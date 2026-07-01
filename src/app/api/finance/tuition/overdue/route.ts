import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ApiResponse } from '@/types/finance';

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

    const supabase = (await createServerSupabaseClient()) as any;

    // 1. Get Fee Structure for Tuition
    let feeQuery = supabase.from('fee_structure').select('class_name, amount').match({ fee_type: 'tuition', is_active: true, academic_year: year });
    if (className) feeQuery = feeQuery.eq('class_name', className);
    const { data: fees } = await feeQuery;
    
    if (!fees || fees.length === 0) {
       return NextResponse.json({ success: true, data: [] });
    }

    const feeMap = new Map(fees.map((f: any) => [f.class_name, f.amount]));

    // 2. Get Students — JOIN with classes to get class name (students table has class_id, not class_name)
    let stdQuery = supabase.from('students').select('id, name, roll, phone, class_id, classes!inner(name)');
    if (className) {
      // Filter by class name via the joined classes table
      stdQuery = stdQuery.eq('classes.name', className);
    }
    const { data: students } = await stdQuery;

    if (!students || students.length === 0) return NextResponse.json({ success: true, data: [] });

    // Map students with their class name from the joined classes table
    const studentsWithClassName = students.map((s: any) => ({
      ...s,
      class_name: s.classes?.name || ''
    }));

    // Filter students to those whose classes have a tuition fee structure
    const targetStudents = studentsWithClassName.filter((s: any) => feeMap.has(s.class_name));

    // 3. Get Payments for this month & year
    const studentIds = targetStudents.map((s: any) => s.id);
    
    if (studentIds.length === 0) return NextResponse.json({ success: true, data: [] });

    const { data: payments } = await supabase
      .from('tuition_payments')
      .select('student_id, amount_due, amount_paid, discount, fine')
      .in('student_id', studentIds)
      .eq('year', y);

    // Build a map: for each student, sum ALL payments in this year that include this month's tuition
    // We check fee_details for month-specific matching via a separate query
    const { data: detailedPayments } = await supabase
      .from('tuition_payments')
      .select('student_id, fee_details, amount_paid')
      .in('student_id', studentIds)
      .eq('year', y);

    // For each student, check if they've paid tuition for the target month
    const paidStudentIds = new Set<string>();
    const partialPayments = new Map<string, { paid: number; due: number }>();

    if (detailedPayments) {
      for (const p of detailedPayments) {
        const details = Array.isArray(p.fee_details) ? p.fee_details : [];
        for (const fd of details) {
          if (fd.type === 'arrears') continue;
          const fType = (fd.type || '').toLowerCase().trim();
          const isMonthly = ['tuition', 'tuition fee', 'hostel', 'transport', 'boarding'].includes(fType);
          if (isMonthly && Number(fd.month) === m) {
            if (p.student_id) paidStudentIds.add(p.student_id);
          }
        }
      }
    }

    // 4. Determine Overdue — students who have NOT paid tuition for the target month
    const overdueList: any[] = [];
    const dueDate = new Date(y, m - 1, 10); // Due on the 10th of the month
    const today = new Date();
    const diffTime = today.getTime() - dueDate.getTime();
    const days_overdue = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

    targetStudents.forEach((std: any) => {
       const amountDue = feeMap.get(std.class_name) || 0;
       
       if (!paidStudentIds.has(std.id)) {
         // No tuition payment for this month
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

    // Sort by outstanding amount descending
    overdueList.sort((a, b) => b.outstanding - a.outstanding);

    return NextResponse.json({ success: true, data: overdueList } as ApiResponse<any[]>);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
