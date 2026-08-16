'use client';

import { useEffect, useState } from 'react';
import { printHtml } from '@/lib/print-utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 as SpinnerGap, Search as MagnifyingGlass, Printer, TrendingUp as TrendUp, TrendingDown as TrendDown, BarChart2 as ChartBar } from "lucide-react";
import { formatTaka, getMonthName } from '@/lib/finance-utils';
import { generateMonthlyReportHtml } from '@/lib/finance-receipt-template';
import { MonthlyReport } from '@/types/finance';
import { createClient } from '@/lib/supabase/client';

export default function MonthlyReportPage() {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<{name: string, address: string, phone: string, logo_url?: string} | null>(null);

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
      const { data } = await supabase.from('school_info').select('name, address, phone, logo_url').limit(1).single();
      if (data) setSchoolInfo(data);
    };
    fetchSchoolInfo();
  }, []);

  const handlePrint = () => {
    if (!report) return;
    const html = generateMonthlyReportHtml(report, {
      school: schoolInfo || undefined
    });
    printHtml(html);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground  mb-1">Monthly Report</h1>
        <p className="text-muted-foreground text-sm mt-1">Detailed financial breakdown for any month.</p>
      </div>

      {/* Funnels */}
      <Card className="bg-card rounded-2xl border border-border shadow-none">
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-end gap-4">
          <div className="space-y-1 w-full md:w-48">
            <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest px-1">Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border rounded-xl shadow-md">
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <SelectItem key={m} value={m.toString()} className="rounded-lg font-medium">{getMonthName(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-full md:w-32">
            <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest px-1">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus:ring-1 focus:ring-ring/30 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border rounded-xl shadow-md">
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={y.toString()} className="rounded-lg font-medium">{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={loadReport} disabled={loading} className="w-full md:w-auto h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-none px-6">
            {loading ? <SpinnerGap size={16} strokeWidth={2} className="mr-2 animate-spin" /> : <MagnifyingGlass size={16} strokeWidth={2} className="mr-2" />}
            Generate
          </Button>
          <Button onClick={handlePrint} variant="outline" disabled={!report} className="w-full md:w-auto md:ml-auto h-11 rounded-xl border-border bg-white hover:bg-muted/50 text-muted-foreground font-bold shadow-none px-6">
            <Printer size={16} strokeWidth={2} className="mr-2" /> Print
          </Button>
        </CardContent>
      </Card>

      {/* Report */}
      {loading ? (
        <div className="flex justify-center p-12"><SpinnerGap size={32} strokeWidth={1.5} className="animate-spin text-muted-foreground/40" /></div>
      ) : report ? (
        <div className="space-y-6">
          <div className="text-center border-b border-border pb-4">
            <h2 className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
              <ChartBar size={20} strokeWidth={2} className="text-muted-foreground" />
              {getMonthName(report.month)} {report.year}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Income */}
            <Card className="bg-card rounded-2xl border border-border shadow-none">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <TrendUp size={16} strokeWidth={2} className="text-foreground" /> Income Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableBody>
                    {report.income_breakdown.map((inc, i) => (
                      <TableRow key={i} className="border-border">
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
            <Card className="bg-card rounded-2xl border border-border shadow-none">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <TrendDown size={16} strokeWidth={2} className="text-red-600" /> Expense Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableBody>
                    {report.expense_breakdown.map((exp, i) => (
                      <TableRow key={i} className="border-border">
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
            <Card className="shadow-none rounded-2xl border border-border bg-muted/50">
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
            <Card className="shadow-none rounded-2xl border border-border bg-muted/50">
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
          <div className="text-center pt-6 border-t-2 border-border">
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
