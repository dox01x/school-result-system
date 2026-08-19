import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { PaymentGatewayManager } from "@/lib/payment/gateway-manager";
import { assertValidTransition } from "@/lib/payment/state-machine";
import {
  acquireIdempotencyLock,
  completeIdempotencyLock,
  releaseIdempotencyLock,
} from "@/lib/payment/idempotency";
import { roundCurrency } from "@/lib/finance-utils";

export async function POST(request: Request) {
  let idempotencyKey: string | null = null;
  let authContext: any = null;

  try {
    const auth = await requireRole(["super_admin", "admin", "accountant"]);
    if (auth instanceof NextResponse) return auth;
    authContext = auth;
    const { user, supabase } = auth;

    idempotencyKey = request.headers.get("Idempotency-Key") || null;
    const body = await request.json();
    const { payment_order_id, tuition_payment_id, amount, reason } = body;

    const parsedAmount = roundCurrency(amount);

    if ((!payment_order_id && !tuition_payment_id) || parsedAmount <= 0 || !reason || reason.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: "payment identifier, valid positive amount, and reason (min 3 chars) are required" },
        { status: 400 }
      );
    }

    // 1. Idempotency Check & Lock
    if (idempotencyKey) {
      const lock = await acquireIdempotencyLock(supabase, idempotencyKey, "payment_refund", body, user.id);
      if (lock.isDuplicate) {
        if (lock.inProgress) {
          return NextResponse.json({ success: false, error: "Refund request already processing" }, { status: 409 });
        }
        if (lock.cachedResponse) {
          return NextResponse.json(lock.cachedResponse.body, { status: lock.cachedResponse.status });
        }
      }
    }

    // 2. Fetch Payment Record
    let tuitionPayment: any = null;
    let paymentOrder: any = null;

    if (tuition_payment_id) {
      const { data: tp } = await supabase.from("tuition_payments").select("*").eq("id", tuition_payment_id).single();
      tuitionPayment = tp;
    }

    if (payment_order_id) {
      const { data: po } = await (supabase as any).from("payment_orders").select("*").eq("id", payment_order_id).single();
      paymentOrder = po;
    } else if (tuitionPayment?.id) {
      const { data: po } = await (supabase as any)
        .from("payment_orders")
        .select("*")
        .eq("tuition_payment_id", tuitionPayment.id)
        .maybeSingle();
      paymentOrder = po;
    }

    const paidAmount = roundCurrency(tuitionPayment?.amount_paid || paymentOrder?.amount_paid || 0);

    if (paidAmount <= 0) {
      if (idempotencyKey) await releaseIdempotencyLock(supabase, idempotencyKey);
      return NextResponse.json({ success: false, error: "Target payment record not found or has 0 paid amount" }, { status: 404 });
    }

    // 3. Fetch Previous Refunds to Check Cumulative Limit
    const { data: previousRefunds } = await (supabase as any)
      .from("payment_refunds")
      .select("amount")
      .or(`tuition_payment_id.eq.${tuitionPayment?.id || "00000000-0000-0000-0000-000000000000"},payment_order_id.eq.${paymentOrder?.id || "00000000-0000-0000-0000-000000000000"}`)
      .eq("status", "COMPLETED");

    const totalPreviouslyRefunded = (previousRefunds || []).reduce(
      (sum: number, r: any) => roundCurrency(sum + Number(r.amount || 0)),
      0
    );

    const remainingRefundable = roundCurrency(paidAmount - totalPreviouslyRefunded);

    if (parsedAmount > remainingRefundable) {
      if (idempotencyKey) await releaseIdempotencyLock(supabase, idempotencyKey);
      return NextResponse.json(
        {
          success: false,
          error: `Requested refund (${parsedAmount} TK) exceeds remaining refundable balance (${remainingRefundable} TK). Previously refunded: ${totalPreviouslyRefunded} TK.`,
        },
        { status: 400 }
      );
    }

    // 4. Process Gateway Refund if Online
    let gatewayRefundResult: any = null;
    const gateway = paymentOrder?.gateway || "counter";

    if (gateway !== "counter" && paymentOrder?.gateway_payment_id) {
      const gatewayInfo = PaymentGatewayManager.resolveGateway(gateway);
      gatewayRefundResult = await (gatewayInfo.adapter as any).refundPayment(
        paymentOrder.gateway_payment_id,
        paymentOrder.gateway_transaction_id || "",
        {
          amount: parsedAmount,
          reason: reason.trim(),
          payment_order_id: paymentOrder.id,
          tuition_payment_id: tuitionPayment?.id,
        }
      );

      if (!gatewayRefundResult.success) {
        if (idempotencyKey) await releaseIdempotencyLock(supabase, idempotencyKey);
        return NextResponse.json(
          { success: false, error: gatewayRefundResult.message || "Gateway refund rejected" },
          { status: 502 }
        );
      }
    }

    // 5. Insert Refund Record
    const refundId = `REF-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: insertedRefund, error: refundErr } = await (supabase as any)
      .from("payment_refunds")
      .insert({
        refund_id: refundId,
        payment_order_id: paymentOrder?.id || null,
        tuition_payment_id: tuitionPayment?.id || null,
        amount: parsedAmount,
        reason: reason.trim(),
        gateway,
        gateway_refund_id: gatewayRefundResult?.gateway_refund_id || null,
        gateway_response: gatewayRefundResult?.raw_response || null,
        status: "COMPLETED",
        refunded_by: user.id,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (refundErr) {
      if (idempotencyKey) await releaseIdempotencyLock(supabase, idempotencyKey);
      return NextResponse.json({ success: false, error: refundErr.message || "Failed to record refund" }, { status: 500 });
    }

    // 6. Update Statuses in Database
    const newTotalRefunded = roundCurrency(totalPreviouslyRefunded + parsedAmount);
    const isFullRefund = newTotalRefunded >= paidAmount;
    const targetStatus = isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";

    if (paymentOrder?.id) {
      assertValidTransition(paymentOrder.status, targetStatus as any);
      await (supabase as any)
        .from("payment_orders")
        .update({
          status: targetStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentOrder.id);
    }

    if (tuitionPayment?.id) {
      await (supabase as any)
        .from("tuition_payments")
        .update({
          status: isFullRefund ? "refunded" : "completed",
          void_reason: `[Refunded ${parsedAmount} TK - Reason: ${reason.trim()}]`,
        })
        .eq("id", tuitionPayment.id);

      // Add expense reversal or adjust income
      await (supabase as any).from("expense_entries").insert({
        category: "other",
        amount: parsedAmount,
        description: `Fee Refund (${reason.trim()}) - Receipt: ${tuitionPayment.receipt_number}`,
        payment_method: tuitionPayment.payment_method || "cash",
        paid_by: user.id,
        expense_date: new Date().toISOString().split("T")[0],
        reference_type: "tuition_payment",
        reference_id: tuitionPayment.id,
      });
    }

    // 7. Audit Log
    await (supabase as any).from("finance_audit_logs").insert({
      actor_id: user.id,
      actor_name: user.email || "Staff",
      action: "PROCESS_PAYMENT_REFUND",
      target_table: "payment_refunds",
      target_id: insertedRefund.id,
      details: {
        refund_id: refundId,
        amount: parsedAmount,
        reason: reason.trim(),
        is_full_refund: isFullRefund,
        gateway,
      },
    });

    const responsePayload = {
      success: true,
      data: insertedRefund,
      message: `Refund of ${parsedAmount} TK processed successfully (${isFullRefund ? "Full Refund" : "Partial Refund"}).`,
    };

    if (idempotencyKey) {
      await completeIdempotencyLock(supabase, idempotencyKey, 200, responsePayload);
    }

    return NextResponse.json(responsePayload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (idempotencyKey && authContext?.supabase) {
      await releaseIdempotencyLock(authContext.supabase, idempotencyKey);
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
