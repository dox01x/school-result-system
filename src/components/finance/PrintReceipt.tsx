'use client';

import { TuitionReceiptData } from '@/types/finance';
import { formatTaka, getMonthName } from '@/lib/finance-utils';

interface PrintReceiptProps {
  data: TuitionReceiptData;
}

export default function PrintReceipt({ data }: PrintReceiptProps) {
  return (
    <div className="hidden print:block print:w-[80mm] print:m-0 print:p-4 text-black bg-card font-sans text-sm">
      {/* 
        This is styled for a POS thermal printer or an A4 paper top corner. 
        Adjust w-[80mm] to w-full if you want full A4 size.
      */}
      <div className="text-center mb-4 border-b pb-4">
        {data.school.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.school.logo_url} alt="Logo" className="w-12 h-12 mx-auto mb-2" />
        )}
        <h2 className="text-lg font-bold">{data.school.name}</h2>
        <p className="text-xs text-gray-600">{data.school.address}</p>
        <p className="text-xs text-gray-600">{data.school.phone}</p>
      </div>

      <div className="mb-4">
        <h3 className="text-center font-bold mb-2 uppercase tracking-wide">Money Receipt</h3>
        <div className="flex justify-between text-xs mb-1">
          <span className="font-semibold">Receipt No:</span>
          <span>{data.receipt_number}</span>
        </div>
        <div className="flex justify-between text-xs mb-1">
          <span className="font-semibold">Date:</span>
          <span>{new Date(data.payment_date).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="mb-4 text-xs border-y py-2 space-y-1">
        <div className="flex justify-between">
          <span>Student Name:</span>
          <span className="font-semibold text-right">{data.student.name}</span>
        </div>
        <div className="flex justify-between">
          <span>Class:</span>
          <span className="text-right">{data.student.class_name} {data.student.section ? `(${data.student.section})` : ''}</span>
        </div>
        {data.student.roll && (
          <div className="flex justify-between">
            <span>Roll:</span>
            <span className="text-right">{data.student.roll}</span>
          </div>
        )}
      </div>

      <div className="mb-4 text-xs">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1">Description</th>
              <th className="text-right py-1">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.fee_details && data.fee_details.length > 0 ? (
              data.fee_details.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1 capitalize">
                    {item.type} {item.month ? `(${getMonthName(item.month)})` : ''}
                  </td>
                  <td className="text-right py-1">{formatTaka(item.amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-1">
                  {data.fee_type === 'tuition' ? 'Tuition Fee' : data.fee_type} 
                  {data.month_name ? ` (${data.month_name})` : ''}
                </td>
                <td className="text-right py-1">{formatTaka(data.amount_due)}</td>
              </tr>
            )}
            {data.fine > 0 && (
              <tr>
                <td className="py-1">Late Fine</td>
                <td className="text-right py-1">{formatTaka(data.fine)}</td>
              </tr>
            )}
            {data.discount > 0 && (
              <tr>
                <td className="py-1">Discount</td>
                <td className="text-right py-1">-{formatTaka(data.discount)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="font-bold border-t">
              <td className="py-2">Net Payable</td>
              <td className="text-right py-2">{formatTaka(data.amount_due + (data.fine || 0) - (data.discount || 0))}</td>
            </tr>
            <tr className="font-bold border-t">
              <td className="py-2">Amount Paid</td>
              <td className="text-right py-2">{formatTaka(data.amount_paid)}</td>
            </tr>
            {data.amount_paid < (data.amount_due + (data.fine || 0) - (data.discount || 0)) && (
               <tr className="border-t text-red-600 border-dashed">
                 <td className="py-2 font-bold flex items-center gap-1">Remaining Due</td>
                 <td className="text-right py-2 font-bold">{formatTaka(data.amount_due + (data.fine || 0) - (data.discount || 0) - data.amount_paid)}</td>
               </tr>
            )}
          </tfoot>
        </table>
      </div>

      <div className="text-xs mb-6">
        <p><strong>Payment Method:</strong> {data.payment_method.replace('_', ' ')}</p>
        <p><strong>Collected By:</strong> {data.collected_by}</p>
        {data.note && <p><strong>Note:</strong> {data.note}</p>}
      </div>

      <div className="text-center text-[10px] text-gray-500 mt-8 pt-4 border-t border-dashed">
        <p>This is a computer generated receipt.</p>
        <p>No signature is required.</p>
      </div>

      {/* CSS to ensure clean printing */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:block {
            position: absolute;
            left: 0;
            top: 0;
            margin: 0;
            padding: 10px;
          }
        }
      `}} />
    </div>
  );
}
