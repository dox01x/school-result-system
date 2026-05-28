'use client';

import { SalarySlipData } from '@/types/finance';
import { formatTaka } from '@/lib/finance-utils';

interface PrintSlipProps {
  data: SalarySlipData;
}

export default function PrintSlip({ data }: PrintSlipProps) {
  return (
    <div className="hidden print:block print:w-[80mm] print:m-0 print:p-4 text-black bg-card font-sans text-sm">
      <div className="text-center mb-4 border-b pb-4">
        {data.school.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.school.logo_url} alt="Logo" className="w-12 h-12 mx-auto mb-2" />
        )}
        <h2 className="text-lg font-bold">{data.school.name}</h2>
        <p className="text-xs text-gray-600">{data.school.address}</p>
        <p className="text-xs text-gray-600">{data.school.phone}</p>
      </div>

      <div className="mb-4 text-center">
        <h3 className="font-bold uppercase tracking-wide bg-gray-200 py-1 inline-block px-4 mb-2">Salary Slip</h3>
        <p className="text-xs font-semibold">{data.month_name} {data.year}</p>
      </div>

      <div className="flex justify-between text-xs mb-4 border-y py-2 space-y-1">
        <div>
          <p><span className="font-bold">Slip No:</span> {data.slip_number}</p>
          <p><span className="font-bold">Date:</span> {new Date(data.payment_date).toLocaleDateString()}</p>
        </div>
        <div className="text-right">
          <p><span className="font-bold">Name:</span> {data.staff.name}</p>
          <p><span className="font-bold">Role:</span> {data.staff.designation}</p>
        </div>
      </div>

      <div className="mb-4 text-xs">
        <div className="flex justify-between border-b py-1">
          <span className="font-semibold">Basic Salary</span>
          <span>{formatTaka(data.basic_salary)}</span>
        </div>

        {data.allowances.length > 0 && (
          <div className="mt-2">
            <span className="font-bold pb-1 block border-b border-dashed">Allowances</span>
            {data.allowances.map((item, idx) => (
              <div key={idx} className="flex justify-between py-1">
                <span>{item.label}</span>
                <span>{formatTaka(item.amount)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between border-y py-1 font-semibold mt-2">
          <span>Gross Salary</span>
          <span>{formatTaka(data.gross_salary)}</span>
        </div>

        {data.deductions.length > 0 && (
          <div className="mt-2">
            <span className="font-bold pb-1 block border-b border-dashed text-red-600">Deductions</span>
            {data.deductions.map((item, idx) => (
              <div key={idx} className="flex justify-between py-1 text-red-600">
                <span>{item.label}</span>
                <span>-{formatTaka(item.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 border-t-2 border-black pt-2">
        <div className="flex justify-between font-bold text-lg">
          <span>Net Salary</span>
          <span>{formatTaka(data.net_salary)}</span>
        </div>
      </div>
      
      <div className="text-xs mt-4">
        <p><strong>Payment Method:</strong> {data.payment_method.replace('_', ' ')}</p>
      </div>

      <div className="text-center text-[10px] text-gray-500 mt-8 pt-4 border-t border-dashed">
        <p>This is a computer generated slip.</p>
        <p>No signature is required.</p>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          .print\\:block { position: absolute; left: 0; top: 0; margin: 0; padding: 10px; width: 100%; }
        }
      `}} />
    </div>
  );
}
