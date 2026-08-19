"use client";

import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Banknote,
  Globe,
  AlertCircle,
  ArrowRight,
  Receipt,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTaka } from "@/lib/finance-utils";

interface CollectionTrendItem {
  date: string;
  formattedDate: string;
  cash: number;
  online: number;
  total: number;
}

interface MethodDistributionItem {
  name: string;
  value: number;
  percentage: number;
  count: number;
  color: string;
}

interface DueByClassItem {
  className: string;
  due: number;
  expected: number;
  collected: number;
}

interface Props {
  totalCollection: number;
  cashCollection: number;
  onlineCollection: number;
  todayCollection: { total: number; cash: number; online: number };
  totalOutstandingDue: number;
  dueByClass: DueByClassItem[];
  onlineGateways: {
    successCount: number;
    pendingCount: number;
    failedCount: number;
  };
  collectionTrend: CollectionTrendItem[];
  methodDistribution: MethodDistributionItem[];
  onDateClick?: (date: string) => void;
}

export function FinanceWidgets({
  totalCollection,
  cashCollection,
  onlineCollection,
  todayCollection,
  totalOutstandingDue,
  dueByClass,
  onlineGateways,
  collectionTrend,
  methodDistribution,
  onDateClick,
}: Props) {
  const maxDue = Math.max(...dueByClass.map((d) => d.due), 1);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Grid: Collection Trend & Payment Method */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Collection Trend Chart */}
        <div className="lg:col-span-8 bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <TrendingUp size={16} strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">Collection Trend</h3>
                <p className="text-xs text-muted-foreground">Revenue timeline (Cash vs Online)</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary hover:bg-primary/10 gap-1 text-xs">
              <Link href="/finance">
                Finance Hub <ArrowRight size={12} />
              </Link>
            </Button>
          </div>

          <div className="h-56 sm:h-64 w-full">
            {collectionTrend.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground text-xs">
                <p>No collection records for this date range.</p>
                <p className="text-[11px] mt-1 text-muted-foreground/70">Change date range to view historical trends.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={collectionTrend}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload.length > 0) {
                      const d = e.activePayload[0]?.payload?.date;
                      if (d && onDateClick) onDateClick(d);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorOnline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="formattedDate" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `৳${v}`} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      color: "var(--card-foreground)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: any, name: any) => [`৳${Number(value).toLocaleString()}`, name === "cash" ? "Cash Collection" : "Online Collection"]}
                  />
                  <Area type="monotone" dataKey="cash" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorCash)" />
                  <Area type="monotone" dataKey="online" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorOnline)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Method Breakdown Donut */}
        <div className="lg:col-span-4 bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">Payment Methods</h3>
                <p className="text-xs text-muted-foreground">Cash vs Online breakdown</p>
              </div>
              <Badge variant="outline" className="text-xs font-bold tabular-nums">
                ৳{totalCollection.toLocaleString()}
              </Badge>
            </div>

            <div className="h-44 relative flex items-center justify-center">
              {totalCollection === 0 ? (
                <div className="text-xs text-muted-foreground text-center">No payment methods recorded in period</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={methodDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={66}
                      paddingAngle={4}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {methodDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        color: "var(--card-foreground)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(val: any) => [`৳${Number(val).toLocaleString()}`, "Amount"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="space-y-2.5 pt-3 border-t border-border/60">
            {methodDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/40">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-semibold text-foreground">{item.name}</span>
                  <span className="text-[11px] text-muted-foreground">({item.count} receipts)</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-foreground tabular-nums">৳{item.value.toLocaleString()}</span>
                  <span className="text-[10.5px] text-muted-foreground ml-1.5 font-medium">({item.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary Grid: Cash Widget, Online Gateway Widget, Due by Class Widget */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Cash Collection Card */}
        <div className="bg-card rounded-2xl border border-border/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Banknote size={16} strokeWidth={2} />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Cash Collection</h4>
              </div>
              <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10">
                Cash Desk
              </Badge>
            </div>
            <div className="space-y-3 mt-4">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                <p className="text-[11px] font-medium text-muted-foreground">Today&apos;s Cash In-Hand</p>
                <p className="text-xl font-bold text-foreground tabular-nums mt-0.5">৳{todayCollection.cash.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex justify-between items-center">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Period Cash Total</p>
                  <p className="text-base font-bold text-foreground tabular-nums mt-0.5">৳{cashCollection.toLocaleString()}</p>
                </div>
                <Button size="sm" variant="outline" asChild className="text-xs h-7 gap-1">
                  <Link href="/finance/daily-closing">
                    Daily Closing <ArrowRight size={11} />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Online Payment Widget */}
        <div className="bg-card rounded-2xl border border-border/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Globe size={16} strokeWidth={2} />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Online Gateways</h4>
              </div>
              <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10">
                Digital Pay
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 text-center">
                <div className="flex items-center justify-center text-emerald-600 mb-1">
                  <CheckCircle2 size={14} />
                </div>
                <span className="text-base font-bold text-foreground tabular-nums">{onlineGateways.successCount}</span>
                <p className="text-[10px] text-muted-foreground font-medium">Success</p>
              </div>
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 text-center">
                <div className="flex items-center justify-center text-amber-600 mb-1">
                  <Clock size={14} />
                </div>
                <span className="text-base font-bold text-foreground tabular-nums">{onlineGateways.pendingCount}</span>
                <p className="text-[10px] text-muted-foreground font-medium">Pending</p>
              </div>
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 text-center">
                <div className="flex items-center justify-center text-rose-600 mb-1">
                  <XCircle size={14} />
                </div>
                <span className="text-base font-bold text-foreground tabular-nums">{onlineGateways.failedCount}</span>
                <p className="text-[10px] text-muted-foreground font-medium">Failed</p>
              </div>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-border/50 flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-medium">Online Total: ৳{onlineCollection.toLocaleString()}</span>
            <Link href="/finance/tuition/collect" className="text-primary font-semibold hover:underline flex items-center gap-0.5">
              Collect <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {/* Outstanding Due by Class Widget */}
        <div className="bg-card rounded-2xl border border-border/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <AlertCircle size={16} strokeWidth={2} />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Outstanding Due</h4>
              </div>
              <Badge variant="destructive" className="text-[10.5px] font-bold tabular-nums">
                ৳{totalOutstandingDue.toLocaleString()}
              </Badge>
            </div>

            <div className="space-y-2 mt-3">
              {dueByClass.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">No outstanding dues calculated</div>
              ) : (
                dueByClass.slice(0, 4).map((d) => {
                  const pct = (d.due / maxDue) * 100;
                  return (
                    <div key={d.className} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-foreground">{d.className}</span>
                        <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">৳{d.due.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(pct, d.due > 0 ? 6 : 0)}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-border/50 text-right">
            <Link href="/finance/tuition/overdue" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
              View Defaulter List <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
