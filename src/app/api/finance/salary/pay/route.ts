import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  SCHOOL_INFO_COLUMNS,
  STAFF_SALARY_CONFIG_COLUMNS,
  SALARY_PAYMENT_COLUMNS,
} from '@/lib/supabase/select-columns';
import { generateSlipNumber } from '@/lib/finance-utils';
import { ApiResponse, SalaryPayment } from '@/types/finance';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { staff_id, month, year, payment_method, paid_by, note } = body;
    
    if (!staff_id || !month || !year || !payment_method) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const supabase = (await createServerSupabaseClient()) as any;
    
    // 1. Fetch Staff Config
    // @ts-ignore
    const { data: config, error: configError } = await supabase
      .from('staff_salary_config')
      .select(STAFF_SALARY_CONFIG_COLUMNS)
      .eq('staff_id', staff_id)
      .eq('is_active', true)
      .single();
      
    if (configError || !config) {
      return NextResponse.json({ success: false, error: "Salary configuration not found or inactive for this staff" }, { status: 404 });
    }

    // 2. Check if already paid
    // @ts-ignore
    const { data: existing } = await supabase
      .from('salary_payments')
      .select('id')
      .match({ staff_id, month, year })
      .single();
      
    if (existing) {
      return NextResponse.json({ success: false, error: "Salary for this month is already paid" }, { status: 409 });
    }

    // 3. Calculate gross and net
    const sumValues = (obj: Record<string, any>) => Object.values(obj).reduce((sum: number, val: any) => sum + Number(val), 0);
    const totalAllowances = sumValues(config.allowances || {});
    const totalDeductions = sumValues(config.deductions || {});
    
    const gross_salary = config.basic_salary + totalAllowances;
    const net_salary = gross_salary - totalDeductions;

    // Fetch staff info for typing and expense description
    // @ts-ignore
    const { data: staff } = await supabase.from('teachers').select('name, designation, employee_type').eq('id', staff_id).single();
    if (!staff) {
        return NextResponse.json({ success: false, error: "Staff not found" }, { status: 404 });
    }

    // 4. Generate Slip Number
    // @ts-ignore
    const slip_number = await generateSlipNumber(supabase, year);

    // 5. Insert into salary_payments
    // @ts-ignore
    const { data: salaryResult, error: insertError } = await supabase
      .from('salary_payments')
      .insert({
        slip_number,
        staff_id,
        staff_type: staff.employee_type || 'teacher',
        month,
        year,
        basic_salary: config.basic_salary,
        allowances: config.allowances,
        deductions: config.deductions,
        gross_salary,
        net_salary,
        payment_method,
        paid_by,
        note
      })
      .select(SALARY_PAYMENT_COLUMNS)
      .single();
      
    if (insertError) throw insertError;

    // 6. Automatically add to expense_entries
    // @ts-ignore
    await supabase.from('expense_entries').insert({
      category: 'salary',
      amount: net_salary,
      description: `Salary paid to ${staff.name} for ${month}/${year} (Slip: ${slip_number})`,
      payment_method,
      paid_by,
      expense_date: new Date().toISOString().split('T')[0],
      month,
      year
    });

    // 7. Fetch School Info
    // @ts-ignore
    const { data: school } = await supabase.from('school_info').select(SCHOOL_INFO_COLUMNS).single();

    return NextResponse.json({ success: true, data: { ...salaryResult, staff, school } } as unknown as ApiResponse<SalaryPayment>);

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
