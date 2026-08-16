import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { generateReceiptNumber, getMonthName, roundCurrency } from '@/lib/finance-utils';
import { sendPaymentConfirmationSms } from '@/lib/sms-gateway';
import { ApiResponse, TuitionPayment } from '@/types/finance';

interface FeeDetailItem {
  type: string;
  amount: number;
  month?: number;
  year?: number;
  exam_name?: string;
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(['super_admin', 'admin', 'accountant']);
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const body = await request.json();
    const { 
      student_id, class_name, section, 
      fee_details = [], year, amount_paid, discount = 0, 
      fine: client_fine = 0, payment_method = 'cash', note 
    } = body;
    
    const parsedAmountPaid = roundCurrency(amount_paid);
    const parsedDiscount = roundCurrency(discount);
    const parsedFine = roundCurrency(client_fine);
    const parsedYear = parseInt(String(year || new Date().getFullYear()), 10);

    if (!student_id || !Array.isArray(fee_details) || fee_details.length === 0 || parsedAmountPaid <= 0) {
      return NextResponse.json({ success: false, error: "Missing required fields or invalid payment amount" }, { status: 400 });
    }

    if (parsedDiscount < 0) {
      return NextResponse.json({ success: false, error: "Discount cannot be negative" }, { status: 400 });
    }

    if (parsedFine < 0) {
      return NextResponse.json({ success: false, error: "Fine cannot be negative" }, { status: 400 });
    }

    // 1. Fetch student details from database
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('name, roll, phone, class_id, classes(name), sections(name)')
      .eq('id', student_id)
      .single();

    if (studentError || !studentData) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const studentClassName = (studentData.classes as { name?: string })?.name || class_name || 'N/A';
    const studentSection = (studentData.sections as { name?: string })?.name || section || '';

    // 2. Fetch active fee structure for this class & year to evaluate scheduled amounts
    const { data: rawFeeStructure } = await supabase
      .from('fee_structure')
      .select('fee_type, amount')
      .eq('class_name', studentClassName)
      .eq('academic_year', parsedYear.toString())
      .eq('is_active', true);

    const feeRateMap = new Map<string, number>();
    (rawFeeStructure || []).forEach(f => {
      feeRateMap.set(f.fee_type.toLowerCase().trim(), Number(f.amount));
    });

    // 3. Fetch all existing completed payments for this student in this year
    const { data: rawExistingPayments } = await supabase
      .from('tuition_payments')
      .select('*')
      .eq('student_id', student_id)
      .eq('year', parsedYear);

    // Filter out voided records using status, note prefix, and void_reason
    const existingPayments = (rawExistingPayments || []).filter(p => {
      const isVoid = p.status === 'void' || 
                     (typeof p.note === 'string' && p.note.startsWith('[VOIDED')) ||
                     (typeof p.void_reason === 'string' && p.void_reason.length > 0);
      return !isVoid;
    });

    // Calculate total previously paid per fee item key
    const cumulativePaidByKey = new Map<string, number>();
    const paidDetailsByKey = new Map<string, { receipt: string; date: string }>();

    for (const payment of existingPayments) {
      const details = (payment.fee_details as FeeDetailItem[]) || [];
      for (const fd of details) {
        if (fd.type === 'arrears') continue;
        let key: string;
        if (fd.month) {
          key = `${fd.type.toLowerCase().trim()}__${fd.month}__${fd.year || parsedYear}`;
        } else if (fd.exam_name) {
          key = `${fd.type.toLowerCase().trim()}__${fd.exam_name.toLowerCase().trim()}__${fd.year || parsedYear}`;
        } else {
          key = `${fd.type.toLowerCase().trim()}__yearly__${fd.year || parsedYear}`;
        }

        const prev = cumulativePaidByKey.get(key) || 0;
        cumulativePaidByKey.set(key, roundCurrency(prev + Number(fd.amount || 0)));
        paidDetailsByKey.set(key, {
          receipt: payment.receipt_number,
          date: payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-GB') : 'previous receipt'
        });
      }
    }

    // 4. Validate submitted fee items and check for over-settled conflicts
    let total_amount_due = 0;
    let primary_month: number | null = null;
    const conflicts: string[] = [];

    for (const item of fee_details as FeeDetailItem[]) {
      const itemAmount = roundCurrency(item.amount);
      if (!item.type || itemAmount <= 0) {
        return NextResponse.json({ success: false, error: "Invalid fee item or non-positive amount" }, { status: 400 });
      }
      total_amount_due = roundCurrency(total_amount_due + itemAmount);

      if (item.type === 'tuition' && item.month) {
        primary_month = primary_month || item.month;
      }

      if (item.type === 'arrears') continue;

      let key: string;
      if (item.month) {
        key = `${item.type.toLowerCase().trim()}__${item.month}__${item.year || parsedYear}`;
      } else if (item.exam_name) {
        key = `${item.type.toLowerCase().trim()}__${item.exam_name.toLowerCase().trim()}__${item.year || parsedYear}`;
      } else {
        key = `${item.type.toLowerCase().trim()}__yearly__${item.year || parsedYear}`;
      }

      const scheduledRate = feeRateMap.get(item.type.toLowerCase().trim());
      const alreadyPaid = cumulativePaidByKey.get(key) || 0;

      // If scheduled rate is known and already paid is >= scheduled rate, block payment
      if (scheduledRate !== undefined && scheduledRate > 0 && alreadyPaid >= scheduledRate) {
        const detail = paidDetailsByKey.get(key);
        const label = item.month 
          ? `${item.type} (${getMonthName(item.month)})` 
          : item.exam_name
            ? `${item.type} (${item.exam_name})`
            : item.type;
        conflicts.push(`${label} has already been fully paid (${alreadyPaid} TK) on ${detail?.date || 'previous receipt'} [Receipt: ${detail?.receipt || 'N/A'}]`);
      }
    }

