'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createClient } from '@/lib/supabase/client';
import { SCHOOL_INFO_COLUMNS, STAFF_SALARY_CONFIG_COLUMNS } from '@/lib/supabase/select-columns';
import { Loader2 as SpinnerGap, Printer, User, Wallet, ArrowRight, CheckCircle } from "lucide-react";
import { formatTaka, getMonthName } from '@/lib/finance-utils';
import Link from 'next/link';
import { Settings } from 'lucide-react';

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

  const supabase = createClient() as any;

  useEffect(() => {
    const fetchStaffAndSchoolInfo = async () => {
      const [staffRes, schoolRes] = await Promise.all([
        supabase.from('teachers').select('id, name, designation, phone').order('name'),
        supabase.from('school_info').select(SCHOOL_INFO_COLUMNS).maybeSingle()
      ]);
      if (staffRes.data) setStaffList(staffRes.data);
      if (schoolRes.data) setSchoolInfo(schoolRes.data);
    };
    fetchStaffAndSchoolInfo();
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
    if (!form.staff_id) { toast.error("Select a staff member"); return; }
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
        setLastSlip({
          staff: selectedStaff,
          config: salaryConfig,
          slip_number: data.data.slip_number,
          school: schoolInfo,
          month: parseInt(form.month),
          year: parseInt(form.year),
          gross,
          deductions,
          net,
          payment_method: form.payment_method,
          date: new Date().toLocaleDateString('en-GB')
        });
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
    const s = lastSlip;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Salary Slip ${s.slip_number}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Inter', sans-serif; max-width:800px; margin:0 auto; padding:40px; color:#000; background:#fff; }
      
      .school-info { text-align: center; margin-bottom: 40px; }
      .school-info h2 { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
      .school-info p { font-size: 12px; color: #666; margin-top: 4px; }
      
      .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #e5e5e5; }
      .header-title h1 { font-size: 28px; font-weight: 900; letter-spacing: -1px; line-height: 1; text-transform: uppercase; }
      .header-title p { font-size: 12px; font-weight: 600; color: #666; letter-spacing: 2px; text-transform: uppercase; margin-top: 6px; }
      .header-date { text-align: right; }
      .header-date .month { font-size: 24px; font-weight: 800; text-transform: capitalize; }
      .header-date .year { font-size: 12px; font-weight: 600; color: #666; letter-spacing: 2px; text-transform: uppercase; }
      
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 40px; border-top: 1px solid #e5e5e5; }
      .info-item { padding: 15px 0; border-bottom: 1px solid #e5e5e5; }
      .info-item:nth-child(odd) { padding-right: 20px; }
      .info-item:nth-child(even) { padding-left: 20px; }
      .info-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #666; margin-bottom: 4px; }
      .info-value { font-size: 14px; font-weight: 600; color: #000; text-transform: capitalize; }
      
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #666; padding: 12px 0; border-bottom: 1px solid #e5e5e5; }
      td { padding: 12px 0; border-bottom: none; font-size: 13px; font-weight: 600; color: #333; text-transform: capitalize; }
      .col-amount { text-align: right; font-family: monospace; font-weight: 600; font-size: 14px; color: #000; }
      .deduction-amount { color: #dc2626; }
      
      .totals-wrap { margin-top: 20px; }
      .totals-box { width: 100%; }
      .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #666; font-weight: 600; }
      .totals-row .val { font-family: monospace; font-weight: 600; color: #000; font-size: 14px; }
      .totals-row.deduction .val { color: #dc2626; }
      
      .net-pay { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; margin-top: 10px; border-top: 2px solid #000; border-bottom: 2px solid #000; }
      .net-pay .lbl { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #000; }
      .net-pay .val { font-size: 28px; font-weight: 900; font-family: monospace; letter-spacing: -1px; }
      
      .footer { text-align: center; font-size: 10px; color: #999; margin-top: 60px; padding-top: 20px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    
    <div class="school-info">
      <h2>${s.school?.name || 'School Name'}</h2>
      <p>${s.school?.address || ''} ${s.school?.phone ? '• ' + s.school.phone : ''}</p>
    </div>
    
    <div class="header">
      <div class="header-title"><h1>Salary Slip</h1><p>${s.slip_number}</p></div>
      <div class="header-date">
        <div class="month">${getMonthName(s.month)}</div>
        <div class="year">${s.year}</div>
      </div>
    </div>
    
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Employee Name</div>
        <div class="info-value">${s.staff.name}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Designation</div>
        <div class="info-value">${s.staff.designation || 'Teacher'}</div>
      </div>
      <div class="info-item" style="border-bottom:none">
        <div class="info-label">Payment Date</div>
        <div class="info-value">${s.date}</div>
      </div>
      <div class="info-item" style="border-bottom:none">
        <div class="info-label">Payment Method</div>
        <div class="info-value">${(s.payment_method || 'Cash').replace('_', ' ')}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Basic Salary</td>
          <td class="col-amount">${s.config.basic_salary.toLocaleString('en-IN')} TK</td>
        </tr>
        ${Object.entries(s.config.allowances || {}).map(([k, v]: [string, any]) =>
          `<tr><td>${k}</td><td class="col-amount">+${Number(v).toLocaleString('en-IN')} TK</td></tr>`
        ).join('')}
        ${Object.entries(s.config.deductions || {}).map(([k, v]: [string, any]) =>
          `<tr><td>${k}</td><td class="col-amount deduction-amount">-${Number(v).toLocaleString('en-IN')} TK</td></tr>`
        ).join('')}
      </tbody>
    </table>

    <div class="totals-wrap">
      <div class="totals-box">
        <div class="totals-row">
          <span>Gross Earnings</span>
          <span class="val">${s.gross.toLocaleString('en-IN')} TK</span>
        </div>
        <div class="totals-row deduction">
          <span>Total Deductions</span>
          <span class="val">-${s.deductions.toLocaleString('en-IN')} TK</span>
        </div>
        
        <div class="net-pay">
          <span class="lbl">Net Pay</span>
          <span class="val">${s.net.toLocaleString('en-IN')} TK</span>
        </div>
      </div>
    </div>

    <div class="footer">Computer Generated Salary Slip • No Signature Required</div>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  // ═══════ SLIP VIEW ═══════
  if (lastSlip) {
    const s = lastSlip;
    return (
      <div className="space-y-6 max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading mb-1">Salary Slip</h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setLastSlip(null)} className="h-11 rounded-xl border-border/50 bg-white hover:bg-muted/50 text-muted-foreground font-bold shadow-none px-6">Pay Another</Button>
            <Button onClick={handlePrintSlip} className="h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-none px-6">
              <Printer size={16} strokeWidth={2} className="mr-2" /> Print Slip
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-sm rounded-none max-w-2xl mx-auto font-sans bg-white p-8 text-black">
          <div className="flex flex-col items-center justify-center pb-6 border-b border-border/50 text-center mb-6">
            <h2 className="text-xl font-bold tracking-tight text-black uppercase">{s.school?.name || "SCHOOL NAME"}</h2>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">{s.school?.address ? s.school.address + ' • ' : ''}Phone: {s.school?.phone || ''}</p>
          </div>
          
          <div className="flex justify-between items-end border-b border-border/50 pb-4 mb-6">
            <div>
              <h1 className="text-lg font-bold uppercase tracking-widest mb-1">Salary Slip</h1>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.slip_number}</p>
            </div>
            <div className="text-right">
              <p className="text-base font-bold capitalize">{getMonthName(s.month)}</p>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{s.year}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-y-4 gap-x-8 border-b border-border/50 pb-6 mb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Employee Name</p>
              <p className="font-semibold text-sm text-black capitalize">{s.staff.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Designation</p>
              <p className="font-semibold text-sm text-black capitalize">{s.staff.designation || s.staff.role || 'Teacher'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Payment Date</p>
              <p className="font-semibold text-sm text-black">{s.date}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Payment Method</p>
              <p className="font-semibold text-sm text-black capitalize">{(s.payment_method || 'Cash').replace('_', ' ')}</p>
            </div>
          </div>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 pb-3 border-b border-border/50">Description</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 pb-3 border-b border-border/50">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-transparent">
              <tr>
                <td className="py-3 font-semibold text-black capitalize">Basic Salary</td>
                <td className="text-right font-mono font-medium text-black py-3 text-sm">{formatTaka(s.config.basic_salary)}</td>
              </tr>
              {Object.entries(s.config.allowances || {}).map(([k, v]: [string, any]) => (
                <tr key={k}>
                  <td className="py-1.5 font-semibold text-black capitalize">{k}</td>
                  <td className="text-right font-mono font-medium text-black py-1.5 text-sm">+{formatTaka(Number(v))}</td>
                </tr>
              ))}
              {Object.entries(s.config.deductions || {}).map(([k, v]: [string, any]) => (
                <tr key={k}>
                  <td className="py-1.5 font-semibold text-black capitalize">{k}</td>
                  <td className="text-right font-mono font-medium text-red-600 py-1.5 text-sm">-{formatTaka(Number(v))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pt-4 border-t border-border/50 mb-8">
            <div className="w-full space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-muted-foreground">Gross Earnings</span>
                <span className="font-mono font-medium text-black text-sm">{formatTaka(s.gross)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-muted-foreground">Total Deductions</span>
                <span className="font-mono font-medium text-red-600 text-sm">-{formatTaka(s.deductions)}</span>
              </div>
              
              <div className="flex justify-between items-center border-y border-border py-3 mt-4">
                <span className="font-bold uppercase tracking-widest text-black text-sm">Net Pay</span>
                <span className="font-bold font-mono text-black text-lg tracking-tight">{formatTaka(s.net)}</span>
              </div>
            </div>
          </div>
          
          <div className="text-center pt-4">
            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">Computer Generated Salary Slip • No Signature Required</p>
          </div>
        </Card>
      </div>
    );
  }

  // ═══════ FORM VIEW ═══════
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading mb-1">Pay Salary</h1>
          <p className="text-muted-foreground text-sm mt-1">Disburse monthly salary to teachers & staff.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5 shadow-none border border-border/50 rounded-2xl h-fit overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle className="text-lg font-bold text-foreground">Salary Payment</CardTitle>
            <CardDescription className="font-bold text-muted-foreground">Ensure staff has an active salary configuration</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Select Staff</Label>
                <Select value={form.staff_id} onValueChange={v => setForm({...form, staff_id: v})}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none"><SelectValue placeholder="Select staff..." /></SelectTrigger>
                  <SelectContent className="border-border/50 rounded-xl shadow-md max-h-[300px]">
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
                    <SelectContent className="border-border/50 rounded-xl shadow-md">
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
                    <SelectContent className="border-border/50 rounded-xl shadow-md">
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
          <Card className={`shadow-none border border-border/50 rounded-2xl transition-all duration-300 overflow-hidden ${!form.staff_id ? 'opacity-40 grayscale' : ''}`}>
            <CardHeader className="border-b border-border/50 bg-muted/30 pb-4">
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Wallet size={20} strokeWidth={2.5} /> Salary Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              {!form.staff_id ? (
                <div className="text-center py-12 text-muted-foreground font-bold text-sm">Select a staff member to see salary breakdown</div>
              ) : loadingConfig ? (
                <div className="flex justify-center py-12"><SpinnerGap size={24} strokeWidth={2} className="animate-spin text-muted-foreground/40" /></div>
              ) : !salaryConfig ? (
                <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-2xl space-y-2">
                  <User size={40} strokeWidth={1.5} className="mx-auto text-muted-foreground/40" />
                  <p className="font-bold text-red-500">No salary configuration found</p>
                  <p className="text-xs font-bold text-muted-foreground/60">Configure salary for this staff member first</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border/50">
                    <div className="w-10 h-10 bg-white border border-border/50 shadow-sm rounded-full flex items-center justify-center">
                      <User size={18} strokeWidth={2.5} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">{selectedStaff?.name}</p>
                      <p className="text-xs font-bold text-muted-foreground capitalize">{selectedStaff?.role} • {getMonthName(parseInt(form.month))} {form.year}</p>
                    </div>
                  </div>

                  <div className="bg-card border border-border/50 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm border-b border-border/50 pb-2">
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
                      <div key={k} className="flex justify-between text-sm border-t border-border/50 pt-2">
                        <span className="capitalize text-muted-foreground font-bold">{k}</span>
                        <span className="font-mono font-black text-red-500">-{formatTaka(Number(v))}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-card border border-border/50 rounded-xl p-4 mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground font-bold">Gross</span>
                      <span className="font-mono font-bold text-foreground">{formatTaka(gross)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground font-bold">Deductions</span>
                      <span className="font-mono font-bold text-red-500">-{formatTaka(deductions)}</span>
                    </div>
                    <div className="flex justify-between pt-3 mt-1 border-t border-border/50">
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
