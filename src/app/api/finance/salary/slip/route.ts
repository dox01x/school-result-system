import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getMonthName } from '@/lib/finance-utils';
import { ApiResponse, SalarySlipData } from '@/types/finance';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const body = await request.json();
    const { salary_id } = body;
    
    if (!salary_id) {
      return NextResponse.json({ success: false, error: "salary_id is required" }, { status: 400 });
    }

    // Fetch school info from DB (with fallback)
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

    // 1. Try to find in teacher salary_payments
    const { data: teacherPayment } = await supabase
      .from('salary_payments')
      .select(`
        *,
        teachers(name, designation, phone)
      `)
      .eq('id', salary_id)
      .maybeSingle();

    if (teacherPayment) {
      let teacherName = (teacherPayment.teachers as { name?: string })?.name;
      let teacherDesignation = (teacherPayment.teachers as { designation?: string })?.designation;
      let teacherPhone = (teacherPayment.teachers as { phone?: string })?.phone;

      // Fallback lookup if join returned null
      if (!teacherName && teacherPayment.staff_id) {
        const { data: t } = await supabase.from('teachers').select('name, designation, phone').eq('id', teacherPayment.staff_id).maybeSingle();
        if (t) {
          teacherName = t.name;
          teacherDesignation = t.designation;
          teacherPhone = t.phone;
        }
      }

      const allowancesArr = Object.entries((teacherPayment.allowances as Record<string, unknown>) || {}).map(([label, amount]) => ({
        label,
        amount: Number(amount)
      }));
      
      const deductionsArr = Object.entries((teacherPayment.deductions as Record<string, unknown>) || {}).map(([label, amount]) => ({
        label,
        amount: Number(amount)
      }));

      const slipData: SalarySlipData = {
        school: schoolInfo,
        slip_number: teacherPayment.slip_number,
        staff: {
          name: teacherName || 'Teacher',
          designation: teacherDesignation || 'Teacher',
          phone: teacherPhone || '',
        },
        month_name: getMonthName(teacherPayment.month),
        year: teacherPayment.year,
        basic_salary: teacherPayment.basic_salary ?? 0,
        allowances: allowancesArr,
        deductions: deductionsArr,
        gross_salary: teacherPayment.gross_salary ?? 0,
        net_salary: teacherPayment.net_salary ?? 0,
        payment_method: teacherPayment.payment_method || 'cash',
        payment_date: teacherPayment.payment_date || '',
        is_computer_generated: true
      };

      try {
        if (!teacherPayment.is_printed) {
          await supabase.from('salary_payments').update({ is_printed: true }).eq('id', salary_id);
        }
      } catch {
        // non-blocking
      }

      return NextResponse.json({ success: true, data: slipData } as ApiResponse<SalarySlipData>);
    }

    // 2. Try to find in general staff_salary_payments
    let staffPayment: any = null;
    try {
      const { data } = await supabase
        .from('staff_salary_payments')
        .select(`
          *,
          staffs(name, designation, phone)
        `)
        .eq('id', salary_id)
        .maybeSingle();
      staffPayment = data;
    } catch {
      // ignore
    }

    if (staffPayment) {
      let staffName = (staffPayment.staffs as { name?: string })?.name;
      let staffDesignation = (staffPayment.staffs as { designation?: string })?.designation;
      let staffPhone = (staffPayment.staffs as { phone?: string })?.phone;

      // Fallback lookup if join returned null
      if (!staffName && staffPayment.staff_id) {
        const { data: s } = await supabase.from('staffs').select('name, designation, phone').eq('id', staffPayment.staff_id).maybeSingle();
        if (s) {
          staffName = s.name;
          staffDesignation = s.designation;
          staffPhone = s.phone;
        }
      }

      const allowancesArr = Object.entries((staffPayment.allowances as Record<string, unknown>) || {}).map(([label, amount]) => ({
        label,
        amount: Number(amount)
      }));
      
      const deductionsArr = Object.entries((staffPayment.deductions as Record<string, unknown>) || {}).map(([label, amount]) => ({
        label,
        amount: Number(amount)
      }));

      const slipData: SalarySlipData = {
        school: schoolInfo,
        slip_number: staffPayment.slip_number,
        staff: {
          name: staffName || 'Staff',
          designation: staffDesignation || 'Staff',
          phone: staffPhone || '',
        },
        month_name: getMonthName(staffPayment.month),
        year: staffPayment.year,
        basic_salary: staffPayment.basic_salary ?? 0,
        allowances: allowancesArr,
        deductions: deductionsArr,
        gross_salary: staffPayment.gross_salary ?? 0,
        net_salary: staffPayment.net_salary ?? 0,
        payment_method: staffPayment.payment_method || 'cash',
        payment_date: staffPayment.payment_date || '',
        is_computer_generated: true
      };

      try {
        if (!staffPayment.is_printed) {
          await supabase.from('staff_salary_payments').update({ is_printed: true }).eq('id', salary_id);
        }
      } catch {
        // non-blocking
      }

      return NextResponse.json({ success: true, data: slipData } as ApiResponse<SalarySlipData>);
    }

    return NextResponse.json({ success: false, error: "Salary payment record not found" }, { status: 404 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