    if (conflicts.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Duplicate/Overpayment conflict detected:\n${conflicts.join('\n')}`,
        conflicts 
      }, { status: 409 });
    }

    // 5. Check calculation chain & discounts
    const grossPayable = roundCurrency(total_amount_due + parsedFine);
    if (parsedDiscount > grossPayable) {
      return NextResponse.json({ success: false, error: "Discount cannot exceed payable fee amount" }, { status: 400 });
    }

    const netPayable = roundCurrency(grossPayable - parsedDiscount);
    if (parsedAmountPaid > netPayable) {
      return NextResponse.json({ 
        success: false, 
        error: `Amount paid (${parsedAmountPaid} TK) cannot exceed net payable (${netPayable} TK). Overpayment is not allowed.` 
      }, { status: 400 });
    }

    // 6. Generate Receipt Number
    const receipt_number = await generateReceiptNumber(supabase, parsedYear);

    const feeTypes = [...new Set((fee_details as FeeDetailItem[]).map((f) => f.type))];
    const fee_type = feeTypes.length > 1 ? 'multiple' : feeTypes[0];

    // 7. Insert Tuition Payment Record (with backward compatibility)
    const insertPayload: Record<string, unknown> = {
      receipt_number,
      student_id,
      class_name: studentClassName,
      section: studentSection,
      fee_type,
      fee_details,
      month: primary_month,
      year: parsedYear,
      amount_due: total_amount_due,
      amount_paid: parsedAmountPaid,
      discount: parsedDiscount,
      fine: parsedFine,
      payment_method,
      collected_by: user?.id || null,
      payment_date: new Date().toISOString(),
      note: note || null,
    };

    let tuitionResult: any = null;
    let insertError: any = null;

    try {
      const res1 = await (supabase as any)
        .from('tuition_payments')
        .insert({ ...insertPayload, status: 'completed' })
        .select()
        .single();
      
      tuitionResult = res1.data;
      insertError = res1.error;
    } catch (e) {
      insertError = e;
    }

    // If failed, fallback to inserting without status column
    if (insertError || !tuitionResult) {
      const res2 = await (supabase as any)
        .from('tuition_payments')
        .insert(insertPayload)
        .select()
        .single();
      
      if (res2.error) {
        console.error('Tuition payment insert failed:', res2.error);
        return NextResponse.json({ success: false, error: res2.error.message || "Failed to record tuition payment" }, { status: 500 });
      }
      tuitionResult = res2.data;
    }

    // 8. Insert Synchronized Income Entry (with backward compatibility)
    const incomeCategory = fee_type === 'arrears' ? 'arrears' : (fee_type === 'tuition' ? 'tuition' : (['mct_exam', 'semester_exam', 'exam'].includes(fee_type) ? 'exam_fee' : 'other'));
    
    const incomePayload: Record<string, any> = {
      category: incomeCategory,
      amount: parsedAmountPaid,
      description: `Fees collected (${feeTypes.join(', ')}) - Receipt: ${receipt_number}`,
      received_from: student_id,
      payment_method,
      received_by: user?.id || null,
      income_date: new Date().toISOString().split('T')[0],
      academic_year: parsedYear.toString(),
      month: primary_month || new Date().getMonth() + 1,
      year: parsedYear,
    };

    try {
      const { error: incErr } = await (supabase as any).from('income_entries').insert({
        ...incomePayload,
        reference_type: 'tuition_payment',
        reference_id: tuitionResult.id
      });

      if (incErr) {
        await (supabase as any).from('income_entries').insert(incomePayload);
      }
    } catch {
      await (supabase as any).from('income_entries').insert(incomePayload);
    }

    // 9. Record Audit Log (safe fire-and-forget)
    try {
      await (supabase as any).from('finance_audit_logs').insert({
        actor_id: user?.id || null,
        actor_name: user?.email || 'Staff',
        action: 'CREATE_TUITION_PAYMENT',
        target_table: 'tuition_payments',
        target_id: tuitionResult.id,
        details: {
          receipt_number,
          student_id,
          student_name: studentData.name,
          amount_paid: parsedAmountPaid,
          amount_due: total_amount_due,
          discount: parsedDiscount,
          fine: parsedFine,
          payment_method
        }
      });
    } catch {
      // Non-blocking
    }

    // 10. SMS Confirmation (Fire-and-forget)
    try {
      const { data: schoolData } = await supabase
        .from('school_info')
        .select('name')
        .limit(1)
        .maybeSingle();

      if (studentData?.phone) {
        sendPaymentConfirmationSms({
          phone: studentData.phone,
          studentName: studentData.name,
          amount: parsedAmountPaid,
          receiptNumber: receipt_number,
          schoolName: schoolData?.name
        }).catch(() => {});
      }
    } catch {
      // SMS failures must never block payment flow
    }

    return NextResponse.json({ success: true, data: tuitionResult } as unknown as ApiResponse<TuitionPayment>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
