import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { generateReceiptNumber, getMonthName, roundCurrency } from '@/lib/finance-utils';
import { sendPaymentConfirmationSms } from '@/lib/sms-gateway';
import { ApiResponse, TuitionPayment } from '@/types/finance';
import {
  acquireIdempotencyLock,
  completeIdempotencyLock,
  releaseIdempotencyLock,
} from '@/lib/payment/idempotency';

interface FeeDetailItem {
  type: string;
  amount: number;
  month?: number;
  year?: number;
  exam_name?: string;
  description?: string;
}

export async function POST(request: Request) {
  let idempotencyKey: string | null = null;
  let authContext: any = null;

  try {
    const auth = await requireRole(['super_admin', 'admin', 'accountant']);
    if (auth instanceof NextResponse) return auth;
    authContext = auth;
    const { user, supabase } = auth;

    idempotencyKey = request.headers.get('Idempotency-Key') || null;
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

    // 1. Idempotency Key Lock & Deduplication Check
    if (idempotencyKey) {
      const lock = await acquireIdempotencyLock(
        supabase,
        idempotencyKey,
        'tuition_collect',
        body,
        user.id
      );

      if (lock.isDuplicate) {
        if (lock.inProgress) {
          return NextResponse.json(
            { success: false, error: lock.error || "Payment collection is currently processing. Please wait." },
            { status: 409 }
          );
        }
        if (lock.cachedResponse) {
          return NextResponse.json(lock.cachedResponse.body, {
            status: lock.cachedResponse.status,
          });
        }
      }
    }

    // 2. Fetch student details from database
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('name, roll, phone, class_id, classes(name), sections(name)')
      .eq('id', student_id)
      .single();

    if (studentError || !studentData) {
      if (idempotencyKey) await releaseIdempotencyLock(supabase, idempotencyKey);
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const studentClassName = (studentData.classes as { name?: string })?.name || class_name || 'N/A';
    const studentSection = (studentData.sections as { name?: string })?.name || section || '';

    // 3. Fetch active fee structure for this class & year to evaluate scheduled amounts
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

    // 4. Fetch all existing completed payments for this student in this year
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

    // 5. Validate submitted fee items and check for over-settled conflicts
    let total_amount_due = 0;
    let primary_month: number | null = null;
    const conflicts: string[] = [];
    const validatedFeeDetails: FeeDetailItem[] = [];

    for (const item of fee_details as FeeDetailItem[]) {
      const fType = (item.type || '').toLowerCase().trim();
      const scheduledRate = feeRateMap.get(fType);

      // Server-side authoritative amount enforcement
      const itemAmount = scheduledRate !== undefined && scheduledRate > 0
        ? scheduledRate
        : roundCurrency(item.amount);

      if (!item.type || itemAmount <= 0) {
        if (idempotencyKey) await releaseIdempotencyLock(supabase, idempotencyKey);
        return NextResponse.json({ success: false, error: "Invalid fee item or non-positive amount" }, { status: 400 });
      }
      total_amount_due = roundCurrency(total_amount_due + itemAmount);

      if (item.type === 'tuition' && item.month) {
        primary_month = primary_month || item.month;
      }

      validatedFeeDetails.push({
        type: item.type,
        amount: itemAmount,
        month: item.month,
        year: item.year || parsedYear,
        exam_name: item.exam_name,
        description: item.description,
      });

      if (item.type === 'arrears') continue;

      let key: string;
      if (item.month) {
        key = `${fType}__${item.month}__${item.year || parsedYear}`;
      } else if (item.exam_name) {
        key = `${fType}__${item.exam_name.toLowerCase().trim()}__${item.year || parsedYear}`;
      } else {
        key = `${fType}__yearly__${item.year || parsedYear}`;
      }

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
      if (idempotencyKey) await releaseIdempotencyLock(supabase, idempotencyKey);
      return NextResponse.json({ 
        success: false, 
        error: `Duplicate/Overpayment conflict detected:\n${conflicts.join('\n')}`,
        conflicts 
      }, { status: 409 });
    }

    // 6. Check calculation chain & discounts
    const grossPayable = roundCurrency(total_amount_due + parsedFine);
    if (parsedDiscount > grossPayable) {
      if (idempotencyKey) await releaseIdempotencyLock(supabase, idempotencyKey);
      return NextResponse.json({ success: false, error: "Discount cannot exceed payable fee amount" }, { status: 400 });
    }

    const netPayable = roundCurrency(grossPayable - parsedDiscount);
    if (parsedAmountPaid > netPayable) {
      if (idempotencyKey) await releaseIdempotencyLock(supabase, idempotencyKey);
      return NextResponse.json({ 
        success: false, 
        error: `Amount paid (${parsedAmountPaid} TK) cannot exceed net payable (${netPayable} TK). Overpayment is not allowed.` 
      }, { status: 400 });
    }

    // 7. Generate Receipt Number
    const receipt_number = await generateReceiptNumber(supabase, parsedYear);

    const feeTypes = [...new Set(validatedFeeDetails.map((f) => f.type))];
    const fee_type = feeTypes.length > 1 ? 'multiple' : feeTypes[0];

    // 8. Insert Tuition Payment Record
    const insertPayload: Record<string, unknown> = {
      receipt_number,
      student_id,
      student_name: studentData.name,
      roll: studentData.roll,
      class_name: studentClassName,
      section: studentSection,
      fee_type,
      fee_details: validatedFeeDetails,
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
      status: 'completed',
    };

    let tuitionResult: any = null;
    const res1 = await (supabase as any)
      .from('tuition_payments')
      .insert(insertPayload)
      .select()
      .single();
    
    if (res1.error) {
      // Fallback for older schema without student_name / roll / status columns
      const fallbackPayload = { ...insertPayload };
      delete fallbackPayload.student_name;
      delete fallbackPayload.roll;
      delete fallbackPayload.status;
      const res2 = await (supabase as any).from('tuition_payments').insert(fallbackPayload).select().single();
      if (res2.error) {
        // Core fallback
        const corePayload = {
          receipt_number,
          student_id,
          class_name: studentClassName,
          section: studentSection,
          fee_type,
          fee_details: validatedFeeDetails,
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
        const res3 = await (supabase as any).from('tuition_payments').insert(corePayload).select().single();
        if (res3.error) {
          if (idempotencyKey) await releaseIdempotencyLock(supabase, idempotencyKey);
          return NextResponse.json({ success: false, error: res3.error.message || "Failed to record tuition payment" }, { status: 500 });
        }
        tuitionResult = res3.data;
      } else {
        tuitionResult = res2.data;
      }
    } else {
      tuitionResult = res1.data;
    }

    // 9. Insert Synchronized Income Entry
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
      reference_type: 'tuition_payment',
      reference_id: tuitionResult.id,
    };

    try {
      await (supabase as any).from('income_entries').insert(incomePayload);
    } catch {
      // Non-blocking fallback
    }

    // 10. Synchronize Payment Order Record
    try {
      const orderId = `ORD-${parsedYear}-${Date.now().toString().slice(-6)}`;
      await (supabase as any).from('payment_orders').insert({
        order_id: orderId,
        student_id,
        class_name: studentClassName,
        section: studentSection,
        amount_due: total_amount_due,
        amount_paid: parsedAmountPaid,
        discount: parsedDiscount,
        fine: parsedFine,
        currency: 'BDT',
        fee_type,
        fee_details: validatedFeeDetails,
        year: parsedYear,
        month: primary_month,
        status: 'SUCCESS',
        payment_method,
        gateway: 'counter',
        idempotency_key: idempotencyKey,
        collected_by: user.id,
        tuition_payment_id: tuitionResult.id,
        completed_at: new Date().toISOString(),
      });
    } catch {
      // Non-blocking
    }

    // 11. Record Audit Log (safe fire-and-forget)
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

    // 12. SMS Confirmation (Fire-and-forget)
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
      // Non-blocking
    }

    const responsePayload = { success: true, data: tuitionResult } as unknown as ApiResponse<TuitionPayment>;

    if (idempotencyKey) {
      await completeIdempotencyLock(supabase, idempotencyKey, 200, responsePayload);
    }

    return NextResponse.json(responsePayload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (idempotencyKey && authContext?.supabase) {
      await releaseIdempotencyLock(authContext.supabase, idempotencyKey);
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
