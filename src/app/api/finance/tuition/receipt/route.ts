import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getMonthName } from '@/lib/finance-utils';
import { ApiResponse, TuitionReceiptData } from '@/types/finance';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const body = await request.json();
    const { payment_id } = body;
    
    if (!payment_id) {
      return NextResponse.json({ success: false, error: "payment_id is required" }, { status: 400 });
    }

    // 1. Fetch tuition payment
    const { data: payment, error } = await supabase
      .from('tuition_payments')
      .select(`
        *,
        students(name, roll, student_id, classes(name), sections(name))
      `)
      .eq('id', payment_id)
      .single();
      
    if (error || !payment) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
    }

    // 2. Fetch school info from DB (with safe fallback)
    const { data: schoolData } = await supabase
      .from('school_info')
      .select('name, address, phone, logo_url')
      .limit(1)
      .maybeSingle();

    const schoolInfo = schoolData || {
      name: "Your School Name",
      address: "School Address, City, Country",
      phone: "+8801XXXXXXXXX",
    };

    // 3. Format Receipt Data
    const rawPayment = payment as Record<string, unknown>;
    const studentRel = payment.students as { name?: string; roll?: string; student_id?: string; classes?: { name?: string }; sections?: { name?: string } } | null;

    const receiptData: TuitionReceiptData = {
      school: schoolInfo,
      receipt_number: payment.receipt_number,
      student: {
        name: (rawPayment.student_name as string) || studentRel?.name || 'Unknown',
        class_name: payment.class_name || studentRel?.classes?.name || 'N/A',
        section: payment.section || studentRel?.sections?.name || '',
        roll: (rawPayment.roll as string) || studentRel?.roll || studentRel?.student_id || 'N/A',
        student_id: studentRel?.student_id || undefined
      },
      fee_type: payment.fee_type,
      fee_details: (payment.fee_details as { type: string; amount: number; month?: number; year?: number }[]) || undefined,
      month_name: payment.month ? getMonthName(payment.month) : undefined,
      year: payment.year,
      amount_due: payment.amount_due ?? 0,
      discount: payment.discount ?? 0,
      fine: payment.fine ?? 0,
      amount_paid: payment.amount_paid ?? 0,
      payment_method: payment.payment_method || 'cash',
      payment_date: payment.payment_date || '',
      collected_by: 'Authorized Accounts Officer',
      note: payment.note ?? undefined,
      status: (rawPayment.status as any) || 'completed',
      is_computer_generated: true
    };

    // 4. Mark as printed if not already
    if (!payment.is_printed) {
      await supabase.from('tuition_payments').update({ is_printed: true }).eq('id', payment_id);
    }

    return NextResponse.json({ success: true, data: receiptData } as ApiResponse<TuitionReceiptData>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
