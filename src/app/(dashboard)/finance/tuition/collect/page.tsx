'use client';

import { useEffect, useState } from 'react';
import { printHtml } from '@/lib/print-utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2 as SpinnerGap, Search as MagnifyingGlass, UserCircle, CheckCircle, 
  Receipt, Printer, AlertCircle as WarningCircle, RotateCcw as ClockCounterClockwise, 
  Ban, ShieldAlert 
} from "lucide-react";
import { formatTaka, getMonthName, roundCurrency } from '@/lib/finance-utils';
import PrintReceipt from '@/components/finance/PrintReceipt';
import { generateTuitionReceiptHtml, ReceiptFormat } from '@/lib/finance-receipt-template';

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

function isPaymentVoid(p: any): boolean {
  if (!p) return false;
  if (p.status === 'void') return true;
  if (typeof p.note === 'string' && p.note.startsWith('[VOIDED')) return true;
  if (typeof p.void_reason === 'string' && p.void_reason.length > 0) return true;
  return false;
}

export default function CollectTuitionPage() {
  const supabase = createClient();

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
  const [partiallyPaidMonths, setPartiallyPaidMonths] = useState<Record<number, { paid: number; scheduled: number }>>({});
  const [paidYearlyFees, setPaidYearlyFees] = useState<string[]>([]);
  const [paidExamFees, setPaidExamFees] = useState<string[]>([]);
  const [totalArrears, setTotalArrears] = useState(0);
  const [arrearsToPayStr, setArrearsToPayStr] = useState('');

  // Exam selection for per-exam fees
  const [examList, setExamList] = useState<any[]>([]);
  const [selectedExamForFee, setSelectedExamForFee] = useState<Record<string, string[]>>({});

  // Submit & Print
  const [submitting, setSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptFormat, setReceiptFormat] = useState<ReceiptFormat>('standard');
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // Voiding Dialog State
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [paymentToVoid, setPaymentToVoid] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  // ──────────────────────── Init ────────────────────────
  useEffect(() => {
    const init = async () => {
      const [classRes, schoolRes, examRes] = await Promise.all([
        supabase.from('classes').select('id, name').order('numeric_value', { ascending: true }),
        supabase.from('school_info').select('name, address, phone, logo_url').limit(1).maybeSingle(),
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
    const yr = parseInt(paymentYear, 10);
    const months: number[] = [];
    const partials: Record<number, { paid: number; scheduled: number }> = {};
    const yearly: string[] = [];
    const paidExams: string[] = [];
    let arrears = 0;

    // Filter only completed (non-voided) payments
    const activePastPayments = pastPayments.filter(p => !isPaymentVoid(p));

    // Build monthly tuition rate lookup from current fee structures
    const tuitionFeeRate = fees.find(f => isMonthlyFee(f.type))?.amount || 0;

    for (const p of activePastPayments) {
      const net = roundCurrency(Number(p.amount_due) + Number(p.fine || 0) - Number(p.discount || 0));
      const remaining = roundCurrency(net - Number(p.amount_paid));
      if (remaining > 0) arrears = roundCurrency(arrears + remaining);

      const details = p.fee_details || [];

      // Subtract any arrears items that were already paid in this receipt
      for (const fd of details) {
        if (fd.type === 'arrears') {
          arrears = roundCurrency(Math.max(0, arrears - Number(fd.amount || 0)));
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
          const paidAmt = Number(fd.amount || 0);

          if (tuitionFeeRate > 0 && paidAmt < tuitionFeeRate) {
            partials[m] = {
              paid: roundCurrency((partials[m]?.paid || 0) + paidAmt),
              scheduled: tuitionFeeRate
            };
            if (partials[m].paid >= tuitionFeeRate) {
              if (!months.includes(m)) months.push(m);
              delete partials[m];
            }
          } else {
            if (!months.includes(m)) months.push(m);
          }
        } else if (isPerExamFee(fType) && fd.exam_name) {
          const examKey = `${fType}__${fd.exam_name}`;
          if (!paidExams.includes(examKey)) paidExams.push(examKey);
        } else if (fType && !isMonthlyFee(fType) && !isPerExamFee(fType)) {
          if (!yearly.includes(fType)) yearly.push(fType);
        }
      }
    }

    arrears = Math.max(0, arrears);
    setPaidMonths(months);
    setPartiallyPaidMonths(partials);
    setPaidYearlyFees(yearly);
    setPaidExamFees(paidExams);
    setTotalArrears(arrears);
    setArrearsToPayStr(arrears > 0 ? arrears.toString() : '');
  }, [pastPayments, paymentYear, fees]);

  // ──────────────────────── Remove fully paid months from selected ────────────────────────
  useEffect(() => {
    setPaymentMonths(prev => {
      const cleaned = prev.filter(m => !paidMonths.includes(parseInt(m, 10)));
      if (cleaned.length === 0) {
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
      supabase.from('students').select('id, name, roll, student_id').eq('class_id', classId).order('roll')
    ]);
    if (secRes.data) setSections(secRes.data);
    if (stuRes.data) setStudentsList([...stuRes.data].sort((a: any, b: any) => {
      const na = parseInt(a.roll, 10), nb = parseInt(b.roll, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return (a.roll || '').localeCompare(b.roll || '');
    }));
  };

  const handleSectionChange = async (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setSelectedStudentId('');
    resetBilling();

    let query = supabase.from('students').select('id, name, roll, student_id').eq('class_id', selectedClassId);
    if (sectionId !== 'all') {
      if (sectionId === 'none') query = query.is('section_id', null);
      else query = query.eq('section_id', sectionId);
    }
    const { data } = await query.order('roll');
    if (data) setStudentsList([...data].sort((a: any, b: any) => {
      const na = parseInt(a.roll, 10), nb = parseInt(b.roll, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return (a.roll || '').localeCompare(b.roll || '');
    }));
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
      let query = supabase.from('students').select('id, name, class_id, section_id, roll, student_id, classes(name), sections(name)');

      if (isUUID || (queryVal.length > 20 && queryVal.includes('-'))) {
        query = query.eq('id', queryVal.trim());
      } else {
        const val = queryVal.trim();
        if (/^\d+$/.test(val)) {
          query = query.or(`roll.eq."${val}",name.ilike."%${val}%",student_id.eq."${val}"`);
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

      // Load fee structure for this class
      const className = (data.classes as { name?: string })?.name;
      if (className) {
        const { data: structs } = await supabase
          .from('fee_structure')
          .select('fee_type, amount')
          .eq('class_name', className)
          .eq('academic_year', currentYear.toString())
          .eq('is_active', true);

        if (structs && structs.length > 0) {
          setFees(structs.map((s: any) => ({
            type: s.fee_type,
            amount: Number(s.amount),
            label: s.fee_type.charAt(0).toUpperCase() + s.fee_type.slice(1).replace('_', ' ') + ' Fee',
            selected: s.fee_type === 'tuition'
          })));
        } else {
          setFees([
            { type: 'tuition', amount: 1000, label: 'Tuition Fee', selected: true },
            { type: 'exam', amount: 500, label: 'Exam Fee', selected: false },
            { type: 'sports', amount: 200, label: 'Sports Fee', selected: false },
          ]);
        }
      } else {
        setFees([
          { type: 'tuition', amount: 1000, label: 'Tuition Fee', selected: true },
          { type: 'exam', amount: 500, label: 'Exam Fee', selected: false },
          { type: 'sports', amount: 200, label: 'Sports Fee', selected: false },
        ]);
      }

      // Load past payments (all, including void for history)
      const { data: past, error: pastError } = await supabase
        .from('tuition_payments')
        .select('*')
        .eq('student_id', data.id)
        .order('payment_date', { ascending: false });

      if (pastError) {
        console.warn('Past payments load error:', pastError);
      }

      setPastPayments(past || []);

    } catch (err: any) {
      console.error('Student load error:', err);
      toast.error(err?.message || "Error loading student data");
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
        window.history.replaceState({}, '', '/finance/tuition/collect');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setSelectedExamForFee({});
    setLastReceipt(null);
    setShowReceipt(false);
  };

  // ──────────────────────── Calculations ────────────────────────
  const activeFees = fees.filter(f => {
    if (!f.selected) return false;
    const fType = f.type.toLowerCase().trim();
    if (isPerExamFee(fType)) return true;
    if (!isMonthlyFee(fType) && paidYearlyFees.includes(fType)) return false;
    return true;
  });

  const activeMonths = paymentMonths.filter(m => !paidMonths.includes(parseInt(m, 10)));

  const totalDue = activeFees.reduce((sum, f) => {
    let multiplier = 1;
    if (isMonthlyFee(f.type)) {
      multiplier = activeMonths.length;
    } else if (isPerExamFee(f.type)) {
      multiplier = Math.max(1, (selectedExamForFee[f.type] || []).length);
    }
    return roundCurrency(sum + (Number(f.amount) * multiplier));
  }, 0);

  const numDiscount = roundCurrency(Number(discount) || 0);
  const arrearsToPayNum = roundCurrency(Number(arrearsToPayStr) || 0);
  const numFine = roundCurrency(Number(lateFineStr) || 0);
  const netPayable = roundCurrency(Math.max(0, totalDue + arrearsToPayNum + numFine - numDiscount));
  const actualPaid = amountPaidStr === '' ? netPayable : roundCurrency(Math.max(0, Number(amountPaidStr)));
  const remainingDue = roundCurrency(Math.max(0, netPayable - actualPaid));

  const toggleFee = (idx: number) => {
    const newFees = [...fees];
    newFees[idx].selected = !newFees[idx].selected;
    setFees(newFees);
  };

  const handleAmountChange = (idx: number, val: string) => {
    const newFees = [...fees];
    newFees[idx].amount = roundCurrency(Number(val));
    setFees(newFees);
  };

  // ──────────────────────── View Past Receipt ────────────────────────
  const handleViewReceipt = (p: any) => {
    const isVoid = isPaymentVoid(p);
    const receiptData = {
      school: schoolInfo || { name: 'School Name', address: 'Address', phone: 'Phone' },
      receipt_number: p.receipt_number,
      student: {
        name: student?.name || p.student_name || 'Student',
        class_name: (student?.classes as { name?: string })?.name || student?.class_name || p.class_name || 'N/A',
        section: (student?.sections as { name?: string })?.name || student?.section || p.section || '',
        roll: student?.roll || student?.student_id || p.roll || ''
      },
      fee_type: p.fee_type,
      fee_details: p.fee_details,
      month_name: p.month ? getMonthName(p.month) : undefined,
      year: p.year,
      amount_due: p.amount_due,
      discount: p.discount || 0,
      fine: p.fine || 0,
      amount_paid: p.amount_paid,
      payment_method: p.payment_method || 'cash',
      payment_date: p.payment_date || '',
      status: isVoid ? 'void' : (p.status || 'completed'),
      note: p.note
    };

    setLastReceipt(receiptData);
    setShowReceipt(true);
  };

  // ──────────────────────── Submit Payment ────────────────────────
  const handleSubmit = async () => {
    if (submitting) return; // double-click lock
    if (!student) {
      toast.error("Please search and select a student first");
      return;
    }
    if (activeFees.length === 0 && arrearsToPayNum === 0) {
      toast.error("Select at least one fee or enter an arrears amount");
      return;
    }
    if (actualPaid <= 0) {
      toast.error("Payment amount must be greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const feeDetails: any[] = [];

      for (const f of activeFees) {
        if (isPerExamFee(f.type)) {
          const selected = selectedExamForFee[f.type] || [];
          if (selected.length === 0) {
            toast.error(`Please select at least one exam for "${f.label}"`);
            setSubmitting(false);
            return;
          }
        }
      }

      activeFees.forEach(f => {
        if (isMonthlyFee(f.type)) {
          activeMonths.forEach(m => {
            feeDetails.push({ type: f.type, amount: Number(f.amount), month: parseInt(m, 10), year: parseInt(paymentYear, 10) });
          });
        } else if (isPerExamFee(f.type)) {
          const selected = selectedExamForFee[f.type] || [];
          selected.forEach(examId => {
             const exam = examList.find(e => e.id === examId);
             feeDetails.push({ type: f.type, amount: Number(f.amount), year: parseInt(paymentYear, 10), exam_name: exam?.name || '' });
          });
        } else {
          feeDetails.push({ type: f.type, amount: Number(f.amount), year: parseInt(paymentYear, 10) });
        }
      });

      if (arrearsToPayNum > 0) {
        feeDetails.push({ type: 'arrears', amount: arrearsToPayNum, year: parseInt(paymentYear, 10) });
      }

      const payload = {
        student_id: student.id,
        class_name: (student.classes as { name?: string })?.name || student.class_name || 'N/A',
        section: (student.sections as { name?: string })?.name || student.section || '',
        fee_details: feeDetails,
        year: parseInt(paymentYear, 10),
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

      if (result.success && result.data) {
        toast.success("Payment completed successfully!");

        const receiptData = {
          school: schoolInfo || { name: 'School Name', address: 'Address', phone: 'Phone' },
          receipt_number: result.data.receipt_number,
          student: {
            name: student.name,
            class_name: (student.classes as { name?: string })?.name || student.class_name || 'N/A',
            section: (student.sections as { name?: string })?.name || student.section || '',
            roll: student.roll || student.student_id || ''
          },
          fee_type: result.data.fee_type,
          fee_details: feeDetails,
          month_name: activeMonths.length > 0 ? getMonthName(parseInt(activeMonths[0], 10)) : undefined,
          year: parseInt(paymentYear, 10),
          amount_due: result.data.amount_due,
          discount: result.data.discount,
          fine: result.data.fine,
          amount_paid: result.data.amount_paid,
          payment_method: paymentMethod,
          payment_date: result.data.payment_date || new Date().toISOString(),
          status: result.data.status || 'completed',
          note: note
        };

        setLastReceipt(receiptData);
        setShowReceipt(true);

        // Silently reload past payments in the background without closing the receipt
        const { data: updatedPast } = await supabase
          .from('tuition_payments')
          .select('*')
          .eq('student_id', student.id)
          .order('payment_date', { ascending: false });

        if (updatedPast) {
          setPastPayments(updatedPast);
        }

      } else {
        toast.error(result.error || "Payment failed");
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      toast.error(err?.message || "Network or server error during payment submission");
    } finally {
      setSubmitting(false);
    }
  };

  // ──────────────────────── Void Payment Action ────────────────────────
  const handleOpenVoidDialog = (payment: any) => {
    setPaymentToVoid(payment);
    setVoidReason('');
    setVoidDialogOpen(true);
  };

  const handleConfirmVoid = async () => {
    if (!paymentToVoid || !voidReason.trim() || voidReason.trim().length < 3) {
      toast.error("Please enter a valid reason for voiding (min 3 characters)");
      return;
    }

    setVoiding(true);
    try {
      const res = await fetch('/api/finance/tuition/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: paymentToVoid.id,
          reason: voidReason.trim()
        })
      });
      const result = await res.json();

      if (result.success) {
        toast.success(result.message || "Payment voided successfully");
        setVoidDialogOpen(false);
        setPaymentToVoid(null);

        // Silently reload past payments so voided status immediately updates without resetting the form
        if (student) {
          const { data: updatedPast } = await supabase
            .from('tuition_payments')
            .select('*')
            .eq('student_id', student.id)
            .order('payment_date', { ascending: false });

          if (updatedPast) {
            setPastPayments(updatedPast);
          }
        }
      } else {
        toast.error(result.error || "Failed to void payment");
      }
    } catch (err: any) {
      console.error('Void error:', err);
      toast.error(err?.message || "Error voiding payment");
    } finally {
      setVoiding(false);
    }
  };

  const handlePrint = () => {
    if (!lastReceipt) return;
    const html = generateTuitionReceiptHtml(lastReceipt, {
      format: receiptFormat,
      school: lastReceipt.school || schoolInfo
    });
    printHtml(html);
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
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Top Control Bar */}
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle size={20} strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">Receipt #{lastReceipt.receipt_number}</h1>
              <p className="text-xs text-muted-foreground font-mono">
                {lastReceipt.student?.name} • Class: {lastReceipt.student?.class_name} • Amount: {formatTaka(lastReceipt.amount_paid)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Format Selector */}
            <div className="flex items-center bg-muted p-1 rounded-xl border border-border/50 text-xs">
              <button
                type="button"
                onClick={() => setReceiptFormat('standard')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  receiptFormat === 'standard'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Standard A4
              </button>
              <button
                type="button"
                onClick={() => setReceiptFormat('dual')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  receiptFormat === 'dual'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Dual Copy
              </button>
              <button
                type="button"
                onClick={() => setReceiptFormat('pos')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  receiptFormat === 'pos'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                POS Slip
              </button>
            </div>

            <Button
              variant="outline"
              className="rounded-xl font-bold h-10 border-border bg-background hover:bg-muted text-foreground"
              onClick={handleNewCollection}
            >
              Back to Form
            </Button>
            <Button
              className="rounded-xl font-bold h-10 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none px-5"
              onClick={handlePrint}
            >
              <Printer size={16} strokeWidth={2} className="mr-2" /> Print Receipt
            </Button>
          </div>
        </div>

        {/* Receipt Document Preview */}
        <div className="bg-muted/40 p-4 sm:p-8 rounded-2xl border border-border flex justify-center">
          <PrintReceipt
            data={lastReceipt}
            format={receiptFormat}
            className="w-full max-w-2xl"
          />
        </div>
      </div>
    );
  }

  // ═══════════════════════ MAIN FORM ═══════════════════════
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Collect Fees</h1>
        <p className="text-muted-foreground text-sm">Select student, allocate fees & partial payments, collect and issue verified receipts.</p>
      </div>

      {/* ─── Search Bar ─── */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex-1 min-w-[140px]">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Class</p>
            <Select value={selectedClassId} onValueChange={handleClassChange}>
              <SelectTrigger className="w-full h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border shadow-md">
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
              <SelectContent className="rounded-xl border-border shadow-md">
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
              <SelectContent className="rounded-xl border-border shadow-md">
                {studentsList.map(st => (
                  <SelectItem key={st.id} value={st.id} className="rounded-lg">{st.name} (Roll: {st.roll})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="hidden lg:flex h-11 items-center px-1 font-bold text-muted-foreground/60 text-sm">OR</div>
          
          <div className="flex-[1.5] min-w-[140px]">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Search by ID, Roll or Name</p>
            <form onSubmit={handleSearch} className="flex space-x-2">
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

        {/* Left: Profile & Past Payments */}
        <div className="lg:col-span-4 space-y-4">
          {student && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
              {/* Student Card */}
              <Card className="border border-border shadow-none bg-card rounded-xl relative overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3 shadow-none border-0">
                    <UserCircle className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <CardTitle className="text-lg font-bold text-foreground tracking-tight">{student.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
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

              {/* Payment Status & Arrears */}
              <Card className="border border-border shadow-none bg-card rounded-xl">
                <CardContent className="pt-5 space-y-4">
                  <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                    <WarningCircle size={14} strokeWidth={1.5} className="text-orange-500" /> Payment Summary ({paymentYear})
                  </h4>

                  <div className={`rounded-xl p-3.5 flex justify-between items-center ${totalArrears > 0 ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40' : 'bg-muted'}`}>
                    <span className={`text-sm font-bold tracking-tight ${totalArrears > 0 ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>
                      {totalArrears > 0 ? 'Outstanding Arrears' : 'Clear (No Arrears)'}
                    </span>
                    <span className={`text-xl font-bold font-mono tracking-tighter ${totalArrears > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {formatTaka(totalArrears)}
                    </span>
                  </div>

                  {paidMonths.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-widest">Fully Paid Months</p>
                      <div className="flex flex-wrap gap-1.5">
                        {paidMonths.sort((a, b) => a - b).map(m => (
                          <Badge key={m} className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            <CheckCircle size={12} strokeWidth={2} className="mr-1" />{getMonthName(m)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(partiallyPaidMonths).length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mb-2 uppercase tracking-widest">Partially Paid Months</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(partiallyPaidMonths).map(([mStr, info]) => {
                          const mNum = parseInt(mStr, 10);
                          const remainingDueOnMonth = info.scheduled - info.paid;
                          return (
                            <Badge key={mStr} variant="outline" className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              {getMonthName(mNum)} (Paid: {info.paid}, Due: {remainingDueOnMonth} TK)
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Past Payments History with Print and Void Actions */}
                  {pastPayments.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 tracking-widest">
                        <ClockCounterClockwise size={14} strokeWidth={1.5} /> Payment History ({pastPayments.length})
                      </p>
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {pastPayments.map(p => {
                          const isVoid = isPaymentVoid(p);
                          const net = Number(p.amount_due) + Number(p.fine || 0) - Number(p.discount || 0);
                          const remaining = roundCurrency(net - Number(p.amount_paid));

                          return (
                            <div key={p.id || p.receipt_number} className={`p-3 rounded-xl border text-xs ${isVoid ? 'bg-muted/40 border-dashed border-red-300 dark:border-red-950 opacity-60' : 'bg-muted/50 border-border'}`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-bold text-foreground">{p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GB') : '-'}</p>
                                    {isVoid && <Badge className="bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border-0 text-[8px] font-black px-1.5 h-4">VOIDED</Badge>}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.receipt_number}</p>
                                </div>
                                <div className="text-right">
                                  <p className={`font-mono font-bold text-sm ${isVoid ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{formatTaka(p.amount_paid)}</p>
                                  {!isVoid && remaining > 0 && (
                                    <p className="text-[10px] text-red-500 font-bold">Due: {formatTaka(remaining)}</p>
                                  )}
                                </div>
                              </div>

                              <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewReceipt(p)}
                                  className="h-6 px-2 text-[10px] text-foreground hover:bg-muted/80 rounded-md font-bold border-border shadow-none"
                                >
                                  <Printer size={11} className="mr-1" /> View / Print Receipt
                                </Button>

                                {!isVoid && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenVoidDialog(p)}
                                    className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md font-bold"
                                  >
                                    <Ban size={11} className="mr-1" /> Void Payment
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right: Billing & Fee Allocations */}
        <div className="lg:col-span-8">
          <Card className={`border border-border shadow-none bg-card rounded-xl transition-all duration-300 ${!student ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground tracking-tight">
                <Receipt size={20} strokeWidth={1.5} className="text-muted-foreground" /> Billing Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Fee Selection */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Select Fees & Months</h3>

                {/* Month Grid */}
                <div className="space-y-2">
                  <div className="flex justify-between items-end px-1">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Monthly Fee Months</Label>
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 rounded-sm">{activeMonths.length} selected</span>
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
                              setPaymentMonths(prev => [...prev, mStr].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)));
                            }
                          }}
                          className={`h-8 text-[11px] font-bold rounded-lg transition-all border-0 relative overflow-hidden
                            ${isPaid
                              ? 'bg-muted/80 text-muted-foreground/60 cursor-not-allowed'
                              : isSelected
                                ? 'bg-primary text-primary-foreground shadow-sm scale-[1.02]'
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
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Academic Year</Label>
                  <Input type="number" className="h-9 text-sm font-bold bg-muted border-0 shadow-none w-28 focus-visible:ring-1 focus-visible:ring-ring/30" value={paymentYear} onChange={e => setPaymentYear(e.target.value)} />
                </div>

                {/* Fee Items */}
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {fees.map((fee, idx) => {
                    const monthly = isMonthlyFee(fee.type);
                    const perExam = isPerExamFee(fee.type);
                    const locked = !monthly && !perExam && paidYearlyFees.includes(fee.type.toLowerCase().trim());

                    const relevantExams = perExam
                      ? examList.filter(e => {
                          if (fee.type === 'mct_exam') return e.exam_type === 'mct';
                          if (fee.type === 'semester_exam') return e.exam_type === 'semester';
                          return e.exam_type === 'mct' || e.exam_type === 'semester';
                        })
                      : [];

                    return (
                      <div key={idx} className="space-y-1.5">
                        <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all shadow-none
                          ${locked ? 'opacity-50 cursor-not-allowed bg-muted/80 border-transparent' : fee.selected ? 'bg-muted/50 border-primary cursor-pointer shadow-xs' : 'bg-muted border-transparent hover:bg-muted/80 cursor-pointer'}`}
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
                            className="w-24 h-8 bg-background border border-border text-right text-sm px-2 font-mono font-bold focus-visible:ring-1 focus-visible:ring-ring/30 disabled:opacity-100 shadow-xs text-foreground"
                          />
                        </label>

                        {/* Exam selector for per-exam fees */}
                        {perExam && fee.selected && (
                          <div className="ml-9 mr-1 mt-2 space-y-1.5 border-l-2 border-border pl-3 py-1">
                            {relevantExams.map(exam => {
                              const examKey = `${fee.type.toLowerCase().trim()}__${exam.name}`;
                              const isPaidExam = paidExamFees.includes(examKey);
                              const selectedExams = selectedExamForFee[fee.type] || [];
                              const isSelected = selectedExams.includes(exam.id);
                              
                              return (
                                <label key={exam.id} className={`flex items-center gap-2 p-2 rounded-lg transition-all ${isPaidExam ? 'opacity-50 cursor-not-allowed bg-muted/50' : isSelected ? 'bg-primary/5 cursor-pointer' : 'hover:bg-muted/50 cursor-pointer'}`}>
                                  <Checkbox 
                                    disabled={isPaidExam} 
                                    checked={isSelected || isPaidExam} 
                                    onCheckedChange={(checked) => {
                                      setSelectedExamForFee(prev => {
                                        const curr = prev[fee.type] || [];
                                        if (checked) return { ...prev, [fee.type]: [...curr, exam.id] };
                                        return { ...prev, [fee.type]: curr.filter(id => id !== exam.id) };
                                      });
                                    }}
                                    className="h-4 w-4 border-border/80 data-[state=checked]:bg-primary"
                                  />
                                  <span className="text-xs font-semibold text-foreground">{exam.name} {isPaidExam && <Badge className="ml-1.5 bg-muted text-muted-foreground border-0 text-[8px] font-bold px-1.5 h-3.5 shadow-none">PAID</Badge>}</span>
                                </label>
                              );
                            })}
                            {relevantExams.length === 0 && <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">No exams found</p>}
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

                <div className="bg-muted/50 border border-border p-5 rounded-xl space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-bold tracking-tight">Fee Total</span>
                    <span className="font-mono font-bold text-foreground">{formatTaka(totalDue)}</span>
                  </div>

                  {/* Arrears */}
                  <div className="flex justify-between items-center text-sm border-t border-border pt-4">
                    <span className="flex flex-col">
                      <span className="font-bold text-red-600 dark:text-red-400 tracking-tight">Arrears / Due</span>
                      {totalArrears > 0 && (
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Available: {formatTaka(totalArrears)}</span>
                      )}
                    </span>
                    <Input
                      type="number"
                      dir="rtl"
                      className="w-24 h-9 bg-background shadow-xs border border-border focus-visible:ring-1 focus-visible:ring-orange-200 text-orange-700 dark:text-orange-400 font-mono font-bold"
                      value={arrearsToPayStr}
                      onChange={(e) => setArrearsToPayStr(e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  {/* Discount */}
                  <div className="flex justify-between items-center text-sm border-t border-border pt-4">
                    <span className="text-muted-foreground font-bold tracking-tight">Authorized Discount</span>
                    <Input
                      type="number"
                      dir="rtl"
                      className="w-24 h-9 bg-background shadow-xs border border-border text-red-500 font-mono font-bold focus-visible:ring-1 focus-visible:ring-ring/20"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  {/* Late Fine (Optional) */}
                  <div className="flex justify-between items-center text-sm border-t border-border pt-4">
                    <span className="text-muted-foreground font-bold tracking-tight">Late Fine <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest ml-1">(optional)</span></span>
                    <Input
                      type="number"
                      dir="rtl"
                      className="w-24 h-9 bg-background shadow-xs border border-border text-foreground font-mono font-bold focus-visible:ring-1 focus-visible:ring-ring/20"
                      value={lateFineStr}
                      onChange={(e) => setLateFineStr(e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div className="flex justify-between items-center text-sm border-t border-border pt-4">
                    <span className="font-bold text-foreground tracking-tight">Net Payable</span>
                    <span className="font-mono font-semibold text-lg text-foreground tracking-tighter">{formatTaka(netPayable)}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm border-t border-border pt-4">
                    <span className="font-bold text-foreground tracking-tight">Amount Being Paid</span>
                    <Input
                      type="number"
                      dir="rtl"
                      className="w-32 h-10 bg-background shadow-xs border border-border focus-visible:ring-2 focus-visible:ring-ring/30 font-mono font-black text-lg text-foreground"
                      value={amountPaidStr}
                      onChange={(e) => setAmountPaidStr(e.target.value)}
                      placeholder={netPayable.toString()}
                    />
                  </div>

                  {remainingDue > 0 && (
                    <div className="flex justify-between items-center pt-3 border-t border-dashed border-red-200 dark:border-red-900">
                      <span className="text-sm font-bold text-red-600 dark:text-red-400 tracking-tight">Remaining Due</span>
                      <span className="text-xl font-black text-red-600 dark:text-red-400 font-mono tracking-tighter">{formatTaka(remainingDue)}</span>
                    </div>
                 )}
                </div>

                {/* Method & Notes */}
                <div className="space-y-3 px-1">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Payment Method & Reference</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="bg-muted border-0 shadow-none h-11 font-semibold text-foreground rounded-xl focus:ring-1 focus:ring-ring/30"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-border shadow-md rounded-xl">
                      <SelectItem value="cash" className="rounded-lg">Cash Payment</SelectItem>
                      <SelectItem value="bank" className="rounded-lg">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_banking" className="rounded-lg">bKash / Nagad / Rocket</SelectItem>
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
                    Confirm Payment & Generate Receipt
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── VOID PAYMENT DIALOG ─── */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert size={20} /> Void Tuition Payment
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Voiding this payment will mark the receipt as void, adjust the student&apos;s dues, and reverse the associated income ledger entry.
            </DialogDescription>
          </DialogHeader>

          {paymentToVoid && (
            <div className="space-y-3 py-2">
              <div className="p-3 bg-muted rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-bold">Receipt:</span>
                  <span className="font-mono font-bold text-foreground">{paymentToVoid.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-bold">Amount Paid:</span>
                  <span className="font-mono font-bold text-foreground">{formatTaka(paymentToVoid.amount_paid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-bold">Date:</span>
                  <span>{paymentToVoid.payment_date ? new Date(paymentToVoid.payment_date).toLocaleDateString('en-GB') : '-'}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reason for Voiding *</Label>
                <Input
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  placeholder="e.g. Wrong student selected / Payment entered in error"
                  className="rounded-xl bg-muted border-0 h-10 text-xs font-medium"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setVoidDialogOpen(false)}
              disabled={voiding}
              className="rounded-xl border-border"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmVoid}
              disabled={voiding || !voidReason.trim() || voidReason.trim().length < 3}
              className="rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white"
            >
              {voiding ? <SpinnerGap size={16} className="mr-2 animate-spin" /> : <Ban size={16} className="mr-2" />}
              Confirm Void
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
