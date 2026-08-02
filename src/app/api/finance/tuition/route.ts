import { NextResponse } from 'next/server';
import { ApiResponse, TuitionPayment } from '@/types/finance';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const className = searchParams.get('class_name');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const status = searchParams.get('status');

    let query = supabase.from('tuition_payments').select(`
      *,
      students!inner(
        name, roll
      )
    `);

    if (studentId) query = query.eq('student_id', studentId);
    if (className) query = query.eq('class_name', className);
    if (month) query = query.eq('month', parseInt(month));
    if (year) query = query.eq('year', parseInt(year));

    const { data, error } = await query;
    if (error) throw error;

    let filteredData = data;
    if (status === 'overdue' && Array.isArray(data)) {
      filteredData = data.filter((payment: { amount_paid: number; amount_due: number }) => payment.amount_paid < payment.amount_due);
    }

    return NextResponse.json({ success: true, data: filteredData } as ApiResponse<TuitionPayment[]>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
