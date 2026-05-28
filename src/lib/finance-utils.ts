import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Generates the next receipt number for tuition payments.
 * Format: RCP-YYYY-000001
 * Note: For strict concurrency, consider using a Postgres sequence or RPC.
 */
export async function generateReceiptNumber(supabase: SupabaseClient, year: number): Promise<string> {
  const prefix = `RCP-${year}-`;
  
  const { data, error } = await supabase
    .from('tuition_payments')
    .select('receipt_number')
    .like('receipt_number', `${prefix}%`)
    .order('receipt_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to generate receipt number: ${error.message}`);
  }

  let nextNum = 1;
  if (data && data.length > 0) {
    const lastNumberStr = data[0].receipt_number.split('-')[2];
    nextNum = parseInt(lastNumberStr, 10) + 1;
  }

  return `${prefix}${nextNum.toString().padStart(6, '0')}`;
}

/**
 * Generates the next slip number for salary payments.
 * Format: SAL-YYYY-000001
 */
export async function generateSlipNumber(supabase: SupabaseClient, year: number): Promise<string> {
  const prefix = `SAL-${year}-`;
  
  const { data, error } = await supabase
    .from('salary_payments')
    .select('slip_number')
    .like('slip_number', `${prefix}%`)
    .order('slip_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to generate slip number: ${error.message}`);
  }

  let nextNum = 1;
  if (data && data.length > 0) {
    const lastNumberStr = data[0].slip_number.split('-')[2];
    nextNum = parseInt(lastNumberStr, 10) + 1;
  }

  return `${prefix}${nextNum.toString().padStart(6, '0')}`;
}

/**
 * Formats a number to South Asian comma format with TK suffix.
 * e.g., 1250 -> 1,250 TK
 */
export function formatTaka(amount: number): string {
  // Using en-IN to get the south asian number grouping system
  return amount.toLocaleString('en-IN') + ' TK';
}

/**
 * Returns the month name. Kept as English since the site must be entirely in English.
 */
export function getMonthName(month: number): string {
  if (month < 1 || month > 12) return '';
  const date = new Date(2000, month - 1, 1);
  return date.toLocaleString('en-US', { month: 'long' });
}

/**
 * Calculates fine based on due date and payment date.
 */
export function calculateFine(dueDate: Date, paymentDate: Date, dailyFine: number): number {
  if (paymentDate <= dueDate) {
    return 0;
  }
  
  const diffTime = paymentDate.getTime() - dueDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  return diffDays * dailyFine;
}
