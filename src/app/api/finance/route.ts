import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { roundCurrency } from "@/lib/finance-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireRole(["super_admin", "admin", "accountant"]);
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const [{ data: tuition }, { data: income }, { data: expense }] = await Promise.all([
      supabase.from("tuition_payments").select("amount_paid").neq("status", "void"),
      supabase.from("income_entries").select("amount"),
      supabase.from("expense_entries").select("amount"),
    ]);

    const totalTuition = roundCurrency((tuition || []).reduce((acc: number, t: { amount_paid?: number | string }) => acc + (Number(t.amount_paid) || 0), 0));
    const totalIncome = roundCurrency((income || []).reduce((acc: number, i: { amount?: number | string }) => acc + (Number(i.amount) || 0), 0));
    const totalExpense = roundCurrency((expense || []).reduce((acc: number, e: { amount?: number | string }) => acc + (Number(e.amount) || 0), 0));

    // Income entries is the authoritative single ledger for all income including synchronized tuition.
    // If income ledger is empty but tuition exists, use totalTuition; otherwise totalIncome is the total revenue.
    const totalRevenue = totalIncome > 0 ? totalIncome : totalTuition;
    const netBalance = roundCurrency(totalRevenue - totalExpense);

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue,
        totalTuition,
        totalOtherIncome: roundCurrency(Math.max(0, totalRevenue - totalTuition)),
        totalExpense,
        netBalance,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
