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

    const supabase = await createServerSupabaseClient();
    
    // 1. Fetch salary payment with teacher info (staff_id references teachers table)
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
    const { data: schoolData } = await supabase.from('school_info').select('name, address, phone, logo_url').limit(1).single();

    const schoolInfo = schoolData || {
      name: "Your School Name",
      address: "School Address, City, Country",
      phone: "+8801XXXXXXXXX",
    };

    // Format allowances and deductions into arrays
    const allowancesArr = Object.entries((payment.allowances as Record<string, unknown>) || {}).map(([label, amount]) => ({
      label,
      amount: Number(amount)
    }));
    
    const deductionsArr = Object.entries((payment.deductions as Record<string, unknown>) || {}).map(([label, amount]) => ({
      label,
      amount: Number(amount)
    }));

    // 2. Format Slip Data — use 'teachers' relation
    const slipData: SalarySlipData = {
      school: schoolInfo,
      slip_number: payment.slip_number,
      staff: {
        name: (payment.teachers as { name?: string })?.name || 'Unknown',
        designation: (payment.teachers as { designation?: string })?.designation || 'Staff',
        phone: (payment.teachers as { phone?: string })?.phone || '',
      },
      month_name: getMonthName(payment.month),
      year: payment.year,
      basic_salary: payment.basic_salary ?? 0,
      allowances: allowancesArr,
      deductions: deductionsArr,
      gross_salary: payment.gross_salary ?? 0,
      net_salary: payment.net_salary ?? 0,
      payment_method: payment.payment_method || 'cash',
      payment_date: payment.payment_date || '',
      is_computer_generated: true
    };

    // 3. Mark as printed
    if (!payment.is_printed) {
       await supabase.from('salary_payments').update({ is_printed: true }).eq('id', salary_id);
    }

    return NextResponse.json({ success: true, data: slipData } as ApiResponse<SalarySlipData>);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
