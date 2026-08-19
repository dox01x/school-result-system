import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaymentGatewayManager } from "@/lib/payment/gateway-manager";
import { assertValidTransition } from "@/lib/payment/state-machine";
import { generateReceiptNumber } from "@/lib/finance-utils";
import { sendPaymentConfirmationSms } from "@/lib/sms-gateway";

export async function POST(request: Request) {
  const supabase = createAdminClient();

  try {
    const { searchParams } = new URL(request.url);
    const gatewayParam = searchParams.get("gateway") || "mock_sandbox";
    const signatureHeader = request.headers.get("x-signature") || request.headers.get("signature");

    let payload: Record<string, any>;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries());
    } else {
      payload = await request.json();
    }

    const gatewayInfo = PaymentGatewayManager.resolveGateway(gatewayParam);
    const adapter = gatewayInfo.adapter as any;

    // 1. Validate Webhook Authenticity & Deduplication
    const valResult = await adapter.verifyWebhook(payload, signatureHeader);

    if (!valResult.is_valid) {
      console.warn("[Webhook Security Alert] Invalid webhook signature or payload:", valResult.error);
      return NextResponse.json({ success: false, error: "Invalid signature or verification failed" }, { status: 401 });
    }

    const eventId = valResult.event_id || `evt_${Date.now()}`;

    // 2. Check Event Deduplication
    const { data: existingEvent } = await (supabase as any)
      .from("payment_webhook_events")
      .select("id, processed")
      .match({ gateway: gatewayParam, event_id: eventId })
      .maybeSingle();

    if (existingEvent && existingEvent.processed) {
      // Return 200 OK to stop gateway retries
      return NextResponse.json({ success: true, message: "Event already processed (idempotent)" });
    }

    // 3. Record Webhook Event
    await (supabase as any).from("payment_webhook_events").upsert({
      gateway: gatewayParam,
      event_id: eventId,
      event_type: valResult.event_type || "PAYMENT_EVENT",
      payload,
      signature: signatureHeader || null,
      processed: false,
    });

    const orderId = valResult.order_id;
    if (!orderId) {
      return NextResponse.json({ success: false, error: "Missing order_id in webhook" }, { status: 400 });
    }

    // 4. Fetch Payment Order
    const { data: order, error: orderErr } = await (supabase as any)
      .from("payment_orders")
      .select("*")
      .eq("order_id", orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: "Payment order not found" }, { status: 404 });
    }

    // 5. Apply State Machine Transition
    if (valResult.status === "SUCCESS") {
      assertValidTransition(order.status, "SUCCESS");

      let tuitionId = order.tuition_payment_id;

      if (!tuitionId) {
        const receiptNo = await generateReceiptNumber(supabase, order.year);

        const { data: tuitionPayment, error: tpErr } = await (supabase as any)
          .from("tuition_payments")
          .insert({
            receipt_number: receiptNo,
            student_id: order.student_id,
            class_name: order.class_name,
            section: order.section,
            fee_type: order.fee_type,
            fee_details: order.fee_details,
            month: order.month,
            year: order.year,
            amount_due: order.amount_due,
            amount_paid: order.amount_paid,
            discount: order.discount,
            fine: order.fine,
            payment_method: order.payment_method,
            collected_by: order.collected_by || null,
            payment_date: new Date().toISOString(),
            status: "completed",
            note: `[Verified via ${gatewayParam} Webhook] ${order.note || ""}`.trim(),
          })
          .select("id")
          .single();

        if (!tpErr && tuitionPayment) {
          tuitionId = tuitionPayment.id;

          // Synchronize income entry
          await (supabase as any).from("income_entries").insert({
            category: order.fee_type === "tuition" ? "tuition" : "other",
            amount: order.amount_paid,
            description: `Fees collected (${order.fee_type}) - Webhook Receipt: ${receiptNo}`,
            received_from: order.student_id,
            payment_method: order.payment_method,
            income_date: new Date().toISOString().split("T")[0],
            academic_year: order.year.toString(),
            month: order.month || new Date().getMonth() + 1,
            year: order.year,
            reference_type: "tuition_payment",
            reference_id: tuitionId,
          });

          // Non-blocking SMS notification
          try {
            const { data: student } = await supabase
              .from("students")
              .select("name, phone")
              .eq("id", order.student_id)
              .single();

            const { data: schoolInfo } = await supabase
              .from("school_info")
              .select("name")
              .limit(1)
              .maybeSingle();

            if (student?.phone) {
              sendPaymentConfirmationSms({
                phone: student.phone,
                studentName: student.name,
                amount: order.amount_paid,
                receiptNumber: receiptNo,
                schoolName: schoolInfo?.name,
              }).catch(() => {});
            }
          } catch {
            // Non-blocking
          }
        }
      }

      await (supabase as any)
        .from("payment_orders")
        .update({
          status: "SUCCESS",
          gateway_transaction_id: valResult.gateway_transaction_id || order.gateway_transaction_id,
          tuition_payment_id: tuitionId,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
    } else if (valResult.status === "FAILED") {
      await (supabase as any)
        .from("payment_orders")
        .update({
          status: "FAILED",
          failure_reason: valResult.error || "Payment declined at gateway",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
    }

    // 6. Mark Webhook Event as Processed
    await (supabase as any)
      .from("payment_webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .match({ gateway: gatewayParam, event_id: eventId });

    // 7. Audit log
    await (supabase as any).from("finance_audit_logs").insert({
      action: `WEBHOOK_PAYMENT_${valResult.status}`,
      target_table: "payment_orders",
      target_id: order.id,
      details: {
        order_id: orderId,
        gateway: gatewayParam,
        event_id: eventId,
        status: valResult.status,
      },
    });

    return NextResponse.json({ success: true, message: "Webhook processed successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Webhook processing error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
