import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { reconcileSinglePayment } from "@/lib/payment/reconciliation";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const body = await request.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: "order_id is required" }, { status: 400 });
    }

    const result = await reconcileSinglePayment(supabase, order_id);

    return NextResponse.json({
      success: result.success,
      status: result.status,
      message: result.message,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
