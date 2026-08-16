import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Rounds monetary amounts to 2 decimal places safely, avoiding JS floating point drift.
 */
export function roundCurrency(amount: number | string | null | undefined): number {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || '0')) || 0;
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Generates the next receipt number for tuition payments.
 * Format: RCP-YYYY-000001
 * Uses integer parsing from existing records and high-concurrency resilience.
 */
export async function generateReceiptNumber(supabase: SupabaseClient, year: number): Promise<string> {
  const prefix = `RCP-${year}-`;
  
  try {
    const { data, error } = await supabase
      .from('tuition_payments')
      .select('receipt_number')
      .like('receipt_number', `${prefix}%`)
      .order('receipt_number', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error querying max receipt number:', error);
    }

    let maxNum = 0;
    if (data && data.length > 0) {
      for (const row of data) {
        if (row.receipt_number && row.receipt_number.startsWith(prefix)) {
          const numPart = parseInt(row.receipt_number.replace(prefix, ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      }
    }

    const nextNum = maxNum + 1;
    return `${prefix}${nextNum.toString().padStart(6, '0')}`;
  } catch {
    // Fallback timestamp-based identifier if DB query fails
    const timeSuffix = (Date.now() % 1000000).toString().padStart(6, '0');
    return `${prefix}${timeSuffix}`;
  }
}

/**
 * Generates the next slip number for salary payments.
 * Format: SAL-YYYY-000001 (Teachers) or STF-YYYY-000001 (Staff)
 */
export async function generateSlipNumber(
  supabase: SupabaseClient,
  year: number,
  isStaff: boolean = false
): Promise<string> {
  const prefix = isStaff ? `STF-${year}-` : `SAL-${year}-`;
  const table = isStaff ? 'staff_salary_payments' : 'salary_payments';
  
  try {
    const { data, error } = await supabase
      .from(table)
      .select('slip_number')
      .like('slip_number', `${prefix}%`)
      .order('slip_number', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error querying max slip number:', error);
    }

    let maxNum = 0;
    if (data && data.length > 0) {
      for (const row of data) {
        if (row.slip_number && row.slip_number.startsWith(prefix)) {
          const numPart = parseInt(row.slip_number.replace(prefix, ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      }
    }

    const nextNum = maxNum + 1;
    return `${prefix}${nextNum.toString().padStart(6, '0')}`;
  } catch {
    const timeSuffix = (Date.now() % 1000000).toString().padStart(6, '0');
    return `${prefix}${timeSuffix}`;
  }
}

/**
 * Formats a number to comma-separated currency format with TK suffix.
 * e.g., 1250 -> 1,250 TK
 */
export function formatCurrency(amount: number | string | null | undefined, includeSymbol: boolean = true): string {
  const num = roundCurrency(amount);
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return includeSymbol ? `${formatted} TK` : formatted;
}

export function formatTaka(amount: number | string | null | undefined): string {
  return formatCurrency(amount, true);
}

/**
 * Returns the month name.
 */
export function getMonthName(month: number): string {
  if (month < 1 || month > 12) return '';
  const date = new Date(2000, month - 1, 1);
  return date.toLocaleString('en-US', { month: 'long' });
}

/**
 * Converts a numeric amount to English words in standard Taka format.
 * e.g., 2500 -> "Two Thousand Five Hundred Taka Only"
 * e.g., 105000 -> "One Lakh Five Thousand Taka Only"
 */
export function amountInWords(amount: number | string | null | undefined): string {
  const num = roundCurrency(amount);
  if (isNaN(num) || num === 0) return 'Zero Taka Only';

  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const taka = Math.floor(absNum);
  const poisha = Math.round((absNum - taka) * 100);

  const units = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertGroup(n: number): string {
    if (n === 0) return '';
    if (n < 20) return units[n];
    if (n < 100) {
      const unit = n % 10;
      return tens[Math.floor(n / 10)] + (unit !== 0 ? ' ' + units[unit] : '');
    }
    const rem = n % 100;
    return units[Math.floor(n / 100)] + ' Hundred' + (rem !== 0 ? ' ' + convertGroup(rem) : '');
  }

  function convertWholeNumber(n: number): string {
    if (n === 0) return 'Zero';

    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const hundred = Math.floor((n % 1000) / 100);
    const rest = n % 100;

    const parts: string[] = [];

    if (crore > 0) {
      parts.push(convertWholeNumber(crore) + ' Crore');
    }
    if (lakh > 0) {
      parts.push(convertGroup(lakh) + ' Lakh');
    }
    if (thousand > 0) {
      parts.push(convertGroup(thousand) + ' Thousand');
    }
    if (hundred > 0) {
      parts.push(units[hundred] + ' Hundred');
    }
    if (rest > 0) {
      parts.push(convertGroup(rest));
    }

    return parts.join(' ');
  }

  let words = (isNegative ? 'Minus ' : '') + convertWholeNumber(taka) + ' Taka';
  if (poisha > 0) {
    words += ' and ' + convertGroup(poisha) + ' Poisha';
  }
  words += ' Only';

  return words;
}

export const numberToWords = amountInWords;

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
