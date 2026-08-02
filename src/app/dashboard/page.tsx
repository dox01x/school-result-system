import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
    ArrowRight, BookOpen, Clock, Building2,
} from "lucide-react";

import { PromotionBanner } from "./_components/promotion-banner";
import { WelcomeBanner } from "./_components/welcome-banner";
import { StatsCards } from "./_components/stats-cards";
import { AttendanceChart } from "./_components/attendance-chart";
import { AccessDeniedToast } from "./_components/access-denied-toast";
import { Button } from "@/components/ui/button";

type SchoolData = { name: string; address: string; phone: string; email: string; logo_url: string; current_academic_year: string; last_promotion_year: string };
type SectionRow = { class_name: string; section_name: string; student_count: number };
type NoticeItem = { title: string; date: string; priority: string | null };
type UpcomingExamItem = { subject: string; date: string; className: string };
type AttendanceItem = { name: "Present" | "Absent"; value: number; color: string; count: number };

interface ClassRecord { id: string; name: string; numeric_value: number }
interface SubjectRecord { id: string; name: string }
interface NoticeRecord { title: string; created_at: string; priority: string | null; is_published: boolean }
interface ScheduleRecord { exam_date: string; class_id: string; subject_id: string }
interface SectionRecord { id: string; name: string; class_id: string }
interface StudentRecord { class_id: string; section_id: string }
interface AttendanceRecord { status: string; att_date: string }

