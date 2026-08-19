"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Building2, RefreshCw, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "./dashboard-header";
import { AttentionCenter, type DashboardAlert } from "./attention-center";
import { KpiGrid } from "./kpi-grid";
import { FinanceWidgets } from "./finance-widgets";
import { AttendanceWidgets } from "./attendance-widgets";
import { AcademicWidgets } from "./academic-widgets";
import { StudentWidgets } from "./student-widgets";
import { RecentTransactionsWidget, type TransactionItem } from "./recent-transactions-widget";
import { ActivityFeedWidget, type ActivityItem } from "./activity-feed-widget";
import { QuickActionsWidget } from "./quick-actions-widget";
import { DrilldownModal } from "./drilldown-modal";
import type { DateRangePreset } from "@/lib/dashboard/dashboard-service";

interface DashboardData {
  timestamp: string;
  roleContext: {
    role: string;
    assignedClasses: any[];
  };
  school?: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logo_url: string;
    current_academic_year: string;
  } | null;
  classes: { id: string; name: string; numeric_value: number }[];
  dateBounds: {
    preset: DateRangePreset;
    startDate: string;
    endDate: string;
  };
  students: {
    totalStudents: number;
    activeStudents: number;
    genderDistribution: { male: number; female: number; other: number; unspecified?: number };
    classDistribution: { className: string; count: number }[];
  };
  staff: {
    totalTeachers: number;
    totalGeneralStaff: number;
    totalEmployees: number;
  };
  attendance: {
    today: {
      dateLabel: string;
      present: number;
      absent: number;
      total: number;
      rate: number;
    };
    classAttendance: { className: string; rate: number; present: number; total: number }[];
    lowAttendanceClasses: { className: string; rate: number; present: number; total: number }[];
    attendanceTrend: { date: string; formattedDate: string; present: number; absent: number; rate: number }[];
  };
  finance?: {
    totalCollection: number;
    collectionTrendPct?: { pct: number; direction: "up" | "down" | "neutral"; text: string } | null;
    cashCollection: number;
    onlineCollection: number;
    todayCollection: { total: number; cash: number; online: number };
    totalOutstandingDue: number;
    dueByClass: { className: string; due: number; expected: number; collected: number }[];
    totalRefunded: number;
    onlineGateways: {
      successCount: number;
      pendingCount: number;
      failedCount: number;
    };
    collectionTrend: { date: string; formattedDate: string; cash: number; online: number; total: number }[];
    methodDistribution: { name: string; value: number; percentage: number; count: number; color: string }[];
    recentTransactions: TransactionItem[];
  } | null;
  academic: {
    totalExams: number;
    upcomingExams: { subject: string; className: string; date: string; formattedDate: string; time: string | null }[];
    totalResultsPublished: number;
    gpaDistribution: { grade: string; count: number; color: string }[];
    configuredSubjectsCount: number;
  };
  activity: ActivityItem[];
  alerts: DashboardAlert[];
}

interface Props {
  initialData?: DashboardData | null;
  role: string;
  userName: string;
}

