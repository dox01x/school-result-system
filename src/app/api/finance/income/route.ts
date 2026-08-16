import { NextResponse } from 'next/server';
import { ApiResponse, IncomeEntry } from '@/types/finance';
import { requireAuth, requireRole } from '@/lib/api-auth';
import { roundCurrency } from '@/lib/finance-utils';

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
    const type = searchParams.get('type');

    let query = supabase.from('income_entries').select('*');

    if (category) query = query.eq('category', category);
    if (month) query = query.eq('month', parseInt(month, 10));
    if (year) query = query.eq('year', parseInt(year, 10));
    if (from) query = query.gte('income_date', from);
    if (to) query = query.lte('income_date', to);

    query = query.order('income_date', { ascending: false }).order('created_at', { ascending: false });

    const { data: rawData, error } = await query;
    if (error) throw error;

    let data = (rawData || []) as IncomeEntry[];
    if (type === 'manual') {
      data = data.filter(i => !i.reference_type || i.reference_type === 'manual');
    }

    return NextResponse.json({ success: true, data } as ApiResponse<IncomeEntry[]>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(['super_admin', 'admin', 'accountant']);
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const body = await request.json();
    const { category, amount, description, received_from, payment_method = 'cash', income_date } = body;

    const parsedAmount = roundCurrency(amount);

    if (!category || parsedAmount <= 0 || !description || !income_date) {
      return NextResponse.json({ success: false, error: "Missing required fields or invalid positive amount" }, { status: 400 });
    }

    const dateObj = new Date(income_date);
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid income_date format" }, { status: 400 });
    }

    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();

    const insertPayload: Record<string, any> = {
      category, 
      amount: parsedAmount, 
      description: description.trim(), 
      received_from: received_from || null, 
      payment_method, 
      received_by: user.id || null, 
      income_date, 
      academic_year: year.toString(), 
      month, 
      year,
    };

    let data: any = null;
    let insertError: any = null;

    try {
      const res1 = await (supabase as any)
        .from('income_entries')
        .insert({ ...insertPayload, reference_type: 'manual' })
        .select('*')
        .single();
      data = res1.data;
      insertError = res1.error;
    } catch (e) {
      insertError = e;
    }

    if (insertError || !data) {
      const res2 = await (supabase as any)
        .from('income_entries')
        .insert(insertPayload)
        .select('*')
        .single();
      if (res2.error) throw res2.error;
      data = res2.data;
    }

    // Audit log
    try {
      await (supabase as any).from('finance_audit_logs').insert({
        actor_id: user?.id && user.id !== '00000000-0000-0000-0000-000000000000' ? user.id : null,
        actor_name: user?.email || 'Staff',
        action: 'CREATE_MANUAL_INCOME',
        target_table: 'income_entries',
        target_id: data.id,
        details: { category, amount: parsedAmount, description, received_from }
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true, data } as ApiResponse<IncomeEntry>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireRole(['super_admin', 'admin', 'accountant']);
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('income_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ success: false, error: "Income entry not found" }, { status: 404 });
    }

    const raw = existing as Record<string, any>;
    if (raw.reference_type === 'tuition_payment') {
      return NextResponse.json({ 
        success: false, 
        error: "This income entry is linked to a tuition payment receipt. Please void the tuition payment instead." 
      }, { status: 400 });
    }

    const { error: delErr } = await supabase.from('income_entries').delete().eq('id', id);
    if (delErr) throw delErr;

    // Audit Log
    try {
      await (supabase as any).from('finance_audit_logs').insert({
        actor_id: user?.id && user.id !== '00000000-0000-0000-0000-000000000000' ? user.id : null,
        actor_name: user?.email || 'Staff',
        action: 'DELETE_MANUAL_INCOME',
        target_table: 'income_entries',
        target_id: id,
        details: { category: raw.category, amount: raw.amount, description: raw.description }
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true, message: "Income entry deleted successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
