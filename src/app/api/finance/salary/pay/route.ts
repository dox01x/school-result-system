import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import {
  SCHOOL_INFO_COLUMNS,
  STAFF_SALARY_CONFIG_COLUMNS,
  SALARY_PAYMENT_COLUMNS,
} from '@/lib/supabase/select-columns';
import { generateSlipNumber, getMonthName, roundCurrency } from '@/lib/finance-utils';
import { sendSalaryConfirmationSms } from '@/lib/sms-gateway';
import { ApiResponse, SalaryPayment } from '@/types/finance';

export async function POST(request: Request) {
  try {
    const auth = await requireRole(['super_admin', 'admin', 'accountant']);
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const body = await request.json();
    const { staff_id, month, year, payment_method = 'cash', note } = body;
    
    const parsedMonth = parseInt(String(month), 10);
    const parsedYear = parseInt(String(year), 10);

    if (!staff_id || !parsedMonth || !parsedYear || parsedMonth < 1 || parsedMonth > 12) {
      return NextResponse.json({ success: false, error: "Missing or invalid required fields (staff_id, month, year)" }, { status: 400 });
    }

    // 1. Fetch Staff Config
    const { data: config, error: configError } = await supabase
      .from('staff_salary_config')
      .select(STAFF_SALARY_CONFIG_COLUMNS)
      .eq('staff_id', staff_id)
      .eq('is_active', true)
      .maybeSingle();
      
    if (configError || !config) {
      return NextResponse.json({ success: false, error: "Active salary configuration not found for this teacher" }, { status: 404 });
    }

    // 2. Check if already paid
    const { data: existing } = await supabase
      .from('salary_payments')
      .select('id, slip_number')
      .match({ staff_id, month: parsedMonth, year: parsedYear })
      .maybeSingle();
      
    if (existing) {
      return NextResponse.json({ 
        success: false, 
        error: `Salary for ${getMonthName(parsedMonth)} ${parsedYear} is already paid (Slip: ${existing.slip_number})` 
      }, { status: 409 });
    }

    // 3. Calculate gross and net
    const sumValues = (obj: Record<string, unknown>) => Object.values(obj || {}).reduce((sum: number, val: unknown) => sum + Number(val || 0), 0);
    const totalAllowances = roundCurrency(sumValues(config.allowances as Record<string, unknown>));
    const totalDeductions = roundCurrency(sumValues(config.deductions as Record<string, unknown>));
    
    const gross_salary = roundCurrency(Number(config.basic_salary) + totalAllowances);
    const net_salary = roundCurrency(gross_salary - totalDeductions);

    if (net_salary < 0) {
      return NextResponse.json({ success: false, error: "Net salary cannot be negative" }, { status: 400 });
    }

    // Fetch staff info for typing and expense description
    const { data: staff } = await supabase
      .from('teachers')
      .select('name, designation, employee_type, phone')
      .eq('id', staff_id)
      .single();

    if (!staff) {
      return NextResponse.json({ success: false, error: "Teacher record not found" }, { status: 404 });
    }

    // 4. Generate Slip Number
    const slip_number = await generateSlipNumber(supabase, parsedYear, false);

    // 5. Insert into salary_payments
    const { data: salaryResult, error: insertError } = await supabase
      .from('salary_payments')
      .insert({
        slip_number,
        staff_id,
        staff_type: 'teacher',
        month: parsedMonth,
        year: parsedYear,
        basic_salary: Number(config.basic_salary),
        allowances: config.allowances,
        deductions: config.deductions,
        gross_salary,
        net_salary,
        payment_method,
        paid_by: user.id,
        payment_date: new Date().toISOString(),
        note: note || null
      })
      .select(SALARY_PAYMENT_COLUMNS)
      .single();
      
    if (insertError) throw insertError;

    // 6. Automatically add synchronized expense entry (with fallback)
    const expensePayload: Record<string, any> = {
      category: 'salary',
      amount: net_salary,
      description: `Salary paid to ${staff.name} for ${getMonthName(parsedMonth)} ${parsedYear} (Slip: ${slip_number})`,
      payment_method,
      paid_by: user?.id || null,
      expense_date: new Date().toISOString().split('T')[0],
      month: parsedMonth,
      year: parsedYear,
    };

    try {
      const { error: expErr } = await (supabase as any).from('expense_entries').insert({
        ...expensePayload,
        reference_type: 'salary_payment',
        reference_id: salaryResult.id
      });
      if (expErr) {
        await (supabase as any).from('expense_entries').insert(expensePayload);
      }
    } catch {
      await (supabase as any).from('expense_entries').insert(expensePayload);
    }

    // 7. Audit Log
    try {
      await (supabase as any).from('finance_audit_logs').insert({
        actor_id: user?.id && user.id !== '00000000-0000-0000-0000-000000000000' ? user.id : null,
        actor_name: user?.email || 'Staff',
        action: 'PAY_TEACHER_SALARY',
        target_table: 'salary_payments',
        target_id: salaryResult.id,
        details: {
          slip_number,
          staff_id,
          teacher_name: staff.name,
          month: parsedMonth,
          year: parsedYear,
          net_salary,
          payment_method
        }
      });
    } catch {
      // Non-blocking
    }

    // 8. Fetch School Info
    const { data: school } = await supabase.from('school_info').select(SCHOOL_INFO_COLUMNS).maybeSingle();

    // 9. SMS Confirmation (Fire-and-forget)
    try {
      if (staff.phone) {
        sendSalaryConfirmationSms({
          phone: staff.phone,
          staffName: staff.name,
          netSalary: net_salary,
          month: getMonthName(parsedMonth),
          year: parsedYear,
          slipNumber: slip_number,
          schoolName: school?.name
        }).catch(() => {});
      }
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true, data: { ...salaryResult, staff, school } } as unknown as ApiResponse<SalaryPayment>);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
