import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
    ArrowRight, BookOpen, Clock, Sparkles, School,
    PenLine, BarChart3, GraduationCap,
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
        if (p === "high" || p === "urgent") return "bg-red-500";
        if (p === "medium") return "bg-blue-500";
        return "bg-emerald-500";
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
            <PromotionBanner academicYear={school?.current_academic_year} />

            {/* Welcome Banner */}
            <Suspense fallback={<div className="animate-pulse rounded-2xl bg-muted h-28 w-full" />}>
                <WelcomeBanner
                    schoolLogoUrl={school?.logo_url}
                    academicYear={school?.current_academic_year}
                />
            </Suspense>

            {/* Empty State */}
            {isEmpty && (
                <div className="bg-card rounded-2xl border-2 border-dashed border-border p-12 text-center">
                    <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 mx-auto"><Sparkles className="h-6 w-6 text-blue-500" /></div>
                    <h2 className="text-lg font-bold text-slate-800 font-heading mb-1">Welcome to ResultPro!</h2>
                    <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">Your school management system is ready. Start by creating your first class.</p>
                    <div className="flex gap-3 justify-center">
                        <Link href="/dashboard/classes" className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold rounded-xl px-5 py-2.5 hover:bg-blue-700 transition-all btn-press text-sm">
                            <School className="h-4 w-4" /> Create First Class <ArrowRight className="h-4 w-4" />
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

            {/* Middle Row */}
            {!isEmpty && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Student Distribution Table */}
                    <div className="lg:col-span-2 bg-card rounded-2xl p-5 border border-border shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-800 font-heading">Section Distribution</h3>
                            <Link href="/dashboard/students" className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 btn-press">
                                View All <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                        {sectionRows.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-8">No sections yet</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-[11px] text-slate-400 border-b border-slate-50 uppercase tracking-wider">
                                            <th className="text-left py-2.5 pr-4 font-medium">Class</th>
                                            <th className="text-left py-2.5 px-4 font-medium">Count</th>
                                            <th className="text-left py-2.5 pl-4 font-medium w-1/3">Distribution</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sectionRows.slice(0, 7).map((row) => {
                                            const pct = maxCount > 0 ? (row.student_count / maxCount) * 100 : 0;
                                            return (
                                                <tr key={`${row.class_name}-${row.section_name}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-3 pr-4">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                                                <span className="text-[10px] font-bold text-blue-600">{row.class_name.replace(/[^0-9]/g, "").slice(0, 2) || "C"}</span>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-medium text-slate-700">{row.class_name}</p>
                                                                <p className="text-[10px] text-slate-400">{row.section_name}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4"><span className="text-xs font-semibold text-slate-700 tabular-nums">{row.student_count}</span></td>
                                                    <td className="py-3 pl-4">
                                                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                            <div className="h-full rounded-full bg-blue-500 animate-bar-fill" style={{ width: `${Math.max(pct, row.student_count > 0 ? 4 : 0)}%` }} />
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
                    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-800 font-heading">Latest Notices</h3>
                            <Link href="/dashboard/administration/notice" className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors btn-press">See All</Link>
                        </div>
                        <div className="space-y-0">
                            {notices.length === 0 ? (
                                <p className="text-sm text-slate-400 py-8 text-center">No published notices</p>
                            ) : notices.map((n, i) => (
                                <div key={i} className={`flex items-start gap-3 py-3 ${i < notices.length - 1 ? "border-b border-slate-50" : ""}`}>
                                    <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.color}`} />
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-slate-600 leading-snug">{n.title}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{n.date}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Row */}
            {!isEmpty && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Upcoming Exams */}
                    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-800 font-heading">Upcoming Exams</h3>
                            <Link href="/dashboard/exams" className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 btn-press">View All <ArrowRight className="h-3 w-3" /></Link>
                        </div>
                        {upcomingExams.length === 0 ? (
                            <p className="text-sm text-slate-400 py-8 text-center">No upcoming exam schedule</p>
                        ) : upcomingExams.map((e, i) => (
                            <div key={i} className={`flex items-center gap-3 py-3 ${i < upcomingExams.length - 1 ? "border-b border-slate-50" : ""}`}>
                                <div className="h-9 w-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0"><BookOpen className="h-4 w-4 text-violet-500" strokeWidth={1.8} /></div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-700">{e.subject}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5"><Clock className="h-3 w-3 text-slate-400" /><span className="text-[10px] text-slate-400">{e.date}</span></div>
                                </div>
                                <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{e.className}</span>
                            </div>
                        ))}
                    </div>

                    {/* Attendance Chart */}
                    <Suspense fallback={<div className="bg-card rounded-2xl p-5 border border-border shadow-sm h-48 animate-pulse" />}>
                        <AttendanceChart data={attendanceData} label={attendanceLabel} />
                    </Suspense>
                </div>
            )}

            {/* Quick Actions */}
            {!isEmpty && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { href: "/dashboard/marks", icon: PenLine, title: "Enter Marks", bg: "bg-blue-50", color: "text-blue-600" },
                        { href: "/dashboard/results", icon: BarChart3, title: "View Results", bg: "bg-emerald-50", color: "text-emerald-600" },
                        { href: "/dashboard/students", icon: GraduationCap, title: "Students", bg: "bg-violet-50", color: "text-violet-600" },
                        { href: "/dashboard/settings", icon: School, title: "Settings", bg: "bg-rose-50", color: "text-rose-500" },
                    ].map((a) => (
                        <Link key={a.href} href={a.href}>
                            <div className="bg-card rounded-2xl p-4 border border-border shadow-sm hover-lift cursor-pointer text-center group">
                                <div className={`${a.bg} h-9 w-9 rounded-xl flex items-center justify-center mx-auto mb-2`}><a.icon className={`h-4 w-4 ${a.color}`} strokeWidth={1.8} /></div>
                                <p className="text-xs font-medium text-slate-600 group-hover:text-slate-800">{a.title}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
