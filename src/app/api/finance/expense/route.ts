import { NextResponse } from 'next/server';
import { EXPENSE_ENTRY_COLUMNS } from '@/lib/supabase/select-columns';
import { ApiResponse, ExpenseEntry } from '@/types/finance';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = supabase.from('expense_entries').select(EXPENSE_ENTRY_COLUMNS);

    if (category) query = query.eq('category', category);
    if (month) query = query.eq('month', parseInt(month));
    if (year) query = query.eq('year', parseInt(year));
    if (from) query = query.gte('expense_date', from);
    if (to) query = query.lte('expense_date', to);

    query = query.order('expense_date', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data } as ApiResponse<ExpenseEntry[]>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const body = await request.json();
    const { category, amount, description, vendor, payment_method, paid_by, expense_date, receipt_url } = body;

    if (!category || typeof amount !== 'number' || amount <= 0 || !description || !expense_date) {
      return NextResponse.json({ success: false, error: "Missing required fields or invalid positive amount" }, { status: 400 });
    }

    const dateObj = new Date(expense_date);
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid expense_date format" }, { status: 400 });
    }

    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();

    const { data, error } = await supabase
      .from('expense_entries')
      .insert({ category, amount, description, vendor, payment_method, paid_by, expense_date, receipt_url, month, year })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data } as ApiResponse<ExpenseEntry>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
