import { TuitionReceiptData, SalarySlipData } from '@/types/finance';
import { formatTaka, getMonthName, amountInWords } from '@/lib/finance-utils';

export type ReceiptFormat = 'standard' | 'dual' | 'pos';

export interface SchoolInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
}

export interface RenderReceiptOptions {
  format?: ReceiptFormat;
  copyLabel?: string;
  showSignatures?: boolean;
  school?: SchoolInfo;
}

/**
 * Shared CSS for print and preview:
 * - Clean, crisp, neutral typography matching the website
 * - Centered school branding
 * - Selective semantic colors (Green for Paid, Red for Due)
 * - Borderless & Fill-free paper aesthetic
 * - No redundant physical signature boxes for computer-generated receipts
 */
export const RECEIPT_PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    font-family: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #0f172a;
    background-color: #ffffff;
    font-size: 12px;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
  }

  .font-mono {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-feature-settings: "tnum" 1;
  }

  /* Page Wrapper */
  .receipt-page {
    max-width: 800px;
    margin: 0 auto;
    background: #ffffff;
    padding: 24px 28px;
  }

  .receipt-dual-wrapper {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
    background: #ffffff;
    padding: 16px 20px;
  }

  .receipt-dual-item {
    position: relative;
    padding: 2px 0;
  }

  .receipt-dual-divider {
    text-align: center;
    position: relative;
    margin: 6px 0;
  }

  .receipt-dual-divider::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    border-top: 1px dashed #cbd5e1;
  }

  .receipt-dual-divider span {
    position: relative;
    background: #ffffff;
    padding: 0 12px;
    font-size: 9px;
    color: #94a3b8;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  /* POS Format */
  .receipt-pos {
    width: 76mm;
    max-width: 76mm;
    margin: 0 auto;
    padding: 10px 6px;
    font-size: 11px;
    color: #0f172a;
  }

  /* Centered Header */
  .header-container {
    text-align: center;
    padding-bottom: 12px;
    border-bottom: 1px solid #e2e8f0;
    margin-bottom: 14px;
  }

  .school-logo {
    width: 44px;
    height: 44px;
    object-fit: contain;
    margin: 0 auto 6px auto;
    display: block;
  }

  .school-details h1 {
    font-size: 18px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .school-details p {
    font-size: 11px;
    color: #64748b;
    margin-top: 2px;
    line-height: 1.35;
  }

  .receipt-title-box {
    margin-top: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .receipt-type-title {
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #0f172a;
  }

  .copy-tag {
    font-size: 10px;
    font-weight: 500;
    color: #64748b;
  }

  /* Top Meta Row (Receipt No & Date) */
  .top-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11.5px;
    color: #64748b;
    margin-bottom: 12px;
    padding: 0 2px;
  }

  .top-meta-row strong {
    color: #0f172a;
  }

  /* Info Grid (Clean borderless, no fill backgrounds) */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px 18px;
    margin-bottom: 16px;
    padding: 0 2px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    font-size: 11.5px;
    line-height: 1.4;
  }

  .info-label {
    color: #94a3b8;
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 1px;
  }

  .info-value {
    color: #0f172a;
    font-weight: 600;
  }

  /* Semantic Status Colors */
  .status-paid {
    color: #16a34a;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .status-partial {
    color: #d97706;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .status-due {
    color: #dc2626;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .status-void {
    color: #dc2626;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  /* Table */
  .table-container {
    margin-bottom: 16px;
  }

  .receipt-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
  }

  .receipt-table th {
    color: #475569;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 6px 4px;
    border-bottom: 1px solid #cbd5e1;
    text-align: left;
  }

  .receipt-table th.text-right,
  .receipt-table td.text-right {
    text-align: right;
  }

  .receipt-table th.text-center,
  .receipt-table td.text-center {
    text-align: center;
  }

  .receipt-table td {
    padding: 7px 4px;
    border-bottom: 1px solid #f1f5f9;
    color: #1e293b;
  }

  .receipt-table tbody tr:last-child td {
    border-bottom: 1px solid #cbd5e1;
  }

  .item-title {
    font-weight: 600;
    color: #0f172a;
  }

  .item-subtitle {
    font-size: 10px;
    color: #94a3b8;
    margin-top: 1px;
  }

  /* Financial Summary */
  .summary-section {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 14px;
  }

  .summary-box {
    width: 280px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11.5px;
    padding: 1px 2px;
    color: #64748b;
  }

  .summary-row.total-payable {
    border-top: 1px solid #e2e8f0;
    padding-top: 5px;
    margin-top: 2px;
    font-weight: 700;
    color: #0f172a;
    font-size: 12px;
  }

  .summary-row.amount-paid {
    padding: 3px 2px;
    font-weight: 900;
    color: #16a34a;
    font-size: 13.5px;
  }

  .summary-row.amount-paid .amount-num {
    font-size: 15px;
    font-weight: 900;
  }

  .summary-row.due-amount {
    color: #dc2626;
    font-weight: 700;
    font-size: 12px;
    padding: 2px;
  }

  /* Amount in Words */
  .words-box {
    border-left: 2px solid #cbd5e1;
    padding: 3px 8px;
    margin-bottom: 14px;
  }

  .words-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #94a3b8;
    margin-bottom: 1px;
  }

  .words-text {
    font-size: 11.5px;
    font-weight: 500;
    color: #0f172a;
  }

  /* Note Box */
  .note-block {
    font-size: 10.5px;
    color: #64748b;
    margin-bottom: 14px;
    padding: 3px 8px;
    border-left: 2px solid #e2e8f0;
  }

  /* Footer */
  .receipt-footer {
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px solid #f1f5f9;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9px;
    color: #94a3b8;
  }

  /* Print Media Rules */
  @page {
    size: A4 portrait;
    margin: 8mm;
  }

  @media print {
    html, body {
      background: #ffffff !important;
      margin: 0 !important;
      padding: 0 !important;
      font-size: 11.5px !important;
    }

    .receipt-page {
      padding: 4px !important;
      max-width: 100% !important;
      box-shadow: none !important;
    }

    .receipt-dual-wrapper {
      padding: 0 !important;
      max-width: 100% !important;
      gap: 16px !important;
    }

    .receipt-dual-item {
      padding: 4px 0 !important;
    }

    .no-print {
      display: none !important;
    }
  }
