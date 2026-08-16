'use client';

import { SalarySlipData } from '@/types/finance';
import { formatTaka, amountInWords } from '@/lib/finance-utils';

interface PrintSlipProps {
  data: SalarySlipData;
  className?: string;
}

export default function PrintSlip({ data, className = '' }: PrintSlipProps) {
  const totalDeductions = (data.deductions || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  return (
    <div className={`salary-slip-root ${className}`}>
      <div className="p-4 bg-white max-w-2xl mx-auto text-slate-800 font-sans text-xs leading-normal select-text">
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
          <div className="mt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Salary Payslip
            </span>
          </div>
        </div>

        {/* Top Metadata Row: Slip No & Pay Period */}
        <div className="flex justify-between items-center text-xs mb-3 px-1 text-slate-600">
          <div>
            <span className="text-slate-400">Slip No:</span>{' '}
            <span className="font-mono font-bold text-slate-900">{data.slip_number}</span>
          </div>
          <div>
            <span className="text-slate-400">Pay Period:</span>{' '}
            <span className="font-medium text-slate-800">
              {data.month_name} {data.year}
            </span>
          </div>
        </div>

        {/* Employee Metadata Grid (Borderless, clean typography) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5 mb-4 text-[11.5px] px-1 py-1">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Employee Name</span>
            <span className="font-bold text-slate-900">{data.staff.name}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Designation</span>
            <span className="font-medium text-slate-800">{data.staff.designation || 'Staff'}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Contact Phone</span>
            <span className="font-mono font-bold text-slate-800">{data.staff.phone || 'N/A'}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Payment Date</span>
            <span className="font-medium text-slate-800">
              {new Date(data.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Payment Method</span>
            <span className="font-medium text-slate-800 capitalize">{(data.payment_method || 'bank').replace('_', ' ')}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Status</span>
            <span className="text-emerald-600 font-bold uppercase text-[11px]">
              PAID & SETTLED
            </span>
          </div>
        </div>

        {/* Salary Breakdown Table (Clean, borderless with subtle dividers) */}
        <div className="mb-4">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="border-b border-slate-300 text-slate-600 text-[10px] uppercase font-bold tracking-wider">
                <th className="text-left py-1.5 px-1">Salary Item & Breakdown</th>
                <th className="text-right py-1.5 px-2 w-36">Amount (TK)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2 px-1 font-bold text-slate-900">Basic Salary</td>
                <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">{formatTaka(data.basic_salary)}</td>
              </tr>
              {data.allowances && data.allowances.length > 0 && (
                <>
                  <tr>
                    <td colSpan={2} className="pt-2 pb-0.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Allowances & Benefits
                    </td>
                  </tr>
                  {data.allowances.map((a, i) => (
                    <tr key={i}>
                      <td className="py-1.5 px-1 pl-4 text-slate-700">{a.label}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-semibold text-emerald-600">+{formatTaka(a.amount)}</td>
                    </tr>
                  ))}
                </>
              )}
              {data.deductions && data.deductions.length > 0 && (
                <>
                  <tr>
                    <td colSpan={2} className="pt-2 pb-0.5 px-1 text-[10px] font-bold uppercase tracking-wider text-red-600">
                      Deductions
                    </td>
                  </tr>
                  {data.deductions.map((d, i) => (
                    <tr key={i}>
                      <td className="py-1.5 px-1 pl-4 text-slate-700">{d.label}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-semibold text-red-600">-{formatTaka(d.amount)}</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="flex justify-end mb-3">
          <div className="w-72 space-y-1 text-[11.5px]">
            <div className="flex justify-between items-center py-0.5 px-1 text-slate-600">
              <span>Gross Earnings</span>
              <span className="font-mono font-semibold text-slate-800">{formatTaka(data.gross_salary)}</span>
            </div>
            {totalDeductions > 0 && (
              <div className="flex justify-between items-center py-0.5 px-1 text-red-600">
                <span>Total Deductions</span>
                <span className="font-mono font-semibold">-{formatTaka(totalDeductions)}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-1 px-1 text-emerald-600 font-extrabold text-sm border-t border-slate-200">
              <span className="text-xs uppercase tracking-wider text-slate-900">Net Take-Home Pay</span>
              <span className="font-mono text-base font-black">{formatTaka(data.net_salary)}</span>
            </div>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="border-l-2 border-slate-300 pl-3 py-1 mb-3">
          <div className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">Net Amount in Words</div>
          <div className="font-medium text-slate-800 text-[11.5px] font-mono">{amountInWords(data.net_salary)}</div>
        </div>

        {/* Footer (No signature boxes) */}
        <div className="mt-4 pt-2 border-t border-slate-100 flex justify-between items-center text-[9.5px] text-slate-400">
          <span>Official Computer-Generated Salary Slip • Confidential</span>
          <span className="font-mono">Printed: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .salary-slip-root, .salary-slip-root * {
            visibility: visible;
          }
          .salary-slip-root {
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
