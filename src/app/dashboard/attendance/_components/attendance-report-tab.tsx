"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AttendanceFilterState } from "./attendance-filters";
import { ATTENDANCE_COLUMNS } from "@/lib/supabase/select-columns";
import { Input } from "@/components/ui/input";
import { Loader2 as SpinnerGap, Search as MagnifyingGlass, Users, CalendarCheck, AlertTriangle as Warning, TrendingUp as TrendUp } from "lucide-react";

type AttRow = {
    id: string;
    student_id: string;
    att_date: string;
    status: string;
    students?: { name: string; roll: string } | null;
};

type StudentSummary = {
    id: string;
    name: string;
    roll: string;
    days: Map<number, "P" | "A">;
    present: number;
    absent: number;
    rate: number;
};

type Props = {
    filters: AttendanceFilterState;
};

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

function rateColor(rate: number): string {
    if (rate >= 90) return "text-muted-foreground";
    if (rate >= 75) return "text-muted-foreground";
    return "text-red-500";
}

function rateBg(rate: number): string {
    if (rate >= 90) return "bg-muted/50 text-foreground";
    if (rate >= 75) return "bg-muted text-foreground";
    return "bg-red-50 text-red-700";
}

export function AttendanceReportTab({ filters }: Props) {
    const supabase = useMemo(() => createClient(), []);
    const [rows, setRows] = useState<AttRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const { selectedClass, selectedSection, year, month } = filters;
    const daysInMonth = getDaysInMonth(year, month);

    const fetchData = useCallback(async () => {
        if (!selectedClass || !selectedSection) return;
        setLoading(true);
        try {
            const monthStr = String(month).padStart(2, "0");
            const start = `${year}-${monthStr}-01`;
            const lastDay = getDaysInMonth(year, month);
            const end = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

            const { data, error } = await supabase
                .from("attendance_records")
                .select(`${ATTENDANCE_COLUMNS},students(name,roll)`)
                .eq("class_id", selectedClass)
                .eq("section_id", selectedSection)
                .gte("att_date", start)
                .lte("att_date", end)
                .order("att_date");
            if (error) throw error;
            setRows((data as AttRow[]) || []);
        } catch {
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [supabase, selectedClass, selectedSection, year, month]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const studentSummaries = useMemo<StudentSummary[]>(() => {
        const map = new Map<string, StudentSummary>();
        for (const row of rows) {
            let s = map.get(row.student_id);
            if (!s) {
                s = {
                    id: row.student_id,
                    name: row.students?.name || "Student",
                    roll: row.students?.roll || "—",
                    days: new Map(),
                    present: 0,
                    absent: 0,
                    rate: 0,
                };
                map.set(row.student_id, s);
            }
            const day = new Date(row.att_date).getDate();
            const status = row.status as "P" | "A";
            s.days.set(day, status);
            if (status === "P") s.present++;
            else if (status === "A") s.absent++;
        }
        for (const s of map.values()) {
            const total = s.present + s.absent;
            s.rate = total > 0 ? Math.round((s.present / total) * 100) : 0;
        }
        return Array.from(map.values()).sort((a, b) =>
            a.roll.localeCompare(b.roll, undefined, { numeric: true })
        );
    }, [rows]);

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return studentSummaries;
        const q = searchQuery.toLowerCase();
        return studentSummaries.filter(
            (s) => s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q)
        );
    }, [studentSummaries, searchQuery]);

    // Stats
    const stats = useMemo(() => {
        const totalStudents = studentSummaries.length;
        const totalDays = new Set(rows.map((r) => r.att_date)).size;
        const avgRate = totalStudents > 0
            ? Math.round(studentSummaries.reduce((a, s) => a + s.rate, 0) / totalStudents)
            : 0;
        const perfect = studentSummaries.filter((s) => s.rate === 100).length;
        const below75 = studentSummaries.filter((s) => s.rate < 75 && s.rate > 0).length;
        return { totalStudents, totalDays, avgRate, perfect, below75 };
    }, [studentSummaries, rows]);

    if (!selectedClass || !selectedSection) {
        return (
            <div className="rounded-2xl border-2 border-dashed border-border/50 p-12 text-center">
                <CalendarCheck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">Select a class and section to view attendance</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
                    ))}
                </div>
                <div className="h-64 rounded-xl bg-muted animate-pulse" />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "School Days", value: stats.totalDays, icon: CalendarCheck, iconBg: "bg-muted", iconColor: "text-foreground" },
                    { label: "Avg. Attendance", value: `${stats.avgRate}%`, icon: TrendUp, iconBg: "bg-muted", iconColor: "text-muted-foreground" },
                    { label: "100% Attendance", value: stats.perfect, icon: Users, iconBg: "bg-muted/50", iconColor: "text-muted-foreground" },
                    { label: "Below 75%", value: stats.below75, icon: Warning, iconBg: "bg-muted/50", iconColor: "text-muted-foreground/60" },
                ].map((c) => (
                    <div key={c.label} className="bg-card rounded-2xl p-4 border border-border/50 shadow-none">
                        <div className="flex items-center gap-3">
                            <div className={`${c.iconBg} rounded-xl p-2.5 shrink-0`}>
                                <c.icon size={20} strokeWidth={2} className={`${c.iconColor}`} />
                            </div>
                            <div>
                                <p className="text-xl font-black text-foreground tabular-nums leading-tight">{c.value}</p>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{c.label}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* MagnifyingGlass */}
            <div className="relative max-w-xs">
                <MagnifyingGlass size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or roll..."
                    className="pl-9 h-11 rounded-xl bg-muted border-0 text-sm font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none"
                />
            </div>

            {/* Calendar Grid */}
            {filtered.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border/50 p-8 text-center">
                    <p className="text-sm text-slate-400">
                        {studentSummaries.length === 0
                            ? "No attendance data for this month"
                            : "No students match your search"}
                    </p>
                </div>
            ) : (
                <div className="bg-card rounded-2xl border border-border/50 shadow-none overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-muted/50">
                                    <th className="sticky left-0 z-20 bg-muted/50 text-left py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px] min-w-[50px] border-r border-border/50">
                                        Roll
                                    </th>
                                    <th className="sticky left-[66px] z-20 bg-muted/50 text-left py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px] min-w-[140px] border-r border-border/50">
                                        Student
                                    </th>
                                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                                        <th
                                            key={d}
                                            className="text-center py-3 px-0 font-bold text-muted-foreground/60 w-[30px] min-w-[30px]"
                                        >
                                            {d}
                                        </th>
                                    ))}
                                    <th className="sticky right-0 z-20 bg-muted/50 text-center py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px] min-w-[52px] border-l border-border/50">
                                        Rate
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((student, idx) => (
                                    <tr
                                        key={student.id}
                                        className={`border-t border-border/50 hover:bg-muted/50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-muted/50/30"}`}
                                    >
                                        <td className="sticky left-0 z-10 bg-inherit py-2.5 px-4 font-mono font-bold text-muted-foreground border-r border-border/50 text-[11px]">
                                            {student.roll}
                                        </td>
                                        <td className="sticky left-[66px] z-10 bg-inherit py-2.5 px-4 font-bold text-foreground truncate max-w-[140px] border-r border-border/50 text-[11px]">
                                            {student.name}
                                        </td>
                                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                                            const status = student.days.get(d);
                                            return (
                                                <td key={d} className="text-center py-2.5 px-0">
                                                    {status === "P" ? (
                                                        <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-muted text-foreground font-black text-[9px]" title={`Day ${d}: Present`}>
                                                            ●
                                                        </span>
                                                    ) : status === "A" ? (
                                                        <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-100 text-red-500 font-black text-[9px]" title={`Day ${d}: Absent`}>
                                                            ●
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex h-[18px] w-[18px] items-center justify-center text-muted-foreground/30 text-[9px]">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className={`sticky right-0 z-10 bg-inherit text-center py-2.5 px-4 font-black tabular-nums border-l border-border/50 ${rateColor(student.rate)}`}>
                                            {student.rate > 0 ? `${student.rate}%` : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer summary */}
                    <div className="border-t border-border/50 bg-muted/50 px-4 py-3 flex items-center justify-between text-[11px] font-bold">
                        <span className="text-muted-foreground tracking-tight">
                            {filtered.length} student{filtered.length !== 1 ? "s" : ""} • {stats.totalDays} school day{stats.totalDays !== 1 ? "s" : ""}
                        </span>
                        <div className="flex items-center gap-4 text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
                                Present
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                                Absent
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block h-1.5 w-3 rounded bg-muted" />
                                No Data
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Below 75% Alert */}
            {stats.below75 > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-none">
                    <div className="flex items-start gap-3">
                        <Warning size={18} strokeWidth={2} className="text-red-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-red-900 tracking-tight">Low Attendance Alert</p>
                            <p className="text-xs font-bold text-red-700/80 mt-1">
                                {stats.below75} student{stats.below75 !== 1 ? "s have" : " has"} attendance below 75% this month:
                            </p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {studentSummaries
                                    .filter((s) => s.rate < 75 && s.rate > 0)
                                    .map((s) => (
                                        <span
                                            key={s.id}
                                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border-0 shadow-sm ${rateBg(s.rate)}`}
                                        >
                                            {s.name} ({s.rate}%)
                                        </span>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
