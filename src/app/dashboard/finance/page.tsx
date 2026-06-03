'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTaka, getMonthName } from '@/lib/finance-utils';
import { FinanceSummary } from '@/types/finance';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import {
  Loader2 as SpinnerGap, Receipt, Wallet, TrendingUp as TrendUp, TrendingDown as TrendDown, AlertCircle as Warning,
  CreditCard, Users, ArrowUpRight, ArrowDownRight, Banknote as Money, FileText,
  Settings as Gear, BarChart as ChartBar, Clock
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
        <SpinnerGap size={32} strokeWidth={1.5} className="animate-spin text-foreground" />
      </div>
    );
  }

  const quickLinks = [
    { href: '/dashboard/finance/tuition/collect', icon: Receipt, label: 'Collect Fees', desc: 'Record student payments' },
    { href: '/dashboard/finance/fee-structure', icon: Gear, label: 'Fee Structure', desc: 'Configure class-wise fees' },
    { href: '/dashboard/finance/tuition/overdue', icon: Warning, label: 'Overdue Fees', desc: 'View defaulter list' },
    { href: '/dashboard/finance/daily-closing', icon: CreditCard, label: 'Daily Closing', desc: 'End-of-day cash reconciliation' },
    { href: '/dashboard/finance/income', icon: TrendUp, label: 'Other Income', desc: 'Donations, grants, rent' },
    { href: '/dashboard/finance/expense', icon: TrendDown, label: 'Expenses', desc: 'Bills, purchases, maintenance' },
    { href: '/dashboard/finance/salary/pay', icon: Users, label: 'Pay Salary', desc: 'Teachers & staff salary' },
    { href: '/dashboard/finance/report/monthly', icon: ChartBar, label: 'Monthly Report', desc: 'Financial breakdown' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        icon={Wallet}
        title="Finance Management"
        subtitle={`Overview for ${getMonthName(currentMonth)} ${currentYear}`}
        actions={
          <Badge variant="outline" className="px-4 py-2 text-sm font-medium bg-muted border-0 text-foreground rounded-md">
            <Clock size={14} strokeWidth={1.5} className="mr-2" /> {currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Badge>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Today's Collection */}
        <Card className="group bg-card rounded-2xl p-6 border border-border hover:border-border hover:bg-muted/30 transition-all duration-300 cursor-pointer shadow-none">
          <CardContent className="p-0">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-muted rounded-xl p-3">
                <Money className="h-6 w-6 text-foreground group-hover:text-foreground transition-colors" strokeWidth={1.2} />
              </div>
              <TrendUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.2} />
            </div>
            <div className="text-4xl font-black tracking-tighter text-foreground tabular-nums">{formatTaka(todayCollection).replace('৳', '')}</div>
            <p className="text-sm text-muted-foreground mt-1.5 font-medium">Today's Collection</p>
          </CardContent>
        </Card>

        {/* Monthly Income */}
        <Card className="group bg-card rounded-2xl p-6 border border-border hover:border-border hover:bg-muted/30 transition-all duration-300 cursor-pointer shadow-none">
          <CardContent className="p-0">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-muted rounded-xl p-3">
                <TrendUp className="h-6 w-6 text-foreground group-hover:text-foreground transition-colors" strokeWidth={1.2} />
              </div>
              <TrendUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.2} />
            </div>
            <div className="text-4xl font-black tracking-tighter text-foreground tabular-nums">{formatTaka(summary?.total_income || 0).replace('৳', '')}</div>
            <p className="text-sm text-muted-foreground mt-1.5 font-medium">Monthly Income</p>
          </CardContent>
        </Card>

        {/* Monthly Expense */}
        <Card className="group bg-card rounded-2xl p-6 border border-border hover:border-border hover:bg-muted/30 transition-all duration-300 cursor-pointer shadow-none">
          <CardContent className="p-0">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-muted rounded-xl p-3">
                <TrendDown className="h-6 w-6 text-foreground group-hover:text-foreground transition-colors" strokeWidth={1.2} />
              </div>
              <TrendUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.2} />
            </div>
            <div className="text-4xl font-black tracking-tighter text-foreground tabular-nums">{formatTaka(summary?.total_expense || 0).replace('৳', '')}</div>
            <p className="text-sm text-muted-foreground mt-1.5 font-medium">Monthly Expense</p>
          </CardContent>
        </Card>

        {/* Net Balance */}
        <Card className="group bg-card rounded-2xl p-6 border border-border hover:border-border hover:bg-muted/30 transition-all duration-300 cursor-pointer shadow-none">
          <CardContent className="p-0">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-muted rounded-xl p-3">
                <Wallet className="h-6 w-6 text-foreground group-hover:text-foreground transition-colors" strokeWidth={1.2} />
              </div>
              <TrendUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.2} />
            </div>
            <div className={`text-4xl font-black tracking-tighter tabular-nums ${(summary?.net_balance || 0) >= 0 ? 'text-foreground' : 'text-red-600'}`}>{formatTaka(summary?.net_balance || 0).replace('৳', '')}</div>
            <p className="text-sm text-muted-foreground mt-1.5 font-medium">Net Balance</p>
          </CardContent>
        </Card>

        {/* Tuition Due */}
        <Card className="group bg-card rounded-2xl p-6 border border-border hover:border-border hover:bg-muted/30 transition-all duration-300 cursor-pointer shadow-none">
          <CardContent className="p-0">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-muted rounded-xl p-3">
                <Warning className="h-6 w-6 text-foreground group-hover:text-foreground transition-colors" strokeWidth={1.2} />
              </div>
              <TrendUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.2} />
            </div>
            <div className="text-4xl font-black tracking-tighter text-foreground tabular-nums">{formatTaka(summary?.tuition_due || 0).replace('৳', '')}</div>
            <p className="text-sm text-muted-foreground mt-1.5 font-medium">Tuition Due</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions + Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-base font-bold text-foreground font-heading tracking-tight">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickLinks.map(link => (
              <Link key={link.href} href={link.href}>
                <div className="group bg-card rounded-2xl p-6 border border-border hover:border-border hover:bg-muted/30 cursor-pointer text-center transition-all h-full flex flex-col justify-center">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4 group-hover:bg-muted/80 transition-colors">
                    <link.icon size={24} strokeWidth={1.2} className="text-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <h3 className="text-sm font-medium text-foreground tracking-tight">{link.label}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="lg:col-span-4">
          <div className="bg-card rounded-2xl p-6 border border-border/50 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-foreground font-heading tracking-tight">Recent Collections</h3>
            </div>
            <div className="space-y-0">
              {recentPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground/70 py-8 text-center">No payments recorded yet</p>
              ) : (
                recentPayments.map((p, i) => (
                  <div key={i} className={`flex justify-between items-center py-3 ${i < recentPayments.length - 1 ? 'border-b border-border/40' : ''}`}>
                    <div>
                      <p className="text-xs font-medium text-foreground leading-snug">{p.students?.name || 'Student'}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{p.class_name} • {p.receipt_number}</p>
                    </div>
                    <span className="font-mono text-xs text-foreground font-semibold">+{formatTaka(p.amount_paid)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
