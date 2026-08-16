import { NextResponse } from 'next/server';
import { ApiResponse, TuitionPayment } from '@/types/finance';
import { requireAuth } from '@/lib/api-auth';

function isPaymentVoid(p: any): boolean {
  if (!p) return false;
  if (p.status === 'void') return true;
  if (typeof p.note === 'string' && p.note.startsWith('[VOIDED')) return true;
  if (typeof p.void_reason === 'string' && p.void_reason.length > 0) return true;
  return false;
}

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
      students(
        id, name, roll, phone
      )
    `);

    if (studentId) query = query.eq('student_id', studentId);
    if (className) query = query.eq('class_name', className);
    if (month) query = query.eq('month', parseInt(month, 10));
    if (year) query = query.eq('year', parseInt(year, 10));

    query = query.order('payment_date', { ascending: false });

    const { data: rawData, error } = await query;
    if (error) throw error;

    let data = rawData || [];
    if (status === 'void') {
      data = data.filter(p => isPaymentVoid(p));
    } else if (status === 'completed') {
      data = data.filter(p => !isPaymentVoid(p));
    } else if (!status) {
      // By default, exclude voided records
      data = data.filter(p => !isPaymentVoid(p));
    }

    return NextResponse.json({ success: true, data } as unknown as ApiResponse<TuitionPayment[]>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
