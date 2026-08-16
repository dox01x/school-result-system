'use client';

import { TuitionReceiptData } from '@/types/finance';
import { formatTaka, getMonthName, amountInWords } from '@/lib/finance-utils';

interface PrintReceiptProps {
  data: TuitionReceiptData;
  format?: 'standard' | 'dual' | 'pos';
  copyLabel?: string;
  className?: string;
}

export default function PrintReceipt({ data, format = 'standard', copyLabel, className = '' }: PrintReceiptProps) {
  const netPayable = Number(data.amount_due) + Number(data.fine || 0) - Number(data.discount || 0);
  const amountPaid = Number(data.amount_paid);
  const remainingDue = Math.max(0, netPayable - amountPaid);
  const isPaid = remainingDue <= 0;
  const isPartial = remainingDue > 0 && amountPaid > 0;
  const isVoid = data.status === 'void';

  // Normalize fee details
  const feeItems = (data.fee_details && data.fee_details.length > 0)
    ? data.fee_details
    : [{
        type: data.fee_type || 'tuition',
        amount: data.amount_due,
        month: undefined,
        year: data.year
      }];

  const renderSingleReceipt = (label?: string) => (
    <div className="bg-white text-slate-800 font-sans text-xs leading-normal select-text p-2">
      {/* Header - School Info Centered */}
      <div className="text-center pb-3 mb-3 border-b border-slate-200">
        {data.school?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.school.logo_url}
            alt="School Logo"
            className="w-12 h-12 object-contain mx-auto mb-1.5"
          />
        )}
        <h1 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-slate-900 leading-tight">
          {data.school?.name || 'School Name'}
        </h1>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
          {data.school?.address}
          {data.school?.phone ? ` • Tel: ${data.school.phone}` : ''}
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Money Receipt
          </span>
          {label && (
            <span className="text-[10px] font-medium text-slate-500">
              ({label})
            </span>
          )}
        </div>
      </div>

      {/* Top Metadata Row: Receipt No & Date */}
      <div className="flex justify-between items-center text-xs mb-3 px-1 text-slate-600">
        <div>
          <span className="text-slate-400">Receipt No:</span>{' '}
          <span className="font-mono font-bold text-slate-900">{data.receipt_number}</span>
        </div>
        <div>
          <span className="text-slate-400">Date:</span>{' '}
          <span className="font-medium text-slate-800">
            {new Date(data.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Student & Academic Metadata Grid (Borderless, clean typography) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5 mb-4 text-[11.5px] px-1 py-1">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Student Name</span>
          <span className="font-bold text-slate-900">{data.student.name}</span>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Class & Section</span>
          <span className="font-medium text-slate-800">
            {data.student.class_name}{data.student.section ? ` (${data.student.section})` : ''}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Roll / ID</span>
          <span className="font-mono font-bold text-slate-800">{data.student.roll || 'N/A'}</span>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Academic Year</span>
          <span className="font-mono font-medium text-slate-800">{data.year || new Date().getFullYear()}</span>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Payment Method</span>
          <span className="font-medium text-slate-800 capitalize">{(data.payment_method || 'cash').replace('_', ' ')}</span>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Payment Status</span>
          <span className="font-bold text-[11px]">
            {isVoid ? (
              <span className="text-red-600 font-bold uppercase">VOIDED</span>
            ) : isPaid ? (
              <span className="text-emerald-600 font-bold uppercase">PAID</span>
            ) : isPartial ? (
              <span className="text-amber-600 font-bold uppercase">PARTIAL</span>
            ) : (
              <span className="text-red-600 font-bold uppercase">DUE</span>
            )}
          </span>
        </div>
      </div>

      {/* Fee Breakdown Table (Clean, borderless with subtle dividers) */}
      <div className="mb-4">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="border-b border-slate-300 text-slate-600 text-[10px] uppercase font-bold tracking-wider">
              <th className="text-center py-1.5 px-1 w-8">#</th>
              <th className="text-left py-1.5 px-2">Item & Description</th>
              <th className="text-right py-1.5 px-2 w-36">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {feeItems.map((item, idx) => {
              let title = '';
              let subtitle = '';

              if (item.type === 'arrears') {
                title = 'Previous Outstanding Arrears';
                subtitle = item.year ? `Academic Session ${item.year}` : 'Past Dues';
              } else if (item.exam_name) {
                title = item.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
                subtitle = `Exam: ${item.exam_name}`;
              } else if (item.month) {
                title = item.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
                subtitle = `Period: ${getMonthName(item.month)} ${item.year || data.year || ''}`.trim();
              } else {
                title = item.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
                subtitle = data.month_name ? `Period: ${data.month_name} ${data.year || ''}` : `Session ${data.year || ''}`;
              }

              return (
                <tr key={idx}>
                  <td className="py-2 px-1 text-center font-mono text-slate-400">{idx + 1}</td>
                  <td className="py-2 px-2">
                    <div className="font-semibold text-slate-900">{title}</div>
                    {subtitle && <div className="text-[10px] text-slate-400 mt-0.5">{subtitle}</div>}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                    {formatTaka(item.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Financial Summary: Selective Semantic Color (Green for Paid, Red for Due) */}
      <div className="flex justify-end mb-3">
        <div className="w-72 space-y-1 text-[11.5px]">
          <div className="flex justify-between items-center py-0.5 px-1 text-slate-600">
            <span>Fee Subtotal</span>
            <span className="font-mono font-semibold text-slate-800">{formatTaka(data.amount_due)}</span>
          </div>
          {Number(data.fine) > 0 && (
            <div className="flex justify-between items-center py-0.5 px-1 text-slate-600">
              <span>Late Fine</span>
              <span className="font-mono font-semibold text-slate-800">+{formatTaka(data.fine)}</span>
            </div>
          )}
          {Number(data.discount) > 0 && (
            <div className="flex justify-between items-center py-0.5 px-1 text-emerald-600 font-medium">
              <span>Discount / Concession</span>
              <span className="font-mono font-bold">-{formatTaka(data.discount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 px-1 font-bold text-slate-900 text-xs">
            <span>Net Payable</span>
            <span className="font-mono">{formatTaka(netPayable)}</span>
          </div>
          <div className="flex justify-between items-center py-1 px-1 text-emerald-600 font-extrabold text-sm">
            <span className="text-xs uppercase tracking-wider">Amount Paid</span>
            <span className="font-mono text-base font-black">{formatTaka(amountPaid)}</span>
          </div>
          {remainingDue > 0 && (
            <div className="flex justify-between items-center py-0.5 px-1 text-red-600 font-bold text-xs">
              <span>Remaining Due</span>
              <span className="font-mono">{formatTaka(remainingDue)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Amount in Words */}
      <div className="border-l-2 border-slate-300 pl-3 py-1 mb-3">
        <div className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">Amount in Words</div>
        <div className="font-medium text-slate-800 text-[11.5px] font-mono">{amountInWords(amountPaid)}</div>
      </div>

      {/* Remarks / Note */}
      {data.note && (
        <div className="text-[10.5px] text-slate-600 mb-3 pl-3 border-l-2 border-slate-200">
          <strong className="text-slate-700">Remarks:</strong> {data.note}
        </div>
      )}

      {/* Footer (No signature boxes) */}
      <div className="mt-4 pt-2 border-t border-slate-100 flex justify-between items-center text-[9.5px] text-slate-400">
        <span>Official Computer-Generated Receipt • Valid without physical seal</span>
        <span className="font-mono">Printed: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );

  return (
    <div className={`receipt-root ${className}`}>
      {format === 'dual' ? (
        <div className="flex flex-col gap-6 bg-white p-2">
          <div>
            {renderSingleReceipt('Student Copy')}
          </div>
          <div className="text-center relative my-1">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-slate-300"></div></div>
            <span className="relative bg-white px-3 text-[9px] uppercase font-bold tracking-widest text-slate-400">
              ✂ Cut Along Perforation
            </span>
          </div>
          <div>
            {renderSingleReceipt('Office Copy')}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-white max-w-2xl mx-auto">
          {renderSingleReceipt(copyLabel)}
        </div>
      )}

      {/* Clean Global Print Stylesheet */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .receipt-root, .receipt-root * {
            visibility: visible;
          }
          .receipt-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff !important;
          }
        }
      `}} />
    </div>
  );
}
