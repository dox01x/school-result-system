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

    const supabase = (await createServerSupabaseClient()) as any;
    
    // 1. Fetch tuition payment
    // @ts-ignore
    const { data: payment, error } = await supabase
      .from('tuition_payments')
      .select(`
        *,
        students!inner(name, roll, classes(name), sections(name))
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
    const receiptData: TuitionReceiptData = {
      school: schoolInfo,
      receipt_number: payment.receipt_number,
      student: {
        name: payment.students.name,
        class_name: payment.students.classes?.name || payment.class_name,
        section: payment.students.sections?.name || payment.section || '',
        roll: payment.students.roll,
      },
      fee_type: payment.fee_type,
      fee_details: payment.fee_details,
      month_name: payment.month ? getMonthName(payment.month) : undefined,
      year: payment.year,
      amount_due: payment.amount_due,
      discount: payment.discount,
      fine: payment.fine,
      amount_paid: payment.amount_paid,
      payment_method: payment.payment_method,
      payment_date: payment.payment_date,
      collected_by: 'Authorized Admin',
      note: payment.note,
      is_computer_generated: true
    };

    // 4. Mark as printed
    if (!payment.is_printed) {
      // @ts-ignore
      await supabase.from('tuition_payments').update({ is_printed: true }).eq('id', payment_id);
    }

    return NextResponse.json({ success: true, data: receiptData } as ApiResponse<TuitionReceiptData>);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
