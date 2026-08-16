import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { ApiResponse, MonthlyReport } from '@/types/finance';
import { roundCurrency } from '@/lib/finance-utils';

interface CategoryAmountRow {
  category: string;
  amount: number;
}

interface FeeStructureRow {
  class_name: string;
  amount: number;
}

interface StudentClassRow {
  id: string;
  classes?: { name: string } | null;
}

interface TuitionPaymentRow {
  amount_due: number;
  amount_paid: number;
  fee_type: string;
  fee_details?: { type: string; amount?: number }[] | null;
  status?: string;
  note?: string;
  void_reason?: string;
}

interface SalaryPaymentRow {
  net_salary: number;
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
    const month = parseInt(searchParams.get('month') || '', 10);
    const year = parseInt(searchParams.get('year') || '', 10);

    if (!month || !year || isNaN(month) || isNaN(year)) {
      return NextResponse.json({ success: false, error: "Valid month and year are required" }, { status: 400 });
    }

    const [
      incomeRes,
      expenseRes,
      salaryRes,
      staffSalaryRes,
      tuitionRes,
      feesRes,
      stdsRes
    ] = await Promise.all([
      supabase.from('income_entries').select('category, amount').match({ month, year }),
      supabase.from('expense_entries').select('category, amount').match({ month, year }),
      supabase.from('salary_payments').select('net_salary').match({ month, year }),
      (async () => {
        try {
          return await supabase.from('staff_salary_payments').select('net_salary').match({ month, year });
        } catch {
          return { data: [] };
        }
      })(),
      supabase.from('tuition_payments').select('amount_due, amount_paid, fee_type, fee_details, status, note, void_reason').match({ month, year }),
      supabase.from('fee_structure').select('class_name, amount').match({ fee_type: 'tuition', academic_year: year.toString(), is_active: true }),
      supabase.from('students').select('id, classes(name)'),
    ]);

    const incomeEntries = (incomeRes.data || []) as unknown as CategoryAmountRow[];
    const expenseEntries = (expenseRes.data || []) as unknown as CategoryAmountRow[];
    const salaryPayments = (salaryRes.data || []) as unknown as SalaryPaymentRow[];
    const staffSalaryPayments = (staffSalaryRes.data || []) as unknown as SalaryPaymentRow[];
    const tuitionPayments = ((tuitionRes.data || []) as unknown as TuitionPaymentRow[]).filter(p => !isPaymentVoid(p));

    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();

    let total_income = 0;
    let total_expense = 0;

    incomeEntries.forEach((item) => {
        const amt = roundCurrency(item.amount);
        incomeMap.set(item.category, roundCurrency((incomeMap.get(item.category) || 0) + amt));
        total_income = roundCurrency(total_income + amt);
    });

    expenseEntries.forEach((item) => {
        const amt = roundCurrency(item.amount);
        expenseMap.set(item.category, roundCurrency((expenseMap.get(item.category) || 0) + amt));
        total_expense = roundCurrency(total_expense + amt);
    });

    const income_breakdown = Array.from(incomeMap.entries()).map(([category, amount]) => ({ category, amount }));
    const expense_breakdown = Array.from(expenseMap.entries()).map(([category, amount]) => ({ category, amount }));

    // Calculate theoretical tuition due
    let expectedTotalTuition = 0;
    const fees = (feesRes.data || []) as unknown as FeeStructureRow[];
    const stds = (stdsRes.data || []) as unknown as StudentClassRow[];

    if (fees.length > 0 && stds.length > 0) {
      const feeMap = new Map(fees.map((f) => [f.class_name, Number(f.amount)]));
      stds.forEach((s) => {
          const className = s.classes?.name;
          if (className) {
            expectedTotalTuition = roundCurrency(expectedTotalTuition + (feeMap.get(className) || 0));
          }
      });
    }

    // Calculate tuition collected from completed payments
    let total_collected = 0;
    tuitionPayments.forEach((p) => {
      if (p.fee_type === 'tuition') {
        total_collected = roundCurrency(total_collected + Number(p.amount_paid));
      } else if (p.fee_type === 'multiple' && Array.isArray(p.fee_details)) {
        for (const fd of p.fee_details) {
          if (fd.type === 'tuition') {
            total_collected = roundCurrency(total_collected + Number(fd.amount || 0));
          }
        }
      } else {
        total_collected = roundCurrency(total_collected + Number(p.amount_paid));
      }
    });

    const total_due = expectedTotalTuition;
    const total_overdue = total_due > total_collected ? roundCurrency(total_due - total_collected) : 0;
    const collection_rate = total_due > 0 ? parseFloat(((total_collected / total_due) * 100).toFixed(2)) : 100;

    const tuition_summary = {
      total_due,
      total_collected,
      total_overdue,
      collection_rate
    };

    const total_teachers = salaryPayments.length;
    const total_staff = staffSalaryPayments.length;
    let total_paid_salary = 0;

    salaryPayments.forEach((sp) => {
      total_paid_salary = roundCurrency(total_paid_salary + Number(sp.net_salary));
    });

    staffSalaryPayments.forEach((sp) => {
      total_paid_salary = roundCurrency(total_paid_salary + Number(sp.net_salary));
    });

    const salary_summary = {
      total_teachers,
      total_staff,
      total_paid: total_paid_salary
    };

    const net_balance = roundCurrency(total_income - total_expense);

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
