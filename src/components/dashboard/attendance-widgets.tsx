"use client";

import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { CalendarCheck, ArrowRight, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AttendanceToday {
  dateLabel: string;
  present: number;
  absent: number;
  total: number;
  rate: number;
}

interface ClassAttendanceItem {
  className: string;
  rate: number;
  present: number;
  total: number;
}

interface AttendanceTrendItem {
  date: string;
  formattedDate: string;
  present: number;
  absent: number;
  rate: number;
}

interface Props {
  today: AttendanceToday;
  classAttendance: ClassAttendanceItem[];
  lowAttendanceClasses: ClassAttendanceItem[];
  attendanceTrend: AttendanceTrendItem[];
  onClassClick?: (className: string) => void;
}

export function AttendanceWidgets({
  today,
  classAttendance,
  lowAttendanceClasses,
  attendanceTrend,
  onClassClick,
}: Props) {
  const pieData = [
    { name: "Present", value: today.present, color: "#10B981" },
    { name: "Absent", value: today.absent, color: "#EF4444" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
      {/* Attendance Summary & Donut */}
      <div className="lg:col-span-5 bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <CalendarCheck size={16} strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">Daily Attendance</h3>
                <p className="text-xs text-muted-foreground">Status for {today.dateLabel}</p>
              </div>
            </div>
            <Badge
              variant={today.rate >= 80 ? "default" : today.rate >= 60 ? "secondary" : "destructive"}
              className="text-xs font-bold tabular-nums"
            >
              {today.rate}% Overall
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 my-3">
            <div className="w-36 h-36 relative shrink-0 flex items-center justify-center">
              {today.total === 0 ? (
                <div className="text-xs text-muted-foreground text-center p-2">No entries</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={62}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {pieData.map((entry, index) => (
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
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold text-foreground leading-none tabular-nums">{today.total}</span>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">Students</span>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2.5 flex-1 w-full">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold text-foreground">Present</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {today.present}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-1">
                    ({today.total > 0 ? Math.round((today.present / today.total) * 100) : 0}%)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
                <div className="flex items-center gap-2">
                  <XCircle size={15} className="text-rose-600 dark:text-rose-400" />
                  <span className="text-xs font-semibold text-foreground">Absent</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    {today.absent}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-1">
                    ({today.total > 0 ? Math.round((today.absent / today.total) * 100) : 0}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-border/60 flex items-center justify-between">
          <Button variant="outline" size="sm" asChild className="text-xs h-7 gap-1">
            <Link href="/attendance">
              Take Attendance <ArrowRight size={12} />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-xs h-7 text-primary">
            <Link href="/attendance/report">
              Report View
            </Link>
          </Button>
        </div>
      </div>

      {/* Class-wise Comparison & Trend */}
      <div className="lg:col-span-7 bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-foreground tracking-tight">Class-wise Attendance</h3>
              <p className="text-xs text-muted-foreground">Class breakdown & anomalies</p>
            </div>
            {lowAttendanceClasses.length > 0 && (
              <Badge variant="destructive" className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0 gap-1">
                <AlertTriangle size={11} /> {lowAttendanceClasses.length} Low
              </Badge>
            )}
          </div>

          <div className="space-y-3">
            {classAttendance.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No class attendance recorded for this period
              </div>
            ) : (
              classAttendance.slice(0, 5).map((c) => {
                const isLow = c.rate < 75;
                return (
                  <div
                    key={c.className}
                    onClick={() => onClassClick && onClassClick(c.className)}
                    className={`flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer ${
                      isLow ? "bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="w-24 sm:w-28 shrink-0">
                      <p className="text-xs font-semibold text-foreground truncate">{c.className}</p>
                      <p className="text-[10.5px] text-muted-foreground">{c.present}/{c.total} present</p>
                    </div>

                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isLow ? "bg-amber-500" : c.rate >= 85 ? "bg-emerald-500" : "bg-primary"
                        }`}
                        style={{ width: `${Math.max(c.rate, 5)}%` }}
                      />
                    </div>

                    <span
                      className={`text-xs font-bold w-12 text-right tabular-nums ${
                        isLow ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                      }`}
                    >
                      {c.rate}%
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Multi-day Trend Area if available */}
        {attendanceTrend.length > 1 && (
          <div className="pt-4 mt-3 border-t border-border/60">
            <p className="text-[11px] font-medium text-muted-foreground mb-2">Trend over date range (%)</p>
            <div className="h-20 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceTrend} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="formattedDate" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      color: "var(--card-foreground)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      fontSize: "11px",
                    }}
                    formatter={(val: any) => [`${val}%`, "Attendance Rate"]}
                  />
                  <Line type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
