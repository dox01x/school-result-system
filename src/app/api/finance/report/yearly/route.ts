import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { ApiResponse, YearlyReport } from '@/types/finance';
import { roundCurrency } from '@/lib/finance-utils';

interface EntryRow {
  month: number;
  category: string;
  amount: number;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get('year');

    if (!yearStr || isNaN(parseInt(yearStr, 10))) {
      return NextResponse.json({ success: false, error: "Valid year is required" }, { status: 400 });
    }

    const year = parseInt(yearStr, 10);

    // 1. Fetch Income and Expenses for the year in parallel
    const [incomeRes, expenseRes] = await Promise.all([
      supabase.from('income_entries').select('month, category, amount').eq('year', year),
      supabase.from('expense_entries').select('month, category, amount').eq('year', year),
    ]);

    const incomeEntries = (incomeRes.data || []) as unknown as EntryRow[];
    const expenseEntries = (expenseRes.data || []) as unknown as EntryRow[];

    // 2. Initialize Monthly Aggregation Array
    const monthly_summary = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: 0,
      expense: 0,
      balance: 0
    }));

    const expenseCategoryMap = new Map<string, number>();
    const incomeCategoryMap = new Map<string, number>();

    let total_income = 0;
    let total_expense = 0;

    // 3. Process Income
    incomeEntries.forEach((item) => {
      const monthIdx = Number(item.month) - 1;
      const amt = roundCurrency(item.amount);
      if (monthIdx >= 0 && monthIdx < 12) {
         monthly_summary[monthIdx].income = roundCurrency(monthly_summary[monthIdx].income + amt);
      }
      incomeCategoryMap.set(item.category, roundCurrency((incomeCategoryMap.get(item.category) || 0) + amt));
      total_income = roundCurrency(total_income + amt);
    });

    // 4. Process Expenses
    expenseEntries.forEach((item) => {
      const monthIdx = Number(item.month) - 1;
      const amt = roundCurrency(item.amount);
      if (monthIdx >= 0 && monthIdx < 12) {
         monthly_summary[monthIdx].expense = roundCurrency(monthly_summary[monthIdx].expense + amt);
      }
      expenseCategoryMap.set(item.category, roundCurrency((expenseCategoryMap.get(item.category) || 0) + amt));
      total_expense = roundCurrency(total_expense + amt);
    });

    // 5. Calculate Balance per month
    for (let i = 0; i < 12; i++) {
        monthly_summary[i].balance = roundCurrency(monthly_summary[i].income - monthly_summary[i].expense);
    }

    const net_balance = roundCurrency(total_income - total_expense);

    // 6. Top Categories
    const top_expense_categories = Array.from(expenseCategoryMap.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const top_income_categories = Array.from(incomeCategoryMap.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const report: YearlyReport = {
      year,
      start_balance: 0,
      monthly_summary,
      top_expense_categories,
      top_income_categories,
      total_income,
      total_expense,
      net_balance,
    };

    return NextResponse.json({ success: true, data: report } as ApiResponse<YearlyReport>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
