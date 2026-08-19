"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Users,
  CalendarCheck,
  Wallet,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Banknote,
  BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ── Smooth Count-up hook ── */
function useCountUp(target: number, duration = 400) {
  const [val, setVal] = useState(target);
  const ref = useRef<number>(target);

  useEffect(() => {
    if (isNaN(target)) return;
    const start = ref.current;
    const diff = target - start;
    if (diff === 0) return;

    const startTime = performance.now();
    let animId: number;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      setVal(current);
      if (progress < 1) {
        animId = requestAnimationFrame(animate);
      } else {
        ref.current = target;
      }
    };
    animId = requestAnimationFrame(animate);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [target, duration]);

  return isNaN(target) ? 0 : val;
}

export interface KpiCardData {
  id: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: LucideIcon;
  href: string;
  color: string;
  bg: string;
  subLabel: string;
  trend?: {
    pct: number;
    direction: "up" | "down" | "neutral";
    text: string;
  } | null;
}

interface Props {
  role: string;
  studentsCount: number;
  staffCount: number;
  attendanceToday: {
    rate: number;
    present: number;
    absent: number;
    total: number;
  };
  financeMetrics?: {
    totalCollection: number;
    collectionTrendPct?: { pct: number; direction: "up" | "down" | "neutral"; text: string } | null;
    todayCollection: { total: number; cash: number; online: number };
    totalOutstandingDue: number;
    cashCollection: number;
    onlineCollection: number;
  } | null;
  academicMetrics?: {
    totalExams: number;
    totalResultsPublished: number;
  } | null;
}

