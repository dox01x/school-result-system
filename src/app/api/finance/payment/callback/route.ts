import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { reconcileSinglePayment } from "@/lib/payment/reconciliation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get("paymentID");
  const orderId = url.searchParams.get("orderID") || url.searchParams.get("tran_id");
  const statusParam = url.searchParams.get("status") || "unknown";

  const supabase = await createServerSupabaseClient();

  if (orderId) {
    try {
      // Execute server-to-server reconciliation
      await reconcileSinglePayment(supabase, orderId);
    } catch (e) {
      console.warn("Callback reconciliation attempt warning:", e);
    }
    return NextResponse.redirect(
      new URL(`/finance/payments?order_id=${encodeURIComponent(orderId)}&status=${encodeURIComponent(statusParam)}`, url.origin)
    );
  }

  return NextResponse.redirect(new URL("/finance/payments", url.origin));
}

export async function POST(request: Request) {
  return GET(request);
}
