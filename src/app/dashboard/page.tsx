import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
    ArrowRight, BookOpen, Clock, Sparkles, Building2,
    Pencil, BarChart2, GraduationCap, Settings
} from "lucide-react";

import { PromotionBanner } from "./_components/promotion-banner";
import { WelcomeBanner } from "./_components/welcome-banner";
import { StatsCards } from "./_components/stats-cards";
import { AttendanceChart } from "./_components/attendance-chart";

type SchoolData = { name: string; address: string; phone: string; email: string; logo_url: string; current_academic_year: string; last_promotion_year: string };
type SectionRow = { class_name: string; section_name: string; student_count: number };
type NoticeItem = { title: string; date: string; color: string };
type UpcomingExamItem = { subject: string; date: string; className: string };
type AttendanceItem = { name: "Present" | "Absent"; value: number; color: string; count: number };

/* ── Server-side data fetching ── */
async function fetchDashboardData() {
    const supabase = await createServerSupabaseClient();

    const [cRes, stuRes, subRes, exRes, secRes, schoolRes, classesRes, subjectsRes, noticesRes] = await Promise.all([
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("exams").select("id", { count: "exact", head: true }),
        supabase.from("sections").select("id", { count: "exact", head: true }),
        supabase.from("school_info").select("name, address, phone, email, logo_url, current_academic_year, last_promotion_year").limit(1).maybeSingle(),
        supabase.from("classes").select("id, name, numeric_value").order("numeric_value"),
        supabase.from("subjects").select("id, name"),
        supabase.from("notices").select("title, created_at, priority, is_published").eq("is_published", true).order("created_at", { ascending: false }).limit(5),
    ]);

    const stats = { classes: cRes.count ?? 0, students: stuRes.count ?? 0, subjects: subRes.count ?? 0, exams: exRes.count ?? 0, sections: secRes.count ?? 0 };
    const school = schoolRes.data as unknown as SchoolData | null;
    const classes = classesRes.data || [];
    const subjects = subjectsRes.data || [];
    const classMap: Record<string, string> = {};
    classes.forEach((c) => { classMap[c.id] = c.name; });
    const subjectMap: Record<string, string> = {};
    subjects.forEach((s) => { subjectMap[s.id] = s.name; });

    const noticeColor = (priority: string | null | undefined) => {
        const p = (priority || "").toLowerCase();
        if (p === "high" || p === "urgent") return "bg-primary";
        if (p === "medium") return "bg-muted/500";
        return "bg-muted";
    };
    const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const notices: NoticeItem[] = (noticesRes.data || []).map((n) => ({
        title: n.title,
        date: fmt(n.created_at),
        color: noticeColor(n.priority),
    }));

    // Upcoming exams
    const todayIso = new Date().toISOString().slice(0, 10);
    const { data: upcomingSchedules } = await supabase
        .from("exam_schedules")
        .select("exam_date, class_id, subject_id")
        .gte("exam_date", todayIso)
        .order("exam_date", { ascending: true })
        .limit(6);
    const upcomingExams: UpcomingExamItem[] = (upcomingSchedules || []).map((r) => ({
        subject: subjectMap[r.subject_id] || "Subject",
        date: fmt(r.exam_date),
        className: classMap[r.class_id] || "Class",
    }));

    // Section distribution
    let sectionRows: SectionRow[] = [];
    if (classes.length > 0) {
        const [sectionsRes, studentsRes] = await Promise.all([
            supabase.from("sections").select("id, name, class_id").order("name"),
            supabase.from("students").select("class_id, section_id"),
        ]);
        const secs = sectionsRes.data || [];
        const studs = studentsRes.data || [];
        const countMap: Record<string, number> = {};
        studs.forEach((s) => { countMap[s.section_id] = (countMap[s.section_id] || 0) + 1; });
        sectionRows = secs.map((sec) => ({ class_name: classMap[sec.class_id] || "", section_name: sec.name, student_count: countMap[sec.id] || 0 }));
    }

    // Attendance snapshot
    let attendanceLabel = "Today";
    let records: { status: string; att_date: string }[] = [];
    const { data: todayAttendance } = await supabase
        .from("attendance_records")
        .select("status, att_date")
        .eq("att_date", todayIso);
    records = todayAttendance || [];
    if (records.length === 0) {
        const { data: latest } = await supabase
            .from("attendance_records")
            .select("att_date")
            .order("att_date", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (latest?.att_date) {
            const { data: latestRows } = await supabase
                .from("attendance_records")
                .select("status, att_date")
                .eq("att_date", latest.att_date);
            records = latestRows || [];
            attendanceLabel = new Date(latest.att_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
    }
    const total = records.length;
    const present = records.filter((r) => (r.status || "").toUpperCase() === "P").length;
    const absent = records.filter((r) => (r.status || "").toUpperCase() === "A").length;
    const toPct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    const attendanceData: AttendanceItem[] = [
        { name: "Present", value: toPct(present), count: present, color: "#27272a" },
        { name: "Absent", value: toPct(absent), count: absent, color: "#d4d4d8" },
    ];

    return { stats, school, notices, upcomingExams, sectionRows, attendanceData, attendanceLabel };
}

export default async function DashboardPage() {
    const { stats, school, notices, upcomingExams, sectionRows, attendanceData, attendanceLabel } = await fetchDashboardData();

    const isEmpty = stats.classes === 0 && stats.students === 0;
    const maxCount = Math.max(...sectionRows.map((r) => r.student_count), 1);

    return (
        <div className="flex flex-col gap-6">
            <PromotionBanner academicYear={school?.current_academic_year} />

            {/* Top Bento Row: Welcome & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Suspense fallback={<div className="animate-pulse rounded-2xl bg-muted h-full w-full min-h-[140px]" />}>
                        <WelcomeBanner
                            schoolLogoUrl={school?.logo_url}
                            academicYear={school?.current_academic_year}
                        />
                    </Suspense>
                </div>

                {!isEmpty && (
                    <div className="grid grid-cols-2 gap-4 lg:col-span-1">
                        {[
                            { href: "/dashboard/marks", icon: Pencil, title: "Marks", bg: "bg-muted", text: "text-foreground", iconColor: "text-foreground", hover: "hover:bg-muted/80" },
                            { href: "/dashboard/students", icon: GraduationCap, title: "Students", bg: "bg-muted", text: "text-foreground", iconColor: "text-foreground", hover: "hover:bg-muted/80" },
                            { href: "/dashboard/results", icon: BarChart2, title: "Results", bg: "bg-muted", text: "text-foreground", iconColor: "text-foreground", hover: "hover:bg-muted/80" },
                            { href: "/dashboard/settings", icon: Settings, title: "Settings", bg: "bg-muted", text: "text-foreground", iconColor: "text-foreground", hover: "hover:bg-muted/80" },
                        ].map((a) => (
                            <Link key={a.href} href={a.href} className="block h-full">
                                <div className={`group flex flex-col items-center justify-center h-full rounded-2xl p-4 transition-all duration-300 ${a.bg} ${a.hover} active:scale-95 cursor-pointer`}>
                                    <a.icon size={22} strokeWidth={1.5} className={`${a.iconColor} mb-2 transition-transform duration-300 group-hover:-translate-y-0.5`} />
                                    <p className={`text-xs font-semibold ${a.text}`}>{a.title}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Empty State */}
            {isEmpty && (
                <div className="bg-transparent rounded-2xl border-2 border-dashed border-border/50 p-12 text-center shadow-none">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 mx-auto text-muted-foreground/40">
                        <Sparkles size={28} strokeWidth={1.2} className="text-foreground" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground font-heading mb-6">Welcome to School Management System!</h2>
                    <div className="flex justify-center">
                        <Link href="/dashboard/classes" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold rounded-xl px-6 py-3 hover:bg-primary/90 transition-all active:scale-95 text-sm shadow-md">
                            <Building2 size={18} strokeWidth={1.5} /> Create First Class <ArrowRight size={18} strokeWidth={1.5} />
                        </Link>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            {!isEmpty && (
                <StatsCards
                    students={stats.students}
                    classes={stats.classes}
                    sections={stats.sections}
                    exams={stats.exams}
                />
            )}

            {/* Main Content Bento Grid */}
            {!isEmpty && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Section Distribution */}
                    <div className="lg:col-span-8 bg-card rounded-2xl p-7 border border-border/50 shadow-none flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-base font-bold text-foreground font-heading tracking-tight">Section Distribution</h3>
                            <Link href="/dashboard/students" className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 bg-muted px-3 py-1.5 rounded-full hover:bg-muted/80">
                                View All <ArrowRight size={14} strokeWidth={2} />
                            </Link>
                        </div>
                        {sectionRows.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground/70 py-8">No sections yet</div>
                        ) : (
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-[11px] text-muted-foreground/70 border-b border-border/40 uppercase tracking-wider">
                                            <th className="text-left pb-3 pr-4 font-semibold whitespace-nowrap">Class</th>
                                            <th className="text-left pb-3 px-4 font-semibold whitespace-nowrap">Students</th>
                                            <th className="text-left pb-3 pl-4 font-semibold w-1/3 whitespace-nowrap">Capacity</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {sectionRows.slice(0, 6).map((row) => {
                                            const pct = maxCount > 0 ? (row.student_count / maxCount) * 100 : 0;
                                            return (
                                                <tr key={`${row.class_name}-${row.section_name}`} className="group hover:bg-muted/30 transition-colors">
                                                    <td className="py-4 pr-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-xl bg-muted border border-border/50 flex items-center justify-center shrink-0 group-hover:bg-card group-hover:shadow-sm transition-all">
                                                                <span className="text-[11px] font-black text-foreground">{row.class_name.replace(/[^0-9]/g, "").slice(0, 2) || "C"}</span>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-semibold text-foreground leading-tight">{row.class_name}</p>
                                                                <p className="text-xs text-muted-foreground/70 mt-0.5">{row.section_name}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4"><span className="text-sm font-bold text-foreground tabular-nums">{row.student_count}</span></td>
                                                    <td className="py-4 pl-4">
                                                        <div className="h-2 rounded-full bg-muted overflow-hidden relative">
                                                            {/* Base bar - animates on load */}
                                                            <div 
                                                                className="absolute left-0 top-0 h-full rounded-full bg-foreground animate-bar-fill group-hover:opacity-0" 
                                                                style={{ width: `${Math.max(pct, row.student_count > 0 ? 4 : 0)}%` }} 
                                                            />
                                                            {/* Hover replay bar - animates on hover */}
                                                            <div 
                                                                className="absolute left-0 top-0 h-full rounded-full bg-foreground hidden group-hover:block animate-bar-fill" 
                                                                style={{ width: `${Math.max(pct, row.student_count > 0 ? 4 : 0)}%` }} 
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Notices */}
                    <div className="lg:col-span-4 bg-muted/30 rounded-2xl p-7 border border-border/50 shadow-none flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-base font-bold text-foreground font-heading tracking-tight">Latest Notices</h3>
                            <Link href="/dashboard/administration/notice" className="text-xs font-semibold text-muted-foreground hover:text-foreground dark:hover:text-foreground transition-colors">See All</Link>
                        </div>
                        <div className="space-y-4 flex-1">
                            {notices.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-sm text-muted-foreground/70 py-8">No published notices</div>
                            ) : notices.map((n, i) => (
                                <div key={i} className="flex items-start gap-3.5 group cursor-pointer">
                                    <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 shadow-sm ${n.color}`} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-foreground leading-snug group-hover:text-muted-foreground transition-colors">{n.title}</p>
                                        <p className="text-[11px] font-medium text-muted-foreground/70 mt-1">{n.date}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Upcoming Exams */}
                    <div className="lg:col-span-4 bg-card rounded-2xl p-7 border border-border/50 shadow-none flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-base font-bold text-foreground font-heading tracking-tight">Upcoming Exams</h3>
                            <Link href="/dashboard/exams" className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                                View All <ArrowRight size={14} strokeWidth={2} />
                            </Link>
                        </div>
                        <div className="space-y-4 flex-1">
                            {upcomingExams.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-sm text-muted-foreground/70 py-8">No upcoming exams</div>
                            ) : upcomingExams.map((e, i) => (
                                <div key={i} className="flex items-center gap-4 group cursor-pointer bg-muted/30 hover:bg-muted/50 p-3 rounded-2xl transition-colors border border-transparent hover:border-border/50">
                                    <div className="h-10 w-10 rounded-xl bg-card border border-border/50 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform"><BookOpen size={18} strokeWidth={1.5} className="text-foreground" /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate">{e.subject}</p>
                                        <div className="flex items-center gap-1.5 mt-1"><Clock size={12} strokeWidth={2} className="text-muted-foreground/80" /><span className="text-[11px] font-medium text-muted-foreground/80">{e.date}</span></div>
                                    </div>
                                    <span className="text-[10px] font-bold bg-muted text-muted-foreground px-2.5 py-1 rounded-md">{e.className}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Attendance Chart */}
                    <div className="lg:col-span-8 bg-card rounded-2xl p-7 border border-border/50 shadow-none flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-base font-bold text-foreground font-heading tracking-tight">Attendance Snapshot</h3>
                        </div>
                        <div className="flex-1 min-h-[220px]">
                            <Suspense fallback={<div className="h-full w-full rounded-2xl bg-muted/50 animate-pulse" />}>
                                <AttendanceChart data={attendanceData} label={attendanceLabel} />
                            </Suspense>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

