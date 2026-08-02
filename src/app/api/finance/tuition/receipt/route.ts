import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getMonthName } from '@/lib/finance-utils';
import { ApiResponse, TuitionReceiptData } from '@/types/finance';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payment_id } = body;
    
    if (!payment_id) {
      return NextResponse.json({ success: false, error: "payment_id is required" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    
    // 1. Fetch tuition payment
    const { data: payment, error } = await supabase
      .from('tuition_payments')
      .select(`
        *,
        students(name, roll, classes(name), sections(name))
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
      .single();

    const schoolInfo = schoolData || {
      name: "Your School Name",
      address: "School Address, City, Country",
      phone: "+8801XXXXXXXXX",
    };

    // 3. Format Receipt Data
    const rawPayment = payment as Record<string, unknown>;
    const studentRel = payment.students as { name?: string; roll?: string; classes?: { name?: string }; sections?: { name?: string } } | null;

    const receiptData: TuitionReceiptData = {
      school: schoolInfo,
      receipt_number: payment.receipt_number,
      student: {
        name: (rawPayment.student_name as string) || studentRel?.name || 'Unknown',
        class_name: payment.class_name || studentRel?.classes?.name || 'N/A',
        section: payment.section || studentRel?.sections?.name || '',
        roll: (rawPayment.roll as string) || studentRel?.roll || 'N/A',
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
      collected_by: 'Authorized Admin',
      note: payment.note ?? undefined,
      is_computer_generated: true
    };

    // 4. Mark as printed
    if (!payment.is_printed) {
      await supabase.from('tuition_payments').update({ is_printed: true }).eq('id', payment_id);
    }

    return NextResponse.json({ success: true, data: receiptData } as ApiResponse<TuitionReceiptData>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