/* ── Server-side data fetching ── */
async function fetchDashboardData() {
    const supabase = await createServerSupabaseClient();
    const todayIso = new Date().toISOString().slice(0, 10);

    const [
        cRes, stuRes, subRes, exRes, secRes, schoolRes,
        classesRes, subjectsRes, noticesRes,
        upcomingSchedulesRes,
        allSectionsRes, allStudentsRes,
        todayAttendanceRes,
    ] = await Promise.all([
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("exams").select("id", { count: "exact", head: true }),
        supabase.from("sections").select("id", { count: "exact", head: true }),
        supabase.from("school_info").select("name, address, phone, email, logo_url, current_academic_year, last_promotion_year").limit(1).maybeSingle(),
        supabase.from("classes").select("id, name, numeric_value").order("numeric_value"),
        supabase.from("subjects").select("id, name"),
        supabase.from("notices").select("title, created_at, priority, is_published").eq("is_published", true).order("created_at", { ascending: false }).limit(5),
        supabase.from("exam_schedules").select("exam_date, class_id, subject_id").gte("exam_date", todayIso).order("exam_date", { ascending: true }).limit(6),
        supabase.from("sections").select("id, name, class_id").order("name"),
        supabase.from("students").select("class_id, section_id"),
        supabase.from("attendance_records").select("status, att_date").eq("att_date", todayIso),
    ]);

    const stats = { classes: cRes.count ?? 0, students: stuRes.count ?? 0, subjects: subRes.count ?? 0, exams: exRes.count ?? 0, sections: secRes.count ?? 0 };
    const school = schoolRes.data as unknown as SchoolData | null;
    const classes = (classesRes.data || []) as unknown as ClassRecord[];
    const subjects = (subjectsRes.data || []) as unknown as SubjectRecord[];
    const classMap: Record<string, string> = {};
    classes.forEach((c) => { classMap[c.id] = c.name; });
    const subjectMap: Record<string, string> = {};
    subjects.forEach((s) => { subjectMap[s.id] = s.name; });

    const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const rawNotices = (noticesRes.data || []) as unknown as NoticeRecord[];
    const notices: NoticeItem[] = rawNotices.map((n) => ({
        title: n.title,
        date: fmt(n.created_at),
        priority: n.priority,
    }));

    const rawSchedules = (upcomingSchedulesRes.data || []) as unknown as ScheduleRecord[];
    const upcomingExams: UpcomingExamItem[] = rawSchedules.map((r) => ({
        subject: subjectMap[r.subject_id] || "Subject",
        date: fmt(r.exam_date),
        className: classMap[r.class_id] || "Class",
    }));

    let sectionRows: SectionRow[] = [];
    if (classes.length > 0) {
        const secs = (allSectionsRes.data || []) as unknown as SectionRecord[];
        const studs = (allStudentsRes.data || []) as unknown as StudentRecord[];
        const countMap: Record<string, number> = {};
        studs.forEach((s) => { countMap[s.section_id] = (countMap[s.section_id] || 0) + 1; });
        sectionRows = secs.map((sec) => ({ class_name: classMap[sec.class_id] || "", section_name: sec.name, student_count: countMap[sec.id] || 0 }));
    }

    let attendanceLabel = "Today";
    let records: AttendanceRecord[] = (todayAttendanceRes.data || []) as unknown as AttendanceRecord[];
    if (records.length === 0) {
        const { data: latest } = await supabase
            .from("attendance_records")
            .select("status, att_date")
            .order("att_date", { ascending: false })
            .limit(100);
        if (latest && latest.length > 0) {
            const latestDate = latest[0].att_date;
            records = (latest as unknown as AttendanceRecord[]).filter((r) => r.att_date === latestDate);
            attendanceLabel = new Date(latestDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
    }
    const total = records.length;
    const present = records.filter((r) => (r.status || "").toUpperCase() === "P").length;
    const absent = records.filter((r) => (r.status || "").toUpperCase() === "A").length;
    const toPct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    const attendanceData: AttendanceItem[] = [
        { name: "Present", value: toPct(present), count: present, color: "#10B981" },
        { name: "Absent", value: toPct(absent), count: absent, color: "#EF4444" },
    ];

    return { stats, school, notices, upcomingExams, sectionRows, attendanceData, attendanceLabel };
}

export default async function DashboardPage() {
    const { stats, school, notices, upcomingExams, sectionRows, attendanceData, attendanceLabel } = await fetchDashboardData();

    const isEmpty = stats.classes === 0 && stats.students === 0;
    const maxCount = Math.max(...sectionRows.map((r) => r.student_count), 1);

    return (
        <div className="space-y-6">
            <AccessDeniedToast />
            <PromotionBanner academicYear={school?.current_academic_year} />

            {/* Welcome */}
            <Suspense fallback={<div className="h-12 rounded-lg bg-muted animate-pulse" />}>
                <WelcomeBanner
                    schoolLogoUrl={school?.logo_url}
                    academicYear={school?.current_academic_year}
                />
            </Suspense>

            {/* Empty State */}
            {isEmpty && (
                <div className="rounded-xl border-2 border-dashed border-border p-12 text-center bg-card">
                    <Building2 size={32} strokeWidth={1.5} className="text-muted-foreground mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-foreground mb-1">Welcome to EduPulse Pro</h2>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">Get started by setting up your school&apos;s classes and sections.</p>
                    <Button asChild>
                        <Link href="/dashboard/classes">
                            Create First Class <ArrowRight size={16} />
                        </Link>
                    </Button>
                </div>
            )}

            {/* Stats */}
            {!isEmpty && (
                <StatsCards
                    students={stats.students}
                    classes={stats.classes}
                    sections={stats.sections}
                    exams={stats.exams}
                />
            )}

            {/* Content Grid */}
            {!isEmpty && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Section Distribution */}
                    <div className="lg:col-span-8 bg-card rounded-xl border border-border p-5">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-[15px] font-semibold text-foreground">Section Distribution</h3>
                            <Link href="/dashboard/students" className="text-xs font-medium text-primary hover:underline">
                                View all
                            </Link>
                        </div>
                        {sectionRows.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-8 text-center">No section data</p>
                        ) : (
                            <div className="space-y-3">
                                {sectionRows.slice(0, 8).map((row) => {
                                    const pct = maxCount > 0 ? (row.student_count / maxCount) * 100 : 0;
                                    return (
                                        <div key={`${row.class_name}-${row.section_name}`} className="flex items-center gap-4">
                                            <div className="w-28 shrink-0">
                                                <p className="text-sm font-medium text-foreground truncate">{row.class_name}</p>
                                                <p className="text-[11px] text-muted-foreground">{row.section_name}</p>
                                            </div>
                                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-primary animate-bar-fill"
                                                    style={{ width: `${Math.max(pct, row.student_count > 0 ? 4 : 0)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-medium text-muted-foreground w-8 text-right tabular-nums">
                                                {row.student_count}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Notices */}
                    <div className="lg:col-span-4 bg-card rounded-xl border border-border p-5 flex flex-col">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-[15px] font-semibold text-foreground">Notices</h3>
                            <Link href="/dashboard/administration/notice" className="text-xs font-medium text-primary hover:underline">
                                View all
                            </Link>
                        </div>
                        <div className="space-y-2 flex-1">
                            {notices.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-8 text-center">No active notices</p>
                            ) : notices.map((n, i) => (
                                <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-foreground line-clamp-1">{n.title}</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">{n.date}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Upcoming Exams */}
                    <div className="lg:col-span-4 bg-card rounded-xl border border-border p-5 flex flex-col">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-[15px] font-semibold text-foreground">Upcoming Exams</h3>
                            <Link href="/dashboard/exams" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                                Schedule <ArrowRight size={12} />
                            </Link>
                        </div>
                        <div className="space-y-2 flex-1">
                            {upcomingExams.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-8 text-center">No upcoming exams</p>
                            ) : upcomingExams.map((e, i) => (
                                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                                    <BookOpen size={14} className="text-muted-foreground shrink-0" strokeWidth={1.5} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{e.subject}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <Clock size={10} className="text-muted-foreground" />
                                            <span className="text-[11px] text-muted-foreground">{e.date}</span>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                                        {e.className}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Attendance */}
                    <div className="lg:col-span-8 bg-card rounded-xl border border-border p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[15px] font-semibold text-foreground">Attendance</h3>
                        </div>
                        <div className="min-h-[200px]">
                            <Suspense fallback={<div className="h-[200px] rounded-lg bg-muted animate-pulse" />}>
                                <AttendanceChart data={attendanceData} label={attendanceLabel} />
                            </Suspense>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
