export type FeeType = 'tuition' | 'admission' | 'sports' | 'library' | 'book' | 'exam' | 'mct_exam' | 'semester_exam' | 'hostel' | 'multiple' | 'other';
export type PaymentMethod = 'cash' | 'bank' | 'mobile_banking';
export type ExpenseCategory = 'electricity' | 'water' | 'maintenance' | 'stationery' | 'sports' | 'library' | 'exam' | 'cleaning' | 'salary' | 'other';
export type IncomeCategory = 'tuition' | 'donation' | 'grant' | 'rent' | 'exam_fee' | 'other';

export interface FeeStructure {
  id: string;
  class_name: string;
  fee_type: FeeType;
  amount: number;
  description?: string;
  academic_year: string;
  is_active: boolean;
  created_at: string;
}

export interface TuitionPayment {
  id: string;
  receipt_number: string;
  student_id: string;
  class_name: string;
  section?: string;
  fee_type: FeeType;
  fee_details?: {
    type: FeeType | string;
    amount: number;
    month?: number;
    year?: number;
  }[];
  month?: number;
  year: number;
  amount_due: number;
  amount_paid: number;
  discount: number;
  fine: number;
  payment_method: PaymentMethod;
  collected_by: string;
  payment_date: string;
  note?: string;
  is_printed: boolean;
}

export interface SalaryPayment {
  id: string;
  slip_number: string;
  staff_id: string;
  staff_type: 'teacher' | 'staff';
  month: number;
  year: number;
  basic_salary: number;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  gross_salary: number;
  net_salary: number;
  payment_method: PaymentMethod;
  paid_by: string;
  payment_date: string;
  note?: string;
  is_printed: boolean;
}

export interface IncomeEntry {
  id: string;
  category: IncomeCategory | string;
  amount: number;
  description: string;
  received_from?: string;
  payment_method: PaymentMethod;
  received_by: string;
  income_date: string;
  academic_year?: string;
  month?: number;
  year?: number;
  created_at: string;
}

export interface ExpenseEntry {
  id: string;
  category: ExpenseCategory | string;
  amount: number;
  description: string;
  vendor?: string;
  payment_method: PaymentMethod;
  paid_by: string;
  expense_date: string;
  receipt_url?: string;
  month?: number;
  year?: number;
  created_at: string;
}

export interface StaffSalaryConfig {
  id: string;
  staff_id: string;
  basic_salary: number;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  effective_from: string;
  is_active: boolean;
  created_at: string;
}

export interface FinanceSummary {
  total_income: number;
  total_expense: number;
  net_balance: number;
  tuition_collected: number;
  tuition_due: number;
  salary_paid: number;
  month: number;
  year: number;
}

export interface MonthlyReport {
  month: number;
  year: number;
  income_breakdown: { category: string; amount: number }[];
  expense_breakdown: { category: string; amount: number }[];
  tuition_summary: {
    total_due: number;
    total_collected: number;
    total_overdue: number;
    collection_rate: number;
  };
  salary_summary: {
    total_teachers: number;
    total_staff: number;
    total_paid: number;
  };
  net_balance: number;
}

export interface YearlyReport {
  year: number;
  /** Opening balance for the year (placeholder until ledger backfill exists) */
  start_balance: number;
  monthly_summary: {
    month: number;
    income: number;
    expense: number;
    balance: number;
  }[];
  top_expense_categories: { category: string; total: number }[];
  top_income_categories: { category: string; total: number }[];
  total_income: number;
  total_expense: number;
  net_balance: number;
}

export interface TuitionReceiptData {
  school: { name: string; address: string; phone: string; logo_url?: string };
  receipt_number: string;
  student: { name: string; class_name: string; section: string; roll?: string };
  fee_type: string;
  fee_details?: { type: string; amount: number; month?: number; year?: number }[];
  month_name?: string;
  year: number;
  amount_due: number;
  discount: number;
  fine: number;
  amount_paid: number;
  payment_method: string;
  payment_date: string;
  collected_by: string;
  note?: string;
  is_computer_generated: true;
}

export interface SalarySlipData {
  school: { name: string; address: string; phone: string; logo_url?: string };
  slip_number: string;
  staff: { name: string; designation: string; phone: string };
  month_name: string;
  year: number;
  basic_salary: number;
  allowances: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
  gross_salary: number;
  net_salary: number;
  payment_method: string;
  payment_date: string;
  is_computer_generated: true;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
