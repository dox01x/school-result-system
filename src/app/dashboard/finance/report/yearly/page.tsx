'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Search, Download } from 'lucide-react';
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
        <h1 className="text-2xl font-semibold tracking-tight">Yearly Financial Report</h1>
        <p className="text-muted-foreground mt-1">Annual overview of the school's financial performance.</p>
      </div>

      {/* Filter */}
      <Card className="print:hidden border-dashed">
        <CardContent className="p-4 flex flex-col sm:flex-row items-end gap-4">
          <div className="space-y-2 w-full sm:w-1/4">
            <Label>Academic Year</Label>
            <Input type="number" value={form.year} onChange={e => setForm({...form, year: e.target.value})} />
          </div>
          <Button onClick={loadReport} disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Generate Report
          </Button>
          <Button onClick={() => window.print()} variant="outline" className="w-full sm:w-auto ml-auto" disabled={!report}>
            <Download className="w-4 h-4 mr-2" /> Print
          </Button>
        </CardContent>
      </Card>

      {/* Report View */}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : report ? (
        <div className="print:block bg-card text-black space-y-6 pt-4 rounded-xl print:rounded-none">
          <div className="text-center border-b pb-4 mb-6">
            <h2 className="text-2xl font-bold">ANNUAL FINANCE REPORT</h2>
            <p className="text-muted-foreground text-lg">Year: {report.year}</p>
          </div>

          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
             <div className="bg-muted/50 p-4 rounded-lg text-center">
                 <p className="text-sm text-muted-foreground">Starting Bal.</p>
                 <p className="text-lg font-semibold">{formatTaka(report.start_balance)}</p>
             </div>
             <div className="bg-green-50 p-4 rounded-lg text-center">
                 <p className="text-sm text-green-700 font-medium">Total Income</p>
                 <p className="text-lg font-bold text-green-800">{formatTaka(report.total_income)}</p>
             </div>
             <div className="bg-red-50 p-4 rounded-lg text-center">
                 <p className="text-sm text-red-700 font-medium">Total Expense</p>
                 <p className="text-lg font-bold text-red-800">{formatTaka(report.total_expense)}</p>
             </div>
             <div className={`p-4 rounded-lg text-center ${report.net_balance >= 0 ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                 <p className="text-sm font-medium">Net Profit / Loss</p>
                 <p className={`text-lg font-extrabold ${report.net_balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {report.net_balance >= 0 ? '+' : ''}{formatTaka(report.net_balance)}
                 </p>
             </div>
          </div>

          {/* Month by Month Breakdown */}
          <div className="space-y-4">
              <h3 className="text-xl font-semibold border-b pb-2">Monthly Breakdown</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>Month</TableHead>
                     <TableHead className="text-right text-green-700">Income</TableHead>
                     <TableHead className="text-right text-red-700">Expense</TableHead>
                     <TableHead className="text-right font-bold">Net Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.monthly_summary.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-muted-foreground">{getMonthName(m.month)}</TableCell>
                      <TableCell className="text-right text-green-700 font-medium">+{formatTaka(m.income)}</TableCell>
                      <TableCell className="text-right text-red-700 font-medium">-{formatTaka(m.expense)}</TableCell>
                      <TableCell className={`text-right font-bold ${m.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                         {m.balance >= 0 ? '+' : ''}{formatTaka(m.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30">
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold text-green-700">{formatTaka(report.total_income)}</TableCell>
                      <TableCell className="text-right font-bold text-red-700">{formatTaka(report.total_expense)}</TableCell>
                      <TableCell className={`text-right font-bold text-lg ${report.net_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
