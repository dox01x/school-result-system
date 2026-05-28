"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AttendanceFilterState } from "./attendance-filters";
import { ATTENDANCE_COLUMNS } from "@/lib/supabase/select-columns";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Users, CalendarCheck, AlertTriangle, TrendingUp } from "lucide-react";

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
    if (rate >= 90) return "text-emerald-600";
    if (rate >= 75) return "text-amber-600";
    return "text-red-600";
}

function rateBg(rate: number): string {
    if (rate >= 90) return "bg-emerald-50 border-emerald-200";
    if (rate >= 75) return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
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
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
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
                        <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
                    ))}
                </div>
                <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "School Days", value: stats.totalDays, icon: CalendarCheck, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
                    { label: "Avg. Attendance", value: `${stats.avgRate}%`, icon: TrendingUp, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
                    { label: "100% Attendance", value: stats.perfect, icon: Users, iconBg: "bg-violet-50", iconColor: "text-violet-600" },
                    { label: "Below 75%", value: stats.below75, icon: AlertTriangle, iconBg: "bg-red-50", iconColor: "text-red-500" },
                ].map((c) => (
                    <div key={c.label} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className={`${c.iconBg} rounded-lg p-2 shrink-0`}>
                                <c.icon className={`h-4 w-4 ${c.iconColor}`} strokeWidth={1.8} />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-slate-800 tabular-nums leading-tight">{c.value}</p>
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{c.label}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or roll..."
                    className="pl-9 h-9 rounded-lg bg-white border-slate-200 text-sm"
                />
            </div>

            {/* Calendar Grid */}
            {filtered.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                    <p className="text-sm text-slate-400">
                        {studentSummaries.length === 0
                            ? "No attendance data for this month"
                            : "No students match your search"}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-slate-50/80">
                                    <th className="sticky left-0 z-20 bg-slate-50/95 backdrop-blur-sm text-left py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px] min-w-[50px] border-r border-slate-100">
                                        Roll
                                    </th>
                                    <th className="sticky left-[50px] z-20 bg-slate-50/95 backdrop-blur-sm text-left py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px] min-w-[140px] border-r border-slate-100">
                                        Student
                                    </th>
                                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                                        <th
                                            key={d}
                                            className="text-center py-2.5 px-0 font-semibold text-slate-400 w-[30px] min-w-[30px]"
                                        >
                                            {d}
                                        </th>
                                    ))}
                                    <th className="sticky right-0 z-20 bg-slate-50/95 backdrop-blur-sm text-center py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px] min-w-[52px] border-l border-slate-100">
                                        Rate
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((student, idx) => (
                                    <tr
                                        key={student.id}
                                        className={`border-t border-slate-50 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                                    >
                                        <td className="sticky left-0 z-10 bg-inherit py-2 px-3 font-mono font-semibold text-slate-600 border-r border-slate-50 text-[11px]">
                                            {student.roll}
                                        </td>
                                        <td className="sticky left-[50px] z-10 bg-inherit py-2 px-3 font-medium text-slate-700 truncate max-w-[140px] border-r border-slate-50 text-[11px]">
                                            {student.name}
                                        </td>
                                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                                            const status = student.days.get(d);
                                            return (
                                                <td key={d} className="text-center py-2 px-0">
                                                    {status === "P" ? (
                                                        <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-emerald-100 text-emerald-600 font-bold text-[9px]" title={`Day ${d}: Present`}>
                                                            ●
                                                        </span>
                                                    ) : status === "A" ? (
                                                        <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-100 text-red-500 font-bold text-[9px]" title={`Day ${d}: Absent`}>
                                                            ●
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex h-[18px] w-[18px] items-center justify-center text-slate-200 text-[9px]">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className={`sticky right-0 z-10 bg-inherit text-center py-2 px-3 font-bold tabular-nums border-l border-slate-50 ${rateColor(student.rate)}`}>
                                            {student.rate > 0 ? `${student.rate}%` : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer summary */}
                    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">
                            {filtered.length} student{filtered.length !== 1 ? "s" : ""} • {stats.totalDays} school day{stats.totalDays !== 1 ? "s" : ""}
                        </span>
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                Present
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                                Absent
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block h-1.5 w-3 rounded bg-slate-200" />
                                No Data
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Below 75% Alert */}
            {stats.below75 > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-amber-800">Low Attendance Alert</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                {stats.below75} student{stats.below75 !== 1 ? "s have" : " has"} attendance below 75% this month:
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {studentSummaries
                                    .filter((s) => s.rate < 75 && s.rate > 0)
                                    .map((s) => (
                                        <span
                                            key={s.id}
                                            className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${rateBg(s.rate)}`}
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