export function KpiGrid({
  role,
  studentsCount,
  staffCount,
  attendanceToday,
  financeMetrics,
  academicMetrics,
}: Props) {
  const studentsVal = useCountUp(studentsCount);
  const staffVal = useCountUp(staffCount);
  const collectionVal = useCountUp(financeMetrics?.totalCollection || 0);
  const todayCollectionVal = useCountUp(financeMetrics?.todayCollection?.total || 0);
  const dueVal = useCountUp(financeMetrics?.totalOutstandingDue || 0);
  const examsVal = useCountUp(academicMetrics?.totalExams || 0);

  const cards: KpiCardData[] = [];

  // Super Admin / Admin Dashboard KPIs
  if (role === "super_admin" || role === "admin") {
    cards.push(
      {
        id: "kpi-students",
        label: "Total Students",
        value: studentsVal,
        icon: GraduationCap,
        href: "/students",
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/20",
        subLabel: "Active student body",
      },
      {
        id: "kpi-attendance",
        label: "Today's Attendance",
        value: attendanceToday.total === 0 ? 0 : attendanceToday.rate,
        suffix: "%",
        icon: CalendarCheck,
        href: "/attendance",
        color: attendanceToday.total === 0 ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400",
        bg: attendanceToday.total === 0 ? "bg-muted/40 border-border/60" : "bg-emerald-500/10 border-emerald-500/20",
        subLabel: attendanceToday.total === 0 ? "Not recorded today" : `${attendanceToday.present} Present · ${attendanceToday.absent} Absent`,
      },
      {
        id: "kpi-period-collection",
        label: "Period Collection",
        value: collectionVal,
        prefix: "৳",
        icon: Wallet,
        href: "/finance",
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-500/10 border-indigo-500/20",
        subLabel: "Total receipts in range",
        trend: financeMetrics?.collectionTrendPct,
      },
      {
        id: "kpi-due",
        label: "Outstanding Due",
        value: dueVal,
        prefix: "৳",
        icon: AlertCircle,
        href: "/finance/tuition/overdue",
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/10 border-amber-500/20",
        subLabel: "Uncollected tuition fees",
      },
      {
        id: "kpi-staff",
        label: "Faculty & Staff",
        value: staffVal,
        icon: Users,
        href: "/administration/staff",
        color: "text-purple-600 dark:text-purple-400",
        bg: "bg-purple-500/10 border-purple-500/20",
        subLabel: "Active employees",
      }
    );
  } else if (role === "accountant") {
    // Accountant Dedicated Finance KPIs
    cards.push(
      {
        id: "kpi-today-col",
        label: "Today's Collection",
        value: todayCollectionVal,
        prefix: "৳",
        icon: Banknote,
        href: "/finance/daily-closing",
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
        subLabel: `Cash ৳${(financeMetrics?.todayCollection?.cash || 0).toLocaleString()}`,
      },
      {
        id: "kpi-total-col",
        label: "Total Collection",
        value: collectionVal,
        prefix: "৳",
        icon: Wallet,
        href: "/finance",
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/20",
        subLabel: "Selected period total",
        trend: financeMetrics?.collectionTrendPct,
      },
      {
        id: "kpi-due-acc",
        label: "Total Due",
        value: dueVal,
        prefix: "৳",
        icon: AlertCircle,
        href: "/finance/tuition/overdue",
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/10 border-amber-500/20",
        subLabel: "Defaulter fee balance",
      },
      {
        id: "kpi-students-acc",
        label: "Enrolled Students",
        value: studentsVal,
        icon: GraduationCap,
        href: "/finance/tuition/collect",
        color: "text-purple-600 dark:text-purple-400",
        bg: "bg-purple-500/10 border-purple-500/20",
        subLabel: "Collect student fees",
      }
    );
  } else if (role === "class_teacher") {
    // Class Teacher KPIs (scoped, NO financial data)
    cards.push(
      {
        id: "kpi-my-students",
        label: "My Class Students",
        value: studentsVal,
        icon: Users,
        href: "/students",
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/20",
        subLabel: "Assigned section roster",
      },
      {
        id: "kpi-my-attendance",
        label: "Today's Attendance",
        value: attendanceToday.total === 0 ? 0 : attendanceToday.rate,
        suffix: "%",
        icon: CalendarCheck,
        href: "/attendance",
        color: attendanceToday.total === 0 ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400",
        bg: attendanceToday.total === 0 ? "bg-muted/40 border-border/60" : "bg-emerald-500/10 border-emerald-500/20",
        subLabel: attendanceToday.total === 0 ? "Not recorded today" : `${attendanceToday.present} Present · ${attendanceToday.absent} Absent`,
      },
      {
        id: "kpi-teacher-exams",
        label: "Scheduled Exams",
        value: examsVal,
        icon: BookOpen,
        href: "/marks",
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-500/10 border-indigo-500/20",
        subLabel: "Enter term marks",
      }
    );
  } else {
    // Exam Controller KPIs
    cards.push(
      {
        id: "kpi-total-exams",
        label: "Active Examinations",
        value: examsVal,
        icon: BookOpen,
        href: "/exams",
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-500/10 border-indigo-500/20",
        subLabel: "Configured terms",
      },
      {
        id: "kpi-results-pub",
        label: "Results Published",
        value: academicMetrics?.totalResultsPublished || 0,
        icon: GraduationCap,
        href: "/results",
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
        subLabel: "Final grade sheets",
      },
      {
        id: "kpi-exam-students",
        label: "Candidate Students",
        value: studentsVal,
        icon: Users,
        href: "/exam-configuration",
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/20",
        subLabel: "Enrolled in classes",
      }
    );
  }

  return (
    <div className={`grid grid-cols-2 ${cards.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3 sm:gap-4`}>
      {cards.map((c) => (
        <Link key={c.id} href={c.href} className="group block focus-visible:outline-none">
          <div className="bg-card rounded-2xl p-4 sm:p-5 border border-border/80 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all duration-150 relative overflow-hidden active:scale-[0.99] h-full flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className={`p-2 rounded-xl border ${c.bg} ${c.color} shrink-0`}>
                <c.icon size={18} strokeWidth={2} />
              </div>
              <div className="flex items-center gap-1.5">
                {c.trend ? (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                      c.trend.direction === "up"
                        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                        : c.trend.direction === "down"
                        ? "text-rose-600 dark:text-rose-400 bg-rose-500/10"
                        : "text-muted-foreground bg-muted"
                    }`}
                  >
                    {c.trend.direction === "up" ? (
                      <TrendingUp size={11} strokeWidth={2.5} />
                    ) : c.trend.direction === "down" ? (
                      <TrendingDown size={11} strokeWidth={2.5} />
                    ) : null}
                    {c.trend.text}
                  </span>
                ) : null}
                <span className="text-muted-foreground/50 group-hover:text-primary transition-colors">
                  <ArrowUpRight size={15} strokeWidth={2} />
                </span>
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-foreground tracking-tight tabular-nums flex items-baseline gap-0.5">
                {c.prefix && <span className="text-base sm:text-lg font-semibold">{c.prefix}</span>}
                <span>{c.value.toLocaleString()}</span>
                {c.suffix && <span className="text-base sm:text-lg font-semibold">{c.suffix}</span>}
              </div>
              <p className="text-xs sm:text-[13px] font-medium text-foreground/90 mt-0.5 truncate">
                {c.label}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {c.subLabel}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
