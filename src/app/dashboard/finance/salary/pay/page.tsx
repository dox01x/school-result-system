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
import { Loader2, Printer, User, Wallet, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatTaka, getMonthName } from '@/lib/finance-utils';

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
    const fetchStaffAndSchool = async () => {
      const [staffRes, schoolRes] = await Promise.all([
        supabase.from('teachers').select('id, name, designation, phone').order('name'),
        supabase.from('school_info').select(SCHOOL_INFO_COLUMNS).maybeSingle()
      ]);
      if (staffRes.data) setStaffList(staffRes.data);
      if (schoolRes.data) setSchoolInfo(schoolRes.data);
    };
    fetchStaffAndSchool();
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
    const allowanceRows = Object.entries(s.config.allowances || {}).map(([k, v]: [string, any]) =>
      `<tr><td style="padding:4px 0;border-bottom:1px solid #f0f0f0;text-transform:capitalize">${k}</td><td style="padding:4px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-family:monospace;color:#059669">+${Number(v).toLocaleString('en-IN')} TK</td></tr>`
    ).join('');
    const deductionRows = Object.entries(s.config.deductions || {}).map(([k, v]: [string, any]) =>
      `<tr><td style="padding:4px 0;border-bottom:1px solid #f0f0f0;text-transform:capitalize">${k}</td><td style="padding:4px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-family:monospace;color:#dc2626">-${Number(v).toLocaleString('en-IN')} TK</td></tr>`
    ).join('');

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Salary Slip ${s.slip_number}</title>
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
      .net-box{display:flex;justify-content:space-between;align-items:center;width:280px;margin-top:15px;padding:15px 20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
      .net-box .lbl{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#0f172a}
      .net-box .val{font-size:20px;font-weight:800;font-family:monospace;color:#0f172a}
      
      .footer-note{text-align:center;font-size:9px;color:#94a3b8;margin-top:60px;text-transform:uppercase;letter-spacing:2px;font-weight:500}
    </style></head><body>
    <div class="pg">
      <div class="sch-hdr">
        ${s.school?.logo_url ? `<img src="${s.school.logo_url}" alt="Logo" />` : ''}
        <div class="sch-txt">
          <h1>${s.school?.name || 'SCHOOL NAME'}</h1>
          <div class="ad">${s.school?.address ? s.school.address + ' • ' : ''}Phone: ${s.school?.phone || ''}</div>
        </div>
      </div>
      
      <div class="tbar">
        <h2>Salary Statement</h2>
        <div class="en">${s.slip_number}</div>
      </div>
      
      <table class="itbl">
        <tr>
          <td class="lb">Employee</td><td class="vl">${s.staff.name}</td>
          <td class="lb">Designation</td><td class="vl" style="text-transform:capitalize">${s.staff.designation || 'Teacher'}</td>
        </tr>
        <tr>
          <td class="lb">Period</td><td class="vl">${getMonthName(s.month)} ${s.year}</td>
          <td class="lb">Paid On</td><td class="vl">${s.date}</td>
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
          <tr>
            <td>Basic Salary</td>
            <td style="text-align:right;font-family:monospace;font-weight:600">${s.config.basic_salary.toLocaleString('en-IN')}</td>
          </tr>
          ${allowanceRows}
          ${deductionRows}
        </tbody>
      </table>

      <div class="net-wrap">
        <div class="grp">
          <span>Gross Earnings</span>
          <span class="val">${s.gross.toLocaleString('en-IN')}</span>
        </div>
        <div class="grp grp-ded">
          <span>Total Deductions</span>
          <span class="val">-${s.deductions.toLocaleString('en-IN')}</span>
        </div>
        
        <div class="net-box">
          <span class="lbl">Net Pay</span>
          <span class="val">${s.net.toLocaleString('en-IN')} <span style="font-size:12px;opacity:0.7">BDT</span></span>
        </div>
      </div>

      <div class="footer-note">Computer Generated Salary Slip. No Signature Required.</div>
    </div></body></html>`);
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
          <h1 className="text-2xl font-bold tracking-tight">Salary Slip</h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setLastSlip(null)}>Pay Another</Button>
            <Button onClick={handlePrintSlip} className="shadow-lg">
              <Printer className="w-4 h-4 mr-2" /> Print Slip
            </Button>
          </div>
        </div>

        <Card className="border border-slate-200 shadow-xl rounded-2xl overflow-hidden max-w-2xl mx-auto font-sans bg-card">
          <div className="flex flex-col items-center justify-center p-8 pb-6 text-center">
            {s.school?.logo_url && (
              <img src={s.school.logo_url} alt="Logo" className="h-12 w-auto object-contain mb-4" />
            )}
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{s.school?.name || "SCHOOL NAME"}</h2>
            <p className="text-xs text-slate-500 mt-1">{s.school?.address ? s.school.address + ' • ' : ''}Phone: {s.school?.phone || ''}</p>
          </div>
          
          <div className="text-center pb-6">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Salary Statement</h3>
            <span className="text-xs text-slate-400 font-mono mt-1 block">{s.slip_number}</span>
          </div>
          
          <CardContent className="p-0 px-8">
            <div className="grid grid-cols-2 text-sm border-t border-b border-slate-100 py-4 gap-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Employee</p>
                <p className="font-semibold text-slate-900">{s.staff.name}</p>
                <p className="text-xs text-slate-500 capitalize">{s.staff.designation || s.staff.role || 'Teacher'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Period</p>
                <p className="font-semibold text-slate-900">{getMonthName(s.month)} {s.year}</p>
                <p className="text-xs text-slate-500">Paid on {s.date}</p>
              </div>
            </div>

            <div className="py-6">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold pb-3 border-b border-slate-100">Description</th>
                    <th className="text-right text-[10px] uppercase tracking-widest text-slate-400 font-semibold pb-3 border-b border-slate-100">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <tr>
                    <td className="py-3 text-slate-700">Basic Salary</td>
                    <td className="text-right font-mono font-medium text-slate-900 py-3">{formatTaka(s.config.basic_salary)}</td>
                  </tr>
                  {Object.entries(s.config.allowances || {}).map(([k, v]: [string, any]) => (
                    <tr key={k}>
                      <td className="py-3 capitalize text-slate-700">{k}</td>
                      <td className="text-right font-mono font-medium text-primary py-3">+{formatTaka(Number(v))}</td>
                    </tr>
                  ))}
                  {Object.entries(s.config.deductions || {}).map(([k, v]: [string, any]) => (
                    <tr key={k}>
                      <td className="py-3 capitalize text-slate-700">{k}</td>
                      <td className="text-right font-mono font-medium text-red-500 py-3">-{formatTaka(Number(v))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4 pb-8 border-t border-slate-100">
              <div className="w-64 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Gross Earnings</span>
                  <span className="font-mono font-medium">{formatTaka(s.gross)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Total Deductions</span>
                  <span className="font-mono font-medium text-red-500">-{formatTaka(s.deductions)}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 rounded-xl p-4 mt-4 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900">Net Pay</span>
                  <span className="text-lg font-bold font-mono text-slate-900">{formatTaka(s.net)}</span>
                </div>
              </div>
            </div>
            
            <div className="text-center pb-8">
              <p className="text-[9px] uppercase tracking-widest text-slate-400 font-medium">Computer Generated Salary Slip. No Signature Required.</p>
            </div>

            <div className="text-center py-4 border-t border-dashed border-slate-300">
              <p className="text-[10px] text-slate-400">Computer generated slip. No signature required.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ═══════ FORM VIEW ═══════
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">Pay Salary</h1>
        <p className="text-muted-foreground text-sm mt-1">Disburse monthly salary to teachers & staff.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5 border-none shadow-lg h-fit">
          <div className="h-1.5 bg-violet-500"></div>
          <CardHeader>
            <CardTitle className="text-lg">Salary Payment</CardTitle>
            <CardDescription>Ensure staff has an active salary configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Select Staff</Label>
                <Select value={form.staff_id} onValueChange={v => setForm({...form, staff_id: v})}>
                  <SelectTrigger className="bg-card"><SelectValue placeholder="Select staff..." /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {staffList.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {s.designation ? `(${s.designation})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Month</Label>
                  <Select value={form.month} onValueChange={v => setForm({...form, month: v})}>
                    <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                        <SelectItem key={m} value={m.toString()}>{getMonthName(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Year</Label>
                  <Input type="number" value={form.year} onChange={e => setForm({...form, year: e.target.value})} className="bg-card" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Method</Label>
                  <Select value={form.payment_method} onValueChange={v => setForm({...form, payment_method: v})}>
                    <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Note</Label>
                  <Input value={form.note} onChange={e => setForm({...form, note: e.target.value})} placeholder="Optional" className="bg-card" />
                </div>
              </div>
              <Button type="submit" className="w-full shadow-md" disabled={submitting || !salaryConfig}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Pay & Generate Slip
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Salary Preview */}
        <div className="lg:col-span-7">
          <Card className={`border-none shadow-md transition-all duration-300 ${!form.staff_id ? 'opacity-40 grayscale' : ''}`}>
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="w-5 h-5 text-violet-500" /> Salary Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              {!form.staff_id ? (
                <div className="text-center py-12 text-muted-foreground text-sm">Select a staff member to see salary breakdown</div>
              ) : loadingConfig ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : !salaryConfig ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl space-y-2">
                  <User className="w-10 h-10 mx-auto text-muted-foreground/30" />
                  <p className="font-semibold text-red-600">No salary configuration found</p>
                  <p className="text-xs text-muted-foreground">Configure salary for this staff member first</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl border border-violet-100">
                    <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{selectedStaff?.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{selectedStaff?.role} • {getMonthName(parseInt(form.month))} {form.year}</p>
                    </div>
                  </div>

                  <div className="bg-card border rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm border-b pb-2">
                      <span className="text-muted-foreground">Basic Salary</span>
                      <span className="font-mono font-bold">{formatTaka(salaryConfig.basic_salary)}</span>
                    </div>
                    {Object.entries(salaryConfig.allowances || {}).map(([k, v]: [string, any]) => (
                      <div key={k} className="flex justify-between text-sm">
                        <span className="capitalize text-muted-foreground">{k}</span>
                        <span className="font-mono font-bold text-primary">+{formatTaka(Number(v))}</span>
                      </div>
                    ))}
                    {Object.entries(salaryConfig.deductions || {}).map(([k, v]: [string, any]) => (
                      <div key={k} className="flex justify-between text-sm border-t pt-2">
                        <span className="capitalize text-muted-foreground">{k}</span>
                        <span className="font-mono font-bold text-red-500">-{formatTaka(Number(v))}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Gross</span>
                      <span className="font-mono font-semibold">{formatTaka(gross)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Deductions</span>
                      <span className="font-mono font-semibold text-red-500">-{formatTaka(deductions)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-emerald-300">
                      <span className="font-bold text-emerald-800">Net Salary</span>
                      <span className="text-xl font-extrabold font-mono text-primary">{formatTaka(net)}</span>
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
