import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getMonthName } from '@/lib/finance-utils';
import { ApiResponse, SalarySlipData } from '@/types/finance';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { salary_id } = body;
    
    if (!salary_id) {
      return NextResponse.json({ success: false, error: "salary_id is required" }, { status: 400 });
    }

    const supabase = (await createServerSupabaseClient()) as any;
    
    // 1. Fetch salary payment with teacher info (staff_id references teachers table, not users)
    // @ts-ignore
    const { data: payment, error } = await supabase
      .from('salary_payments')
      .select(`
        *,
        teachers!salary_payments_staff_id_fkey(name, designation, phone)
      `)
      .eq('id', salary_id)
      .single();
      
    if (error || !payment) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
    }

    // Fetch school info from DB
    // @ts-ignore
    const { data: schoolData } = await supabase.from('school_info').select('name, address, phone, logo_url').limit(1).single();

    const schoolInfo = schoolData || {
      name: "Your School Name",
      address: "School Address, City, Country",
      phone: "+8801XXXXXXXXX",
    };

    // Format allowances and deductions into arrays
    const allowancesArr = Object.entries(payment.allowances || {}).map(([label, amount]) => ({
      label,
      amount: Number(amount)
    }));
    
    const deductionsArr = Object.entries(payment.deductions || {}).map(([label, amount]) => ({
      label,
      amount: Number(amount)
    }));

    // 2. Format Slip Data — use 'teachers' relation, not 'users'
    const slipData: SalarySlipData = {
      school: schoolInfo,
      slip_number: payment.slip_number,
      staff: {
        name: payment.teachers?.name || 'Unknown',
        designation: payment.teachers?.designation || 'Staff',
        phone: payment.teachers?.phone || '',
      },
      month_name: getMonthName(payment.month),
      year: payment.year,
      basic_salary: payment.basic_salary,
      allowances: allowancesArr,
      deductions: deductionsArr,
      gross_salary: payment.gross_salary,
      net_salary: payment.net_salary,
      payment_method: payment.payment_method,
      payment_date: payment.payment_date,
      is_computer_generated: true
    };

    // 3. Mark as printed
    if (!payment.is_printed) {
       // @ts-ignore
       await supabase.from('salary_payments').update({ is_printed: true }).eq('id', salary_id);
    }

    return NextResponse.json({ success: true, data: slipData } as ApiResponse<SalarySlipData>);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
