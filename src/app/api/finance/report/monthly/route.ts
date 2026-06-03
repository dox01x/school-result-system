import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ApiResponse, MonthlyReport } from '@/types/finance';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || '');
    const year = parseInt(searchParams.get('year') || '');

    if (!month || !year) {
      return NextResponse.json({ success: false, error: "month and year are required" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // @ts-ignore
    const { data: incomeEntries } = await supabase.from('income_entries').select('category, amount').match({ month, year });
    // @ts-ignore
    const { data: expenseEntries } = await supabase.from('expense_entries').select('category, amount').match({ month, year });
    // @ts-ignore
    const { data: salaryPayments } = await supabase.from('salary_payments').select('staff_type, net_salary').match({ month, year });
    // Fetch ALL tuition payments for this month/year (including fee_type='multiple' which may contain tuition)
    // @ts-ignore
    const { data: tuitionPayments } = await supabase.from('tuition_payments').select('amount_due, amount_paid, fee_type, fee_details').match({ month, year });

    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();

    let total_income = 0;
    let total_expense = 0;

    (incomeEntries || []).forEach((item: any) => {
        incomeMap.set(item.category, (incomeMap.get(item.category) || 0) + Number(item.amount));
        total_income += Number(item.amount);
    });

    (expenseEntries || []).forEach((item: any) => {
        expenseMap.set(item.category, (expenseMap.get(item.category) || 0) + Number(item.amount));
        total_expense += Number(item.amount);
    });

    const income_breakdown = Array.from(incomeMap.entries()).map(([category, amount]) => ({ category, amount }));
    const expense_breakdown = Array.from(expenseMap.entries()).map(([category, amount]) => ({ category, amount }));

    // Calculate theoretical tuition due
    let expectedTotalTuition = 0;
    // @ts-ignore
    const { data: fees } = await supabase.from('fee_structure').select('class_name, amount').match({ fee_type: 'tuition', academic_year: year.toString(), is_active: true });
    // Students table has class_id, not class_name — JOIN with classes table
    // @ts-ignore
    const { data: stds } = await supabase.from('students').select('id, classes!inner(name)');
    
    if (fees && stds) {
      const feeMap = new Map(fees.map((f: any) => [f.class_name, f.amount]));
      stds.forEach((s: any) => {
          const className = s.classes?.name;
          if (className) {
            expectedTotalTuition += feeMap.get(className) || 0;
          }
      });
    }

    // Calculate tuition collected — for multi-fee payments, extract only the tuition portion from fee_details
    let total_collected = 0;
    (tuitionPayments || []).forEach((p: any) => {
      if (p.fee_type === 'tuition') {
        total_collected += Number(p.amount_paid);
      } else if (p.fee_type === 'multiple' && Array.isArray(p.fee_details)) {
        // Sum only tuition-type entries from fee_details
        for (const fd of p.fee_details) {
          if (fd.type === 'tuition') {
            total_collected += Number(fd.amount || 0);
          }
        }
      }
    });
    const total_due = expectedTotalTuition;
    const total_overdue = total_due > total_collected ? total_due - total_collected : 0;
    const collection_rate = total_due > 0 ? (total_collected / total_due) * 100 : 100;

    const tuition_summary = {
      total_due,
      total_collected,
      total_overdue,
      collection_rate: parseFloat(collection_rate.toFixed(2))
    };

    let total_teachers = 0;
    let total_staff = 0;
    let total_paid_salary = 0;

    (salaryPayments || []).forEach((sp: any) => {
      if (sp.staff_type === 'teacher') total_teachers++;
      else total_staff++;
      total_paid_salary += Number(sp.net_salary);
    });

    const salary_summary = {
      total_teachers,
      total_staff,
      total_paid: total_paid_salary
    };

    const net_balance = total_income - total_expense;

    const report: MonthlyReport = {
      month,
      year,
      income_breakdown,
      expense_breakdown,
      tuition_summary,
      salary_summary,
      net_balance
    };

    return NextResponse.json({ success: true, data: report } as ApiResponse<MonthlyReport>);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
