'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTaka, getMonthName } from '@/lib/finance-utils';
import { FinanceSummary } from '@/types/finance';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { 
  Loader2, Receipt, Wallet, TrendingUp, TrendingDown, AlertTriangle, 
  CreditCard, Users, ArrowUpRight, ArrowDownRight, Banknote, FileText, 
  Settings, BarChart3, Clock 
} from 'lucide-react';

export default function FinanceDashboard() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayCollection, setTodayCollection] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const todayStr = currentDate.toISOString().split('T')[0];

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const supabase = createClient() as any;

        // Fetch summary, today's collection, and recent payments in parallel
        const [summaryRes, todayRes, recentRes] = await Promise.all([
          fetch(`/api/finance/summary?month=${currentMonth}&year=${currentYear}`),
          supabase
            .from('tuition_payments')
            .select('amount_paid')
            .gte('payment_date', todayStr + 'T00:00:00')
            .lte('payment_date', todayStr + 'T23:59:59'),
          supabase
            .from('tuition_payments')
            .select('receipt_number, amount_paid, payment_date, class_name, fee_type, student_id, students(name)')
            .order('payment_date', { ascending: false })
            .limit(6)
        ]);

        const summaryData = await summaryRes.json();
        if (summaryData.success) setSummary(summaryData.data);

        if (todayRes.data) {
          setTodayCount(todayRes.data.length);
          setTodayCollection(todayRes.data.reduce((s: number, r: any) => s + Number(r.amount_paid), 0));
        }

        if (recentRes.data) setRecentPayments(recentRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [currentMonth, currentYear, todayStr]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const quickLinks = [
    { href: '/dashboard/finance/tuition/collect', icon: Receipt, label: 'Collect Fees', desc: 'Record student payments', color: 'bg-emerald-500' },
    { href: '/dashboard/finance/fee-structure', icon: Settings, label: 'Fee Structure', desc: 'Configure class-wise fees', color: 'bg-blue-500' },
    { href: '/dashboard/finance/tuition/overdue', icon: AlertTriangle, label: 'Overdue Fees', desc: 'View defaulter list', color: 'bg-amber-500' },
    { href: '/dashboard/finance/income', icon: TrendingUp, label: 'Other Income', desc: 'Donations, grants, rent', color: 'bg-primary' },
    { href: '/dashboard/finance/expense', icon: TrendingDown, label: 'Expenses', desc: 'Bills, purchases, maintenance', color: 'bg-red-500' },
    { href: '/dashboard/finance/salary/pay', icon: Users, label: 'Pay Salary', desc: 'Teachers & staff salary', color: 'bg-violet-500' },
    { href: '/dashboard/finance/report/monthly', icon: BarChart3, label: 'Monthly Report', desc: 'Financial breakdown', color: 'bg-primary/80' },
    { href: '/dashboard/finance/report/yearly', icon: FileText, label: 'Yearly Report', desc: 'Annual overview', color: 'bg-slate-500' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Finance Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview for {getMonthName(currentMonth)} {currentYear}</p>
        </div>
        <Badge variant="outline" className="px-4 py-2 text-sm font-semibold">
          <Clock className="w-3.5 h-3.5 mr-1.5" /> {currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Today's Collection */}
        <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white relative overflow-hidden">
          <div className="absolute top-2 right-2 opacity-20"><Banknote className="w-16 h-16" /></div>
          <CardContent className="pt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">Today's Collection</p>
            <p className="text-2xl font-extrabold mt-1 font-mono">{formatTaka(todayCollection)}</p>
            <p className="text-[11px] text-emerald-200 mt-1">{todayCount} payment(s) today</p>
          </CardContent>
        </Card>

        {/* Monthly Income */}
        <Card className="border-none shadow-md bg-card relative overflow-hidden group hover:shadow-lg transition-shadow">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400"></div>
          <CardContent className="pt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-primary" /> Monthly Income
            </p>
            <p className="text-xl font-extrabold mt-1 font-mono text-primary">{formatTaka(summary?.total_income || 0)}</p>
          </CardContent>
        </Card>

        {/* Monthly Expense */}
        <Card className="border-none shadow-md bg-card relative overflow-hidden group hover:shadow-lg transition-shadow">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-400"></div>
          <CardContent className="pt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3 text-red-500" /> Monthly Expense
            </p>
            <p className="text-xl font-extrabold mt-1 font-mono text-red-600">{formatTaka(summary?.total_expense || 0)}</p>
          </CardContent>
        </Card>

        {/* Net Balance */}
        <Card className="border-none shadow-md bg-card relative overflow-hidden group hover:shadow-lg transition-shadow">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-400"></div>
          <CardContent className="pt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Wallet className="w-3 h-3 text-blue-500" /> Net Balance
            </p>
            <p className={`text-xl font-extrabold mt-1 font-mono ${(summary?.net_balance || 0) >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
              {formatTaka(summary?.net_balance || 0)}
            </p>
          </CardContent>
        </Card>

        {/* Tuition Due */}
        <Card className="border-none shadow-md bg-card relative overflow-hidden group hover:shadow-lg transition-shadow">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
          <CardContent className="pt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" /> Tuition Due
            </p>
            <p className="text-xl font-extrabold mt-1 font-mono text-amber-700">{formatTaka(summary?.tuition_due || 0)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Collected: {formatTaka(summary?.tuition_collected || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions + Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-8">
          <h2 className="text-sm font-bold uppercase text-muted-foreground tracking-wider mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickLinks.map(link => (
              <Link key={link.href} href={link.href} className="group p-4 bg-card border rounded-xl hover:shadow-lg transition-all hover:border-primary/30">
                <div className={`w-9 h-9 ${link.color} rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <link.icon className="w-4.5 h-4.5 text-white" />
                </div>
                <h3 className="font-bold text-sm text-slate-800">{link.label}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="lg:col-span-4">
          <h2 className="text-sm font-bold uppercase text-muted-foreground tracking-wider mb-3">Recent Payments</h2>
          <Card className="border-none shadow-md">
            <CardContent className="pt-4 space-y-2">
              {recentPayments.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">No payments recorded yet</p>
              ) : (
                recentPayments.map((p, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{p.students?.name || 'Student'}</p>
                      <p className="text-[10px] text-muted-foreground">{p.class_name} • {p.receipt_number}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(p.payment_date).toLocaleDateString('en-GB')}</p>
                    </div>
                    <span className="font-mono font-bold text-primary text-sm">+{formatTaka(p.amount_paid)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
