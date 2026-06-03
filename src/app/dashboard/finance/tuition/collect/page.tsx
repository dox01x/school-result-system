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
import { Loader2 as SpinnerGap, Search as MagnifyingGlass, UserCircle, CheckCircle, Receipt, Printer, AlertCircle as WarningCircle, RotateCcw as ClockCounterClockwise } from "lucide-react";
import { formatTaka, getMonthName } from '@/lib/finance-utils';

type FeeItem = {
  type: string;
  amount: number;
  label: string;
  selected: boolean;
};

const MONTHLY_FEE_TYPES = ['tuition', 'hostel', 'transport', 'tuition fee', 'boarding'];
const PER_EXAM_FEE_TYPES = ['exam', 'mct_exam', 'semester_exam'];

function isMonthlyFee(type: string) {
  return MONTHLY_FEE_TYPES.includes(type.toLowerCase().trim());
}

function isPerExamFee(type: string) {
  return PER_EXAM_FEE_TYPES.includes(type.toLowerCase().trim());
}

export default function CollectTuitionPage() {
  const supabase = createClient() as any;

  // MagnifyingGlass
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
  const [paidExamFees, setPaidExamFees] = useState<string[]>([]); // tracks "mct_exam__1st MCT" etc.
  const [totalArrears, setTotalArrears] = useState(0);
  const [arrearsToPayStr, setArrearsToPayStr] = useState('');

  // Exam selection for per-exam fees
  const [examList, setExamList] = useState<any[]>([]);
  const [selectedExamForFee, setSelectedExamForFee] = useState<Record<string, string>>({}); // fee.type -> exam_id

  // Submit & Print
  const [submitting, setSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // ──────────────────────── Init ────────────────────────
  useEffect(() => {
    const init = async () => {
      const [classRes, schoolRes, examRes] = await Promise.all([
        supabase.from('classes').select('id, name').order('numeric_value', { ascending: true }),
        supabase.from('school_info').select('name, address, phone, logo_url').limit(1).single(),
        supabase.from('exams').select('id, name, exam_type, term').order('term').order('exam_type')
      ]);
      if (classRes.data) setClasses(classRes.data);
      if (schoolRes.data) setSchoolInfo(schoolRes.data);
      if (examRes.data) setExamList(examRes.data);
    };
    init();
  }, []);

  // ──────────────────────── Compute paid months & arrears ────────────────────────
  useEffect(() => {
    const yr = parseInt(paymentYear);
    const months: number[] = [];
    const yearly: string[] = [];
    const paidExams: string[] = [];
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

      // Track paid months, yearly fees, and per-exam fees
      for (const fd of details) {
        if (fd.type === 'arrears') continue;
        const fdYear = Number(fd.year) || Number(p.year);
        if (fdYear !== yr) continue;

        const fType = fd.type?.toLowerCase().trim();
        if (isMonthlyFee(fType) && fd.month) {
          const m = Number(fd.month);
          if (!months.includes(m)) months.push(m);
        } else if (isPerExamFee(fType) && fd.exam_name) {
          // Per-exam fee: track as "type__examName"
          const examKey = `${fType}__${fd.exam_name}`;
          if (!paidExams.includes(examKey)) paidExams.push(examKey);
        } else if (fType && !isMonthlyFee(fType) && !isPerExamFee(fType)) {
          if (!yearly.includes(fType)) yearly.push(fType);
        }
      }
    }

    arrears = Math.max(0, arrears);
    setPaidMonths(months);
    setPaidYearlyFees(yearly);
    setPaidExamFees(paidExams);
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

  // ──────────────────────── Auto-load from URL ────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sid = params.get('student_id');
      if (sid) {
        setSearchId(sid);
        loadStudentData(sid, true);
        window.history.replaceState({}, '', '/dashboard/finance/tuition/collect');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMagnifyingGlass = (e?: React.FormEvent) => {
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
    setSelectedExamForFee({});
    setLastReceipt(null);
    setShowReceipt(false);
  };

  // ──────────────────────── Calculations ────────────────────────
  const activeFees = fees.filter(f => {
    if (!f.selected) return false;
    const fType = f.type.toLowerCase().trim();
    // Per-exam fees: check if THIS specific exam is already paid
    if (isPerExamFee(fType)) {
      const selExamId = selectedExamForFee[f.type];
      if (selExamId) {
        const exam = examList.find(e => e.id === selExamId);
        if (exam && paidExamFees.includes(`${fType}__${exam.name}`)) return false;
      }
      return true;
    }
    // Yearly fees: check if already paid
    if (!isMonthlyFee(fType) && paidYearlyFees.includes(fType)) return false;
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
      // Get authenticated user ID for audit trail
      const { data: userData } = await supabase.auth.getUser();
      const collectedBy = userData?.user?.id;

      const feeDetails: any[] = [];

      // Validate per-exam fees have an exam selected
      for (const f of activeFees) {
        if (isPerExamFee(f.type) && !selectedExamForFee[f.type]) {
          toast.error(`Please select which exam for "${f.label}"`);
          setSubmitting(false);
          return;
        }
      }

      activeFees.forEach(f => {
        if (isMonthlyFee(f.type)) {
          activeMonths.forEach(m => {
            feeDetails.push({ type: f.type, amount: f.amount, month: parseInt(m), year: parseInt(paymentYear) });
          });
        } else if (isPerExamFee(f.type)) {
          const exam = examList.find(e => e.id === selectedExamForFee[f.type]);
          feeDetails.push({ type: f.type, amount: f.amount, year: parseInt(paymentYear), exam_name: exam?.name || '' });
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
        collected_by: collectedBy,
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
    const feeRows = (r.fee_details || []).map((fd: any, i: number) => {
      const label = fd.type === 'arrears' 
        ? 'Previous Arrears' 
        : fd.exam_name
          ? `${fd.type.replace('_', ' ')} (${fd.exam_name})`
          : (fd.type + (fd.month ? ' (' + getMonthName(fd.month) + ')' : ''));
      return `<tr>
        <td class="col-center">${i + 1}</td>
        <td class="col-label">${label}</td>
        <td class="col-amount">${Number(fd.amount).toLocaleString('en-IN')} TK</td>
      </tr>`;
    }).join('');

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${r.receipt_number}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Inter',sans-serif;color:#000;font-size:13px;line-height:1.5;background:#fff;max-width:800px;margin:0 auto;padding:40px}
      
      .school-info { text-align: center; margin-bottom: 40px; }
      .school-info h2 { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
      .school-info p { font-size: 12px; color: #666; margin-top: 4px; }
      
      .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #e5e5e5; }
      .header-title h1 { font-size: 28px; font-weight: 900; letter-spacing: -1px; line-height: 1; text-transform: uppercase; }
      .header-title p { font-size: 12px; font-weight: 600; color: #666; letter-spacing: 2px; text-transform: uppercase; margin-top: 6px; }
      .header-date { text-align: right; }
      .header-date .date-val { font-size: 24px; font-weight: 800; color:#000; }
      .header-date .date-year { font-size: 12px; font-weight: 600; color: #666; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
      
      .info-grid{display:grid;grid-template-columns:repeat(2, 1fr);row-gap:24px;column-gap:30px;margin-bottom:40px;padding-bottom:20px}
      .info-item .lbl{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#000;margin-bottom:8px}
      .info-item .val{font-size:14px;font-weight:600;color:#333}
      
      table { width: 100%; border-collapse: collapse; margin-bottom:20px; border-top:1px solid #e5e5e5; }
      th { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #000; padding: 20px 0 10px; text-align: left; }
      td { padding: 12px 0; border-bottom: none; font-size: 13px; }
      .col-label { font-weight: 600; text-transform: capitalize; color: #333; }
      .col-amount { text-align: right; font-family: monospace; font-weight: 600; font-size: 14px; }
      .col-center { text-align: center; width: 40px; color:#666; }
      
      .total-row td { border-top: none; padding-top: 24px; font-weight: 800; color: #000; font-size: 14px; }
      .total-row .col-amount { font-size: 16px; }
      
      .net-card { background: transparent; color: #000; padding: 30px 0; margin-top: 20px; text-align: center; }
      .net-card h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 3px; color: #666; margin-bottom: 12px; }
      .net-card .val { font-size: 48px; font-weight: 900; font-family: monospace; letter-spacing: -2px; }
      
      .note-box{font-size:12px;color:#666;margin-bottom:20px;text-align:center;font-weight:600}
      .footer { text-align: center; font-size: 10px; color: #999; margin-top: 40px; padding-top: 20px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    <div class="school-info">
      ${r.school?.logo_url ? `<img src="${r.school.logo_url}" alt="Logo" style="max-height:50px;margin-bottom:10px" />` : ''}
      <h2>${r.school?.name || 'SCHOOL NAME'}</h2>
      <p>${r.school?.address || ''} ${r.school?.phone ? '• ' + r.school.phone : ''}</p>
    </div>
    
    <div class="header">
      <div class="header-title"><h1>Money Receipt</h1><p>${r.receipt_number}</p></div>
      <div class="header-date">
        <div class="date-val">${new Date(r.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long' })}</div>
        <div class="date-year">${new Date(r.payment_date).getFullYear()}</div>
      </div>
    </div>
    
    <div class="info-grid">
      <div class="info-item"><div class="lbl">Student Name</div><div class="val">${r.student.name}</div></div>
      <div class="info-item"><div class="lbl">Class</div><div class="val">${r.student.class_name}</div></div>
      <div class="info-item"><div class="lbl">Section</div><div class="val">${r.student.section || 'N/A'}</div></div>
      <div class="info-item"><div class="lbl">Roll No.</div><div class="val">${r.student.roll || 'N/A'}</div></div>
      <div class="info-item"><div class="lbl">Academic Year</div><div class="val">${r.fee_details?.[0]?.year || currentYear}</div></div>
      <div class="info-item"><div class="lbl">Payment Method</div><div class="val" style="text-transform:capitalize">${(r.payment_method || 'cash').replace('_',' ')}</div></div>
      <div class="info-item"><div class="lbl">Status</div><div class="val">${rem > 0 ? 'Partial' : 'Paid'}</div></div>
    </div>
    
    <table>
      <thead><tr><th class="col-center">#</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${feeRows}
        ${Number(r.fine) > 0 ? '<tr><td class="col-center">-</td><td class="col-label">Late Fine</td><td class="col-amount">+' + Number(r.fine).toLocaleString('en-IN') + ' TK</td></tr>' : ''}
        ${Number(r.discount) > 0 ? '<tr><td class="col-center">-</td><td class="col-label">Discount</td><td class="col-amount">-' + Number(r.discount).toLocaleString('en-IN') + ' TK</td></tr>' : ''}
        <tr class="total-row"><td colspan="2" class="col-label">Net Payable</td><td class="col-amount">${netP.toLocaleString('en-IN')} TK</td></tr>
        <tr class="total-row" style="padding-top:12px"><td colspan="2" class="col-label" style="padding-top:12px">Amount Paid</td><td class="col-amount" style="padding-top:12px">+${Number(r.amount_paid).toLocaleString('en-IN')} TK</td></tr>
      </tbody>
    </table>
    
    <div class="net-card">
      <h4>Due Amount</h4>
      <div class="val">${rem > 0 ? rem.toLocaleString('en-IN') : '0'} <span style="font-size:24px;letter-spacing:0">TK</span></div>
    </div>
    
    ${r.note ? '<div class="note-box">Note: ' + r.note + '</div>' : ''}
    <div class="footer">Computer Generated Receipt • No Signature Required</div>
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

    const receiptCss = `
      .rc-view *{margin:0;padding:0;box-sizing:border-box}
      .rc-view{font-family:'Inter',sans-serif;color:#000;font-size:13px;line-height:1.5}
      .rc-view .pg{max-width:800px;margin:0 auto;padding:40px;background:#fff}
      
      .rc-view .school-info { text-align: center; margin-bottom: 40px; }
      .rc-view .school-info h2 { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color:#000; }
      .rc-view .school-info p { font-size: 12px; color: #666; margin-top: 4px; }
      
      .rc-view .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #e5e5e5; }
      .rc-view .header-title h1 { font-size: 28px; font-weight: 900; letter-spacing: -1px; line-height: 1; text-transform: uppercase; color:#000; margin-bottom: 6px; }
      .rc-view .header-title p { font-size: 12px; font-weight: 600; color: #666; letter-spacing: 2px; text-transform: uppercase; }
      .rc-view .header-date { text-align: right; }
      .rc-view .header-date .date-val { font-size: 24px; font-weight: 800; color:#000; }
      .rc-view .header-date .date-year { font-size: 12px; font-weight: 600; color: #666; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
      
      .rc-view .info-grid{display:grid;grid-template-columns:repeat(2, 1fr);row-gap:24px;column-gap:30px;margin-bottom:40px;padding-bottom:20px}
      .rc-view .info-item .lbl{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#000;margin-bottom:8px}
      .rc-view .info-item .val{font-size:14px;font-weight:600;color:#333}
      
      .rc-view table { width: 100%; border-collapse: collapse; margin-bottom:20px; border-top:1px solid #e5e5e5; }
      .rc-view th { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #000; padding: 20px 0 10px; text-align: left; }
      .rc-view td { padding: 12px 0; border-bottom: none; font-size: 13px; }
      .rc-view .col-label { font-weight: 600; text-transform: capitalize; color: #333; }
      .rc-view .col-amount { text-align: right; font-family: monospace; font-weight: 600; font-size: 14px; color:#000;}
      .rc-view .col-center { text-align: center; width: 40px; color:#666; }
      
      .rc-view .total-row td { border-top: none; padding-top: 24px; font-weight: 800; color: #000; font-size: 14px; }
      .rc-view .total-row .col-amount { font-size: 16px; }
      
      .rc-view .net-card { background: transparent; color: #000; padding: 30px 0; margin-top: 20px; text-align: center; }
      .rc-view .net-card h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 3px; color: #666; margin-bottom: 12px; }
      .rc-view .net-card .val { font-size: 48px; font-weight: 900; font-family: monospace; letter-spacing: -2px; }
      
      .rc-view .note-box{font-size:12px;color:#666;margin-bottom:20px;text-align:center;font-weight:600}
      .rc-view .foot{text-align:center;font-size:10px;color:#999;margin-top:40px;padding-top:20px;font-weight:600;text-transform:uppercase;letter-spacing:1px}
    `;

    const feeRowsHtml = (r.fee_details || []).map((fd: any, i: number) => {
      const label = fd.type === 'arrears' 
        ? 'Previous Arrears' 
        : fd.exam_name 
          ? `${fd.type.replace('_', ' ')} (${fd.exam_name})`
          : (fd.type + (fd.month ? ` (${getMonthName(fd.month)})` : ''));
      return `<tr><td class="col-center">${i + 1}</td><td class="col-label">${label}</td><td class="col-amount">${Number(fd.amount).toLocaleString('en-IN')} TK</td></tr>`;
    }).join('');

    const fineRow = Number(r.fine) > 0 ? `<tr><td class="col-center">-</td><td class="col-label">Late Fine</td><td class="col-amount">+${Number(r.fine).toLocaleString('en-IN')} TK</td></tr>` : '';
    const discRow = Number(r.discount) > 0 ? `<tr><td class="col-center">-</td><td class="col-label">Discount</td><td class="col-amount">-${Number(r.discount).toLocaleString('en-IN')} TK</td></tr>` : '';
    const noteHtml = r.note ? `<div class="note-box">Note: ${r.note}</div>` : '';

    const receiptBody = `<div class="pg">
      <div class="school-info">
        ${r.school?.logo_url ? `<img src="${r.school.logo_url}" alt="Logo" style="max-height:50px;margin-bottom:10px" />` : ''}
        <h2>${r.school?.name || 'SCHOOL NAME'}</h2>
        <p>${r.school?.address || ''} ${r.school?.phone ? '• ' + r.school.phone : ''}</p>
      </div>
      
      <div class="header">
        <div class="header-title"><h1>Money Receipt</h1><p>${r.receipt_number}</p></div>
        <div class="header-date">
          <div class="date-val">${new Date(r.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long' })}</div>
          <div class="date-year">${new Date(r.payment_date).getFullYear()}</div>
        </div>
      </div>
      
      <div class="info-grid">
        <div class="info-item"><div class="lbl">Student Name</div><div class="val">${r.student.name}</div></div>
        <div class="info-item"><div class="lbl">Class</div><div class="val">${r.student.class_name}</div></div>
        <div class="info-item"><div class="lbl">Section</div><div class="val">${r.student.section || 'N/A'}</div></div>
        <div class="info-item"><div class="lbl">Roll No.</div><div class="val">${r.student.roll || 'N/A'}</div></div>
        <div class="info-item"><div class="lbl">Academic Year</div><div class="val">${r.fee_details?.[0]?.year || currentYear}</div></div>
        <div class="info-item"><div class="lbl">Payment Method</div><div class="val" style="text-transform:capitalize">${(r.payment_method || 'cash').replace('_',' ')}</div></div>
        <div class="info-item"><div class="lbl">Status</div><div class="val">${rem > 0 ? 'Partial' : 'Paid'}</div></div>
      </div>
      
      <table>
        <thead><tr><th class="col-center">#</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
          ${feeRowsHtml}
          ${fineRow}
          ${discRow}
          <tr class="total-row"><td colspan="2" class="col-label">Net Payable</td><td class="col-amount">${netP.toLocaleString('en-IN')} TK</td></tr>
          <tr class="total-row" style="padding-top:12px"><td colspan="2" class="col-label" style="padding-top:12px">Amount Paid</td><td class="col-amount" style="padding-top:12px">+${Number(r.amount_paid).toLocaleString('en-IN')} TK</td></tr>
        </tbody>
      </table>
      
      <div class="net-card">
        <h4>Due Amount</h4>
        <div class="val">${rem > 0 ? rem.toLocaleString('en-IN') : '0'} <span style="font-size:24px;letter-spacing:0">TK</span></div>
      </div>
      
      ${noteHtml}
      <div class="foot">Computer Generated Receipt • No Signature Required</div>
    </div>`;

    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Payment Receipt</h1>
          <div className="flex gap-3">
            <Button variant="outline" className="rounded-xl font-bold" onClick={handleNewCollection}>New Collection</Button>
            <Button className="rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-none" onClick={handlePrint}>
              <Printer size={16} strokeWidth={2} className="mr-2" /> Print
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
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Collect Fees</h1>
        <p className="text-muted-foreground mt-1 text-sm">Search student, select fees and months, collect payment and print receipt.</p>
      </div>

      {/* ─── Search Bar ─── */}
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex-1 min-w-[140px]">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Class</p>
            <Select value={selectedClassId} onValueChange={handleClassChange}>
              <SelectTrigger className="w-full h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50 shadow-md">
                {classes.map(c => <SelectItem key={c.id} value={c.id} className="rounded-lg">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Section</p>
            <Select value={selectedSectionId} onValueChange={handleSectionChange} disabled={!selectedClassId}>
              <SelectTrigger className="w-full h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                <SelectValue placeholder="Select Section" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50 shadow-md">
                <SelectItem value="all" className="rounded-lg">All Sections</SelectItem>
                {sections.length === 0
                  ? <SelectItem value="none" className="rounded-lg">No Sections</SelectItem>
                  : sections.map(s => <SelectItem key={s.id} value={s.id} className="rounded-lg">{s.name}</SelectItem>)
                }
              </SelectContent>
            </Select>
          </div>
          <div className="flex-[1.2] min-w-[140px]">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Student</p>
            <Select value={selectedStudentId} onValueChange={handleStudentDropdownChange} disabled={studentsList.length === 0}>
              <SelectTrigger className="w-full h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                <SelectValue placeholder="Select Student" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50 shadow-md">
                {studentsList.map(st => (
                  <SelectItem key={st.id} value={st.id} className="rounded-lg">{st.name} (Roll: {st.roll})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="hidden lg:flex h-11 items-center px-1 font-bold text-muted-foreground/60 text-sm">OR</div>
          
          <div className="flex-[1.5] min-w-[140px]">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Search by ID or Name</p>
            <form onSubmit={handleMagnifyingGlass} className="flex space-x-2">
              <Input
                placeholder="Student ID, Roll, or Name..."
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                className="flex-1 h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus-visible:ring-1 focus-visible:ring-ring/30 px-4"
              />
              <Button type="submit" disabled={searching} className="h-11 px-5 rounded-xl bg-primary text-primary-foreground shadow-none hover:bg-primary/90 transition-colors">
                {searching ? <SpinnerGap size={18} strokeWidth={1.5} className="animate-spin" /> : <MagnifyingGlass size={18} strokeWidth={1.5} />}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* ─── Main Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left: Profile */}
        <div className="lg:col-span-4 space-y-4">
          {student && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
              {/* Student Card */}
              <Card className="border border-border/50 shadow-none bg-card rounded-2xl relative overflow-hidden">
                <CardHeader>
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3 shadow-none border-0">
                    <UserCircle className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <CardTitle className="text-lg font-bold text-foreground tracking-tight">{student.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest mb-1">Class</p>
                      <p className="font-semibold text-foreground">{student.classes?.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest mb-1">Section</p>
                      <p className="font-semibold text-foreground">{student.sections?.name || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest mb-1">Roll / ID</p>
                      <span className="font-mono text-foreground font-bold bg-muted px-2.5 py-1 rounded-md inline-block">{student.roll || student.student_id}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Status */}
              <Card className="border border-border/50 shadow-none bg-card rounded-2xl">
                <CardContent className="pt-5 space-y-4">
                  <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                    <WarningCircle size={14} strokeWidth={1.5} className="text-orange-500" /> Payment Status ({paymentYear})
                  </h4>

                  <div className={`rounded-xl p-3.5 flex justify-between items-center ${totalArrears > 0 ? 'bg-red-50' : 'bg-muted'}`}>
                    <span className={`text-sm font-bold tracking-tight ${totalArrears > 0 ? 'text-red-900' : 'text-foreground'}`}>
                      {totalArrears > 0 ? 'Total Arrears' : 'No Dues'}
                    </span>
                    <span className={`text-xl font-bold font-mono tracking-tighter ${totalArrears > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {formatTaka(totalArrears)}
                    </span>
                  </div>

                  {paidMonths.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-widest">Paid Months</p>
                      <div className="flex flex-wrap gap-1.5">
                        {paidMonths.sort((a, b) => a - b).map(m => (
                          <Badge key={m} className="bg-muted text-muted-foreground hover:bg-muted/80 border-0 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            <CheckCircle size={12} strokeWidth={2} className="mr-1" />{getMonthName(m)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {pastPayments.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 tracking-widest">
                        <ClockCounterClockwise size={14} strokeWidth={1.5} /> Recent Payments
                      </p>
                      {pastPayments.slice(0, 3).map(p => (
                        <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-muted text-xs">
                          <div>
                            <p className="font-bold text-foreground tracking-tight">{new Date(p.payment_date).toLocaleDateString('en-GB')}</p>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.receipt_number}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-foreground text-sm tracking-tighter">{formatTaka(p.amount_paid)}</p>
                            {(() => {
                              const n = Number(p.amount_due) + Number(p.fine || 0) - Number(p.discount || 0);
                              const d = n - Number(p.amount_paid);
                              return d > 0 ? <p className="text-[10px] text-red-500 font-bold mt-0.5">Due: {formatTaka(d)}</p> : null;
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
          <Card className={`border border-border/50 shadow-none bg-card rounded-2xl transition-all duration-300 ${!student ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground tracking-tight">
                <Receipt size={20} strokeWidth={1.5} className="text-muted-foreground" /> Billing Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Fee Selection */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Available Fees</h3>

                {/* Month Grid */}
                <div className="space-y-2">
                  <div className="flex justify-between items-end px-1">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Monthly Fee Months</Label>
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 rounded-sm shadow-none">{activeMonths.length} selected</span>
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
                          className={`h-8 text-[11px] font-bold rounded-lg transition-all border-0 relative overflow-hidden
                            ${isPaid
                              ? 'bg-muted/80 text-muted-foreground/60 cursor-not-allowed'
                              : isSelected
                                ? 'bg-primary text-primary-foreground shadow-md scale-[1.03]'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80 shadow-none'
                            }`}
                        >
                          {isPaid ? (
                            <span className="flex items-center justify-center text-muted-foreground/60 gap-0.5">
                              <CheckCircle size={12} strokeWidth={2} /> Paid
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
                <div className="flex items-center gap-3 px-1">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Year</Label>
                  <Input type="number" className="h-9 text-sm font-bold bg-muted border-0 shadow-none w-28 focus-visible:ring-1 focus-visible:ring-ring/30" value={paymentYear} onChange={e => setPaymentYear(e.target.value)} />
                </div>

                {/* Fee Items */}
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {fees.map((fee, idx) => {
                    const monthly = isMonthlyFee(fee.type);
                    const perExam = isPerExamFee(fee.type);
                    const locked = !monthly && !perExam && paidYearlyFees.includes(fee.type.toLowerCase().trim());

                    // For per-exam fees, determine the relevant exam list
                    const relevantExams = perExam
                      ? examList.filter(e => {
                          if (fee.type === 'mct_exam') return e.exam_type === 'mct';
                          if (fee.type === 'semester_exam') return e.exam_type === 'semester';
                          // Generic 'exam' type: show all MCT and Semester exams
                          return e.exam_type === 'mct' || e.exam_type === 'semester';
                        })
                      : [];

                    return (
                      <div key={idx} className="space-y-1.5">
                        <label className={`flex items-center gap-3 p-3 rounded-xl border-0 transition-all shadow-none
                          ${locked ? 'opacity-50 cursor-not-allowed bg-muted/80' : fee.selected ? 'bg-muted/50 border-primary border cursor-pointer shadow-sm' : 'bg-muted hover:bg-muted/80 cursor-pointer'}`}
                        >
                          <Checkbox disabled={locked} checked={fee.selected || locked} onCheckedChange={() => !locked && toggleFee(idx)} className="border-border data-[state=checked]:bg-primary data-[state=checked]:text-white" />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-foreground flex items-center gap-2">
                              {fee.label}
                              {locked && <Badge className="bg-muted text-muted-foreground border-0 text-[9px] font-bold px-1.5 h-4 shadow-none">PAID</Badge>}
                              {monthly && <Badge className="bg-muted text-muted-foreground border-0 text-[9px] font-bold px-1.5 h-4 shadow-none">Monthly</Badge>}
                              {perExam && <Badge className="bg-muted text-muted-foreground border-0 text-[9px] font-bold px-1.5 h-4 shadow-none">Per Exam</Badge>}
                            </p>
                          </div>
                          <Input
                            type="number"
                            value={fee.amount}
                            onChange={e => handleAmountChange(idx, e.target.value)}
                            disabled={!fee.selected || locked}
                            className="w-24 h-8 bg-white border-0 text-right text-sm px-2 font-mono font-bold focus-visible:ring-1 focus-visible:ring-ring/30 disabled:opacity-100 shadow-sm"
                          />
                        </label>
                        {/* Exam selector for per-exam fees */}
                        {perExam && fee.selected && (
                          <div className="ml-9 mr-1">
                            <Select
                              value={selectedExamForFee[fee.type] || ''}
                              onValueChange={(v) => setSelectedExamForFee(prev => ({ ...prev, [fee.type]: v }))}
                            >
                              <SelectTrigger className="h-9 text-xs font-semibold bg-muted border-0 shadow-none focus:ring-1 focus:ring-ring/30">
                                <SelectValue placeholder={`For which exam? ${fee.type === 'mct_exam' ? '(MCT)' : fee.type === 'semester_exam' ? '(Semester)' : ''}`} />
                              </SelectTrigger>
                              <SelectContent className="border-border/50 rounded-xl shadow-md">
                                {relevantExams.map(exam => {
                                  const examKey = `${fee.type.toLowerCase().trim()}__${exam.name}`;
                                  const isPaidExam = paidExamFees.includes(examKey);
                                  return (
                                    <SelectItem key={exam.id} value={exam.id} disabled={isPaidExam} className="rounded-lg">
                                      {exam.name} {isPaidExam ? '✓ PAID' : ''}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {fees.length === 0 && <p className="text-xs text-center text-muted-foreground py-10">No fee structures configured.</p>}
                </div>
              </div>

              {/* Summary & Checkout */}
              <div className="space-y-5">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Payment Summary</h3>

                <div className="bg-muted/50/80 border border-border/50 p-5 rounded-2xl shadow-none space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-bold tracking-tight">Fee Total</span>
                    <span className="font-mono font-bold text-foreground">{formatTaka(totalDue)}</span>
                  </div>

                  {/* Arrears */}
                  <div className="flex justify-between items-center text-sm border-t border-border/50 pt-4">
                    <span className="flex flex-col">
                      <span className="font-bold text-red-600 tracking-tight">Arrears / Due</span>
                      {totalArrears > 0 && (
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Previous: {formatTaka(totalArrears)}</span>
                      )}
                    </span>
                    <Input
                      type="number"
                      dir="rtl"
                      className="w-24 h-9 bg-white shadow-sm border-0 focus-visible:ring-1 focus-visible:ring-orange-200 text-orange-700 font-mono font-bold"
                      value={arrearsToPayStr}
                      onChange={(e) => setArrearsToPayStr(e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  {/* Discount */}
                  <div className="flex justify-between items-center text-sm border-t border-border/50 pt-4">
                    <span className="text-muted-foreground font-bold tracking-tight">Discount</span>
                    <Input
                      type="number"
                      dir="rtl"
                      className="w-24 h-9 bg-white shadow-sm border-0 text-red-500 font-mono font-bold focus-visible:ring-1 focus-visible:ring-ring/20"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  {/* Late Fine (Optional) */}
                  <div className="flex justify-between items-center text-sm border-t border-border/50 pt-4">
                    <span className="text-muted-foreground font-bold tracking-tight">Late Fine <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest ml-1">(optional)</span></span>
                    <Input
                      type="number"
                      dir="rtl"
                      className="w-24 h-9 bg-white shadow-sm border-0 text-foreground font-mono font-bold focus-visible:ring-1 focus-visible:ring-ring/20"
                      value={lateFineStr}
                      onChange={(e) => setLateFineStr(e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div className="flex justify-between items-center text-sm border-t border-border/50 pt-4">
                    <span className="font-bold text-foreground tracking-tight">Net Payable</span>
                    <span className="font-mono font-extrabold text-lg text-foreground tracking-tighter">{formatTaka(netPayable)}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm border-t border-border/50 pt-4">
                    <span className="font-bold text-foreground tracking-tight">Amount Paid</span>
                    <Input
                      type="number"
                      dir="rtl"
                      className="w-32 h-10 bg-white shadow-sm border border-border/50 focus-visible:ring-2 focus-visible:ring-ring/30 font-mono font-black text-lg text-foreground"
                      value={amountPaidStr}
                      onChange={(e) => setAmountPaidStr(e.target.value)}
                      placeholder={netPayable.toString()}
                    />
                  </div>

                  {remainingDue > 0 && (
                    <div className="flex justify-between items-center pt-3 border-t border-dashed border-red-200">
                      <span className="text-sm font-bold text-red-600 tracking-tight">Remaining Due</span>
                      <span className="text-xl font-black text-red-600 font-mono tracking-tighter">{formatTaka(remainingDue)}</span>
                    </div>
                 )}
                </div>

                {/* Method & Notes */}
                <div className="space-y-3 px-1">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Method & Notes</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="bg-muted border-0 shadow-none h-11 font-semibold text-foreground rounded-xl focus:ring-1 focus:ring-ring/30"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-border/50 shadow-md rounded-xl">
                      <SelectItem value="cash" className="rounded-lg">Cash Payment</SelectItem>
                      <SelectItem value="bank" className="rounded-lg">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_banking" className="rounded-lg">bKash / Nagad / Upay</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Optional remarks (e.g. bKash TrxID)"
                    className="bg-muted border-0 shadow-none h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-ring/30 font-medium"
                  />

                  <Button
                    size="lg"
                    className="w-full h-12 mt-2 text-base font-bold bg-primary text-primary-foreground shadow-none rounded-xl hover:bg-primary/90 transition-colors"
                    onClick={handleSubmit}
                    disabled={submitting || (activeFees.length === 0 && arrearsToPayNum === 0)}
                  >
                    {submitting ? <SpinnerGap size={20} strokeWidth={1.5} className="mr-2 animate-spin" /> : <CheckCircle size={20} strokeWidth={2} className="mr-2" />}
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
