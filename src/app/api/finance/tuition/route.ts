import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ApiResponse, TuitionPayment } from '@/types/finance';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const className = searchParams.get('class_name');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const status = searchParams.get('status');

    const supabase = await createServerSupabaseClient();
    
    // @ts-ignore
    let query = supabase.from('tuition_payments').select(`
      *,
      students!inner(
        name, roll_no
      )
    `);
    
    if (studentId) query = query.eq('student_id', studentId);
    if (className) query = query.eq('class_name', className);
    if (month) query = query.eq('month', parseInt(month));
    if (year) query = query.eq('year', parseInt(year));
    
    const { data, error } = await query;
    if (error) throw error;

    let filteredData = data;
    if (status === 'overdue') {
      filteredData = data.filter((payment: any) => payment.amount_paid < payment.amount_due);
    }
    
    return NextResponse.json({ success: true, data: filteredData } as ApiResponse<TuitionPayment[]>);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
