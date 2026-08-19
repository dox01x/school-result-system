import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { ApiResponse, FinanceSummary } from '@/types/finance';
import { roundCurrency } from '@/lib/finance-utils';

interface FeeRow {
  class_name: string;
  amount: number;
}

interface StudentClassRow {
  id: string;
  classes?: { name: string } | null;
}

function isPaymentVoid(p: any): boolean {
  if (!p) return false;
  if (p.status === 'void') return true;
  if (typeof p.note === 'string' && p.note.startsWith('[VOIDED')) return true;
  if (typeof p.void_reason === 'string' && p.void_reason.length > 0) return true;
  return false;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const monthStr = searchParams.get('month');
    const yearStr = searchParams.get('year');

    if (!monthStr || !yearStr || isNaN(parseInt(monthStr, 10)) || isNaN(parseInt(yearStr, 10))) {
       return NextResponse.json({ success: false, error: "Valid month and year are required" }, { status: 400 });
    }

    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    const [
      tuitionResult,
      incomeResult,
      expenseResult,
      salaryResult,
      staffSalaryResult,
      expectedTuitionResult
    ] = await Promise.all([
      // Fetch tuition payments with lean select and filter void in-memory
      supabase.from('tuition_payments').select('amount_paid, status, note, void_reason, month, fee_details').eq('year', year),
      supabase.from('income_entries').select('amount').match({ month, year }),
      supabase.from('expense_entries').select('amount').match({ month, year }),
      supabase.from('salary_payments').select('net_salary').match({ month, year }),
      (async () => {
        try {
          const res = await supabase.from('staff_salary_payments').select('net_salary').match({ month, year });
          return res.data || [];
        } catch {
          return [];
        }
      })(),

      (async () => {
         const { data: rawFees } = await supabase.from('fee_structure').select('class_name, amount').match({ fee_type: 'tuition', academic_year: yearStr, is_active: true });
         const { data: rawStds } = await supabase.from('students').select('id, classes(name)');
         
         const fees = (rawFees || []) as unknown as FeeRow[];
         const stds = (rawStds || []) as unknown as StudentClassRow[];
         if (fees.length === 0 || stds.length === 0) return 0;
         
         const feeMap = new Map(fees.map((f) => [f.class_name, Number(f.amount)]));
         let expected = 0;
         stds.forEach((s) => {
             const className = s.classes?.name;
             if (className) {
               expected += feeMap.get(className) || 0;
             }
         });
         return roundCurrency(expected);
      })()
    ]);

    const activeTuitions = ((tuitionResult.data || []) as any[]).filter((p) => {
      if (isPaymentVoid(p)) return false;
      if (Number(p.month) === month) return true;
      if (Array.isArray(p.fee_details)) {
        return p.fee_details.some((fd: any) => Number(fd.month) === month);
      }
      return false;
    });
    const tuition_collected = roundCurrency(activeTuitions.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0));

    const sumValues = (arr: unknown[] | null, key: string) => 
      arr ? roundCurrency(arr.reduce((sum: number, item: unknown) => sum + Number((item as Record<string, unknown>)?.[key] || 0), 0)) : 0;

    const total_income = sumValues(incomeResult.data, 'amount');
    const total_expense = sumValues(expenseResult.data, 'amount');
    const salary_paid = roundCurrency(sumValues(salaryResult.data, 'net_salary') + sumValues(staffSalaryResult, 'net_salary'));
    const tuition_due = roundCurrency(Math.max(0, expectedTuitionResult - tuition_collected));
    const net_balance = roundCurrency(total_income - total_expense);

    const summary: FinanceSummary = {
      total_income,
      total_expense,
      net_balance,
      tuition_collected,
      tuition_due,
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
