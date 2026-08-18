import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const [{ data: tuition }, { data: income }, { data: expense }] = await Promise.all([
      supabase.from("tuition_payments").select("amount_paid"),
      (supabase as any).from("income_entries").select("amount"),
      (supabase as any).from("expense_entries").select("amount"),
    ]);

    const totalTuition = (tuition || []).reduce((acc: number, t: any) => acc + (Number(t.amount_paid) || 0), 0);
    const totalIncome = (income || []).reduce((acc: number, i: any) => acc + (Number(i.amount) || 0), 0);
    const totalExpense = (expense || []).reduce((acc: number, e: any) => acc + (Number(e.amount) || 0), 0);

    return NextResponse.json({
      data: {
        totalRevenue: totalTuition + totalIncome,
        totalExpense,
        netBalance: totalTuition + totalIncome - totalExpense,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
