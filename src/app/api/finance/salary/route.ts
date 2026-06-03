import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ApiResponse, SalaryPayment } from '@/types/finance';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staff_id');
    const staffType = searchParams.get('staff_type');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    const supabase = await createServerSupabaseClient();
    
    // @ts-ignore
    let query = supabase.from('salary_payments').select(`
      *,
      teachers!salary_payments_staff_id_fkey(name, designation, employee_type)
    `);
    
    if (staffId) query = query.eq('staff_id', staffId);
    if (staffType) query = query.eq('staff_type', staffType);
    if (month) query = query.eq('month', parseInt(month));
    if (year) query = query.eq('year', parseInt(year));
    
    const { data, error } = await query;
    if (error) throw error;
    
    return NextResponse.json({ success: true, data } as ApiResponse<SalaryPayment[]>);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
