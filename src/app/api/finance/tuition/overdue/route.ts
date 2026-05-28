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

    const supabase = await createServerSupabaseClient();

    // 1. Get Fee Structure for Tuition
    // @ts-ignore
    let feeQuery = supabase.from('fee_structure').select('class_name, amount').match({ fee_type: 'tuition', is_active: true, academic_year: year });
    if (className) feeQuery = feeQuery.eq('class_name', className);
    const { data: fees } = await feeQuery;
    
    if (!fees || fees.length === 0) {
       return NextResponse.json({ success: true, data: [] });
    }

    const feeMap = new Map(fees.map((f: any) => [f.class_name, f.amount]));

    // 2. Get Students
    // @ts-ignore
    let stdQuery = supabase.from('students').select('id, name, roll_no, class_name');
    if (className) stdQuery = stdQuery.eq('class_name', className);
    const { data: students } = await stdQuery;

    if (!students || students.length === 0) return NextResponse.json({ success: true, data: [] });

    // Filter students to those whose classes have a tuition fee structure
    const targetStudents = students.filter((s: any) => feeMap.has(s.class_name));

    // 3. Get Payments for this month & year
    const studentIds = targetStudents.map((s: any) => s.id);
    
    // @ts-ignore
    const { data: payments } = await supabase
      .from('tuition_payments')
      .select('student_id, amount_due, amount_paid')
      .in('student_id', studentIds)
      .match({ fee_type: 'tuition', month: m, year: y });

    const paymentMap = new Map();
    if (payments) {
      payments.forEach((p: any) => {
         paymentMap.set(p.student_id, p);
      });
    }

    // 4. Determine Overdue
    const overdueList: any[] = [];
    const dueDate = new Date(y, m - 1, 10);
    const today = new Date();
    const diffTime = today.getTime() - dueDate.getTime();
    const days_overdue = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

    targetStudents.forEach((std: any) => {
       const p = paymentMap.get(std.id);
       const amountDue = feeMap.get(std.class_name) || 0;
       
       if (!p) {
         // No payment made at all
         overdueList.push({
           student_info: std,
           class_name: std.class_name,
           month: m,
           year: y,
           amount_due: amountDue,
           amount_paid: 0,
           outstanding: amountDue,
           days_overdue
         });
       } else if (p.amount_paid < p.amount_due) {
         // Partially paid
         overdueList.push({
           student_info: std,
           class_name: std.class_name,
           month: m,
           year: y,
           amount_due: p.amount_due,
           amount_paid: p.amount_paid,
           outstanding: p.amount_due - p.amount_paid,
           days_overdue
         });
       }
    });

    // 5. Sort by days overdue descending (already same since dueDate is same for all in this batch, 
    // but just in case, sort by outstanding amount descending as secondary)
    overdueList.sort((a, b) => b.outstanding - a.outstanding);

    return NextResponse.json({ success: true, data: overdueList } as ApiResponse<any[]>);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
