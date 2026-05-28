'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createClient } from '@/lib/supabase/client';
import { TUITION_PAYMENT_COLUMNS } from '@/lib/supabase/select-columns';
import { Loader2, Search, UserCircle, CheckCircle2, Receipt, Printer, AlertCircle, History } from 'lucide-react';
import { formatTaka, getMonthName } from '@/lib/finance-utils';

type FeeItem = {
  type: string;
  amount: number;
  label: string;
  selected: boolean;
};

const MONTHLY_FEE_TYPES = ['tuition', 'hostel', 'transport', 'tuition fee', 'boarding'];

function isMonthlyFee(type: string) {
  return MONTHLY_FEE_TYPES.includes(type.toLowerCase().trim());
}

export default function CollectTuitionPage() {
  const supabase = createClient() as any;

  // Search
  const [searchId, setSearchId] = useState('');
  const [searching, setSearching] = useState(false);

  // Student
  const [student, setStudent] = useState<any>(null);

  // Class/Section/Student dropdown
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Billing
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [fees, setFees] = useState<FeeItem[]>([]);
  const [paymentYear, setPaymentYear] = useState(currentYear.toString());
  const [paymentMonths, setPaymentMonths] = useState<string[]>([currentMonth.toString()]);
  const [discount, setDiscount] = useState('0');
  const [amountPaidStr, setAmountPaidStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [lateFineStr, setLateFineStr] = useState('');

  // Smart states
  const [pastPayments, setPastPayments] = useState<any[]>([]);
  const [paidMonths, setPaidMonths] = useState<number[]>([]);
  const [paidYearlyFees, setPaidYearlyFees] = useState<string[]>([]);
  const [totalArrears, setTotalArrears] = useState(0);
  const [arrearsToPayStr, setArrearsToPayStr] = useState('');

  // Submit & Print
  const [submitting, setSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // ──────────────────────── Init ────────────────────────
  useEffect(() => {
    const init = async () => {
      const [classRes, schoolRes] = await Promise.all([
        supabase.from('classes').select('id, name').order('numeric_value', { ascending: true }),
        supabase.from('school_info').select('name, address, phone, logo_url').limit(1).single()
      ]);
      if (classRes.data) setClasses(classRes.data);
      if (schoolRes.data) setSchoolInfo(schoolRes.data);
    };
    init();
  }, []);

  // ──────────────────────── Compute paid months & arrears ────────────────────────
  useEffect(() => {
    const yr = parseInt(paymentYear);
    const months: number[] = [];
    const yearly: string[] = [];
    let arrears = 0;

    for (const p of pastPayments) {
      // Calculate arrears: net payable minus amount paid
      const net = Number(p.amount_due) + Number(p.fine || 0) - Number(p.discount || 0);
      const remaining = net - Number(p.amount_paid);
      if (remaining > 0) arrears += remaining;

      // Parse fee_details to find which months/fees are paid
      const details = p.fee_details || [];

      // Subtract any arrears items that were already paid in this receipt
      for (const fd of details) {
        if (fd.type === 'arrears') {
          arrears -= Number(fd.amount);
        }
      }

      // Track paid months and yearly fees
      for (const fd of details) {
        if (fd.type === 'arrears') continue;
        const fdYear = Number(fd.year) || Number(p.year);
        if (fdYear !== yr) continue;

        const fType = fd.type?.toLowerCase().trim();
        if (isMonthlyFee(fType) && fd.month) {
          const m = Number(fd.month);
          if (!months.includes(m)) months.push(m);
        } else if (fType && !isMonthlyFee(fType)) {
          if (!yearly.includes(fType)) yearly.push(fType);
        }
      }
    }

    arrears = Math.max(0, arrears);
    setPaidMonths(months);
    setPaidYearlyFees(yearly);
    setTotalArrears(arrears);
    setArrearsToPayStr(arrears > 0 ? arrears.toString() : '');
  }, [pastPayments, paymentYear]);

  // ──────────────────────── Remove paid months from selected ────────────────────────
  useEffect(() => {
    setPaymentMonths(prev => {
      const cleaned = prev.filter(m => !paidMonths.includes(parseInt(m)));
      if (cleaned.length === 0) {
        // Select first unpaid month
        for (let i = 1; i <= 12; i++) {
          if (!paidMonths.includes(i)) return [i.toString()];
        }
        return [];
      }
      return cleaned;
    });
  }, [paidMonths]);

  // ──────────────────────── Class/Section handlers ────────────────────────
  const handleClassChange = async (classId: string) => {
    setSelectedClassId(classId);
    setSelectedSectionId('');
    setSelectedStudentId('');
    setStudentsList([]);
    resetBilling();

    const [secRes, stuRes] = await Promise.all([
      supabase.from('sections').select('id, name').eq('class_id', classId),
      supabase.from('students').select('id, name, roll').eq('class_id', classId).order('roll')
    ]);
    if (secRes.data) setSections(secRes.data);
    if (stuRes.data) setStudentsList(stuRes.data);
  };

  const handleSectionChange = async (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setSelectedStudentId('');
    resetBilling();

    let query = supabase.from('students').select('id, name, roll').eq('class_id', selectedClassId);
    if (sectionId !== 'all') {
      if (sectionId === 'none') query = query.is('section_id', null);
      else query = query.eq('section_id', sectionId);
    }
    const { data } = await query.order('roll');
    if (data) setStudentsList(data);
  };

  const handleStudentDropdownChange = (studentId: string) => {
    setSelectedStudentId(studentId);
    loadStudentData(studentId, true);
  };

  // ──────────────────────── Load student data ────────────────────────
  const loadStudentData = async (queryVal: string, isUUID: boolean) => {
    if (!queryVal.trim()) return;
    setSearching(true);
    resetBilling();

    try {
      let query = supabase.from('students').select('id, name, class_id, section_id, roll, student_id, classes!inner(name), sections(name)');

      if (isUUID || (queryVal.length > 20 && queryVal.includes('-'))) {
        query = query.eq('id', queryVal.trim());
      } else {
        const val = queryVal.trim();
        if (/^\d+$/.test(val)) {
          query = query.or(`roll.eq."${val}",name.ilike."%${val}%"`);
        } else {
          query = query.ilike('name', `%${val}%`);
        }
      }

      const { data, error } = await query.limit(1).maybeSingle();

      if (error || !data) {
        toast.error("Student not found");
        setStudent(null);
        return;
      }

      setStudent(data);

      // Load fee structure
      const className = data.classes?.name;
      const { data: structs } = await supabase
        .from('fee_structure')
        .select('fee_type, amount')
        .eq('class_name', className)
        .eq('academic_year', currentYear.toString())
        .eq('is_active', true);

      if (structs && structs.length > 0) {
        setFees(structs.map((s: any) => ({
          type: s.fee_type,
          amount: s.amount,
          label: s.fee_type.charAt(0).toUpperCase() + s.fee_type.slice(1) + ' Fee',
          selected: s.fee_type === 'tuition'
        })));
      } else {
        setFees([
          { type: 'tuition', amount: 1000, label: 'Tuition Fee', selected: true },
          { type: 'exam', amount: 500, label: 'Exam Fee', selected: false },
          { type: 'sports', amount: 200, label: 'Sports Fee', selected: false },
        ]);
      }

      // Load past payments
      const { data: past } = await supabase
        .from('tuition_payments')
        .select(TUITION_PAYMENT_COLUMNS)
        .eq('student_id', data.id)
        .order('payment_date', { ascending: false });

      setPastPayments(past || []);

    } catch {
      toast.error("Error searching student");
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchId.trim()) return;
    loadStudentData(searchId, false);
  };

  const resetBilling = () => {
    setStudent(null);
    setFees([]);
    setDiscount('0');
    setAmountPaidStr('');
    setArrearsToPayStr('');
    setPastPayments([]);
    setNote('');
    setLateFineStr('');
    setLastReceipt(null);
    setShowReceipt(false);
  };

  // ──────────────────────── Calculations ────────────────────────
  const activeFees = fees.filter(f => {
    if (!f.selected) return false;
    if (!isMonthlyFee(f.type) && paidYearlyFees.includes(f.type.toLowerCase().trim())) return false;
    return true;
  });

  // Only count non-paid selected months
  const activeMonths = paymentMonths.filter(m => !paidMonths.includes(parseInt(m)));

  const totalDue = activeFees.reduce((sum, f) => {
    const multiplier = isMonthlyFee(f.type) ? activeMonths.length : 1;
    return sum + (Number(f.amount) * multiplier);
  }, 0);

  const numDiscount = Number(discount) || 0;
  const arrearsToPayNum = Number(arrearsToPayStr) || 0;
  const numFine = Number(lateFineStr) || 0;
  const netPayable = Math.max(0, totalDue + arrearsToPayNum + numFine - numDiscount);
  const actualPaid = amountPaidStr === '' ? netPayable : Math.max(0, Number(amountPaidStr));
  const remainingDue = Math.max(0, netPayable - actualPaid);

  const toggleFee = (idx: number) => {
    const newFees = [...fees];
    newFees[idx].selected = !newFees[idx].selected;
    setFees(newFees);
  };

  const handleAmountChange = (idx: number, val: string) => {
    const newFees = [...fees];
    newFees[idx].amount = Number(val);
    setFees(newFees);
  };

  // ──────────────────────── Submit ────────────────────────
  const handleSubmit = async () => {
    if (!student) return;
    if (activeFees.length === 0 && arrearsToPayNum === 0) {
      toast.error("Select at least one fee or enter an arrears amount");
      return;
    }
    if (netPayable === 0) {
      toast.error("Total amount cannot be zero");
      return;
    }

    setSubmitting(true);
    try {
      const feeDetails: any[] = [];

      activeFees.forEach(f => {
        if (isMonthlyFee(f.type)) {
          activeMonths.forEach(m => {
            feeDetails.push({ type: f.type, amount: f.amount, month: parseInt(m), year: parseInt(paymentYear) });
          });
        } else {
          feeDetails.push({ type: f.type, amount: f.amount, year: parseInt(paymentYear) });
        }
      });

      if (arrearsToPayNum > 0) {
        feeDetails.push({ type: 'arrears', amount: arrearsToPayNum, year: parseInt(paymentYear) });
      }

      const payload = {
        student_id: student.id,
        class_name: student.classes?.name,
        section: student.sections?.name,
        fee_details: feeDetails,
        year: parseInt(paymentYear),
        amount_paid: actualPaid,
        discount: numDiscount,
        fine: numFine,
        payment_method: paymentMethod,
        note: note
      };

      const res = await fetch('/api/finance/tuition/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (result.success) {
        toast.success("Payment completed successfully");

        // Build receipt data locally (no separate API call needed)
        const receiptData = {
          school: schoolInfo || { name: 'School Name', address: 'Address', phone: 'Phone' },
          receipt_number: result.data.receipt_number,
          student: {
            name: student.name,
            class_name: student.classes?.name || '',
            section: student.sections?.name || '',
            roll: student.roll || student.student_id || ''
          },
          fee_details: feeDetails,
          amount_due: result.data.amount_due,
          discount: result.data.discount,
          fine: result.data.fine,
          amount_paid: result.data.amount_paid,
          payment_method: paymentMethod,
          payment_date: result.data.payment_date || new Date().toISOString(),
          note: note
        };

        setLastReceipt(receiptData);
        setShowReceipt(true);

      } else {
        toast.error(result.error || "Payment failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (!lastReceipt) return;
    const r = lastReceipt;
    const netP = Number(r.amount_due) + Number(r.fine || 0) - Number(r.discount || 0);
    const rem = Math.max(0, netP - Number(r.amount_paid));
    const months = ['', 'January','February','March','April','May','June','July','August','September','October','November','December'];

    const feeRows = (r.fee_details || []).map((fd: any, i: number) => {
      const label = fd.type === 'arrears' 
        ? 'Previous Arrears' 
        : (fd.type + (fd.month ? ' (' + months[fd.month] + ')' : ''));
      return `<tr class="${i % 2 === 0 ? 'e' : 'o'}">
        <td style="text-align:center;color:#888">${i + 1}</td>
        <td style="text-align:left !important;text-transform:capitalize">${label}</td>
        <td style="text-align:right;font-family:monospace;font-weight:600">${fd.amount.toLocaleString('en-IN')} TK</td>
      </tr>`;
    }).join('');

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${r.receipt_number}</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      @page{size:A4 portrait;margin:0}
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Poppins',ui-sans-serif,system-ui,sans-serif;color:#1e293b;font-size:13px;line-height:1.6;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;background:#fff}
      .pg{max-width:700px;margin:20mm auto;padding:10mm;background:#fff}
      .sch-hdr{display:flex;align-items:center;justify-content:center;gap:15px;margin-bottom:30px;text-align:center}
      .sch-hdr img{max-height:55px;width:auto;object-fit:contain}
      .sch-txt h1{font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.5px;line-height:1.2;text-transform:uppercase}
      .sch-txt .ad{font-size:11px;color:#64748b;margin-top:2px}
      
      .tbar{margin-bottom:30px;text-align:center}
      .tbar h2{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:4px;color:#0f172a;margin-bottom:4px}
      .tbar .en{font-size:11px;color:#94a3b8;font-family:monospace;letter-spacing:1px}
      
      .itbl{width:100%;border-collapse:collapse;margin-bottom:30px}
      .itbl td{padding:12px;border-bottom:1px solid #f1f5f9;border-top:1px solid #f1f5f9}
      .lb{color:#64748b;width:20%;font-weight:500;text-transform:uppercase;font-size:10px;letter-spacing:1.5px}
      .vl{font-weight:600;width:30%;color:#0f172a;font-size:13px}
      
      .mtbl{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:13px}
      .mtbl th{color:#64748b;padding:12px 15px;border-bottom:1px solid #cbd5e1;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px}
      .mtbl td{padding:12px 15px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a}
      
      .net-wrap{display:flex;flex-direction:column;align-items:flex-end;margin-top:20px;padding-top:20px;border-top:1px solid #f1f5f9}
      .grp{display:flex;justify-content:space-between;width:240px;margin-bottom:8px;font-size:12px;color:#64748b}
      .grp .val{font-family:monospace;font-weight:600;color:#0f172a;font-size:13px}
      .grp-ded .val{color:#ef4444}
      .grp-paid .val{color:#10b981}
      .net-box{display:flex;justify-content:space-between;align-items:center;width:280px;margin-top:15px;padding:15px 20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
      .net-box .lbl{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#0f172a}
      .net-box .val{font-size:20px;font-weight:800;font-family:monospace;color:#0f172a}
      
      .method{font-size:10px;color:#64748b;margin-top:30px;padding:15px;background:#f8fafc;border-radius:8px}
      .footer-note{text-align:center;font-size:9px;color:#94a3b8;margin-top:60px;text-transform:uppercase;letter-spacing:2px;font-weight:500}
    </style></head><body>
    <div class="pg">
      <div class="sch-hdr">
        ${r.school?.logo_url ? `<img src="${r.school.logo_url}" alt="Logo" />` : ''}
        <div class="sch-txt">
          <h1>${r.school?.name || 'SCHOOL NAME'}</h1>
          <div class="ad">${r.school?.address ? r.school.address + ' • ' : ''}Phone: ${r.school?.phone || ''}</div>
        </div>
      </div>
      
      <div class="tbar">
        <h2>Money Receipt</h2>
        <div class="en">${r.receipt_number}</div>
      </div>
      <table class="itbl">
        <tr>
          <td class="lb">Student Name</td><td class="vl">${r.student.name}</td>
          <td class="lb">Class</td><td class="vl">${r.student.class_name}${r.student.section ? ' (' + r.student.section + ')' : ''}</td>
        </tr>
        <tr>
          <td class="lb">Roll No.</td><td class="vl">${r.student.roll || 'N/A'}</td>
          <td class="lb">Date</td><td class="vl">${new Date(r.payment_date).toLocaleDateString('en-GB')}</td>
        </tr>
        <tr>
          <td class="lb">Academic Year</td><td class="vl">${r.fee_details?.[0]?.year || currentYear}</td>
          <td class="lb">Payment Method</td><td class="vl" style="text-transform:capitalize">${(r.payment_method || 'cash').replace('_',' ')}</td>
        </tr>
      </table>
      <table class="mtbl">
        <thead>
          <tr>
            <th style="width:70%">Description</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${feeRows}
          ${Number(r.fine) > 0 ? '<tr><td>Late Fine</td><td style="text-align:right;font-family:monospace;font-weight:600">+' + Number(r.fine).toLocaleString('en-IN') + '</td></tr>' : ''}
          ${Number(r.discount) > 0 ? '<tr><td>Discount</td><td style="text-align:right;font-family:monospace;font-weight:600;color:#10b981">-' + Number(r.discount).toLocaleString('en-IN') + '</td></tr>' : ''}
        </tbody>
      </table>

      <div class="net-wrap">
        <div class="grp">
          <span>Net Payable</span>
          <span class="val">${netP.toLocaleString('en-IN')}</span>
        </div>
        <div class="grp grp-paid">
          <span>Amount Paid</span>
          <span class="val">+${Number(r.amount_paid).toLocaleString('en-IN')}</span>
        </div>
        
        <div class="net-box">
          <span class="lbl ${rem > 0 ? 'grp-ded' : ''}">Due Amount</span>
          <span class="val" style="${rem > 0 ? 'color:#ef4444' : ''}">${rem > 0 ? rem.toLocaleString('en-IN') : '0'} <span style="font-size:12px;opacity:0.7">BDT</span></span>
        </div>
      </div>

      ${r.note ? '<div class="method"><strong>NOTE:</strong> ' + r.note + '</div>' : ''}
      <div class="footer-note">Computer Generated Receipt. No Signature Required.</div>
    </div>
    </body></html>`);

    printWindow.document.close();
    printWindow.onload = () => { setTimeout(() => printWindow.print(), 500); };
  };

  const handleNewCollection = () => {
    setShowReceipt(false);
    setLastReceipt(null);
    setSearchId('');
    setSelectedStudentId('');
    resetBilling();
  };

  // ═══════════════════════ RECEIPT VIEW ═══════════════════════
  if (showReceipt && lastReceipt) {
    const r = lastReceipt;
    const netP = Number(r.amount_due) + Number(r.fine || 0) - Number(r.discount || 0);
    const rem = Math.max(0, netP - Number(r.amount_paid));

    const receiptCss = `.rc-view *{margin:0;padding:0;box-sizing:border-box}.rc-view,.rc-view .pg{font-family:'Poppins',ui-sans-serif,system-ui,sans-serif;color:#1e293b;font-size:13px;line-height:1.6}.rc-view .pg{max-width:700px;margin:0 auto;padding:10mm 12mm;background:#fff}.rc-view .sch-hdr{display:flex;align-items:center;justify-content:center;gap:15px;margin-bottom:30px;text-align:center}.rc-view .sch-hdr img{max-height:55px;width:auto;object-fit:contain}.rc-view .sch-txt h1{font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.5px;line-height:1.2;text-transform:uppercase}.rc-view .sch-txt .ad{font-size:11px;color:#64748b;margin-top:2px}.rc-view .tbar{margin-bottom:30px;text-align:center}.rc-view .tbar h2{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:4px;color:#0f172a;margin-bottom:4px}.rc-view .tbar .en{font-size:11px;color:#94a3b8;font-family:monospace;letter-spacing:1px}.rc-view .itbl{width:100%;border-collapse:collapse;margin-bottom:30px}.rc-view .itbl td{padding:12px;border-bottom:1px solid #f1f5f9;border-top:1px solid #f1f5f9}.rc-view .lb{color:#64748b;width:20%;font-weight:500;text-transform:uppercase;font-size:10px;letter-spacing:1.5px}.rc-view .vl{font-weight:600;width:30%;color:#0f172a;font-size:13px}.rc-view .mtbl{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:13px}.rc-view .mtbl th{color:#64748b;padding:12px 15px;border-bottom:1px solid #cbd5e1;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px}.rc-view .mtbl td{padding:12px 15px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a}.rc-view .net-wrap{display:flex;flex-direction:column;align-items:flex-end;margin-top:20px;padding-top:20px;border-top:1px solid #f1f5f9}.rc-view .grp{display:flex;justify-content:space-between;width:240px;margin-bottom:8px;font-size:12px;color:#64748b}.rc-view .grp .val{font-family:monospace;font-weight:600;color:#0f172a;font-size:13px}.rc-view .grp-ded .val{color:#ef4444}.rc-view .grp-paid .val{color:#10b981}.rc-view .net-box{display:flex;justify-content:space-between;align-items:center;width:280px;margin-top:15px;padding:15px 20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}.rc-view .net-box .lbl{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#0f172a}.rc-view .net-box .val{font-size:20px;font-weight:800;font-family:monospace;color:#0f172a}.rc-view .fn{text-align:center;font-size:9px;color:#94a3b8;margin-top:60px;text-transform:uppercase;letter-spacing:2px;font-weight:500}`;

    const feeRowsHtml = (r.fee_details || []).map((fd: any, i: number) => {
      const label = fd.type === 'arrears' ? 'Previous Arrears' : (fd.type + (fd.month ? ` (${getMonthName(fd.month)})` : ''));
      return `<tr><td style="text-align:center;color:#555">${i + 1}</td><td style="text-align:left !important;text-transform:capitalize">${label}</td><td style="text-align:right;font-family:monospace;font-weight:600">${Number(fd.amount).toLocaleString('en-IN')} TK</td></tr>`;
    }).join('');

    const fineRow = Number(r.fine) > 0 ? `<tr><td style="text-align:center">-</td><td style="text-align:left !important">Late Fine</td><td style="text-align:right;font-family:monospace;font-weight:600">+${Number(r.fine).toLocaleString('en-IN')} TK</td></tr>` : '';
    const discRow = Number(r.discount) > 0 ? `<tr><td style="text-align:center">-</td><td style="text-align:left !important">Discount</td><td style="text-align:right;font-family:monospace;font-weight:600">-${Number(r.discount).toLocaleString('en-IN')} TK</td></tr>` : '';
    const noteHtml = r.note ? `<div style="font-size:12px;color:#4a5568;padding:4px 0;border-top:1px solid #e2e8f0">Note: <strong>${r.note}</strong></div>` : '';

    const receiptBody = `<div class="pg"><div class="sch-hdr">${r.school?.logo_url ? `<img src="${r.school.logo_url}" alt="Logo" />` : ''}<div class="sch-txt"><h1>${r.school?.name || 'SCHOOL NAME'}</h1><div class="ad">${r.school?.address ? r.school.address + ' • ' : ''}Phone: ${r.school?.phone || ''}</div></div></div><div class="tbar"><h2>Money Receipt</h2><div class="en">${r.receipt_number}</div></div><table class="itbl"><tr><td class="lb">Student ID</td><td class="vl">${r.student.roll || 'N/A'}</td><td class="lb">Name</td><td class="vl">${r.student.name}</td></tr><tr><td class="lb">Class</td><td class="vl">${r.student.class_name}${r.student.section ? ' (' + r.student.section + ')' : ''}</td><td class="lb">Paid On</td><td class="vl">${new Date(r.payment_date).toLocaleDateString('en-GB')}</td></tr></table><table class="mtbl"><thead><tr><th style="width:70%">Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>${feeRowsHtml}${fineRow}${discRow}</tbody></table><div class="net-wrap"><div class="grp"><span>Net Payable</span><span class="val">${netP.toLocaleString('en-IN')}</span></div><div class="grp grp-paid"><span>Amount Paid</span><span class="val">+${Number(r.amount_paid).toLocaleString('en-IN')}</span></div><div class="net-box"><span class="lbl ${rem > 0 ? 'grp-ded' : ''}">Due Amount</span><span class="val" style="${rem > 0 ? 'color:#ef4444' : ''}">${rem > 0 ? rem.toLocaleString('en-IN') : '0'} <span style="font-size:12px;opacity:0.7">BDT</span></span></div></div>${noteHtml}<div class="fn">Computer Generated Receipt. No Signature Required.</div></div>`;

    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Payment Receipt</h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleNewCollection}>New Collection</Button>
            <Button onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
          </div>
        </div>
        <div
          className="rc-view bg-card"
          dangerouslySetInnerHTML={{ __html: `<style>${receiptCss}</style>${receiptBody}` }}
        />
      </div>
    );
  }

  // ═══════════════════════ MAIN FORM ═══════════════════════
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Collect Fees</h1>
        <p className="text-muted-foreground mt-1 text-sm">Search student, select fees and months, collect payment and print receipt.</p>
      </div>

      {/* ─── Search Bar ─── */}
      <Card className="border-none shadow-md overflow-hidden bg-card/50 backdrop-blur-xl">
        <div className="h-1.5 bg-primary"></div>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4 items-end">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Class</Label>
              <Select value={selectedClassId} onValueChange={handleClassChange}>
                <SelectTrigger className="bg-card"><SelectValue placeholder="Select Class" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Section</Label>
              <Select value={selectedSectionId} onValueChange={handleSectionChange} disabled={!selectedClassId}>
                <SelectTrigger className="bg-card"><SelectValue placeholder="Select Section" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.length === 0
                    ? <SelectItem value="none">No Sections</SelectItem>
                    : sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-[1.2]">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Student</Label>
              <Select value={selectedStudentId} onValueChange={handleStudentDropdownChange} disabled={studentsList.length === 0}>
                <SelectTrigger className="bg-card font-medium"><SelectValue placeholder="Select Student" /></SelectTrigger>
                <SelectContent>
                  {studentsList.map(st => (
                    <SelectItem key={st.id} value={st.id}>{st.name} (Roll: {st.roll})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="hidden lg:flex h-10 items-center px-3 font-bold text-muted-foreground/40 text-sm">OR</div>
            <div className="space-y-1.5 flex-[1.5]">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Search by ID or Name</Label>
              <form onSubmit={handleSearch} className="flex space-x-2">
                <Input
                  placeholder="Student ID, Roll, or Name..."
                  value={searchId}
                  onChange={e => setSearchId(e.target.value)}
                  className="bg-card"
                />
                <Button type="submit" disabled={searching} className="shadow-md px-5">
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Main Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left: Profile */}
        <div className="lg:col-span-4 space-y-4">
          {student && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
              {/* Student Card */}
              <Card className="border-none shadow-lg bg-gradient-to-br from-primary/5 to-transparent relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><UserCircle className="w-24 h-24" /></div>
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                    <UserCircle className="w-7 h-7 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{student.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Class</p>
                      <p className="font-medium">{student.classes?.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Section</p>
                      <p className="font-medium">{student.sections?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Roll / ID</p>
                      <span className="font-mono text-primary font-semibold bg-card border px-2 py-1 rounded-md shadow-sm inline-block">{student.roll || student.student_id}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Status */}
              <Card className="border-none shadow-md">
                <CardContent className="pt-5 space-y-4">
                  <h4 className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-500" /> Payment Status ({paymentYear})
                  </h4>

                  <div className={`rounded-xl p-3 flex justify-between items-center shadow-sm ${totalArrears > 0 ? 'bg-orange-50/70 border border-orange-200/60' : 'bg-emerald-50/70 border border-emerald-200/60'}`}>
                    <span className={`text-sm font-bold ${totalArrears > 0 ? 'text-orange-800' : 'text-emerald-800'}`}>
                      {totalArrears > 0 ? 'Total Arrears' : 'No Dues'}
                    </span>
                    <span className={`text-lg font-extrabold font-mono ${totalArrears > 0 ? 'text-orange-600' : 'text-primary'}`}>
                      {formatTaka(totalArrears)}
                    </span>
                  </div>

                  {paidMonths.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground mb-1.5 uppercase">Paid Months</p>
                      <div className="flex flex-wrap gap-1">
                        {paidMonths.sort((a, b) => a - b).map(m => (
                          <Badge key={m} className="bg-emerald-100 text-primary hover:bg-emerald-100 text-[10px] px-2 py-0.5">
                            <CheckCircle2 className="w-3 h-3 mr-1" />{getMonthName(m)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {pastPayments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <History className="w-3 h-3" /> Recent Payments
                      </p>
                      {pastPayments.slice(0, 3).map(p => (
                        <div key={p.id} className="flex justify-between items-center p-2.5 rounded-md bg-card border text-xs shadow-sm">
                          <div>
                            <p className="font-bold text-slate-800">{new Date(p.payment_date).toLocaleDateString('en-GB')}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{p.receipt_number}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-primary">{formatTaka(p.amount_paid)}</p>
                            {(() => {
                              const n = Number(p.amount_due) + Number(p.fine || 0) - Number(p.discount || 0);
                              const d = n - Number(p.amount_paid);
                              return d > 0 ? <p className="text-[10px] text-red-500 font-bold">Due: {formatTaka(d)}</p> : null;
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right: Billing */}
        <div className="lg:col-span-8">
          <Card className={`border-none shadow-lg transition-all duration-300 bg-card/60 backdrop-blur-lg ${!student ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="w-5 h-5 text-primary" /> Billing Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Fee Selection */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Available Fees</h3>

                {/* Month Grid */}
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <Label className="text-xs text-muted-foreground">Monthly Fee Months</Label>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded-sm">{activeMonths.length} selected</span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const mNum = i + 1;
                      const mStr = mNum.toString();
                      const isPaid = paidMonths.includes(mNum);
                      const isSelected = paymentMonths.includes(mStr) && !isPaid;
                      return (
                        <button
                          key={mStr}
                          type="button"
                          disabled={isPaid}
                          onClick={() => {
                            if (isPaid) return;
                            if (isSelected) {
                              setPaymentMonths(prev => prev.filter(m => m !== mStr));
                            } else {
                              setPaymentMonths(prev => [...prev, mStr].sort((a, b) => parseInt(a) - parseInt(b)));
                            }
                          }}
                          className={`h-8 text-xs font-semibold rounded-lg transition-all border relative overflow-hidden
                            ${isPaid
                              ? 'bg-emerald-50 border-emerald-200 cursor-not-allowed'
                              : isSelected
                                ? 'bg-primary text-primary-foreground border-primary shadow-md scale-[1.03]'
                                : 'bg-card text-muted-foreground hover:bg-slate-50 border-input'
                            }`}
                        >
                          {isPaid ? (
                            <span className="flex items-center justify-center text-primary gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Paid
                            </span>
                          ) : (
                            new Date(2000, i).toLocaleString('default', { month: 'short' })
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Year */}
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Year</Label>
                  <Input type="number" className="h-9 text-sm font-semibold bg-card shadow-sm w-28" value={paymentYear} onChange={e => setPaymentYear(e.target.value)} />
                </div>

                {/* Fee Items */}
                <div className="space-y-2 bg-slate-50/50 p-3 rounded-xl border max-h-[280px] overflow-y-auto">
                  {fees.map((fee, idx) => {
                    const monthly = isMonthlyFee(fee.type);
                    const locked = !monthly && paidYearlyFees.includes(fee.type.toLowerCase().trim());

                    return (
                      <label key={idx} className={`flex items-center gap-3 p-3 rounded-lg border transition-all
                        ${locked ? 'opacity-50 cursor-not-allowed bg-emerald-50/40 border-emerald-100' : fee.selected ? 'bg-primary/5 border-primary/30 shadow-sm cursor-pointer' : 'bg-card hover:bg-muted/40 border-input cursor-pointer'}`}
                      >
                        <Checkbox disabled={locked} checked={fee.selected || locked} onCheckedChange={() => !locked && toggleFee(idx)} />
                        <div className="flex-1">
                          <p className="text-sm font-semibold flex items-center gap-2">
                            {fee.label}
                            {locked && <Badge className="bg-emerald-100 text-primary hover:bg-emerald-100 text-[9px] px-1.5 h-4">PAID</Badge>}
                            {monthly && <Badge variant="outline" className="text-[9px] px-1 h-4 text-muted-foreground">Monthly</Badge>}
                          </p>
                        </div>
                        <Input
                          type="number"
                          value={fee.amount}
                          onChange={e => handleAmountChange(idx, e.target.value)}
                          disabled={!fee.selected || locked}
                          className="w-20 h-7 text-right text-sm px-2 font-mono font-bold"
                        />
                      </label>
                    );
                  })}
                  {fees.length === 0 && <p className="text-xs text-center text-muted-foreground py-10">No fee structures configured.</p>}
                </div>
              </div>

              {/* Summary & Checkout */}
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Payment Summary</h3>

                <div className="bg-gradient-to-b from-slate-50 to-white p-5 rounded-2xl border shadow-sm space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-semibold">Fee Total</span>
                    <span className="font-mono font-bold">{formatTaka(totalDue)}</span>
                  </div>

                  {/* Arrears */}
                  <div className="flex justify-between items-center text-sm border-t border-dashed pt-3">
                    <span className="flex flex-col">
                      <span className="font-bold text-orange-700">Arrears / Due</span>
                      {totalArrears > 0 && (
                        <span className="text-[10px] font-medium text-orange-600/70">Previous: {formatTaka(totalArrears)}</span>
                      )}
                    </span>
                    <Input
                      type="number"
                      dir="rtl"
                      className="w-24 h-8 bg-orange-50/50 border-orange-200 focus-visible:ring-1 focus-visible:ring-orange-400 text-orange-800 font-mono font-bold"
                      value={arrearsToPayStr}
                      onChange={(e) => setArrearsToPayStr(e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  {/* Discount */}
                  <div className="flex justify-between items-center text-sm border-t border-dashed pt-3">
                    <span className="text-muted-foreground">Discount</span>
                    <Input
                      type="number"
                      dir="rtl"
                      className="w-24 h-8 bg-card border-dashed text-red-500 font-mono"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  {/* Late Fine (Optional) */}
                  <div className="flex justify-between items-center text-sm border-t border-dashed pt-3">
                    <span className="text-muted-foreground">Late Fine <span className="text-[10px]">(optional)</span></span>
                    <Input
                      type="number"
                      dir="rtl"
                      className="w-24 h-8 bg-card border-dashed text-orange-600 font-mono"
                      value={lateFineStr}
                      onChange={(e) => setLateFineStr(e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div className="flex justify-between items-center text-sm border-t pt-3">
                    <span className="font-bold">Net Payable</span>
                    <span className="font-mono font-bold text-lg">{formatTaka(netPayable)}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold">Amount Paid</span>
                    <Input
                      type="number"
                      dir="rtl"
                      className="w-28 h-9 bg-card border-solid focus-visible:ring-2 focus-visible:ring-primary font-mono font-bold"
                      value={amountPaidStr}
                      onChange={(e) => setAmountPaidStr(e.target.value)}
                      placeholder={netPayable.toString()}
                    />
                  </div>

                  {remainingDue > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t border-dashed border-red-200">
                      <span className="text-sm font-bold text-red-600">Remaining Due</span>
                      <span className="text-xl font-extrabold text-red-600 font-mono">{formatTaka(remainingDue)}</span>
                    </div>
                 )}
                </div>

                {/* Method & Notes */}
                <div className="space-y-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider">Method & Notes</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash Payment</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_banking">bKash / Nagad / Upay</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Optional remarks (e.g. bKash TrxID)"
                    className="bg-card"
                  />

                  <Button
                    size="lg"
                    className="w-full text-base font-semibold shadow-xl shadow-primary/25 group relative overflow-hidden transition-all hover:scale-[1.01]"
                    onClick={handleSubmit}
                    disabled={submitting || (activeFees.length === 0 && arrearsToPayNum === 0)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                    Print & Complete Collection
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
