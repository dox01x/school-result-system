'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Search, Printer, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { formatTaka, getMonthName } from '@/lib/finance-utils';
import { MonthlyReport } from '@/types/finance';

export default function MonthlyReportPage() {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => { loadReport(); }, []);

  const handlePrint = () => {
    if (!report) return;
    const r = report;

    const incomeRows = r.income_breakdown.map(i =>
      `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-transform:capitalize">${i.category.replace('_', ' ')}</td><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-family:monospace;font-weight:600;color:#059669">${i.amount.toLocaleString('en-IN')} TK</td></tr>`
    ).join('');

    const expenseRows = r.expense_breakdown.map(e =>
      `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-transform:capitalize">${e.category.replace('_', ' ')}</td><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-family:monospace;font-weight:600;color:#dc2626">${e.amount.toLocaleString('en-IN')} TK</td></tr>`
    ).join('');

    const totalIncome = r.income_breakdown.reduce((s, i) => s + i.amount, 0);
    const totalExpense = r.expense_breakdown.reduce((s, e) => s + e.amount, 0);

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Report - ${getMonthName(r.month)} ${r.year}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Inter',sans-serif;max-width:700px;margin:0 auto;padding:30px;color:#1e293b}
      h1{text-align:center;font-size:20px;font-weight:800;margin-bottom:4px}
      .subtitle{text-align:center;font-size:14px;color:#64748b;margin-bottom:24px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
      .section h3{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
      .section.income h3{color:#059669}
      .section.expense h3{color:#dc2626}
      table{width:100%;border-collapse:collapse}
      .total-row{font-weight:700;border-top:2px solid #e2e8f0}
      .total-row td{padding-top:8px}
      .summary{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:24px 0}
      .summary-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center}
      .summary-card h4{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:4px}
      .summary-card .val{font-size:18px;font-weight:800;font-family:monospace}
      .net{text-align:center;margin-top:24px;padding-top:16px;border-top:3px solid #0f172a}
      .net h4{font-size:12px;color:#64748b;margin-bottom:4px}
      .net .val{font-size:28px;font-weight:800;font-family:monospace}
      .footer{text-align:center;font-size:9px;color:#94a3b8;margin-top:30px;padding-top:12px;border-top:1px dashed #cbd5e1}
      @media print{body{padding:10px}}
    </style></head><body>
    <h1>MONTHLY FINANCE REPORT</h1>
    <div class="subtitle">${getMonthName(r.month)} ${r.year}</div>
    <div class="grid">
      <div class="section income"><h3>Income Breakdown</h3><table><tbody>${incomeRows}<tr class="total-row"><td>Total Income</td><td style="text-align:right;font-family:monospace;color:#059669">${totalIncome.toLocaleString('en-IN')} TK</td></tr></tbody></table></div>
      <div class="section expense"><h3>Expense Breakdown</h3><table><tbody>${expenseRows}<tr class="total-row"><td>Total Expense</td><td style="text-align:right;font-family:monospace;color:#dc2626">${totalExpense.toLocaleString('en-IN')} TK</td></tr></tbody></table></div>
    </div>
    <div class="summary">
      <div class="summary-card"><h4>Tuition Collected</h4><div class="val" style="color:#059669">${r.tuition_summary.total_collected.toLocaleString('en-IN')} TK</div><div style="font-size:10px;color:#94a3b8;margin-top:4px">Expected: ${r.tuition_summary.total_due.toLocaleString('en-IN')} TK (${r.tuition_summary.collection_rate}%)</div></div>
      <div class="summary-card"><h4>Salary Paid</h4><div class="val">${r.salary_summary.total_paid.toLocaleString('en-IN')} TK</div><div style="font-size:10px;color:#94a3b8;margin-top:4px">${r.salary_summary.total_teachers} teachers + ${r.salary_summary.total_staff} staff</div></div>
    </div>
    <div class="net"><h4>Net Balance</h4><div class="val" style="color:${r.net_balance >= 0 ? '#059669' : '#dc2626'}">${r.net_balance >= 0 ? '+' : ''}${r.net_balance.toLocaleString('en-IN')} TK</div></div>
    <div class="footer"><p>Generated on ${new Date().toLocaleDateString('en-GB')} • Financial Report</p></div>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">Monthly Report</h1>
        <p className="text-muted-foreground text-sm mt-1">Detailed financial breakdown for any month.</p>
      </div>

      {/* Filter */}
      <Card className="border-none shadow-md">
        <CardContent className="p-4 flex flex-col sm:flex-row items-end gap-4">
          <div className="space-y-1 w-full sm:w-48">
            <Label className="text-[10px] text-muted-foreground uppercase">Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <SelectItem key={m} value={m.toString()}>{getMonthName(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-full sm:w-32">
            <Label className="text-[10px] text-muted-foreground uppercase">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={loadReport} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Generate
          </Button>
          <Button onClick={handlePrint} variant="outline" disabled={!report} className="ml-auto">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </CardContent>
      </Card>

      {/* Report */}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : report ? (
        <div className="space-y-6">
          <div className="text-center border-b pb-4">
            <h2 className="text-xl font-extrabold text-slate-800">
              <BarChart3 className="w-5 h-5 inline mr-2 text-primary/80" />
              {getMonthName(report.month)} {report.year}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Income */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> Income Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableBody>
                    {report.income_breakdown.map((inc, i) => (
                      <TableRow key={i}>
                        <TableCell className="capitalize text-sm">{inc.category.replace('_', ' ')}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-primary">{formatTaka(inc.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {report.income_breakdown.length === 0 && (
                      <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground text-sm py-6">No income this month</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Expense */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" /> Expense Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableBody>
                    {report.expense_breakdown.map((exp, i) => (
                      <TableRow key={i}>
                        <TableCell className="capitalize text-sm">{exp.category.replace('_', ' ')}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-red-600">{formatTaka(exp.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {report.expense_breakdown.length === 0 && (
                      <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground text-sm py-6">No expenses this month</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Tuition + Salary Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-none shadow-sm bg-emerald-50/50">
              <CardContent className="pt-5 text-center space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Tuition Fees</p>
                <p className="text-sm">Expected: <strong>{formatTaka(report.tuition_summary.total_due)}</strong></p>
                <p className="text-sm">Collected: <strong className="text-primary">{formatTaka(report.tuition_summary.total_collected)}</strong></p>
                <p className="text-sm">Overdue: <strong className="text-red-600">{formatTaka(report.tuition_summary.total_overdue)}</strong></p>
                <Badge className="bg-emerald-100 text-primary hover:bg-emerald-100">{report.tuition_summary.collection_rate}% collected</Badge>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-violet-50/50">
              <CardContent className="pt-5 text-center space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-violet-600 font-bold">Staff Salaries</p>
                <p className="text-sm">Teachers: <strong>{report.salary_summary.total_teachers}</strong></p>
                <p className="text-sm">Staff: <strong>{report.salary_summary.total_staff}</strong></p>
                <p className="text-lg font-extrabold font-mono mt-1">{formatTaka(report.salary_summary.total_paid)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Net */}
          <div className="text-center pt-6 border-t-4">
            <p className="text-sm text-muted-foreground mb-1">Net Balance</p>
            <p className={`text-4xl font-extrabold font-mono ${report.net_balance >= 0 ? 'text-primary' : 'text-red-600'}`}>
              {report.net_balance >= 0 ? '+' : ''}{formatTaka(report.net_balance)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
