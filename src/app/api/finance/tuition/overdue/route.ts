import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ApiResponse } from '@/types/finance';

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
  fee_details: { type?: string; month?: number }[] | null;
  amount_paid: number;
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const className = searchParams.get('class_name');

    if (!month || !year) {
      return NextResponse.json({ success: false, error: "month and year are required" }, { status: 400 });
    }

    const m = parseInt(month);
    const y = parseInt(year);

    const supabase = await createServerSupabaseClient();

    // 1. Get Fee Structure for Tuition
    let feeQuery = supabase.from('fee_structure').select('class_name, amount').match({ fee_type: 'tuition', is_active: true, academic_year: year });
    if (className) feeQuery = feeQuery.eq('class_name', className);
    const { data: rawFees } = await feeQuery;
    const fees = (rawFees || []) as unknown as FeeStructureRow[];
    
    if (fees.length === 0) {
       return NextResponse.json({ success: true, data: [] });
    }

    const feeMap = new Map(fees.map((f) => [f.class_name, f.amount]));

    // 2. Get Students — JOIN with classes to get class name
    let stdQuery = supabase.from('students').select('id, name, roll, phone, class_id, classes!inner(name)');
    if (className) {
      stdQuery = stdQuery.eq('classes.name', className);
    }
    const { data: rawStudents } = await stdQuery;
    const students = (rawStudents || []) as unknown as StudentRow[];

    if (students.length === 0) return NextResponse.json({ success: true, data: [] });

    // Map students with their class name from the joined classes table
    const studentsWithClassName = students.map((s) => ({
      ...s,
      class_name: s.classes?.name || ''
    }));

    // Filter students to those whose classes have a tuition fee structure
    const targetStudents = studentsWithClassName.filter((s) => feeMap.has(s.class_name));
    const studentIds = targetStudents.map((s) => s.id);
    
    if (studentIds.length === 0) return NextResponse.json({ success: true, data: [] });

    // We check fee_details for month-specific matching via a separate query
    const { data: rawDetailedPayments } = await supabase
      .from('tuition_payments')
      .select('student_id, fee_details, amount_paid')
      .in('student_id', studentIds)
      .eq('year', y);

    const detailedPayments = (rawDetailedPayments || []) as unknown as DetailedPaymentRow[];

    // For each student, check if they've paid tuition for the target month
    const paidStudentIds = new Set<string>();

    detailedPayments.forEach((p) => {
      const details = Array.isArray(p.fee_details) ? p.fee_details : [];
      for (const fd of details) {
        if (fd.type === 'arrears') continue;
        const fType = (fd.type || '').toLowerCase().trim();
        const isMonthly = ['tuition', 'tuition fee', 'hostel', 'transport', 'boarding'].includes(fType);
        if (isMonthly && Number(fd.month) === m) {
          if (p.student_id) paidStudentIds.add(p.student_id);
        }
      }
    });

    // 4. Determine Overdue — students who have NOT paid tuition for the target month
    const overdueList: OverdueItem[] = [];
    const dueDate = new Date(y, m - 1, 10);
    const today = new Date();
    const diffTime = today.getTime() - dueDate.getTime();
    const days_overdue = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

    targetStudents.forEach((std) => {
       const amountDue = feeMap.get(std.class_name) || 0;
       
       if (!paidStudentIds.has(std.id)) {
         overdueList.push({
           student_info: { id: std.id, name: std.name, roll: std.roll, phone: std.phone },
           class_name: std.class_name,
           month: m,
           year: y,
           amount_due: amountDue,
           amount_paid: 0,
           outstanding: amountDue,
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
