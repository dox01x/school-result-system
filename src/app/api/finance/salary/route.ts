import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { ApiResponse, SalaryPayment } from '@/types/finance';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staff_id');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    let query = supabase.from('salary_payments').select(`
      *,
      teachers!salary_payments_staff_id_fkey(name, designation)
    `);
    
    if (staffId) query = query.eq('staff_id', staffId);
    if (month) query = query.eq('month', parseInt(month, 10));
    if (year) query = query.eq('year', parseInt(year, 10));
    
    query = query.order('payment_date', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    
    return NextResponse.json({ success: true, data } as ApiResponse<SalaryPayment[]>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
