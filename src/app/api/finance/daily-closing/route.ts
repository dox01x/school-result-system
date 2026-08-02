import { NextResponse } from 'next/server';
import { ApiResponse } from '@/types/finance';
import { requireAuth } from '@/lib/api-auth';

interface TuitionPaymentRow {
  receipt_number: string;
  amount_paid: number;
  payment_method: string;
  payment_date: string;
  class_name: string;
  fee_type: string;
  collected_by?: string;
  student_name?: string;
  students?: { name: string } | null;
}

interface IncomeEntryRow {
  category: string;
  amount: number;
  description: string;
  payment_method: string;
  income_date: string;
}

interface ExpenseEntryRow {
  category: string;
  amount: number;
  description: string;
  payment_method: string;
  expense_date: string;
}

interface TeacherSalaryRow {
  slip_number: string;
  net_salary: number;
  payment_method: string;
  payment_date: string;
  teachers?: { name: string } | null;
}

interface StaffSalaryRow {
  slip_number: string;
  net_salary: number;
  payment_method: string;
  payment_date: string;
  staffs?: { name: string } | null;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ success: false, error: "date is required (YYYY-MM-DD)" }, { status: 400 });
    }

    const dateStart = `${dateStr}T00:00:00.000Z`;
    const nextDayObj = new Date(dateStr);
    nextDayObj.setDate(nextDayObj.getDate() + 1);
    const nextDayStr = nextDayObj.toISOString().split('T')[0];
    const dateEnd = `${nextDayStr}T00:00:00.000Z`;

    // Fetch all tuition payments for this date
    const { data: rawTuition } = await supabase
      .from('tuition_payments')
      .select('receipt_number, amount_paid, payment_method, payment_date, class_name, fee_type, collected_by, student_name, students(name)')
      .gte('payment_date', dateStart)
      .lt('payment_date', dateEnd)
      .order('payment_date', { ascending: true });

    // Fetch all income entries for this date
    const { data: rawIncome } = await supabase
      .from('income_entries')
      .select('category, amount, description, payment_method, income_date')
      .eq('income_date', dateStr);

    // Fetch all expense entries for this date
    const { data: rawExpense } = await supabase
      .from('expense_entries')
      .select('category, amount, description, payment_method, expense_date')
      .eq('expense_date', dateStr);

    // Fetch salary payments for this date
    const { data: rawSalary } = await supabase
      .from('salary_payments')
      .select('slip_number, net_salary, payment_method, payment_date, teachers!salary_payments_staff_id_fkey(name)')
      .gte('payment_date', dateStart)
      .lt('payment_date', dateEnd);

    // Fetch staff salary payments for this date
    const { data: rawStaffSalary } = await supabase
      .from('staff_salary_payments')
      .select('slip_number, net_salary, payment_method, payment_date, staffs!staff_salary_payments_staff_id_fkey(name)')
      .gte('payment_date', dateStart)
      .lt('payment_date', dateEnd);

    const tuitionPayments = (rawTuition || []) as unknown as TuitionPaymentRow[];
    const incomeEntries = (rawIncome || []) as unknown as IncomeEntryRow[];
    const expenseEntries = (rawExpense || []) as unknown as ExpenseEntryRow[];
    const salaryPayments = (rawSalary || []) as unknown as TeacherSalaryRow[];
    const staffSalaryPayments = (rawStaffSalary || []) as unknown as StaffSalaryRow[];

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

    // Tuition payments
    tuitionPayments.forEach((p) => {
      totalTuitionCollected += Number(p.amount_paid);
      const method = (p.payment_method || 'cash').toLowerCase();
      if (methodBreakdown[method]) methodBreakdown[method].income += Number(p.amount_paid);
    });

    // Other income (filter out auto-generated tuition entries to avoid double-counting)
    incomeEntries.forEach((inc) => {
      const desc = (inc.description || '').toLowerCase();
      const isAutoTuition = desc.startsWith('fees collected');
      if (!isAutoTuition) {
        const amt = Number(inc.amount);
        totalOtherIncome += amt;
        const method = (inc.payment_method || 'cash').toLowerCase();
        if (methodBreakdown[method]) methodBreakdown[method].income += amt;
      }
    });

    // Expenses
    expenseEntries.forEach((e) => {
      totalExpense += Number(e.amount);
      const method = (e.payment_method || 'cash').toLowerCase();
      if (methodBreakdown[method]) methodBreakdown[method].expense += Number(e.amount);
    });

    // Salaries
    salaryPayments.forEach((s) => {
      totalSalaryPaid += Number(s.net_salary);
    });

    staffSalaryPayments.forEach((s) => {
      totalSalaryPaid += Number(s.net_salary);
    });

    const netCashInHand = (methodBreakdown.cash?.income || 0) - (methodBreakdown.cash?.expense || 0);

    // Filter out auto-generated salary entries from general expenses array for display
    const generalExpensesList = expenseEntries
      .filter((e) => {
        const cat = (e.category || '').toLowerCase();
        const desc = (e.description || '').toLowerCase();
        return cat !== 'salary' && !desc.startsWith('salary paid') && !desc.startsWith('staff salary paid');
      })
      .map((e) => ({
        category: e.category,
        amount: e.amount,
        description: e.description,
        method: e.payment_method
      }));

    const summary = {
      date: dateStr,
      tuition_collected: totalTuitionCollected,
      tuition_count: tuitionPayments.length,
      other_income: totalOtherIncome,
      total_expense: totalExpense,
      salary_paid: totalSalaryPaid,
      net_cash_in_hand: netCashInHand,
      method_breakdown: methodBreakdown,
      tuition_payments: tuitionPayments.map((p) => ({
        receipt: p.receipt_number,
        student: p.student_name || p.students?.name || 'Unknown',
        class: p.class_name,
        amount: p.amount_paid,
        method: p.payment_method,
        time: p.payment_date
      })),
      expenses: generalExpensesList,
      salary_payments: [
        ...salaryPayments.map((s) => ({
          slip: s.slip_number,
          staff: s.teachers?.name || 'Unknown',
          amount: s.net_salary,
          method: s.payment_method
        })),
        ...staffSalaryPayments.map((s) => ({
          slip: s.slip_number,
          staff: s.staffs?.name || 'Unknown',
          amount: s.net_salary,
          method: s.payment_method
        }))
      ]
    };

    return NextResponse.json({ success: true, data: summary } as ApiResponse<typeof summary>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
