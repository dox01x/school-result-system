'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTaka, formatCurrency, getMonthName } from '@/lib/finance-utils';
import { FinanceSummary } from '@/types/finance';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import {
  Receipt, Wallet, TrendingUp as TrendUp, TrendingDown as TrendDown, AlertCircle as Warning,
  CreditCard, Users, Banknote as Money,
  Settings as Gear, BarChart as ChartBar, Clock, ArrowUpRight
} from 'lucide-react';

export default function FinanceDashboard() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayCollection, setTodayCollection] = useState(0);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const todayStr = currentDate.toISOString().split('T')[0];

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const supabase = createClient();

        const [summaryRes, todayRes, recentRes] = await Promise.all([
          fetch(`/api/finance/summary?month=${currentMonth}&year=${currentYear}`),
          supabase
            .from('tuition_payments')
            .select('amount_paid')
            .neq('status', 'void')
            .gte('payment_date', todayStr + 'T00:00:00')
            .lte('payment_date', todayStr + 'T23:59:59'),
          supabase
            .from('tuition_payments')
            .select('receipt_number, amount_paid, payment_date, class_name, fee_type, student_id, students(name)')
            .neq('status', 'void')
            .order('payment_date', { ascending: false })
            .limit(6)
        ]);

        const summaryData = await summaryRes.json();
        if (summaryData.success) setSummary(summaryData.data);

        if (todayRes.data) {
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

  const quickLinks = [
    { href: '/finance/tuition/collect', icon: Receipt, label: 'Collect Fees', desc: 'Student payments' },
    { href: '/finance/fee-structure', icon: Gear, label: 'Fee Structure', desc: 'Grade fee rates' },
    { href: '/finance/tuition/overdue', icon: Warning, label: 'Overdue Fees', desc: 'Defaulter list' },
    { href: '/finance/daily-closing', icon: CreditCard, label: 'Daily Closing', desc: 'Cash reconciliation' },
    { href: '/finance/income', icon: TrendUp, label: 'Other Income', desc: 'Grants & donations' },
    { href: '/finance/expense', icon: TrendDown, label: 'Expenses', desc: 'Bills & operational' },
    { href: '/finance/salary/pay', icon: Users, label: 'Pay Salary', desc: 'Staff payroll' },
    { href: '/finance/report/monthly', icon: ChartBar, label: 'Monthly Report', desc: 'Financial audit' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={Wallet}
        title="Finance & Accounts"
        subtitle={`Financial ledger overview for ${getMonthName(currentMonth)} ${currentYear}`}
        actions={
          <Badge variant="outline" className="px-3 py-1.5 text-xs font-semibold bg-card border-border">
            <Clock size={13} strokeWidth={2} className="mr-1.5 text-muted-foreground" />
            {currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Badge>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Today's Collection */}
        <Card className="rounded-2xl p-4 sm:p-5 border-border/80 shadow-xs hover:border-primary/40 transition-all">
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Money size={18} strokeWidth={2} />
              </div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Today</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {loading ? "..." : formatCurrency(todayCollection)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Daily Collection</p>
          </CardContent>
        </Card>

        {/* Monthly Income */}
        <Card className="rounded-2xl p-4 sm:p-5 border-border/80 shadow-xs hover:border-primary/40 transition-all">
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <TrendUp size={18} strokeWidth={2} />
              </div>
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">Month</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {loading ? "..." : formatCurrency(summary?.total_income || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Total Income</p>
          </CardContent>
        </Card>

        {/* Monthly Expense */}
        <Card className="rounded-2xl p-4 sm:p-5 border-border/80 shadow-xs hover:border-primary/40 transition-all">
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <TrendDown size={18} strokeWidth={2} />
              </div>
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider">Month</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {loading ? "..." : formatCurrency(summary?.total_expense || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Total Expense</p>
          </CardContent>
        </Card>

        {/* Net Balance */}
        <Card className="rounded-2xl p-4 sm:p-5 border-border/80 shadow-xs hover:border-primary/40 transition-all">
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Wallet size={18} strokeWidth={2} />
              </div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Net</span>
            </div>
            <div className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${(summary?.net_balance || 0) >= 0 ? 'text-foreground' : 'text-rose-600'}`}>
              {loading ? "..." : formatCurrency(summary?.net_balance || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Net Balance</p>
          </CardContent>
        </Card>

        {/* Tuition Due */}
        <Card className="rounded-2xl p-4 sm:p-5 border-border/80 shadow-xs hover:border-primary/40 transition-all col-span-2 sm:col-span-1">
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Warning size={18} strokeWidth={2} />
              </div>
              <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">Pending</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {loading ? "..." : formatCurrency(summary?.tuition_due || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Tuition Due</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions + Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-8 space-y-3">
          <h3 className="text-base font-semibold text-foreground tracking-tight">Financial Modules</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {quickLinks.map(link => (
              <Link key={link.href} href={link.href} className="group block focus-visible:outline-none">
                <div className="bg-card rounded-2xl p-4 border border-border/80 hover:border-primary/40 hover:shadow-xs transition-all text-center h-full flex flex-col items-center justify-center active:scale-[0.98]">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <link.icon size={20} strokeWidth={2} />
                  </div>
                  <h4 className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{link.label}</h4>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate max-w-full">{link.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-base font-semibold text-foreground tracking-tight">Recent Collections</h3>
          <div className="bg-card rounded-2xl p-4 sm:p-5 border border-border/80 shadow-xs h-full flex flex-col justify-between">
            <div className="space-y-2.5">
              {recentPayments.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No payment records yet</p>
              ) : (
                recentPayments.map((p, i) => (
                  <div key={i} className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40 border border-border/50">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-xs font-semibold text-foreground truncate">{p.students?.name || 'Student'}</p>
                      <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{p.class_name} • {p.receipt_number}</p>
                    </div>
                    <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold tabular-nums shrink-0">
                      +{formatTaka(p.amount_paid)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="pt-3 mt-3 border-t border-border/60">
              <Link href="/finance/tuition/collect" className="text-xs font-semibold text-primary hover:underline flex items-center justify-center gap-1">
                Collect New Fee <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
