import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { INCOME_ENTRY_COLUMNS } from '@/lib/supabase/select-columns';
import { ApiResponse, IncomeEntry } from '@/types/finance';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const supabase = await createServerSupabaseClient();
    
    // @ts-ignore
    let query = supabase.from('income_entries').select(INCOME_ENTRY_COLUMNS);
    
    if (category) query = query.eq('category', category);
    if (month) query = query.eq('month', parseInt(month));
    if (year) query = query.eq('year', parseInt(year));
    if (from) query = query.gte('income_date', from);
    if (to) query = query.lte('income_date', to);
    
    query = query.order('income_date', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    
    return NextResponse.json({ success: true, data } as ApiResponse<IncomeEntry[]>);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, amount, description, received_from, payment_method, received_by, income_date } = body;
    
    if (!category || typeof amount !== 'number' || !description || !income_date) {
      return NextResponse.json({ success: false, error: "Missing required fields or invalid amount" }, { status: 400 });
    }

    const dateStr = new Date(income_date);
    const month = dateStr.getMonth() + 1;
    const year = dateStr.getFullYear();

    const supabase = await createServerSupabaseClient();
    
    // @ts-ignore
    const { data, error } = await supabase
      .from('income_entries')
      .insert({ category, amount, description, received_from, payment_method, received_by, income_date, academic_year: year.toString(), month, year })
      .select()
      .single();
      
    if (error) throw error;
    return NextResponse.json({ success: true, data } as ApiResponse<IncomeEntry>);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