`;

/**
 * Generate standard HTML for a Tuition / Fee Receipt
 */
export function generateTuitionReceiptHtml(data: TuitionReceiptData, options: RenderReceiptOptions = {}): string {
  const format = options.format || 'standard';
  const school = data.school || options.school || { name: 'School Name', address: '', phone: '' };

  const netPayable = Number(data.amount_due) + Number(data.fine || 0) - Number(data.discount || 0);
  const amountPaid = Number(data.amount_paid);
  const remainingDue = Math.max(0, netPayable - amountPaid);
  const isPaid = remainingDue <= 0;
  const isPartial = remainingDue > 0 && amountPaid > 0;
  const isVoid = data.status === 'void';
  const statusHtml = isVoid
    ? `<span class="status-void">VOIDED</span>`
    : isPaid
      ? `<span class="status-paid">PAID</span>`
      : isPartial
        ? `<span class="status-partial">PARTIAL</span>`
        : `<span class="status-due">DUE</span>`;

  // Build item rows
  let feeItems = data.fee_details || [];
  if (feeItems.length === 0) {
    feeItems = [{
      type: data.fee_type || 'Tuition Fee',
      amount: data.amount_due,
      month: data.month_name ? undefined : undefined
    }];
  }

  const tableRowsHtml = feeItems.map((item, idx) => {
    let title = '';
    let subtitle = '';

    if (item.type === 'arrears') {
      title = 'Previous Outstanding Arrears';
      subtitle = item.year ? `Academic Session ${item.year}` : 'Past Dues';
    } else if (item.exam_name) {
      title = `${item.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
      subtitle = `Exam: ${item.exam_name}`;
    } else if (item.month) {
      title = `${item.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
      subtitle = `Period: ${getMonthName(item.month)} ${item.year || data.year || ''}`.trim();
    } else {
      title = `${item.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
      subtitle = data.month_name ? `Period: ${data.month_name} ${data.year || ''}` : `Session ${data.year || ''}`;
    }

    return `
      <tr>
        <td class="text-center font-mono" style="width: 32px; color:#94a3b8;">${idx + 1}</td>
        <td>
          <div class="item-title">${title}</div>
          ${subtitle ? `<div class="item-subtitle">${subtitle}</div>` : ''}
        </td>
        <td class="text-right font-mono font-bold" style="font-size: 12px; color: #0f172a;">${formatTaka(item.amount)}</td>
      </tr>
    `;
  }).join('');

  const renderSingleReceiptBody = (copyLabel: string = '') => `
    <div class="header-container">
      ${school.logo_url ? `<img src="${school.logo_url}" alt="Logo" class="school-logo" />` : ''}
      <div class="school-details">
        <h1>${school.name}</h1>
        <p>${school.address || ''}${school.phone ? ' • Tel: ' + school.phone : ''}</p>
      </div>
      <div class="receipt-title-box">
        <span class="receipt-type-title">Money Receipt</span>
        ${copyLabel ? `<span class="copy-tag">(${copyLabel})</span>` : ''}
      </div>
    </div>

    <div class="top-meta-row">
      <div>
        <span>Receipt No:</span> <strong class="font-mono">${data.receipt_number}</strong>
      </div>
      <div>
        <span>Date:</span> <strong>${new Date(data.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Student Name</span>
        <span class="info-value">${data.student.name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Class & Section</span>
        <span class="info-value">${data.student.class_name}${data.student.section ? ` (${data.student.section})` : ''}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Roll / ID</span>
        <span class="info-value font-mono font-bold">${data.student.roll || 'N/A'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Academic Year</span>
        <span class="info-value font-mono">${data.year || new Date().getFullYear()}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Payment Method</span>
        <span class="info-value" style="text-transform: capitalize;">${(data.payment_method || 'Cash').replace('_', ' ')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Payment Status</span>
        <span class="info-value">${statusHtml}</span>
      </div>
    </div>

    <div class="table-container">
      <table class="receipt-table">
        <thead>
          <tr>
            <th class="text-center" style="width: 32px;">#</th>
            <th>Item & Description</th>
            <th class="text-right" style="width: 140px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>

    <div class="summary-section">
      <div class="summary-box">
        <div class="summary-row">
          <span>Fee Subtotal</span>
          <span class="font-mono font-semibold" style="color: #334155;">${formatTaka(data.amount_due)}</span>
        </div>
        ${Number(data.fine) > 0 ? `
          <div class="summary-row">
            <span>Late Fine</span>
            <span class="font-mono font-semibold" style="color: #334155;">+${formatTaka(data.fine)}</span>
          </div>
        ` : ''}
        ${Number(data.discount) > 0 ? `
          <div class="summary-row" style="color: #16a34a; font-weight: 600;">
            <span>Discount / Concession</span>
            <span class="font-mono font-bold">-${formatTaka(data.discount)}</span>
          </div>
        ` : ''}
        <div class="summary-row total-payable">
          <span>Net Payable</span>
          <span class="font-mono font-bold" style="color: #0f172a;">${formatTaka(netPayable)}</span>
        </div>
        <div class="summary-row amount-paid">
          <span style="text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: #0f172a;">Amount Paid</span>
          <span class="font-mono amount-num">${formatTaka(amountPaid)}</span>
        </div>
        ${remainingDue > 0 ? `
          <div class="summary-row due-amount">
            <span>Remaining Due</span>
            <span class="font-mono">${formatTaka(remainingDue)}</span>
          </div>
        ` : ''}
      </div>
    </div>

    <div class="words-box">
      <div class="words-label">Amount in Words</div>
      <div class="words-text font-mono">${amountInWords(amountPaid)}</div>
    </div>

    ${data.note ? `
      <div class="note-block">
        <strong style="color: #334155;">Remarks:</strong> ${data.note}
      </div>
    ` : ''}

    <div class="receipt-footer">
      <span>Official Computer-Generated Receipt • Valid without physical seal</span>
      <span class="font-mono">Printed: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  `;

  let bodyContent = '';

  if (format === 'dual') {
    bodyContent = `
      <div class="receipt-dual-wrapper">
        <div class="receipt-dual-item">
          ${renderSingleReceiptBody('Student Copy')}
        </div>
        <div class="receipt-dual-divider">
          <span>✂ Cut Along Perforation</span>
        </div>
        <div class="receipt-dual-item">
          ${renderSingleReceiptBody('Office Copy')}
        </div>
      </div>
    `;
  } else if (format === 'pos') {
    bodyContent = `
      <div class="receipt-pos">
        <div style="text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; margin-bottom: 8px;">
          <h2 style="font-size: 14px; font-weight: 800; text-transform: uppercase;">${school.name}</h2>
          <p style="font-size: 10px; color: #64748b;">${school.address || ''}</p>
          <p style="font-size: 10px; color: #64748b;">${school.phone || ''}</p>
          <div style="font-weight: 700; font-size: 11px; margin-top: 4px; text-transform: uppercase;">Money Receipt</div>
        </div>
        <div style="font-size: 10px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 6px; margin-bottom: 6px;">
          <div><span>Receipt No:</span> <span class="font-mono font-bold">${data.receipt_number}</span></div>
          <div><span>Date:</span> ${new Date(data.payment_date).toLocaleDateString('en-GB')}</div>
          <div><span>Student:</span> ${data.student.name}</div>
          <div><span>Class:</span> ${data.student.class_name} ${data.student.section ? '(' + data.student.section + ')' : ''} | <span>Roll:</span> ${data.student.roll || '-'}</div>
          <div><span>Method:</span> ${(data.payment_method || 'Cash').replace('_', ' ')}</div>
        </div>
        <table style="width: 100%; font-size: 10.5px; border-collapse: collapse; margin-bottom: 8px;">
          <thead>
            <tr style="border-bottom: 1px solid #e2e8f0; color: #475569;">
              <th style="text-align: left; padding: 2px 0;">Item</th>
              <th style="text-align: right; padding: 2px 0;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${feeItems.map(f => `
              <tr>
                <td style="padding: 2px 0;">${f.type.replace('_', ' ')} ${f.month ? '(' + getMonthName(f.month) + ')' : ''}</td>
                <td style="text-align: right; padding: 2px 0;" class="font-mono font-bold">${formatTaka(f.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="border-top: 1px dashed #cbd5e1; padding-top: 4px; font-size: 10.5px;">
          <div style="display:flex;justify-content:space-between;color:#64748b;"><span>Net Payable:</span><span class="font-mono font-bold" style="color:#0f172a;">${formatTaka(netPayable)}</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:900;font-size:12px;padding:2px 0;color:#16a34a;"><span>PAID:</span><span class="font-mono font-black">${formatTaka(amountPaid)}</span></div>
          ${remainingDue > 0 ? `<div style="display:flex;justify-content:space-between;color:#dc2626;font-weight:800;"><span>Due:</span><span class="font-mono">${formatTaka(remainingDue)}</span></div>` : ''}
        </div>
        <div style="font-size: 9.5px; margin-top: 6px; border-top: 1px dotted #cbd5e1; padding-top: 4px; color: #475569;">
          <strong>In Words:</strong> ${amountInWords(amountPaid)}
        </div>
        <div style="text-align: center; font-size: 8.5px; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 4px; color: #94a3b8;">
          Computer Generated Receipt • Thank You
        </div>
      </div>
    `;
  } else {
    bodyContent = `
      <div class="receipt-page">
        ${renderSingleReceiptBody(options.copyLabel || '')}
      </div>
    `;
  }

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt_${data.receipt_number}</title>
    <style>${RECEIPT_PRINT_CSS}</style>
  </head>
  <body>
    ${bodyContent}
  </body>
  </html>`;
}

/**
 * Generate standard HTML for a Salary / Payroll Slip
 */
export function generateSalarySlipHtml(data: SalarySlipData, options: RenderReceiptOptions = {}): string {
  const school = data.school || options.school || { name: 'School Name', address: '', phone: '' };

  const allowancesRows = (data.allowances || []).map(a => `
    <tr>
      <td style="padding-left: 12px; color: #334155;">${a.label}</td>
      <td class="text-right font-mono font-semibold" style="color: #16a34a;">+${formatTaka(a.amount)}</td>
    </tr>
  `).join('');

  const deductionsRows = (data.deductions || []).map(d => `
    <tr>
      <td style="padding-left: 12px; color: #dc2626;">${d.label}</td>
      <td class="text-right font-mono font-semibold" style="color: #dc2626;">-${formatTaka(d.amount)}</td>
    </tr>
  `).join('');

  const totalDeductions = (data.deductions || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Salary_Slip_${data.slip_number}</title>
    <style>${RECEIPT_PRINT_CSS}</style>
  </head>
  <body>
    <div class="receipt-page">
      <div class="header-container">
        ${school.logo_url ? `<img src="${school.logo_url}" alt="Logo" class="school-logo" />` : ''}
        <div class="school-details">
          <h1>${school.name}</h1>
          <p>${school.address || ''}${school.phone ? ' • Tel: ' + school.phone : ''}</p>
        </div>
        <div class="receipt-title-box">
          <span class="receipt-type-title">Salary Payslip</span>
        </div>
      </div>

      <div class="top-meta-row">
        <div>
          <span>Slip No:</span> <strong class="font-mono">${data.slip_number}</strong>
        </div>
        <div>
          <span>Pay Period:</span> <strong>${data.month_name} ${data.year}</strong>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Employee Name</span>
          <span class="info-value">${data.staff.name}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Designation / Role</span>
          <span class="info-value">${data.staff.designation || 'Staff'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Contact Phone</span>
          <span class="info-value font-mono">${data.staff.phone || 'N/A'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Payment Date</span>
          <span class="info-value">${new Date(data.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Payment Method</span>
          <span class="info-value" style="text-transform: capitalize;">${(data.payment_method || 'Bank').replace('_', ' ')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Status</span>
          <span class="info-value"><span class="status-paid">PAID & SETTLED</span></span>
        </div>
      </div>

      <div class="table-container">
        <table class="receipt-table">
          <thead>
            <tr>
              <th>Salary Breakdown & Description</th>
              <th class="text-right" style="width: 140px;">Amount (TK)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: 700; color: #0f172a;">Basic Salary</td>
              <td class="text-right font-mono font-bold" style="color: #0f172a;">${formatTaka(data.basic_salary)}</td>
            </tr>
            ${allowancesRows ? `
              <tr>
                <td colspan="2" style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; padding-top: 10px;">Allowances & Benefits</td>
              </tr>
              ${allowancesRows}
            ` : ''}
            ${deductionsRows ? `
              <tr>
                <td colspan="2" style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #dc2626; padding-top: 10px;">Deductions</td>
              </tr>
              ${deductionsRows}
            ` : ''}
          </tbody>
        </table>
      </div>

      <div class="summary-section">
        <div class="summary-box">
          <div class="summary-row">
            <span>Gross Earnings</span>
            <span class="font-mono font-semibold" style="color: #334155;">${formatTaka(data.gross_salary)}</span>
          </div>
          ${totalDeductions > 0 ? `
            <div class="summary-row" style="color: #dc2626; font-weight: 600;">
              <span>Total Deductions</span>
              <span class="font-mono font-bold">-${formatTaka(totalDeductions)}</span>
            </div>
          ` : ''}
          <div class="summary-row amount-paid" style="border-top: 1px solid #e2e8f0; padding-top: 6px;">
            <span style="text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: #0f172a;">Net Take-Home Pay</span>
            <span class="font-mono amount-num">${formatTaka(data.net_salary)}</span>
          </div>
        </div>
      </div>

      <div class="words-box">
        <div class="words-label">Net Amount in Words</div>
        <div class="words-text font-mono">${amountInWords(data.net_salary)}</div>
      </div>

      <div class="receipt-footer">
        <span>Official Computer-Generated Salary Slip • Confidential</span>
        <span class="font-mono">Printed: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  </body>
  </html>`;
}

/**
 * Generate standard HTML for Daily Cash Closing Statement
 */
export function generateDailyClosingHtml(data: any, options: RenderReceiptOptions = {}): string {
  const school = data.school || options.school || { name: 'School Name', address: '', phone: '' };

  const tuitionRows = (data.tuition_payments || []).map((p: any, i: number) => `
    <tr>
      <td class="text-center font-mono" style="width: 32px; color: #94a3b8;">${i + 1}</td>
      <td class="font-semibold text-slate-900">${p.student}</td>
      <td>${p.class || '-'}</td>
      <td class="font-mono text-slate-700">${p.receipt}</td>
      <td style="text-transform: capitalize;">${(p.method || 'cash').replace('_', ' ')}</td>
      <td class="text-right font-mono font-bold text-slate-900">${formatTaka(p.amount)}</td>
    </tr>
  `).join('');

  const expenseRows = (data.expenses || []).map((e: any, i: number) => `
    <tr>
      <td class="text-center font-mono" style="width: 32px; color: #94a3b8;">${i + 1}</td>
      <td class="font-semibold text-slate-900" style="text-transform: capitalize;">${e.category.replace('_', ' ')}</td>
      <td>${e.description}</td>
      <td class="text-right font-mono font-bold text-red-600">-${formatTaka(e.amount)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily_Closing_${data.date}</title>
    <style>${RECEIPT_PRINT_CSS}</style>
  </head>
  <body>
    <div class="receipt-page">
      <div class="header-container">
        ${school.logo_url ? `<img src="${school.logo_url}" alt="Logo" class="school-logo" />` : ''}
        <div class="school-details">
          <h1>${school.name}</h1>
          <p>${school.address || ''}${school.phone ? ' • Tel: ' + school.phone : ''}</p>
        </div>
        <div class="receipt-title-box">
          <span class="receipt-type-title">Daily Cash Closing</span>
        </div>
      </div>

      <div class="top-meta-row">
        <div><strong>Closing Date:</strong> ${new Date(data.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
      </div>

      <div class="info-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 20px;">
        <div class="info-item">
          <span class="info-label">Total Collections</span>
          <span class="info-value font-mono font-bold" style="font-size: 14px; color: #16a34a; margin-top: 2px;">
            ${formatTaka(data.tuition_collected)}
          </span>
          <span style="font-size: 9.5px; color: #94a3b8;">${data.tuition_count} transaction(s)</span>
        </div>
        <div class="info-item">
          <span class="info-label">Total Expenses</span>
          <span class="info-value font-mono font-bold" style="font-size: 14px; color: #dc2626; margin-top: 2px;">
            ${formatTaka(data.total_expense)}
          </span>
          <span style="font-size: 9.5px; color: #94a3b8;">Daily Outflows</span>
        </div>
        <div class="info-item">
          <span class="info-label">Net Physical Cash in Hand</span>
          <span class="info-value font-mono font-black" style="font-size: 15px; color: #0f172a; margin-top: 2px;">
            ${data.net_cash_in_hand >= 0 ? '+' : ''}${formatTaka(data.net_cash_in_hand)}
          </span>
          <span style="font-size: 9.5px; color: #94a3b8;">Cash Box Balance</span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px;">
        <div>
          <div style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Cash Collected</div>
          <div class="font-mono font-bold" style="font-size: 13px; color: #0f172a; margin-top: 2px;">${formatTaka(data.method_breakdown?.cash?.income || 0)}</div>
        </div>
        <div>
          <div style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Bank Inflows</div>
          <div class="font-mono font-bold" style="font-size: 13px; color: #0f172a; margin-top: 2px;">${formatTaka(data.method_breakdown?.bank?.income || 0)}</div>
        </div>
        <div>
          <div style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Mobile Banking</div>
          <div class="font-mono font-bold" style="font-size: 13px; color: #0f172a; margin-top: 2px;">${formatTaka(data.method_breakdown?.mobile_banking?.income || 0)}</div>
        </div>
      </div>

      ${tuitionRows ? `
        <div class="table-container" style="margin-bottom: 20px;">
          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-bottom: 6px;">
            Student Fee Collections (${data.tuition_payments?.length || 0})
          </div>
          <table class="receipt-table">
            <thead>
              <tr>
                <th class="text-center" style="width: 32px;">#</th>
                <th>Student Name</th>
                <th>Class</th>
                <th>Receipt No</th>
                <th>Method</th>
                <th class="text-right" style="width: 120px;">Amount</th>
              </tr>
            </thead>
            <tbody>${tuitionRows}</tbody>
          </table>
        </div>
      ` : ''}

      ${expenseRows ? `
        <div class="table-container" style="margin-bottom: 20px;">
          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #dc2626; margin-bottom: 6px;">
            Day Expenses (${data.expenses?.length || 0})
          </div>
          <table class="receipt-table">
            <thead>
              <tr>
                <th class="text-center" style="width: 32px;">#</th>
                <th>Category</th>
                <th>Description</th>
                <th class="text-right" style="width: 120px;">Amount</th>
              </tr>
            </thead>
            <tbody>${expenseRows}</tbody>
          </table>
        </div>
      ` : ''}

      <div class="receipt-footer">
        <span>Official Computer-Generated Daily Reconciliation • Confidential</span>
        <span class="font-mono">Printed: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  </body>
  </html>`;
}

/**
 * Generate standard HTML for Monthly Financial Statement
 */
export function generateMonthlyReportHtml(data: any, options: RenderReceiptOptions = {}): string {
  const school = data.school || options.school || { name: 'School Name', address: '', phone: '' };

  const incomeRows = (data.income_breakdown || []).map((i: any) => `
    <tr>
      <td style="text-transform: capitalize; font-weight: 500;">${i.category.replace('_', ' ')}</td>
      <td class="text-right font-mono font-bold text-slate-900">${formatTaka(i.amount)}</td>
    </tr>
  `).join('');

  const expenseRows = (data.expense_breakdown || []).map((e: any) => `
    <tr>
      <td style="text-transform: capitalize; font-weight: 500;">${e.category.replace('_', ' ')}</td>
      <td class="text-right font-mono font-bold text-red-600">-${formatTaka(e.amount)}</td>
    </tr>
  `).join('');

  const totalIncome = (data.income_breakdown || []).reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
  const totalExpense = (data.expense_breakdown || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Finance_Report_${getMonthName(data.month)}_${data.year}</title>
    <style>${RECEIPT_PRINT_CSS}</style>
  </head>
  <body>
    <div class="receipt-page">
      <div class="header-container">
        ${school.logo_url ? `<img src="${school.logo_url}" alt="Logo" class="school-logo" />` : ''}
        <div class="school-details">
          <h1>${school.name}</h1>
          <p>${school.address || ''}${school.phone ? ' • Tel: ' + school.phone : ''}</p>
        </div>
        <div class="receipt-title-box">
          <span class="receipt-type-title">Monthly Financial Statement</span>
        </div>
      </div>

      <div class="top-meta-row">
        <div><strong>Audit Period:</strong> ${getMonthName(data.month)} ${data.year}</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
        <div>
          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            Income Breakdown
          </div>
          <table class="receipt-table">
            <thead>
              <tr>
                <th>Category</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${incomeRows || '<tr><td colspan="2" style="color:#94a3b8; text-align:center;">No income records</td></tr>'}
              <tr style="font-weight: 700; border-top: 1px solid #cbd5e1;">
                <td>Total Income</td>
                <td class="text-right font-mono font-black text-slate-900">${formatTaka(totalIncome)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #dc2626; margin-bottom: 6px; border-bottom: 1px solid #fecaca; padding-bottom: 3px;">
            Expense Breakdown
          </div>
          <table class="receipt-table">
            <thead>
              <tr>
                <th>Category</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${expenseRows || '<tr><td colspan="2" style="color:#94a3b8; text-align:center;">No expense records</td></tr>'}
              <tr style="font-weight: 700; border-top: 1px solid #fecaca;">
                <td>Total Expense</td>
                <td class="text-right font-mono font-black text-red-600">${formatTaka(totalExpense)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="info-grid" style="grid-template-columns: repeat(2, 1fr); margin-bottom: 20px;">
        <div class="info-item">
          <span class="info-label">Tuition Fee Collection</span>
          <span class="info-value font-mono font-bold" style="font-size: 14px; color: #16a34a; margin-top: 2px;">
            ${formatTaka(data.tuition_summary?.total_collected || 0)}
          </span>
          <span style="font-size: 9.5px; color: #94a3b8;">
            Expected: ${formatTaka(data.tuition_summary?.total_due || 0)} • Collection Rate: ${data.tuition_summary?.collection_rate || 0}%
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">Salary & Payroll Disbursed</span>
          <span class="info-value font-mono font-bold" style="font-size: 14px; color: #0f172a; margin-top: 2px;">
            ${formatTaka(data.salary_summary?.total_paid || 0)}
          </span>
          <span style="font-size: 9.5px; color: #94a3b8;">
            ${data.salary_summary?.total_teachers || 0} Teachers • ${data.salary_summary?.total_staff || 0} Staff Members
          </span>
        </div>
      </div>

      <div style="padding: 12px 0; text-align: center; margin-bottom: 20px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 3px;">
          Monthly Net Balance (Surplus / Deficit)
        </div>
        <div class="font-mono font-black" style="font-size: 24px; color: ${data.net_balance >= 0 ? '#16a34a' : '#dc2626'};">
          ${data.net_balance >= 0 ? '+' : ''}${formatTaka(data.net_balance)}
        </div>
      </div>

      <div class="receipt-footer">
        <span>Official Computer-Generated Financial Statement • Audited & Approved</span>
        <span class="font-mono">Printed: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  </body>
  </html>`;
}

/**
 * Generate standard HTML for Annual Financial Statement
 */
export function generateYearlyReportHtml(data: any, options: RenderReceiptOptions = {}): string {
  const school = data.school || options.school || { name: 'School Name', address: '', phone: '' };

  const monthRows = (data.monthly_summary || []).map((m: any) => `
    <tr>
      <td class="font-semibold text-slate-800">${getMonthName(m.month)}</td>
      <td class="text-right font-mono font-semibold text-slate-900">+${formatTaka(m.income)}</td>
      <td class="text-right font-mono font-semibold text-red-600">-${formatTaka(m.expense)}</td>
      <td class="text-right font-mono font-bold ${m.balance >= 0 ? 'text-slate-900' : 'text-red-600'}">
        ${m.balance >= 0 ? '+' : ''}${formatTaka(m.balance)}
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Annual_Finance_Report_${data.year}</title>
    <style>${RECEIPT_PRINT_CSS}</style>
  </head>
  <body>
    <div class="receipt-page">
      <div class="header-container">
        ${school.logo_url ? `<img src="${school.logo_url}" alt="Logo" class="school-logo" />` : ''}
        <div class="school-details">
          <h1>${school.name}</h1>
          <p>${school.address || ''}${school.phone ? ' • Tel: ' + school.phone : ''}</p>
        </div>
        <div class="receipt-title-box">
          <span class="receipt-type-title">Annual Financial Audit</span>
        </div>
      </div>

      <div class="top-meta-row">
        <div><strong>Academic / Fiscal Year:</strong> ${data.year}</div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
        <div>
          <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Starting Balance</div>
          <div class="font-mono font-bold" style="font-size: 13px; color: #0f172a; margin-top: 2px;">${formatTaka(data.start_balance)}</div>
        </div>
        <div>
          <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Income</div>
          <div class="font-mono font-bold" style="font-size: 13px; color: #16a34a; margin-top: 2px;">${formatTaka(data.total_income)}</div>
        </div>
        <div>
          <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Expenses</div>
          <div class="font-mono font-bold" style="font-size: 13px; color: #dc2626; margin-top: 2px;">${formatTaka(data.total_expense)}</div>
        </div>
        <div>
          <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Net Fiscal Balance</div>
          <div class="font-mono font-bold" style="font-size: 14px; color: ${data.net_balance >= 0 ? '#16a34a' : '#dc2626'}; margin-top: 2px;">
            ${data.net_balance >= 0 ? '+' : ''}${formatTaka(data.net_balance)}
          </div>
        </div>
      </div>

      <div class="table-container" style="margin-bottom: 20px;">
        <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-bottom: 6px;">
          Month-by-Month Statement Summary (${data.year})
        </div>
        <table class="receipt-table">
          <thead>
            <tr>
              <th>Month</th>
              <th class="text-right">Income</th>
              <th class="text-right">Expense</th>
              <th class="text-right">Net Balance</th>
            </tr>
          </thead>
          <tbody>
            ${monthRows}
            <tr style="font-weight: 800; border-top: 1.5px solid #0f172a;">
              <td>ANNUAL TOTAL</td>
              <td class="text-right font-mono font-bold text-slate-900">${formatTaka(data.total_income)}</td>
              <td class="text-right font-mono font-bold text-red-600">${formatTaka(data.total_expense)}</td>
              <td class="text-right font-mono font-black ${data.net_balance >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                ${data.net_balance >= 0 ? '+' : ''}${formatTaka(data.net_balance)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="receipt-footer">
        <span>Annual Audit Report • Official Institutional Document</span>
        <span class="font-mono">Printed: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  </body>
  </html>`;
}
