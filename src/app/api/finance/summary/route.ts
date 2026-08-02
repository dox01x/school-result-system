import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ApiResponse, FinanceSummary } from '@/types/finance';

interface FeeRow {
  class_name: string;
  amount: number;
}

interface StudentClassRow {
  id: string;
  classes?: { name: string } | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthStr = searchParams.get('month');
    const yearStr = searchParams.get('year');

    if (!monthStr || !yearStr || isNaN(parseInt(monthStr)) || isNaN(parseInt(yearStr))) {
       return NextResponse.json({ success: false, error: "Valid month and year are required" }, { status: 400 });
    }

    const month = parseInt(monthStr);
    const year = parseInt(yearStr);

    const supabase = await createServerSupabaseClient();

    // Promises
    const [
      tuitionResult,
      incomeResult,
      expenseResult,
      salaryResult,
      staffSalaryResult,
      expectedTuitionResult
    ] = await Promise.all([
      supabase.from('tuition_payments').select('amount_paid').match({ month, year }),
      supabase.from('income_entries').select('amount').match({ month, year }),
      supabase.from('expense_entries').select('amount').match({ month, year }),
      supabase.from('salary_payments').select('net_salary').match({ month, year }),
      supabase.from('staff_salary_payments').select('net_salary').match({ month, year }),

      (async () => {
         const { data: rawFees } = await supabase.from('fee_structure').select('class_name, amount').match({ fee_type: 'tuition', academic_year: yearStr, is_active: true });
         const { data: rawStds } = await supabase.from('students').select('id, classes!inner(name)');
         
         const fees = (rawFees || []) as unknown as FeeRow[];
         const stds = (rawStds || []) as unknown as StudentClassRow[];
         if (fees.length === 0 || stds.length === 0) return 0;
         
         const feeMap = new Map(fees.map((f) => [f.class_name, f.amount]));
         let expected = 0;
         stds.forEach((s) => {
             const className = s.classes?.name;
             if (className) {
               expected += feeMap.get(className) || 0;
             }
         });
         return expected;
      })()
    ]);

    const sumValues = (arr: unknown[] | null, key: string) => 
      arr ? arr.reduce((sum: number, item: unknown) => sum + Number((item as Record<string, unknown>)?.[key] || 0), 0) : 0;

    const tuition_collected = sumValues(tuitionResult.data, 'amount_paid');
    const total_income = sumValues(incomeResult.data, 'amount');
    const total_expense = sumValues(expenseResult.data, 'amount');
    const salary_paid = sumValues(salaryResult.data, 'net_salary') + sumValues(staffSalaryResult.data, 'net_salary');
    const tuition_due = expectedTuitionResult - tuition_collected;

    const net_balance = total_income - total_expense;

    const summary: FinanceSummary = {
      total_income,
      total_expense,
      net_balance,
      tuition_collected,
      tuition_due: tuition_due > 0 ? tuition_due : 0,
      salary_paid,
      month,
      year
    };

    return NextResponse.json({ success: true, data: summary } as ApiResponse<FinanceSummary>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
