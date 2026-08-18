import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { ApiResponse } from '@/types/finance';
import { roundCurrency } from '@/lib/finance-utils';

interface FeeStructureRow {
  class_name: string;
  amount: number;
}

interface StudentRow {
  id: string;
  name: string;
  roll: string | null;
  phone: string | null;
  class_id: string;
  classes?: { name: string } | null;
}

interface DetailedPaymentRow {
  student_id: string;
  fee_details: { type?: string; month?: number; amount?: number }[] | null;
  amount_paid: number;
  status?: string;
  note?: string;
  void_reason?: string;
}

interface OverdueItem {
  student_info: { id: string; name: string; roll: string | null; phone: string | null };
  class_name: string;
  month: number;
  year: number;
  amount_due: number;
  amount_paid: number;
  outstanding: number;
  days_overdue: number;
}

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
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const className = searchParams.get('class_name');

    if (!month || !year) {
      return NextResponse.json({ success: false, error: "month and year are required" }, { status: 400 });
    }

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    // 1. Get Fee Structure for Tuition
    let feeQuery = supabase
      .from('fee_structure')
      .select('class_name, amount')
      .match({ fee_type: 'tuition', is_active: true, academic_year: year });

    if (className && className !== 'all') {
      feeQuery = feeQuery.eq('class_name', className);
    }
    const { data: rawFees } = await feeQuery;
    const fees = (rawFees || []) as unknown as FeeStructureRow[];
    
    if (fees.length === 0) {
       return NextResponse.json({ success: true, data: [] });
    }

    const feeMap = new Map(fees.map((f) => [f.class_name, Number(f.amount)]));

    // 2. Get Students — join with classes to get class name
    const stdQuery = supabase.from('students').select('id, name, roll, phone, class_id, classes(name)');
    const { data: rawStudents, error: stdErr } = await stdQuery;
    if (stdErr) throw stdErr;

    const students = (rawStudents || []) as unknown as StudentRow[];
    if (students.length === 0) return NextResponse.json({ success: true, data: [] });

    const studentsWithClassName = students.map((s) => ({
      ...s,
      class_name: s.classes?.name || ''
    })).filter(s => !className || className === 'all' || s.class_name === className);

    // Filter students whose classes have a tuition fee structure configured
    const targetStudents = studentsWithClassName.filter((s) => feeMap.has(s.class_name));
    const studentIds = targetStudents.map((s) => s.id);
    
    if (studentIds.length === 0) return NextResponse.json({ success: true, data: [] });

    // 3. Fetch detailed payments for all target students in this year (excluding void in-memory)
    const { data: rawDetailedPayments } = await supabase
      .from('tuition_payments')
      .select('*')
      .in('student_id', studentIds)
      .eq('year', y);

    const detailedPayments = ((rawDetailedPayments || []) as DetailedPaymentRow[]).filter(p => !isPaymentVoid(p));

    // Calculate cumulative amount paid per student specifically for month `m`
    const paidAmountByStudentForMonth = new Map<string, number>();

    detailedPayments.forEach((p) => {
      const details = Array.isArray(p.fee_details) ? p.fee_details : [];
      for (const fd of details) {
        if (fd.type === 'arrears') continue;
        const fType = (fd.type || '').toLowerCase().trim();
        const isMonthly = ['tuition', 'tuition fee', 'hostel', 'transport', 'boarding'].includes(fType);
        if (isMonthly && Number(fd.month) === m) {
          const prev = paidAmountByStudentForMonth.get(p.student_id) || 0;
          paidAmountByStudentForMonth.set(p.student_id, roundCurrency(prev + Number(fd.amount || 0)));
        }
      }
    });

    // 4. Calculate Overdue List (Exact outstanding = scheduledFee - paidSoFar)
    const overdueList: OverdueItem[] = [];
    const dueDate = new Date(y, m - 1, 10);
    const today = new Date();
    const diffTime = today.getTime() - dueDate.getTime();
    const days_overdue = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

    targetStudents.forEach((std) => {
       const scheduledFee = feeMap.get(std.class_name) || 0;
       const alreadyPaid = paidAmountByStudentForMonth.get(std.id) || 0;
       const outstanding = roundCurrency(Math.max(0, scheduledFee - alreadyPaid));
       
       if (outstanding > 0) {
         overdueList.push({
           student_info: { id: std.id, name: std.name, roll: std.roll, phone: std.phone },
           class_name: std.class_name,
           month: m,
           year: y,
           amount_due: scheduledFee,
           amount_paid: alreadyPaid,
           outstanding,
           days_overdue
         });
       }
    });

    overdueList.sort((a, b) => b.outstanding - a.outstanding);

    return NextResponse.json({ success: true, data: overdueList } as ApiResponse<OverdueItem[]>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