export function DashboardView({ initialData, role, userName }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<DashboardData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);
  const [, startTransition] = useTransition();

  const rangeParam = (searchParams.get("range") || "30d") as DateRangePreset;
  const classParam = searchParams.get("classId") || undefined;

  const fetchStats = useCallback(
    async (r = rangeParam, c = classParam, showIndicator = true) => {
      if (showIndicator) setRefreshing(true);
      setError(null);

      try {
        const query = new URLSearchParams();
        query.set("range", r);
        if (c) query.set("classId", c);

        const res = await fetch(`/api/dashboard/stats?${query.toString()}`);
        const result = await res.json();

        if (!res.ok || !result.success) {
          throw new Error(result.error || "Failed to load dashboard data");
        }

        setData(result.data);
        setLastUpdated(new Date());
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
        toast.error("Dashboard update failed. Click retry to reload.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [rangeParam, classParam]
  );

  useEffect(() => {
    if (!initialData) {
      void fetchStats(rangeParam, classParam, false);
    }
  }, [initialData, rangeParam, classParam, fetchStats]);

  const handleRangeChange = (newRange: DateRangePreset) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", newRange);
    startTransition(() => {
      router.replace(`/dashboard?${params.toString()}`);
    });
    void fetchStats(newRange, classParam, true);
  };

  const handleClassChange = (newClassId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newClassId) params.set("classId", newClassId);
    else params.delete("classId");
    startTransition(() => {
      router.replace(`/dashboard?${params.toString()}`);
    });
    void fetchStats(rangeParam, newClassId, true);
  };

  const handleExport = (type: "summary" | "transactions" | "due", format: "csv" | "json") => {
    const query = new URLSearchParams();
    query.set("type", type);
    query.set("format", format);
    query.set("range", rangeParam);
    if (classParam) query.set("classId", classParam);

    window.open(`/api/dashboard/export?${query.toString()}`, "_blank");
    toast.success(`Exporting ${type} report as ${format.toUpperCase()}...`);
  };

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 w-full sm:w-1/2 bg-muted/60 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted/60 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-72 bg-muted/60 rounded-2xl" />
          <div className="lg:col-span-4 h-72 bg-muted/60 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
        <div className="h-12 w-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-base font-bold text-foreground">Failed to Load Dashboard</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">{error}</p>
        <Button size="sm" onClick={() => void fetchStats()} className="gap-1.5">
          <RefreshCw size={13} /> Retry
        </Button>
      </div>
    );
  }

  const isEmpty =
    (data?.students?.totalStudents ?? 0) === 0 &&
    (data?.classes?.length ?? 0) === 0;

  return (
    <div className="space-y-6">
      {/* Header with Date Range, Filters & Refresh */}
      <DashboardHeader
        role={role}
        userName={userName}
        academicYear={data?.school?.current_academic_year}
        schoolName={data?.school?.name}
        range={rangeParam}
        selectedClassId={classParam}
        classes={data?.classes || []}
        isRefreshing={refreshing}
        lastUpdated={lastUpdated}
        onRangeChange={handleRangeChange}
        onClassChange={handleClassChange}
        onRefresh={() => void fetchStats()}
        onExport={handleExport}
      />

      {/* Empty State when Institution has no configured classes or students */}
      {isEmpty && (
        <div className="rounded-2xl border border-dashed border-border p-10 sm:p-14 text-center bg-card shadow-xs">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} strokeWidth={1.8} />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1.5">Welcome to EduPulse Pro</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Get started with your institution setup by creating classes, sections, and enrolling students.
          </p>
          <Button asChild className="gap-2">
            <Link href="/classes">
              Create First Class <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      )}

      {/* Attention Center (Actionable Alerts) */}
      {!isEmpty && data?.alerts && data.alerts.length > 0 && (
        <AttentionCenter alerts={data.alerts} />
      )}

      {/* Dynamic Role-Based KPI Grid */}
      {!isEmpty && data && (
        <KpiGrid
          role={role}
          studentsCount={data.students.totalStudents}
          staffCount={data.staff.totalEmployees}
          attendanceToday={data.attendance.today}
          financeMetrics={data.finance}
          academicMetrics={data.academic}
        />
      )}

      {/* Financial Overview (For Super Admin, Admin, and Accountant) */}
      {!isEmpty && data?.finance && (
        <FinanceWidgets
          totalCollection={data.finance.totalCollection}
          cashCollection={data.finance.cashCollection}
          onlineCollection={data.finance.onlineCollection}
          todayCollection={data.finance.todayCollection}
          totalOutstandingDue={data.finance.totalOutstandingDue}
          dueByClass={data.finance.dueByClass}
          onlineGateways={data.finance.onlineGateways}
          collectionTrend={data.finance.collectionTrend}
          methodDistribution={data.finance.methodDistribution}
          onDateClick={(d) => {
            toast.info(`Inspecting collections for ${new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`);
          }}
        />
      )}

      {/* Attendance Analytics Grid */}
      {!isEmpty && data?.attendance && (
        <AttendanceWidgets
          today={data.attendance.today}
          classAttendance={data.attendance.classAttendance}
          lowAttendanceClasses={data.attendance.lowAttendanceClasses}
          attendanceTrend={data.attendance.attendanceTrend}
          onClassClick={(className) => {
            const found = data.classes.find((c) => c.name === className);
            if (found) {
              if (classParam === found.id) {
                handleClassChange(undefined);
                toast.info("Reset to all classes");
              } else {
                handleClassChange(found.id);
                toast.info(`Filtering by ${found.name}`);
              }
            }
          }}
        />
      )}

      {/* Academic & Student Distribution Grid */}
      {!isEmpty && data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          <div className="lg:col-span-6">
            <StudentWidgets
              totalStudents={data.students.totalStudents}
              classDistribution={data.students.classDistribution}
              genderDistribution={data.students.genderDistribution}
              onClassClick={(className) => {
                const found = data.classes.find((c) => c.name === className);
                if (found) {
                  if (classParam === found.id) {
                    handleClassChange(undefined);
                    toast.info("Reset to all classes");
                  } else {
                    handleClassChange(found.id);
                    toast.info(`Filtering by ${found.name}`);
                  }
                }
              }}
            />
          </div>
          <div className="lg:col-span-6">
            <AcademicWidgets
              totalExams={data.academic.totalExams}
              upcomingExams={data.academic.upcomingExams}
              totalResultsPublished={data.academic.totalResultsPublished}
              gpaDistribution={data.academic.gpaDistribution}
              configuredSubjectsCount={data.academic.configuredSubjectsCount}
            />
          </div>
        </div>
      )}

      {/* Recent Collections & Chronological Activity Stream */}
      {!isEmpty && data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {data.finance?.recentTransactions && (
            <div className="lg:col-span-6">
              <RecentTransactionsWidget
                transactions={data.finance.recentTransactions}
                onSelectTransaction={(tx) => setSelectedTx(tx)}
              />
            </div>
          )}
          <div className={data.finance?.recentTransactions ? "lg:col-span-6" : "lg:col-span-12"}>
            <ActivityFeedWidget activities={data.activity} />
          </div>
        </div>
      )}

      {/* Quick Actions Bar */}
      {!isEmpty && (
        <QuickActionsWidget role={role} />
      )}

      {/* Drilldown Modal for granular receipts */}
      <DrilldownModal
        isOpen={Boolean(selectedTx)}
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  );
}
