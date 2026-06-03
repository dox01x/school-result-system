'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2 as SpinnerGap, Search as MagnifyingGlass, Printer as DownloadSimple } from "lucide-react";
import { formatTaka, getMonthName } from '@/lib/finance-utils';
import { YearlyReport } from '@/types/finance';

export default function YearlyReportPage() {
  const [report, setReport] = useState<YearlyReport | null>(null);
  const [loading, setLoading] = useState(false);

  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState({
    year: currentYear.toString(),
  });

  const loadReport = async () => {
    if (!form.year) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/report/yearly?year=${form.year}`);
      const data = await res.json();
      
      if (data.success) {
        setReport(data.data);
      } else {
        toast.error(data.error || "Failed to fetch report");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading mb-1">Yearly Financial Report</h1>
        <p className="text-muted-foreground mt-1">Annual overview of the school's financial performance.</p>
      </div>

      {/* Funnels */}
      <Card className="print:hidden border border-border/50 rounded-2xl shadow-none">
        <CardContent className="p-4 flex flex-col sm:flex-row items-end gap-4">
          <div className="space-y-1 w-full sm:w-1/4">
            <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest px-1">Active Academic Year</Label>
            <Input type="number" value={form.year} onChange={e => setForm({...form, year: e.target.value})} className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" />
          </div>
          <Button onClick={loadReport} disabled={loading} className="w-full sm:w-auto h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-none px-6">
            {loading ? <SpinnerGap size={16} strokeWidth={2} className="mr-2 animate-spin" /> : <MagnifyingGlass size={16} strokeWidth={2} className="mr-2" />}
            Generate Report
          </Button>
          <Button onClick={() => window.print()} variant="outline" className="w-full sm:w-auto ml-auto h-11 rounded-xl border-border/50 bg-white hover:bg-muted/50 text-muted-foreground font-bold shadow-none px-6" disabled={!report}>
            <DownloadSimple size={16} strokeWidth={2} className="mr-2" /> Print
          </Button>
        </CardContent>
      </Card>

      {/* Report View */}
      {loading ? (
        <div className="flex justify-center p-12"><SpinnerGap size={32} strokeWidth={1.5} className="animate-spin text-muted-foreground/40" /></div>
      ) : report ? (
        <div className="print:block bg-card text-black space-y-6 pt-4 rounded-xl print:rounded-none">
          <div className="text-center border-b border-border/50 pb-4 mb-6">
            <h2 className="text-xl font-bold text-foreground tracking-wider">ANNUAL FINANCE REPORT</h2>
            <p className="text-muted-foreground font-bold mt-1 text-sm">Year: {report.year}</p>
          </div>

          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
             <div className="bg-muted/50 border border-border/50 p-5 rounded-2xl text-center flex flex-col justify-center items-center shadow-none">
                 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Starting Bal.</p>
                 <p className="text-xl font-black font-mono text-foreground">{formatTaka(report.start_balance)}</p>
             </div>
             <div className="bg-muted/50 border border-border/50 p-5 rounded-2xl text-center flex flex-col justify-center items-center shadow-none">
                 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Total Income</p>
                 <p className="text-xl font-black font-mono text-foreground">{formatTaka(report.total_income)}</p>
             </div>
             <div className="bg-muted/50 border border-border/50 p-5 rounded-2xl text-center flex flex-col justify-center items-center shadow-none">
                 <p className="text-[10px] uppercase tracking-widest text-red-600 font-bold mb-1">Total Expense</p>
                 <p className="text-xl font-black font-mono text-red-600">{formatTaka(report.total_expense)}</p>
             </div>
             <div className="bg-muted/50 border border-border/50 p-5 rounded-2xl text-center flex flex-col justify-center items-center shadow-none">
                 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Net Profit / Loss</p>
                 <p className={`text-xl font-black font-mono ${report.net_balance >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                    {report.net_balance >= 0 ? '+' : ''}{formatTaka(report.net_balance)}
                 </p>
             </div>
          </div>

          {/* Month by Month Breakdown */}
          <div className="space-y-4">
              <h3 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2">Monthly Breakdown</h3>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                     <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold py-3">Month</TableHead>
                     <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold py-3 text-right">Income</TableHead>
                     <TableHead className="text-[10px] uppercase tracking-widest text-red-600 font-bold py-3 text-right">Expense</TableHead>
                     <TableHead className="text-[10px] uppercase tracking-widest text-foreground font-bold py-3 text-right">Net Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.monthly_summary.map((m, i) => (
                    <TableRow key={i} className="border-border/50">
                      <TableCell className="font-bold text-[11px] text-muted-foreground">{getMonthName(m.month)}</TableCell>
                      <TableCell className="text-right text-foreground font-mono font-bold">+{formatTaka(m.income)}</TableCell>
                      <TableCell className="text-right text-red-600 font-mono font-bold">-{formatTaka(m.expense)}</TableCell>
                      <TableCell className={`text-right font-mono font-bold ${m.balance >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                         {m.balance >= 0 ? '+' : ''}{formatTaka(m.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-border/50">
                      <TableCell className="font-bold text-[11px] text-foreground uppercase tracking-widest">Total</TableCell>
                      <TableCell className="text-right font-black font-mono text-foreground">{formatTaka(report.total_income)}</TableCell>
                      <TableCell className="text-right font-black font-mono text-red-600">{formatTaka(report.total_expense)}</TableCell>
                      <TableCell className={`text-right font-black font-mono text-lg tracking-tight ${report.net_balance >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                         {formatTaka(report.net_balance)}
                      </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
          </div>
          
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body * { visibility: hidden; }
              .print\\:block, .print\\:block * { visibility: visible; }
              .print\\:block { position: absolute; left: 0; top: 0; background: white; margin: 0; padding: 20px; width: 100%; box-shadow: none; border: none; }
            }
          `}} />
        </div>
      ) : null}
    </div>
  );
}
