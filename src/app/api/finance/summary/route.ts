import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ApiResponse, FinanceSummary } from '@/types/finance';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthStr = searchParams.get('month');
    const yearStr = searchParams.get('year');

    if (!monthStr || !yearStr) {
       return NextResponse.json({ success: false, error: "month and year are required" }, { status: 400 });
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
      // @ts-ignore
      supabase.from('tuition_payments').select('amount_paid').match({ month, year }),
      // @ts-ignore
      supabase.from('income_entries').select('amount').match({ month, year }),
      // @ts-ignore
      supabase.from('expense_entries').select('amount').match({ month, year }),
      // @ts-ignore
      supabase.from('salary_payments').select('net_salary').match({ month, year }),
      // @ts-ignore
      supabase.from('staff_salary_payments').select('net_salary').match({ month, year }),

      // Calculate expected tuition: students table has class_id, not class_name.
      // We must join students → classes → fee_structure by class name.
      (async () => {
         // @ts-ignore
         const { data: fees } = await supabase.from('fee_structure').select('class_name, amount').match({ fee_type: 'tuition', academic_year: yearStr, is_active: true });
         // Students table has class_id → join with classes to get name
         // @ts-ignore
         const { data: stds } = await supabase.from('students').select('id, classes!inner(name)');
         
         if (!fees || !stds) return 0;
         
         const feeMap = new Map(fees.map((f: any) => [f.class_name, f.amount]));
         let expected = 0;
         stds.forEach((s: any) => {
             const className = s.classes?.name;
             if (className) {
               expected += feeMap.get(className) || 0;
             }
         });
         return expected;
      })()
    ]);

    const sumValues = (arr: any[] | null, key: string) => arr ? arr.reduce((sum, item) => sum + Number(item[key] || 0), 0) : 0;

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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
