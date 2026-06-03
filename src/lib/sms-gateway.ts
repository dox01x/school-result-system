/**
 * SMS Gateway Utility
 * 
 * Supports multiple Bangladeshi SMS gateways.
 * Configure via environment variables:
 *   SMS_GATEWAY=bulksmsbd|sslwireless|greenweb|none
 *   SMS_API_KEY=your_api_key
 *   SMS_SENDER_ID=your_sender_id (optional)
 * 
 * Set SMS_GATEWAY=none (or leave unset) to disable SMS.
 */

export type SmsResult = {
  success: boolean;
  message: string;
  gateway?: string;
};

/**
 * Send an SMS message.
 * Returns silently on failure — SMS should never block a payment from completing.
 */
export async function sendSms(phone: string, text: string): Promise<SmsResult> {
  const gateway = process.env.SMS_GATEWAY?.toLowerCase().trim() || 'none';
  const apiKey = process.env.SMS_API_KEY || '';
  const senderId = process.env.SMS_SENDER_ID || 'SchoolERP';

  if (gateway === 'none' || !apiKey) {
    return { success: false, message: 'SMS gateway not configured', gateway };
  }

  // Normalize BD phone number: ensure starts with 88
  const cleanPhone = normalizeBDPhone(phone);
  if (!cleanPhone) {
    return { success: false, message: 'Invalid phone number', gateway };
  }

  try {
    let result: SmsResult;

    switch (gateway) {
      case 'bulksmsbd':
        result = await sendViaBulkSmsBD(apiKey, senderId, cleanPhone, text);
        break;
      case 'sslwireless':
        result = await sendViaSslWireless(apiKey, senderId, cleanPhone, text);
        break;
      case 'greenweb':
        result = await sendViaGreenWeb(apiKey, cleanPhone, text);
        break;
      default:
        result = { success: false, message: `Unknown gateway: ${gateway}`, gateway };
    }

    return result;
  } catch (error: any) {
    console.error('[SMS Gateway Error]', error.message);
    return { success: false, message: error.message, gateway };
  }
}

/**
 * Send tuition payment confirmation SMS.
 */
export async function sendPaymentConfirmationSms(params: {
  phone: string;
  studentName: string;
  amount: number;
  receiptNumber: string;
  schoolName?: string;
}): Promise<SmsResult> {
  const { phone, studentName, amount, receiptNumber, schoolName } = params;
  
  if (!phone || phone.trim().length < 8) {
    return { success: false, message: 'No phone number provided' };
  }

  const amountStr = amount.toLocaleString('en-IN');
  const school = schoolName || 'School';
  const text = `${school}: Received ${amountStr} TK from ${studentName}. Receipt: ${receiptNumber}. Thank you.`;

  return sendSms(phone, text);
}

/**
 * Send salary payment confirmation SMS.
 */
export async function sendSalaryConfirmationSms(params: {
  phone: string;
  staffName: string;
  netSalary: number;
  month: string;
  year: number;
  slipNumber: string;
  schoolName?: string;
}): Promise<SmsResult> {
  const { phone, staffName, netSalary, month, year, slipNumber, schoolName } = params;
  
  if (!phone || phone.trim().length < 8) {
    return { success: false, message: 'No phone number provided' };
  }

  const amountStr = netSalary.toLocaleString('en-IN');
  const school = schoolName || 'School';
  const text = `${school}: Salary ${amountStr} TK for ${month} ${year} credited to ${staffName}. Slip: ${slipNumber}.`;

  return sendSms(phone, text);
}

/**
 * Send overdue reminder SMS.
 */
export async function sendOverdueReminderSms(params: {
  phone: string;
  studentName: string;
  outstanding: number;
  monthName: string;
  schoolName?: string;
}): Promise<SmsResult> {
  const { phone, studentName, outstanding, monthName, schoolName } = params;
  
  if (!phone || phone.trim().length < 8) {
    return { success: false, message: 'No phone number provided' };
  }

  const amountStr = outstanding.toLocaleString('en-IN');
  const school = schoolName || 'School';
  const text = `${school}: Dear guardian, ${studentName}'s ${monthName} tuition fee of ${amountStr} TK is overdue. Please pay at your earliest convenience.`;

  return sendSms(phone, text);
}

// ─── Helper Functions ────────────────────────────────────────────

function normalizeBDPhone(phone: string): string | null {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // Handle various BD number formats
  if (digits.startsWith('880')) {
    digits = digits; // Already has full country code 880
  } else if (digits.startsWith('88') && !digits.startsWith('880')) {
    // Has '88' but missing the '0' — unlikely but handle gracefully
    digits = digits;
  } else if (digits.startsWith('0')) {
    digits = '88' + digits; // 01711... → 8801711... (13 digits)
  } else if (digits.length === 10) {
    digits = '880' + digits;
  } else if (digits.length === 11 && digits.startsWith('01')) {
    digits = '88' + digits; // 01711234567 → 8801711234567
  }

  // BD numbers should be 13 digits: 880XXXXXXXXXX
  if (digits.length !== 13 || !digits.startsWith('880')) {
    return null;
  }

  return digits;
}

// ─── Gateway Implementations ────────────────────────────────────

async function sendViaBulkSmsBD(apiKey: string, senderId: string, phone: string, text: string): Promise<SmsResult> {
  const url = `https://bulksmsbd.net/api/smsapi`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      senderid: senderId,
      number: phone,
      message: text,
      type: 'text'
    })
  });
  const data = await res.json();
  return {
    success: data.response_code === 202 || data.success === true,
    message: data.success_message || data.error_message || JSON.stringify(data),
    gateway: 'bulksmsbd'
  };
}

async function sendViaSslWireless(apiKey: string, senderId: string, phone: string, text: string): Promise<SmsResult> {
  const url = `https://smsplus.sslwireless.com/api/v3/send-sms`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_token: apiKey,
      sid: senderId,
      msisdn: phone,
      sms: text,
      csms_id: `SMS_${Date.now()}`
    })
  });
  const data = await res.json();
  return {
    success: data.status === 'SUCCESS',
    message: data.status_message || JSON.stringify(data),
    gateway: 'sslwireless'
  };
}

async function sendViaGreenWeb(apiKey: string, phone: string, text: string): Promise<SmsResult> {
  const url = `http://api.greenweb.com.bd/api.php?token=${encodeURIComponent(apiKey)}&to=${phone}&message=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  const responseText = await res.text();
  const success = responseText.includes('Ok') || responseText.includes('ok');
  return {
    success,
    message: responseText,
    gateway: 'greenweb'
  };
}
