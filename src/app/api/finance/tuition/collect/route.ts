import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateReceiptNumber, getMonthName } from '@/lib/finance-utils';
import { sendPaymentConfirmationSms } from '@/lib/sms-gateway';
import { ApiResponse, TuitionPayment } from '@/types/finance';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      student_id, class_name, section, 
      fee_details = [], year, amount_paid, discount = 0, 
      fine: client_fine, payment_method, collected_by, note 
    } = body;
    
    if (!student_id || fee_details.length === 0 || typeof amount_paid !== 'number') {
      return NextResponse.json({ success: false, error: "Missing required fields or invalid amount" }, { status: 400 });
    }

    const supabase = (await createServerSupabaseClient()) as any;

    // ═══════════════════ SERVER-SIDE DUPLICATE CHECK ═══════════════════
    // Fetch ALL existing payments for this student in this year
    const { data: existingPayments } = await supabase
      .from('tuition_payments')
      .select('fee_details, receipt_number, payment_date')
      .eq('student_id', student_id)
      .eq('year', year);

    // Build a set of already-paid {type, month} combinations
    const paidItems = new Set<string>();
    const paidItemDetails: Record<string, { receipt: string; date: string }> = {};

    if (existingPayments) {
      for (const payment of existingPayments) {
        const details = payment.fee_details || [];
        for (const fd of details) {
          if (fd.type === 'arrears') continue; // arrears can be paid multiple times
          let key: string;
          if (fd.month) {
            key = `${fd.type}__${fd.month}__${fd.year || year}`;
          } else if (fd.exam_name) {
            key = `${fd.type}__${fd.exam_name}__${fd.year || year}`;
          } else {
            key = `${fd.type}__yearly__${fd.year || year}`;
          }
          paidItems.add(key);
          paidItemDetails[key] = { 
            receipt: payment.receipt_number, 
            date: new Date(payment.payment_date).toLocaleDateString('en-GB') 
          };
        }
      }
    }

    // Check submitted fee_details against already-paid items
    const conflicts: string[] = [];

    for (const item of fee_details) {
      if (item.type === 'arrears') continue;
      let key: string;
      if (item.month) {
        key = `${item.type}__${item.month}__${item.year || year}`;
      } else if (item.exam_name) {
        key = `${item.type}__${item.exam_name}__${item.year || year}`;
      } else {
        key = `${item.type}__yearly__${item.year || year}`;
      }
      
      if (paidItems.has(key)) {
        const detail = paidItemDetails[key];
        const label = item.month 
          ? `${item.type} (${getMonthName(item.month)})` 
          : item.exam_name
            ? `${item.type.replace('_', ' ')} (${item.exam_name})`
            : item.type;
        conflicts.push(`${label} — already paid on ${detail.date} (Receipt: ${detail.receipt})`);
      }
    }

    if (conflicts.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Duplicate payment detected!\n${conflicts.join('\n')}`,
        conflicts 
      }, { status: 409 });
    }
    // ═══════════════════ END DUPLICATE CHECK ═══════════════════

    let total_amount_due = 0;
    const total_fine = Number(client_fine) || 0;
    let primary_month = null;

    for (const item of fee_details) {
      if (!item.type || typeof item.amount !== 'number') {
        return NextResponse.json({ success: false, error: "Invalid fee details structure" }, { status: 400 });
      }
      total_amount_due += item.amount;

      if (item.type === 'tuition' && item.month) {
        primary_month = primary_month || item.month;
      }
    }

    const receipt_number = await generateReceiptNumber(supabase, year);

    const feeTypes = [...new Set(fee_details.map((f: any) => f.type))];
    const fee_type = feeTypes.length > 1 ? 'multiple' : feeTypes[0];

    const { data: tuitionResult, error: insertError } = await supabase
      .from('tuition_payments')
      .insert({
        receipt_number,
        student_id,
        class_name: class_name || 'N/A',
        section,
        fee_type,
        fee_details,
        month: primary_month,
        year,
        amount_due: total_amount_due,
        amount_paid,
        discount,
        fine: total_fine,
        payment_method,
        collected_by,
        note
      })
      .select()
      .single();
      
    if (insertError) throw insertError;

    // Auto income entry
    await supabase.from('income_entries').insert({
      category: fee_type === 'arrears' ? 'arrears' : (fee_type === 'tuition' ? 'tuition' : (['mct_exam', 'semester_exam', 'exam'].includes(fee_type as string) ? 'exam_fee' : 'other')),
      amount: amount_paid,
      description: `Fees collected (${feeTypes.join(', ')}) - Receipt: ${receipt_number}`,
      received_from: student_id,
      payment_method,
      received_by: collected_by,
      income_date: new Date().toISOString().split('T')[0],
      academic_year: year.toString(),
      month: primary_month || new Date().getMonth() + 1,
      year: year
    });

    // ═══════════════════ SMS CONFIRMATION (fire-and-forget) ═══════════════════
    // Send SMS to guardian's phone. This must NEVER block payment completion.
    try {
      // Fetch student phone and school name for SMS
      const { data: studentData } = await supabase
        .from('students')
        .select('name, phone')
        .eq('id', student_id)
        .single();
      const { data: schoolData } = await supabase
        .from('school_info')
        .select('name')
        .limit(1)
        .single();

      if (studentData?.phone) {
        // Don't await — fire and forget so SMS failure never blocks the response
        sendPaymentConfirmationSms({
          phone: studentData.phone,
          studentName: studentData.name,
          amount: amount_paid,
          receiptNumber: receipt_number,
          schoolName: schoolData?.name
        }).catch(() => {}); // silently ignore SMS errors
      }
    } catch {
      // SMS errors must never affect payment flow
    }
    // ═══════════════════ END SMS ═══════════════════

    return NextResponse.json({ success: true, data: tuitionResult } as ApiResponse<TuitionPayment>);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
