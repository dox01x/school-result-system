'use client';

import { useEffect, useState } from 'react';
import { printHtml } from '@/lib/print-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createClient } from '@/lib/supabase/client';
import { SCHOOL_INFO_COLUMNS, STAFF_SALARY_CONFIG_COLUMNS } from '@/lib/supabase/select-columns';
import { Loader2 as SpinnerGap, Printer, User, Wallet, ArrowRight, CheckCircle, Settings } from "lucide-react";
import { formatTaka, getMonthName } from '@/lib/finance-utils';
import PrintSlip from '@/components/finance/PrintSlip';
import { generateSalarySlipHtml } from '@/lib/finance-receipt-template';
import { SalarySlipData } from '@/types/finance';
import Link from 'next/link';

export default function PaySalaryPage() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [salaryConfig, setSalaryConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [lastSlip, setLastSlip] = useState<any>(null);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [form, setForm] = useState({
    staff_id: '',
    month: currentMonth.toString(),
    year: currentYear.toString(),
    payment_method: 'bank',
    note: ''
  });

  const supabase = createClient();

  useEffect(() => {
    const fetchTeachersAndSchoolInfo = async () => {
      const [teacherRes, schoolRes] = await Promise.all([
        supabase.from('teachers').select('id, name, designation, phone').order('name'),
        supabase.from('school_info').select(SCHOOL_INFO_COLUMNS).maybeSingle()
      ]);
      if (teacherRes.data) setStaffList(teacherRes.data);
      if (schoolRes.data) setSchoolInfo(schoolRes.data);
    };
    fetchTeachersAndSchoolInfo();
  }, []);

  // Load salary config when staff is selected
  useEffect(() => {
    if (!form.staff_id) { setSalaryConfig(null); return; }
    const load = async () => {
      setLoadingConfig(true);
      const { data } = await supabase
        .from('staff_salary_config')
        .select(STAFF_SALARY_CONFIG_COLUMNS)
        .eq('staff_id', form.staff_id)
        .eq('is_active', true)
        .maybeSingle();
      setSalaryConfig(data);
      setLoadingConfig(false);
    };
    load();
  }, [form.staff_id]);

  const sumObj = (obj: Record<string, any>) => obj ? Object.values(obj).reduce((s: number, v: any) => s + Number(v), 0) : 0;
  const gross = salaryConfig ? salaryConfig.basic_salary + sumObj(salaryConfig.allowances) : 0;
  const deductions = salaryConfig ? sumObj(salaryConfig.deductions) : 0;
  const net = gross - deductions;

  const selectedStaff = staffList.find(s => s.id === form.staff_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.staff_id) { toast.error("Select a teacher"); return; }
    if (!salaryConfig) { toast.error("No salary configuration found"); return; }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const res = await fetch('/api/finance/salary/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: form.staff_id,
          month: parseInt(form.month),
          year: parseInt(form.year),
          payment_method: form.payment_method,
          paid_by: userData?.user?.id,
          note: form.note
        })
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Salary paid successfully!");
        const slipData: SalarySlipData = {
          school: schoolInfo || { name: 'School Name', address: '', phone: '' },
          slip_number: data.data.slip_number,
          staff: {
            name: selectedStaff?.name || 'Teacher',
            designation: selectedStaff?.designation || 'Teacher',
            phone: selectedStaff?.phone || ''
          },
          month_name: getMonthName(parseInt(form.month)),
          year: parseInt(form.year),
          basic_salary: salaryConfig.basic_salary,
          allowances: Object.entries(salaryConfig.allowances || {}).map(([k, v]) => ({ label: k, amount: Number(v) })),
          deductions: Object.entries(salaryConfig.deductions || {}).map(([k, v]) => ({ label: k, amount: Number(v) })),
          gross_salary: gross,
          net_salary: net,
          payment_method: form.payment_method,
          payment_date: new Date().toISOString(),
          is_computer_generated: true
        };
        setLastSlip(slipData);
        setForm(prev => ({ ...prev, note: '' }));
      } else {
        toast.error(data.error || "Failed to pay salary");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintSlip = () => {
    if (!lastSlip) return;
    const html = generateSalarySlipHtml(lastSlip, {
      school: lastSlip.school || schoolInfo
    });
    printHtml(html);
  };

  // ═══════ SLIP VIEW ═══════
  if (lastSlip) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle size={20} strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">Salary Paid Successfully</h1>
              <p className="text-xs text-muted-foreground font-mono">Slip #{lastSlip.slip_number}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setLastSlip(null)}
              className="h-10 rounded-xl border-border bg-background hover:bg-muted text-foreground font-bold shadow-none px-5"
            >
              Pay Another
            </Button>
            <Button
              onClick={handlePrintSlip}
              className="h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-none px-5"
            >
              <Printer size={16} strokeWidth={2} className="mr-2" /> Print Payslip
            </Button>
          </div>
        </div>

        <div className="bg-muted/40 p-4 sm:p-8 rounded-2xl border border-border flex justify-center">
          <PrintSlip data={lastSlip} className="w-full max-w-2xl" />
        </div>
      </div>
    );
  }

  // ═══════ FORM VIEW ═══════
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground  mb-1">Pay Teacher Salary</h1>
          <p className="text-muted-foreground text-sm mt-1">Disburse monthly salary to teachers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5 shadow-none border border-border rounded-xl h-fit overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border">
            <CardTitle className="text-lg font-bold text-foreground">Teacher Salary Payment</CardTitle>
            <CardDescription className="font-bold text-muted-foreground">Ensure teacher has an active salary configuration</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Select Teacher</Label>
                <Select value={form.staff_id} onValueChange={v => setForm({...form, staff_id: v})}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none"><SelectValue placeholder="Select teacher..." /></SelectTrigger>
                  <SelectContent className="border-border rounded-xl shadow-md max-h-[300px]">
                    {staffList.map(s => (
                      <SelectItem key={s.id} value={s.id} className="rounded-lg font-medium">
                        {s.name} {s.designation ? `(${s.designation})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Month</Label>
                  <Select value={form.month} onValueChange={v => setForm({...form, month: v})}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-border rounded-xl shadow-md">
                      {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                        <SelectItem key={m} value={m.toString()} className="rounded-lg font-medium">{getMonthName(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Year</Label>
                  <Input type="number" value={form.year} onChange={e => setForm({...form, year: e.target.value})} className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Method</Label>
                  <Select value={form.payment_method} onValueChange={v => setForm({...form, payment_method: v})}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-border rounded-xl shadow-md">
                      <SelectItem value="cash" className="rounded-lg font-medium">Cash</SelectItem>
                      <SelectItem value="bank" className="rounded-lg font-medium">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_banking" className="rounded-lg font-medium">Mobile Banking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Note</Label>
                  <Input value={form.note} onChange={e => setForm({...form, note: e.target.value})} placeholder="Optional" className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-none mt-2" disabled={submitting || !salaryConfig}>
                {submitting ? <SpinnerGap size={16} strokeWidth={2} className="mr-2 animate-spin" /> : <CheckCircle size={16} strokeWidth={2} className="mr-2" />}
                Pay & Generate Slip
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Salary Preview */}
        <div className="lg:col-span-7">
          <Card className={`shadow-none border border-border rounded-xl transition-all duration-300 overflow-hidden ${!form.staff_id ? 'opacity-40 grayscale' : ''}`}>
            <CardHeader className="border-b border-border bg-muted/30 pb-4">
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Wallet size={20} strokeWidth={2.5} /> Salary Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              {!form.staff_id ? (
                <div className="text-center py-12 text-muted-foreground font-bold text-sm">Select a teacher to see salary breakdown</div>
              ) : loadingConfig ? (
                <div className="flex justify-center py-12"><SpinnerGap size={24} strokeWidth={2} className="animate-spin text-muted-foreground/40" /></div>
              ) : !salaryConfig ? (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-xl space-y-2">
                  <User size={40} strokeWidth={1.5} className="mx-auto text-muted-foreground/40" />
                  <p className="font-bold text-red-500">No salary configuration found</p>
                  <p className="text-xs font-bold text-muted-foreground/60">Configure salary for this teacher first</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border">
                    <div className="w-10 h-10 bg-card border border-border shadow-xs rounded-full flex items-center justify-center">
                      <User size={18} strokeWidth={2.5} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">{selectedStaff?.name}</p>
                      <p className="text-xs font-bold text-muted-foreground capitalize">{selectedStaff?.role} • {getMonthName(parseInt(form.month))} {form.year}</p>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm border-b border-border pb-2">
                      <span className="text-muted-foreground font-bold">Basic Salary</span>
                      <span className="font-mono font-black text-foreground">{formatTaka(salaryConfig.basic_salary)}</span>
                    </div>
                    {Object.entries(salaryConfig.allowances || {}).map(([k, v]: [string, any]) => (
                      <div key={k} className="flex justify-between text-sm">
                        <span className="capitalize text-muted-foreground font-bold">{k}</span>
                        <span className="font-mono font-black text-foreground">+{formatTaka(Number(v))}</span>
                      </div>
                    ))}
                    {Object.entries(salaryConfig.deductions || {}).map(([k, v]: [string, any]) => (
                      <div key={k} className="flex justify-between text-sm border-t border-border pt-2">
                        <span className="capitalize text-muted-foreground font-bold">{k}</span>
                        <span className="font-mono font-black text-red-500">-{formatTaka(Number(v))}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-card border border-border rounded-xl p-4 mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground font-bold">Gross</span>
                      <span className="font-mono font-bold text-foreground">{formatTaka(gross)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground font-bold">Deductions</span>
                      <span className="font-mono font-bold text-red-500">-{formatTaka(deductions)}</span>
                    </div>
                    <div className="flex justify-between pt-3 mt-1 border-t border-border">
                      <span className="font-bold text-foreground">Net Salary</span>
                      <span className="text-xl font-black font-mono text-foreground">{formatTaka(net)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
