import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { EXPENSE_ENTRY_COLUMNS } from '@/lib/supabase/select-columns';
import { ApiResponse, ExpenseEntry } from '@/types/finance';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const supabase = (await createServerSupabaseClient()) as any;
    
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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, amount, description, vendor, payment_method, paid_by, expense_date, receipt_url } = body;
    
    if (!category || typeof amount !== 'number' || !description || !expense_date) {
      return NextResponse.json({ success: false, error: "Missing required fields or invalid amount" }, { status: 400 });
    }

    const dateStr = new Date(expense_date);
    const month = dateStr.getMonth() + 1;
    const year = dateStr.getFullYear();

    const supabase = (await createServerSupabaseClient()) as any;
    
    const { data, error } = await supabase
      .from('expense_entries')
      .insert({ category, amount, description, vendor, payment_method, paid_by, expense_date, receipt_url, month, year })
      .select()
      .single();
      
    if (error) throw error;
    return NextResponse.json({ success: true, data } as ApiResponse<ExpenseEntry>);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
