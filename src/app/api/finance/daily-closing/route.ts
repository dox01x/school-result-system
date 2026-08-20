import { NextResponse } from 'next/server';
import { ApiResponse } from '@/types/finance';
import { requireRole } from '@/lib/api-auth';
import { roundCurrency } from '@/lib/finance-utils';

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
  status?: string;
  note?: string;
  void_reason?: string;
}

interface IncomeEntryRow {
  category: string;
  amount: number;
  description: string;
  payment_method: string;
  income_date: string;
  reference_type?: string;
}

interface ExpenseEntryRow {
  category: string;
  amount: number;
  description: string;
  payment_method: string;
  expense_date: string;
  reference_type?: string;
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

function isPaymentVoid(p: any): boolean {
  if (!p) return false;
  if (p.status === 'void') return true;
  if (typeof p.note === 'string' && p.note.startsWith('[VOIDED')) return true;
  if (typeof p.void_reason === 'string' && p.void_reason.length > 0) return true;
  return false;
}

export async function GET(request: Request) {
  try {
    const auth = await requireRole(['super_admin', 'admin', 'accountant']);
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ success: false, error: "date is required (YYYY-MM-DD)" }, { status: 400 });
    }

    const dateStart = `${dateStr}T00:00:00.000Z`;
    const [y, m, d] = dateStr.split('-').map(Number);
    const nextDayStr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().split('T')[0];
    const dateEnd = `${nextDayStr}T00:00:00.000Z`;

    // 1. Fetch tuition payments for this date (and filter void in-memory)
    const { data: rawTuition } = await supabase
      .from('tuition_payments')
      .select('*')
      .gte('payment_date', dateStart)
      .lt('payment_date', dateEnd)
      .order('payment_date', { ascending: true });

    // 2. Fetch other income entries (excluding auto-generated tuition entries)
    const { data: rawIncome } = await supabase
      .from('income_entries')
      .select('*')
      .eq('income_date', dateStr);

    // 3. Fetch general expense entries (excluding auto-generated salary entries)
    const { data: rawExpense } = await supabase
      .from('expense_entries')
      .select('*')
      .eq('expense_date', dateStr);

    // 4. Fetch teacher salary payments for this date
    const { data: rawSalary } = await supabase
      .from('salary_payments')
      .select('slip_number, net_salary, payment_method, payment_date, teachers(name)')
      .gte('payment_date', dateStart)
      .lt('payment_date', dateEnd);

    // 5. Fetch staff salary payments for this date
    let rawStaffSalary: any[] = [];
    try {
      const { data } = await supabase
        .from('staff_salary_payments')
        .select('slip_number, net_salary, payment_method, payment_date, staffs(name)')
        .gte('payment_date', dateStart)
        .lt('payment_date', dateEnd);
      rawStaffSalary = data || [];
    } catch {
      // ignore
    }

    const tuitionPayments = ((rawTuition || []) as unknown as TuitionPaymentRow[]).filter(p => !isPaymentVoid(p));
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
    let totalGeneralExpense = 0;
    let totalSalaryPaid = 0;

    // Process Tuition collections
    tuitionPayments.forEach((p) => {
      const amt = roundCurrency(p.amount_paid);
      totalTuitionCollected = roundCurrency(totalTuitionCollected + amt);
      const method = (p.payment_method || 'cash').toLowerCase();
      if (methodBreakdown[method]) {
        methodBreakdown[method].income = roundCurrency(methodBreakdown[method].income + amt);
      }
    });

    // Process Other Income (excluding auto-tuition)
    const otherIncomeList: { category: string; amount: number; description: string; method: string }[] = [];
    incomeEntries.forEach((inc) => {
      const isAutoTuition = inc.reference_type === 'tuition_payment' || (inc.description || '').toLowerCase().startsWith('fees collected');
      if (!isAutoTuition) {
        const amt = roundCurrency(inc.amount);
        totalOtherIncome = roundCurrency(totalOtherIncome + amt);
        const method = (inc.payment_method || 'cash').toLowerCase();
        if (methodBreakdown[method]) {
          methodBreakdown[method].income = roundCurrency(methodBreakdown[method].income + amt);
        }
        otherIncomeList.push({
          category: inc.category,
          amount: amt,
          description: inc.description,
          method: inc.payment_method
        });
      }
    });

    // Process Salaries
    salaryPayments.forEach((s) => {
      const amt = roundCurrency(s.net_salary);
      totalSalaryPaid = roundCurrency(totalSalaryPaid + amt);
      const method = (s.payment_method || 'cash').toLowerCase();
      if (methodBreakdown[method]) {
        methodBreakdown[method].expense = roundCurrency(methodBreakdown[method].expense + amt);
      }
    });

    staffSalaryPayments.forEach((s) => {
      const amt = roundCurrency(s.net_salary);
      totalSalaryPaid = roundCurrency(totalSalaryPaid + amt);
      const method = (s.payment_method || 'cash').toLowerCase();
      if (methodBreakdown[method]) {
        methodBreakdown[method].expense = roundCurrency(methodBreakdown[method].expense + amt);
      }
    });

    // Process General Expenses (excluding auto-salaries)
    const generalExpensesList: { category: string; amount: number; description: string; method: string }[] = [];
    expenseEntries.forEach((e) => {
      const isAutoSalary = e.reference_type === 'salary_payment' || 
                           e.reference_type === 'staff_salary_payment' || 
                           (e.description || '').toLowerCase().startsWith('salary paid') ||
                           (e.description || '').toLowerCase().startsWith('staff salary paid');
      if (!isAutoSalary) {
        const amt = roundCurrency(e.amount);
        totalGeneralExpense = roundCurrency(totalGeneralExpense + amt);
        const method = (e.payment_method || 'cash').toLowerCase();
        if (methodBreakdown[method]) {
          methodBreakdown[method].expense = roundCurrency(methodBreakdown[method].expense + amt);
        }
        generalExpensesList.push({
          category: e.category,
          amount: amt,
          description: e.description,
          method: e.payment_method
        });
      }
    });

    const totalIncome = roundCurrency(totalTuitionCollected + totalOtherIncome);
    const totalExpense = roundCurrency(totalGeneralExpense + totalSalaryPaid);
    const netCashInHand = roundCurrency((methodBreakdown.cash?.income || 0) - (methodBreakdown.cash?.expense || 0));

    const summary = {
      date: dateStr,
      tuition_collected: totalTuitionCollected,
      tuition_count: tuitionPayments.length,
      other_income: totalOtherIncome,
      total_income: totalIncome,
      total_expense: totalExpense,
      general_expense: totalGeneralExpense,
      salary_paid: totalSalaryPaid,
      net_cash_in_hand: netCashInHand,
      method_breakdown: methodBreakdown,
      tuition_payments: tuitionPayments.map((p) => ({
        receipt: p.receipt_number,
        student: p.student_name || p.students?.name || 'Student',
        class: p.class_name,
        amount: p.amount_paid,
        method: p.payment_method,
        time: p.payment_date
      })),
      other_income_entries: otherIncomeList,
      expenses: generalExpensesList,
      salary_payments: [
        ...salaryPayments.map((s) => ({
          slip: s.slip_number,
          staff: s.teachers?.name || 'Teacher',
          amount: s.net_salary,
          method: s.payment_method
        })),
        ...staffSalaryPayments.map((s) => ({
          slip: s.slip_number,
          staff: s.staffs?.name || 'Staff',
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
