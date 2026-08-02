import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ApiResponse, MonthlyReport } from '@/types/finance';

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
}

interface SalaryPaymentRow {
  net_salary: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || '');
    const year = parseInt(searchParams.get('year') || '');

    if (!month || !year || isNaN(month) || isNaN(year)) {
      return NextResponse.json({ success: false, error: "Valid month and year are required" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    const { data: rawIncome } = await supabase.from('income_entries').select('category, amount').match({ month, year });
    const { data: rawExpense } = await supabase.from('expense_entries').select('category, amount').match({ month, year });
    const { data: rawSalary } = await supabase.from('salary_payments').select('net_salary').match({ month, year });
    const { data: rawStaffSalary } = await supabase.from('staff_salary_payments').select('net_salary').match({ month, year });
    const { data: rawTuition } = await supabase.from('tuition_payments').select('amount_due, amount_paid, fee_type, fee_details').match({ month, year });

    const incomeEntries = (rawIncome || []) as unknown as CategoryAmountRow[];
    const expenseEntries = (rawExpense || []) as unknown as CategoryAmountRow[];
    const salaryPayments = (rawSalary || []) as unknown as SalaryPaymentRow[];
    const staffSalaryPayments = (rawStaffSalary || []) as unknown as SalaryPaymentRow[];
    const tuitionPayments = (rawTuition || []) as unknown as TuitionPaymentRow[];

    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();

    let total_income = 0;
    let total_expense = 0;

    incomeEntries.forEach((item) => {
        incomeMap.set(item.category, (incomeMap.get(item.category) || 0) + Number(item.amount));
        total_income += Number(item.amount);
    });

    expenseEntries.forEach((item) => {
        expenseMap.set(item.category, (expenseMap.get(item.category) || 0) + Number(item.amount));
        total_expense += Number(item.amount);
    });

    const income_breakdown = Array.from(incomeMap.entries()).map(([category, amount]) => ({ category, amount }));
    const expense_breakdown = Array.from(expenseMap.entries()).map(([category, amount]) => ({ category, amount }));

    // Calculate theoretical tuition due
    let expectedTotalTuition = 0;
    const { data: rawFees } = await supabase.from('fee_structure').select('class_name, amount').match({ fee_type: 'tuition', academic_year: year.toString(), is_active: true });
    const { data: rawStds } = await supabase.from('students').select('id, classes!inner(name)');
    
    const fees = (rawFees || []) as unknown as FeeStructureRow[];
    const stds = (rawStds || []) as unknown as StudentClassRow[];

    if (fees.length > 0 && stds.length > 0) {
      const feeMap = new Map(fees.map((f) => [f.class_name, f.amount]));
      stds.forEach((s) => {
          const className = s.classes?.name;
          if (className) {
            expectedTotalTuition += feeMap.get(className) || 0;
          }
      });
    }

    // Calculate tuition collected — for multi-fee payments, extract only the tuition portion from fee_details
    let total_collected = 0;
    tuitionPayments.forEach((p) => {
      if (p.fee_type === 'tuition') {
        total_collected += Number(p.amount_paid);
      } else if (p.fee_type === 'multiple' && Array.isArray(p.fee_details)) {
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

    const total_teachers = salaryPayments.length;
    const total_staff = staffSalaryPayments.length;
    let total_paid_salary = 0;

    salaryPayments.forEach((sp) => {
      total_paid_salary += Number(sp.net_salary);
    });

    staffSalaryPayments.forEach((sp) => {
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
