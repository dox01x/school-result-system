import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
    ArrowRight, BookOpen, Clock, Building2, Megaphone, CalendarCheck, BarChart2
} from "lucide-react";

import { PromotionBanner } from "./_components/promotion-banner";
import { WelcomeBanner } from "./_components/welcome-banner";
import { StatsCards } from "./_components/stats-cards";
import { AttendanceChart } from "./_components/attendance-chart";
import { AccessDeniedToast } from "./_components/access-denied-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
        stuRes, exRes, schoolRes,
        classesRes, subjectsRes, noticesRes,
        upcomingSchedulesRes,
        allSectionsRes, allStudentsRes,
        todayAttendanceRes,
    ] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("exams").select("id", { count: "exact", head: true }),
        supabase.from("school_info").select("name, address, phone, email, logo_url, current_academic_year, last_promotion_year").limit(1).maybeSingle(),
        supabase.from("classes").select("id, name, numeric_value").order("numeric_value"),
        supabase.from("subjects").select("id, name"),
        supabase.from("notices").select("title, created_at, priority, is_published").eq("is_published", true).order("created_at", { ascending: false }).limit(5),
        supabase.from("exam_schedules").select("exam_date, class_id, subject_id").gte("exam_date", todayIso).order("exam_date", { ascending: true }).limit(6),
        supabase.from("sections").select("id, name, class_id").order("name"),
        supabase.from("students").select("class_id, section_id"),
        supabase.from("attendance_records").select("status, att_date").eq("att_date", todayIso),
    ]);

    const classes = (classesRes.data || []) as unknown as ClassRecord[];
    const subjects = (subjectsRes.data || []) as unknown as SubjectRecord[];
    const sections = (allSectionsRes.data || []) as unknown as SectionRecord[];

    const stats = {
        classes: classes.length,
        students: stuRes.count ?? 0,
        subjects: subjects.length,
        exams: exRes.count ?? 0,
        sections: sections.length,
    };
    const school = schoolRes.data as unknown as SchoolData | null;
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

            {/* Welcome Greeting */}
            <Suspense fallback={<div className="h-12 rounded-xl bg-muted/60 animate-pulse" />}>
                <WelcomeBanner
                    schoolLogoUrl={school?.logo_url}
                    academicYear={school?.current_academic_year}
                />
            </Suspense>

            {/* Empty State */}
            {isEmpty && (
                <div className="rounded-2xl border border-dashed border-border p-10 sm:p-14 text-center bg-card shadow-xs">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto mb-4">
                        <Building2 size={28} strokeWidth={1.8} />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1.5">Welcome to EduPulse Pro</h2>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                        Get started with your institution setup by creating classes, sections, and subjects.
                    </p>
                    <Button asChild className="gap-2">
                        <Link href="/dashboard/classes">
                            Create First Class <ArrowRight size={16} />
                        </Link>
                    </Button>
                </div>
            )}

            {/* Core Stats Overview */}
            {!isEmpty && (
                <StatsCards
                    students={stats.students}
                    classes={stats.classes}
                    sections={stats.sections}
                    exams={stats.exams}
                />
            )}

            {/* Main Content Grid */}
            {!isEmpty && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
                    {/* Section Distribution */}
                    <div className="lg:col-span-8 bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs flex flex-col">
                        <div className="flex items-center justify-between gap-3 mb-5">
                            <div>
                                <h3 className="text-base font-semibold text-foreground tracking-tight">Section Distribution</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Student capacity by class section</p>
                            </div>
                            <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary hover:bg-primary/10 gap-1 text-xs">
                                <Link href="/dashboard/students">
                                    View all <ArrowRight size={13} />
                                </Link>
                            </Button>
                        </div>
                        {sectionRows.length === 0 ? (
                            <div className="py-12 text-center text-sm text-muted-foreground flex-1 flex items-center justify-center">
                                No section data registered yet
                            </div>
                        ) : (
                            <div className="space-y-3.5 flex-1 justify-center flex flex-col">
                                {sectionRows.slice(0, 7).map((row) => {
                                    const pct = maxCount > 0 ? (row.student_count / maxCount) * 100 : 0;
                                    return (
                                        <div key={`${row.class_name}-${row.section_name}`} className="flex items-center gap-3 sm:gap-4">
                                            <div className="w-28 sm:w-32 shrink-0">
                                                <p className="text-[13px] font-medium text-foreground truncate">{row.class_name}</p>
                                                <p className="text-[11px] text-muted-foreground">Section {row.section_name}</p>
                                            </div>
                                            <div className="flex-1 h-2 sm:h-2.5 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-primary animate-bar-fill"
                                                    style={{ width: `${Math.max(pct, row.student_count > 0 ? 5 : 0)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-semibold text-foreground w-10 text-right tabular-nums">
                                                {row.student_count}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Notices Card */}
                    <div className="lg:col-span-4 bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs flex flex-col">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                                    <Megaphone size={16} strokeWidth={2} />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-foreground tracking-tight">Notices</h3>
                                    <p className="text-xs text-muted-foreground">School circulars</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary hover:bg-primary/10 text-xs">
                                <Link href="/dashboard/administration/notice">
                                    All
                                </Link>
                            </Button>
                        </div>
                        <div className="space-y-2.5 flex-1">
                            {notices.length === 0 ? (
                                <div className="py-12 text-center text-sm text-muted-foreground flex-1 flex items-center justify-center">
                                    No active notices
                                </div>
                            ) : notices.map((n, i) => (
                                <div key={i} className="p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors border border-border/50">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <p className="text-[13px] font-semibold text-foreground line-clamp-1 leading-snug">{n.title}</p>
                                        {n.priority === "high" && (
                                            <Badge variant="destructive" className="text-[9.5px] px-1.5 py-0 shrink-0">
                                                Urgent
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                        <Clock size={11} /> {n.date}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Upcoming Exams Card */}
                    <div className="lg:col-span-4 bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs flex flex-col">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                                    <BookOpen size={16} strokeWidth={2} />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-foreground tracking-tight">Upcoming Exams</h3>
                                    <p className="text-xs text-muted-foreground">Test schedules</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary hover:bg-primary/10 gap-1 text-xs">
                                <Link href="/dashboard/administration/exam-schedule">
                                    Schedule <ArrowRight size={12} />
                                </Link>
                            </Button>
                        </div>
                        <div className="space-y-2.5 flex-1">
                            {upcomingExams.length === 0 ? (
                                <div className="py-12 text-center text-sm text-muted-foreground flex-1 flex items-center justify-center">
                                    No upcoming exams scheduled
                                </div>
                            ) : upcomingExams.map((e, i) => (
                                <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-semibold text-foreground truncate">{e.subject}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <Clock size={11} className="text-muted-foreground" />
                                            <span className="text-[11px] text-muted-foreground">{e.date}</span>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-[11px] font-semibold bg-background shrink-0">
                                        {e.className}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Attendance Analytics */}
                    <div className="lg:col-span-8 bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs flex flex-col">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                                    <CalendarCheck size={16} strokeWidth={2} />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-foreground tracking-tight">Attendance Summary</h3>
                                    <p className="text-xs text-muted-foreground">Status for {attendanceLabel}</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary hover:bg-primary/10 gap-1 text-xs">
                                <Link href="/dashboard/attendance">
                                    Take Attendance <ArrowRight size={12} />
                                </Link>
                            </Button>
                        </div>
                        <div className="min-h-[220px] flex-1 flex flex-col justify-center">
                            <Suspense fallback={<div className="h-[200px] rounded-xl bg-muted/60 animate-pulse" />}>
                                <AttendanceChart data={attendanceData} label={attendanceLabel} />
                            </Suspense>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
