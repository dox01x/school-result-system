import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ApiResponse } from '@/types/finance';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    if (!dateStr) {
      return NextResponse.json({ success: false, error: "date is required (YYYY-MM-DD)" }, { status: 400 });
    }

    const supabase = (await createServerSupabaseClient()) as any;
    const dateStart = `${dateStr}T00:00:00`;
    const dateEnd = `${dateStr}T23:59:59`;

    // Fetch all tuition payments for this date
    // @ts-ignore
    const { data: tuitionPayments } = await supabase
      .from('tuition_payments')
      .select('receipt_number, amount_paid, payment_method, payment_date, class_name, fee_type, collected_by, students(name)')
      .gte('payment_date', dateStart)
      .lte('payment_date', dateEnd)
      .order('payment_date', { ascending: true });

    // Fetch all income entries for this date
    // @ts-ignore
    const { data: incomeEntries } = await supabase
      .from('income_entries')
      .select('category, amount, description, payment_method, income_date')
      .eq('income_date', dateStr);

    // Fetch all expense entries for this date
    // @ts-ignore
    const { data: expenseEntries } = await supabase
      .from('expense_entries')
      .select('category, amount, description, payment_method, expense_date')
      .eq('expense_date', dateStr);

    // Fetch salary payments for this date
    // @ts-ignore
    const { data: salaryPayments } = await supabase
      .from('salary_payments')
      .select('slip_number, net_salary, payment_method, payment_date, teachers!salary_payments_staff_id_fkey(name)')
      .gte('payment_date', dateStart)
      .lte('payment_date', dateEnd);

    // Fetch staff salary payments for this date
    // @ts-ignore
    const { data: staffSalaryPayments } = await supabase
      .from('staff_salary_payments')
      .select('slip_number, net_salary, payment_method, payment_date, staffs!staff_salary_payments_staff_id_fkey(name)')
      .gte('payment_date', dateStart)
      .lte('payment_date', dateEnd);

    // Calculate totals by payment method
    const methodBreakdown: Record<string, { income: number; expense: number }> = {
      cash: { income: 0, expense: 0 },
      bank: { income: 0, expense: 0 },
      mobile_banking: { income: 0, expense: 0 }
    };

    let totalTuitionCollected = 0;
    let totalOtherIncome = 0;
    let totalExpense = 0;
    let totalSalaryPaid = 0;

    // Tuition is already included in income_entries (auto-inserted), 
    // so we compute from tuition_payments separately for detail display
    (tuitionPayments || []).forEach((p: any) => {
      totalTuitionCollected += Number(p.amount_paid);
      const method = p.payment_method || 'cash';
      if (methodBreakdown[method]) methodBreakdown[method].income += Number(p.amount_paid);
    });

    // Other income: filter out auto-generated tuition entries to avoid double-counting
    // Auto-generated entries from tuition/collect have descriptions starting with "Fees collected"
    (incomeEntries || []).forEach((inc: any) => {
      const desc = (inc.description || '').toLowerCase();
      const isAutoTuition = desc.startsWith('fees collected');
      if (!isAutoTuition) {
        const amt = Number(inc.amount);
        totalOtherIncome += amt;
        const method = inc.payment_method || 'cash';
        if (methodBreakdown[method]) methodBreakdown[method].income += amt;
      }
    });

    (expenseEntries || []).forEach((e: any) => {
      totalExpense += Number(e.amount);
      const method = e.payment_method || 'cash';
      if (methodBreakdown[method]) methodBreakdown[method].expense += Number(e.amount);
    });

    (salaryPayments || []).forEach((s: any) => {
      totalSalaryPaid += Number(s.net_salary);
    });

    (staffSalaryPayments || []).forEach((s: any) => {
      totalSalaryPaid += Number(s.net_salary);
    });

    const totalIncome = totalTuitionCollected + totalOtherIncome;
    const netCashInHand = methodBreakdown.cash.income - methodBreakdown.cash.expense;

    const summary = {
      date: dateStr,
      tuition_collected: totalTuitionCollected,
      tuition_count: tuitionPayments?.length || 0,
      other_income: totalOtherIncome,
      total_expense: totalExpense,
      salary_paid: totalSalaryPaid,
      net_cash_in_hand: netCashInHand,
      method_breakdown: methodBreakdown,
      tuition_payments: (tuitionPayments || []).map((p: any) => ({
        receipt: p.receipt_number,
        student: p.students?.name || 'Unknown',
        class: p.class_name,
        amount: p.amount_paid,
        method: p.payment_method,
        time: p.payment_date
      })),
      expenses: (expenseEntries || []).map((e: any) => ({
        category: e.category,
        amount: e.amount,
        description: e.description,
        method: e.payment_method
      })),
      salary_payments: [
        ...(salaryPayments || []).map((s: any) => ({
          slip: s.slip_number,
          staff: s.teachers?.name || 'Unknown',
          amount: s.net_salary,
          method: s.payment_method
        })),
        ...(staffSalaryPayments || []).map((s: any) => ({
          slip: s.slip_number,
          staff: s.staffs?.name || 'Unknown',
          amount: s.net_salary,
          method: s.payment_method
        }))
      ]
    };

    return NextResponse.json({ success: true, data: summary } as ApiResponse<any>);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
