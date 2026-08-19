import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { runUnsettledPaymentsScan, reconcileSinglePayment } from "@/lib/payment/reconciliation";

export async function POST(request: Request) {
  try {
    const auth = await requireRole(["super_admin", "admin", "accountant"]);
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const body = await request.json().catch(() => ({}));
    const { order_id, older_than_minutes = 5 } = body;

    if (order_id) {
      const singleRes = await reconcileSinglePayment(supabase, order_id);
      return NextResponse.json(singleRes);
    }

    const report = await runUnsettledPaymentsScan(supabase, older_than_minutes);

    return NextResponse.json({
      success: true,
      data: report,
      message: `Reconciliation scan completed. Scanned: ${report.scannedCount}, Reconciled: ${report.reconciledCount}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
