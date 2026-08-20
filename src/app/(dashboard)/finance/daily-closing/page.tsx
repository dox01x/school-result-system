'use client';

import { useState, useEffect } from 'react';
import { printHtml } from '@/lib/print-utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatTaka, formatCurrency } from '@/lib/finance-utils';
import { generateDailyClosingHtml } from '@/lib/finance-receipt-template';
import { Loader2 as SpinnerGap, Search as MagnifyingGlass, Printer, Banknote as Money, CreditCard, Smartphone as DeviceMobile, Receipt, TrendingDown as TrendDown, Users, CalendarDays as CalendarBlank } from "lucide-react";
import { createClient } from '@/lib/supabase/client';

export default function DailyClosingPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [schoolInfo, setSchoolInfo] = useState<{name: string, address: string, phone: string, logo_url?: string} | null>(null);

  useEffect(() => {
    const fetchSchoolInfo = async () => {
      const supabase = createClient();
      const { data } = await supabase.from('school_info').select('name, address, phone, logo_url').limit(1).single();
      if (data) setSchoolInfo(data);
    };
    fetchSchoolInfo();
  }, []);

  const loadData = async () => {
    if (!date) { toast.error("Select a date"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/daily-closing?date=${date}`);
      const result = await res.json();
      if (result.success) setData(result.data);
      else toast.error(result.error || "Failed to load data");
    } catch {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!data) return;
    const html = generateDailyClosingHtml(data, {
      school: schoolInfo || undefined
    });
    printHtml(html);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground  mb-1">Daily Cash Closing</h1>
        <p className="text-muted-foreground text-sm mt-1">End-of-day reconciliation — match software records with cash box.</p>
      </div>

      {/* Date Picker */}
      <Card className="bg-card rounded-2xl border border-border shadow-none">
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-end gap-4">
          <div className="space-y-1.5 w-full md:max-w-xs">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Select Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-11 rounded-xl bg-muted border-0 font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none" />
          </div>
          <Button onClick={loadData} disabled={loading} className="w-full md:w-auto h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-none px-6">
            {loading ? <SpinnerGap size={16} strokeWidth={2} className="mr-2 animate-spin" /> : <MagnifyingGlass size={16} strokeWidth={2.5} className="mr-2" />}
            Load
          </Button>
          {data && (
            <Button onClick={handlePrint} variant="outline" className="w-full md:w-auto md:ml-auto h-11 rounded-xl border-border bg-background hover:bg-muted text-foreground font-bold shadow-none px-6">
              <Printer size={16} strokeWidth={2} className="mr-2" /> Print Report
            </Button>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center py-12"><SpinnerGap size={32} strokeWidth={1.5} className="animate-spin text-muted-foreground/40" /></div>
      )}

      {!loading && data && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Date Header */}
          <div className="text-center">
            <Badge variant="outline" className="px-4 py-2 text-sm font-bold border-border text-muted-foreground shadow-none">
              <CalendarBlank size={16} strokeWidth={2} className="mr-1.5 text-muted-foreground/60" />
              {new Date(data.date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </Badge>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card rounded-xl p-6 border border-border shadow-none">
              <CardContent className="p-0">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <Receipt className="h-6 w-6 text-foreground" strokeWidth={1.2} />
                  </div>
                </div>
                <div className="text-3xl font-black tracking-tighter text-foreground tabular-nums">{formatCurrency(data.tuition_collected)}</div>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">Total Collection</p>
                <p className="text-xs text-muted-foreground mt-1">{data.tuition_count} receipt(s) today</p>
              </CardContent>
            </Card>

            <Card className="bg-card rounded-xl p-6 border border-border shadow-none">
              <CardContent className="p-0">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <TrendDown className="h-6 w-6 text-red-600" strokeWidth={1.2} />
                  </div>
                </div>
                <div className="text-3xl font-black tracking-tighter text-red-600 tabular-nums">{formatCurrency(data.total_expense)}</div>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">Total Expense</p>
              </CardContent>
            </Card>

            <Card className="bg-card rounded-xl p-6 border border-border shadow-none">
              <CardContent className="p-0">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <Users className="h-6 w-6 text-foreground" strokeWidth={1.2} />
                  </div>
                </div>
                <div className="text-3xl font-black tracking-tighter text-foreground tabular-nums">{formatCurrency(data.salary_paid)}</div>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">Salary Paid</p>
              </CardContent>
            </Card>

            <Card className="bg-card rounded-xl p-6 border border-border shadow-none">
              <CardContent className="p-0">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <Money className="h-6 w-6 text-foreground" strokeWidth={1.2} />
                  </div>
                </div>
                <div className={`text-3xl font-black tracking-tighter tabular-nums ${data.net_cash_in_hand >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                  {formatCurrency(data.net_cash_in_hand)}
                </div>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">Net Cash In Hand</p>
                <p className="text-xs text-muted-foreground mt-1">Cash payments only</p>
              </CardContent>
            </Card>
          </div>

          {/* Method Breakdown */}
          <Card className="bg-card rounded-2xl border border-border shadow-none">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Collection by Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Money size={20} strokeWidth={2} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Cash</p>
                    <p className="font-mono font-black text-foreground">{formatTaka(data.method_breakdown?.cash?.income || 0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <CreditCard size={20} strokeWidth={2} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Bank</p>
                    <p className="font-mono font-black text-foreground">{formatTaka(data.method_breakdown?.bank?.income || 0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <DeviceMobile size={20} strokeWidth={2} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Mobile</p>
                    <p className="font-mono font-black text-foreground">{formatTaka(data.method_breakdown?.mobile_banking?.income || 0)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tuition Payments List */}
          {data.tuition_payments?.length > 0 && (
            <Card className="bg-card rounded-2xl border border-border shadow-none overflow-hidden">
              <CardHeader className="pb-3 border-b border-border bg-muted/50">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Receipt size={16} strokeWidth={2} className="text-foreground" /> Fee Collections ({data.tuition_payments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-border">
                      <TableHead className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground w-10">#</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Student</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Class</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Receipt</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Method</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tuition_payments.map((p: any, i: number) => (
                      <TableRow key={i} className="border-border">
                        <TableCell className="text-[11px] font-bold text-muted-foreground/60">{i + 1}</TableCell>
                        <TableCell className="text-[11px] font-bold text-foreground">{p.student}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px] font-bold border-border text-muted-foreground uppercase tracking-widest shadow-none px-1.5 py-0">{p.class}</Badge></TableCell>
                        <TableCell className="font-mono text-[11px] font-medium text-muted-foreground">{p.receipt}</TableCell>
                        <TableCell>
                          <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest">{(p.method || 'cash').replace('_', ' ')}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">+{formatTaka(Number(p.amount))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Expenses List */}
          {data.expenses?.length > 0 && (
            <Card className="bg-card rounded-2xl border border-border shadow-none overflow-hidden">
              <CardHeader className="pb-3 border-b border-border bg-muted/50">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <TrendDown size={16} strokeWidth={2} className="text-red-600" /> Expenses ({data.expenses.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-border">
                      <TableHead className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground w-10">#</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Category</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Description</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.expenses.map((e: any, i: number) => (
                      <TableRow key={i} className="border-border">
                        <TableCell className="text-[11px] font-bold text-muted-foreground/60">{i + 1}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px] font-bold border-border text-muted-foreground uppercase tracking-widest shadow-none px-1.5 py-0">{e.category.replace('_', ' ')}</Badge></TableCell>
                        <TableCell className="text-[11px] font-bold text-muted-foreground">{e.description}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-red-600">-{formatTaka(Number(e.amount))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Salary Payments */}
          {data.salary_payments?.length > 0 && (
            <Card className="bg-card rounded-2xl border border-border shadow-none overflow-hidden">
              <CardHeader className="pb-3 border-b border-border bg-muted/50">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Users size={16} strokeWidth={2} className="text-foreground" /> Salary Payments ({data.salary_payments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-border">
                      <TableHead className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground w-10">#</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Staff</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Slip</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.salary_payments.map((s: any, i: number) => (
                      <TableRow key={i} className="border-border">
                        <TableCell className="text-[11px] font-bold text-muted-foreground/60">{i + 1}</TableCell>
                        <TableCell className="text-[11px] font-bold text-foreground">{s.staff}</TableCell>
                        <TableCell className="font-mono text-[11px] font-medium text-muted-foreground">{s.slip}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">{formatTaka(Number(s.amount))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {data.tuition_count === 0 && data.expenses?.length === 0 && data.salary_payments?.length === 0 && (
            <div className="text-center py-16 text-muted-foreground bg-muted/50 rounded-2xl border border-border">
              <CalendarBlank size={48} strokeWidth={1.5} className="mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-bold text-foreground">No transactions found</p>
              <p className="text-[11px] font-bold mt-1 uppercase tracking-widest text-muted-foreground/60">No financial activity recorded for this date.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
