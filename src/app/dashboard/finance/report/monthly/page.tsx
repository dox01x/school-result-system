'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 as SpinnerGap, Search as MagnifyingGlass, Printer, TrendingUp as TrendUp, TrendingDown as TrendDown, BarChart2 as ChartBar } from "lucide-react";
import { formatTaka, getMonthName } from '@/lib/finance-utils';
import { MonthlyReport } from '@/types/finance';
import { createClient } from '@/lib/supabase/client';

export default function MonthlyReportPage() {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<{name: string, address: string, phone: string} | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [month, setMonth] = useState(currentMonth.toString());
  const [year, setYear] = useState(currentYear.toString());

  const loadReport = async () => {
    if (!month || !year) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/report/monthly?month=${month}&year=${year}`);
      const data = await res.json();
      if (data.success) setReport(data.data);
      else toast.error(data.error || "Failed to fetch report");
    } catch {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    loadReport();
    const fetchSchoolInfo = async () => {
      const supabase = createClient();
      const { data } = await supabase.from('school_info').select('name, address, phone').limit(1).single();
      if (data) setSchoolInfo(data);
    };
    fetchSchoolInfo();
  }, []);

  const handlePrint = () => {
    if (!report) return;
    const r = report;

    const incomeRows = r.income_breakdown.map(i =>
      `<tr><td class="col-label">${i.category.replace('_', ' ')}</td><td class="col-amount">${i.amount.toLocaleString('en-IN')} TK</td></tr>`
    ).join('');

    const expenseRows = r.expense_breakdown.map(e =>
      `<tr><td class="col-label">${e.category.replace('_', ' ')}</td><td class="col-amount">${e.amount.toLocaleString('en-IN')} TK</td></tr>`
    ).join('');

    const totalIncome = r.income_breakdown.reduce((s, i) => s + i.amount, 0);
    const totalExpense = r.expense_breakdown.reduce((s, e) => s + e.amount, 0);

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Report - ${getMonthName(r.month)} ${r.year}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Inter', sans-serif; max-width:800px; margin:0 auto; padding:40px; color:#000; background:#fff; }
      .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #e5e5e5; }
      .header-title h1 { font-size: 28px; font-weight: 900; letter-spacing: -1px; line-height: 1; text-transform: uppercase; }
      .header-title p { font-size: 12px; font-weight: 600; color: #666; letter-spacing: 2px; text-transform: uppercase; margin-top: 6px; }
      .header-date { text-align: right; }
      .header-date .month { font-size: 24px; font-weight: 800; }
      .header-date .year { font-size: 12px; font-weight: 600; color: #666; letter-spacing: 2px; text-transform: uppercase; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 40px; }
      .grid > div:first-child { border-right: 1px solid #e5e5e5; padding-right: 40px; }
      .grid > div:last-child { padding-left: 40px; }
      .section h3 { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; color: #000; padding-bottom: 0; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 12px 0; border-bottom: none; font-size: 13px; }
      .col-label { font-weight: 600; text-transform: capitalize; color: #333; }
      .col-amount { text-align: right; font-family: monospace; font-weight: 600; font-size: 14px; }
      .total-row td { border-top: none; padding-top: 24px; font-weight: 800; color: #000; font-size: 14px; }
      .total-row .col-amount { font-size: 16px; }
      .summary { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 40px; }
      .summary > div:first-child { border-right: 1px solid #e5e5e5; padding-right: 40px; }
      .summary > div:last-child { padding-left: 40px; }
      .summary-card { padding: 20px; background: #fafafa; border-radius: 12px; }
      .summary-card h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #666; margin-bottom: 8px; }
      .summary-card .val { font-size: 24px; font-weight: 900; font-family: monospace; color: #000; letter-spacing: -0.5px; }
      .summary-card .desc { font-size: 11px; color: #666; margin-top: 6px; font-weight: 600; }
      .net-card { background: transparent; color: #000; padding: 30px 0; margin-top: 20px; text-align: center; }
      .net-card h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 3px; color: #666; margin-bottom: 12px; }
      .net-card .val { font-size: 48px; font-weight: 900; font-family: monospace; letter-spacing: -2px; }
      .footer { text-align: center; font-size: 10px; color: #999; margin-top: 40px; padding-top: 20px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
      .school-info { text-align: center; margin-bottom: 40px; }
      .school-info h2 { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
      .school-info p { font-size: 12px; color: #666; margin-top: 4px; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    <div class="school-info">
      <h2>${schoolInfo?.name || 'School Name'}</h2>
      <p>${schoolInfo?.address || ''} ${schoolInfo?.phone ? '• ' + schoolInfo.phone : ''}</p>
    </div>
    <div class="header">
      <div class="header-title"><h1>Finance Report</h1><p>Monthly Statement</p></div>
      <div class="header-date"><div class="month">${getMonthName(r.month)}</div><div class="year">${r.year}</div></div>
    </div>
    <div class="grid">
      <div class="section"><h3>Income Breakdown</h3><table><tbody>${incomeRows}<tr class="total-row"><td class="col-label">Total Income</td><td class="col-amount">${totalIncome.toLocaleString('en-IN')} TK</td></tr></tbody></table></div>
      <div class="section"><h3>Expense Breakdown</h3><table><tbody>${expenseRows}<tr class="total-row"><td class="col-label">Total Expense</td><td class="col-amount">${totalExpense.toLocaleString('en-IN')} TK</td></tr></tbody></table></div>
    </div>
    <div class="summary">
      <div class="summary-card"><h4>Tuition Collected</h4><div class="val">${r.tuition_summary.total_collected.toLocaleString('en-IN')} TK</div><div class="desc">Expected: ${r.tuition_summary.total_due.toLocaleString('en-IN')} TK &bull; ${r.tuition_summary.collection_rate}% Collected</div></div>
      <div class="summary-card"><h4>Salary Paid</h4><div class="val">${r.salary_summary.total_paid.toLocaleString('en-IN')} TK</div><div class="desc">${r.salary_summary.total_teachers} Teachers &bull; ${r.salary_summary.total_staff} Staff</div></div>
    </div>
    <div class="net-card"><h4>Net Balance</h4><div class="val">${r.net_balance >= 0 ? '+' : ''}${r.net_balance.toLocaleString('en-IN')} TK</div></div>
    <div class="footer"><p>Generated on ${new Date().toLocaleDateString('en-GB')} &bull; School Management System</p></div>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading mb-1">Monthly Report</h1>
        <p className="text-muted-foreground text-sm mt-1">Detailed financial breakdown for any month.</p>
      </div>

      {/* Funnels */}
      <Card className="bg-card rounded-2xl border border-border/50 shadow-none">
        <CardContent className="p-4 flex flex-col sm:flex-row items-end gap-4">
          <div className="space-y-1 w-full sm:w-48">
            <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest px-1">Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border/50 rounded-xl shadow-md">
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <SelectItem key={m} value={m.toString()} className="rounded-lg font-medium">{getMonthName(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-full sm:w-32">
            <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest px-1">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border/50 rounded-xl shadow-md">
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={y.toString()} className="rounded-lg font-medium">{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={loadReport} disabled={loading} className="h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-none px-6">
            {loading ? <SpinnerGap size={16} strokeWidth={2} className="mr-2 animate-spin" /> : <MagnifyingGlass size={16} strokeWidth={2} className="mr-2" />}
            Generate
          </Button>
          <Button onClick={handlePrint} variant="outline" disabled={!report} className="ml-auto h-11 rounded-xl border-border/50 bg-white hover:bg-muted/50 text-muted-foreground font-bold shadow-none px-6">
            <Printer size={16} strokeWidth={2} className="mr-2" /> Print
          </Button>
        </CardContent>
      </Card>

      {/* Report */}
      {loading ? (
        <div className="flex justify-center p-12"><SpinnerGap size={32} strokeWidth={1.5} className="animate-spin text-muted-foreground/40" /></div>
      ) : report ? (
        <div className="space-y-6">
          <div className="text-center border-b border-border/50 pb-4">
            <h2 className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
              <ChartBar size={20} strokeWidth={2} className="text-muted-foreground" />
              {getMonthName(report.month)} {report.year}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Income */}
            <Card className="bg-card rounded-2xl border border-border/50 shadow-none">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <TrendUp size={16} strokeWidth={2} className="text-foreground" /> Income Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableBody>
                    {report.income_breakdown.map((inc, i) => (
                      <TableRow key={i} className="border-border/50">
                        <TableCell className="capitalize text-[11px] font-bold text-muted-foreground">{inc.category.replace('_', ' ')}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">{formatTaka(inc.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {report.income_breakdown.length === 0 && (
                      <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground/60 text-[11px] font-bold py-6">No income this month</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Expense */}
            <Card className="bg-card rounded-2xl border border-border/50 shadow-none">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <TrendDown size={16} strokeWidth={2} className="text-red-600" /> Expense Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableBody>
                    {report.expense_breakdown.map((exp, i) => (
                      <TableRow key={i} className="border-border/50">
                        <TableCell className="capitalize text-[11px] font-bold text-muted-foreground">{exp.category.replace('_', ' ')}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-red-600">{formatTaka(exp.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {report.expense_breakdown.length === 0 && (
                      <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground/60 text-[11px] font-bold py-6">No expenses this month</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Tuition + Salary Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-none rounded-2xl border border-border/50 bg-muted/50">
              <CardContent className="p-6 text-center space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Tuition Fees</p>
                <div className="flex flex-col items-center gap-1">
                    <p className="text-[11px] font-bold text-muted-foreground">Expected: <span className="font-mono text-foreground">{formatTaka(report.tuition_summary.total_due)}</span></p>
                    <p className="text-[11px] font-bold text-muted-foreground">Collected: <span className="font-mono text-foreground">{formatTaka(report.tuition_summary.total_collected)}</span></p>
                    <p className="text-[11px] font-bold text-muted-foreground">Overdue: <span className="font-mono text-red-600">{formatTaka(report.tuition_summary.total_overdue)}</span></p>
                </div>
                <Badge className="bg-muted hover:bg-muted/80 text-foreground border-0 rounded-md px-2 py-0.5 font-bold text-[10px] uppercase tracking-widest">{report.tuition_summary.collection_rate}% collected</Badge>
              </CardContent>
            </Card>
            <Card className="shadow-none rounded-2xl border border-border/50 bg-muted/50">
              <CardContent className="p-6 text-center space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Staff Salaries</p>
                <div className="flex flex-col items-center gap-1">
                    <p className="text-[11px] font-bold text-muted-foreground">Teachers: <span className="text-foreground">{report.salary_summary.total_teachers}</span></p>
                    <p className="text-[11px] font-bold text-muted-foreground">Staff: <span className="text-foreground">{report.salary_summary.total_staff}</span></p>
                </div>
                <p className="text-xl font-black font-mono text-foreground mt-2">{formatTaka(report.salary_summary.total_paid)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Net */}
          <div className="text-center pt-6 border-t-2 border-border/50">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Net Balance</p>
            <p className={`text-5xl font-black font-mono tracking-tight ${report.net_balance >= 0 ? 'text-foreground' : 'text-red-600'}`}>
              {report.net_balance >= 0 ? '+' : ''}{formatTaka(report.net_balance)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
