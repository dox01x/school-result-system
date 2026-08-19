/**
 * Financial Reconciliation & Background Verification Service
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { PaymentGatewayManager } from "./gateway-manager";
import { assertValidTransition } from "./state-machine";
import { generateReceiptNumber, roundCurrency } from "../finance-utils";

export interface ReconciliationReport {
  scannedCount: number;
  reconciledCount: number;
  mismatchCount: number;
  details: {
    order_id: string;
    previous_status: string;
    resolved_status: string;
    action_taken: string;
  }[];
}

/**
 * Reconciles a single payment order against the authoritative gateway API.
 */
export async function reconcileSinglePayment(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ success: boolean; status: string; message: string }> {
  // 1. Fetch order
  const { data: order, error: orderErr } = await (supabase as any)
    .from("payment_orders")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (orderErr || !order) {
    return { success: false, status: "UNKNOWN", message: "Payment order not found" };
  }

  if (order.status === "SUCCESS" || order.status === "REFUNDED") {
    return { success: true, status: order.status, message: "Order is already in final settled state" };
  }

  // 2. Query gateway status
  const gatewayInfo = PaymentGatewayManager.resolveGateway(order.gateway);
  const paymentId = order.gateway_payment_id || order.gateway_transaction_id;

  if (!paymentId) {
    return { success: false, status: order.status, message: "No gateway identifier on record" };
  }

  const queryRes = await (gatewayInfo.adapter as any).queryPayment(paymentId);

  if (!queryRes || queryRes.status === "VERIFICATION_REQUIRED") {
    return { success: false, status: "VERIFICATION_REQUIRED", message: "Gateway query timed out" };
  }

  if (queryRes.status === "SUCCESS" && queryRes.verified) {
    assertValidTransition(order.status, "SUCCESS");

    // Check if tuition payment already created
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
          payment_date: queryRes.payment_time || new Date().toISOString(),
          status: "completed",
          note: `[Reconciled via ${order.gateway}] ${order.note || ""}`.trim(),
        })
        .select("id")
        .single();

      if (!tpErr && tuitionPayment) {
        tuitionId = tuitionPayment.id;

        // Insert synchronized income entry
        await (supabase as any).from("income_entries").insert({
          category: order.fee_type === "tuition" ? "tuition" : "other",
          amount: order.amount_paid,
          description: `Fees collected (${order.fee_type}) - Reconciled Receipt: ${receiptNo}`,
          received_from: order.student_id,
          payment_method: order.payment_method,
          income_date: new Date().toISOString().split("T")[0],
          academic_year: order.year.toString(),
          month: order.month || new Date().getMonth() + 1,
          year: order.year,
          reference_type: "tuition_payment",
          reference_id: tuitionId,
        });
      }
    }

    // Update order status
    await (supabase as any)
      .from("payment_orders")
      .update({
        status: "SUCCESS",
        gateway_transaction_id: queryRes.gateway_transaction_id || order.gateway_transaction_id,
        tuition_payment_id: tuitionId,
        completed_at: queryRes.payment_time || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    // Audit log
    await (supabase as any).from("finance_audit_logs").insert({
      action: "RECONCILE_PAYMENT_SUCCESS",
      target_table: "payment_orders",
      target_id: order.id,
      details: {
        order_id: orderId,
        gateway: order.gateway,
        trx_id: queryRes.gateway_transaction_id,
        amount: order.amount_paid,
      },
    });

    return {
      success: true,
      status: "SUCCESS",
      message: `Reconciled successfully. Transaction: ${queryRes.gateway_transaction_id}`,
    };
  }

  if (queryRes.status === "FAILED") {
    await (supabase as any)
      .from("payment_orders")
      .update({
        status: "FAILED",
        failure_reason: queryRes.message || "Payment declined at gateway",
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    return { success: true, status: "FAILED", message: "Order marked as failed based on gateway status" };
  }

  return { success: true, status: order.status, message: "Order remains pending at gateway" };
}

/**
 * Scans unsettled payments and reconciles with gateway.
 */
export async function runUnsettledPaymentsScan(
  supabase: SupabaseClient,
  olderThanMinutes: number = 5
): Promise<ReconciliationReport> {
  const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();

  const { data: unsettledOrders, error } = await (supabase as any)
    .from("payment_orders")
    .select("order_id, status, gateway, created_at")
    .in("status", ["PENDING", "PROCESSING", "VERIFICATION_REQUIRED", "INITIATED"])
    .lte("created_at", threshold)
    .neq("gateway", "counter")
    .limit(50);

  const report: ReconciliationReport = {
    scannedCount: unsettledOrders ? unsettledOrders.length : 0,
    reconciledCount: 0,
    mismatchCount: 0,
    details: [],
  };

  if (error || !unsettledOrders || unsettledOrders.length === 0) {
    return report;
  }

  for (const order of unsettledOrders) {
    try {
      const res = await reconcileSinglePayment(supabase, order.order_id);
      if (res.status === "SUCCESS") {
        report.reconciledCount++;
        report.details.push({
          order_id: order.order_id,
          previous_status: order.status,
          resolved_status: res.status,
          action_taken: res.message,
        });
      } else if (res.status === "FAILED") {
        report.details.push({
          order_id: order.order_id,
          previous_status: order.status,
          resolved_status: res.status,
          action_taken: "Marked as FAILED",
        });
      }
    } catch (err: any) {
      report.mismatchCount++;
      report.details.push({
        order_id: order.order_id,
        previous_status: order.status,
        resolved_status: "ERROR",
        action_taken: err?.message || "Reconciliation failed",
      });
    }
  }

  return report;
}
