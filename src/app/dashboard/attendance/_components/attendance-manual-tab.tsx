"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STUDENT_COLUMNS } from "@/lib/supabase/select-columns";
import type { Student } from "@/lib/database.types";
import type { AttendanceFilterState } from "./attendance-filters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, Save, Loader2, PenLine, CheckCircle2, RotateCcw } from "lucide-react";

type CellStatus = "P" | "A" | null;
type AttendanceGrid = Map<string, Map<number, CellStatus>>; // student_id -> day -> status

type Props = {
    filters: AttendanceFilterState;
    onSaveComplete?: () => void;
};

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

function pad2(n: number): string {
    return n.toString().padStart(2, "0");
}

export function AttendanceManualTab({ filters, onSaveComplete }: Props) {
    const supabase = useMemo(() => createClient(), []);
    const { selectedClass, selectedSection, year, month } = filters;
    const daysInMonth = getDaysInMonth(year, month);

    const [students, setStudents] = useState<Student[]>([]);
    const [grid, setGrid] = useState<AttendanceGrid>(new Map());
    const [originalGrid, setOriginalGrid] = useState<AttendanceGrid>(new Map());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [hasChanges, setHasChanges] = useState(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load students + existing attendance data
    const loadData = useCallback(async () => {
        if (!selectedClass || !selectedSection) return;
        setLoading(true);
        try {
            const [studentsRes, attRes] = await Promise.all([
                supabase
                    .from("students")
                    .select(STUDENT_COLUMNS)
                    .eq("class_id", selectedClass)
                    .eq("section_id", selectedSection)
                    .order("roll"),
                supabase
                    .from("attendance_records")
                    .select("student_id,att_date,status")
                    .eq("class_id", selectedClass)
                    .eq("section_id", selectedSection)
                    .gte("att_date", `${year}-${pad2(month)}-01`)
                    .lte("att_date", `${year}-${pad2(month)}-${pad2(daysInMonth)}`),
            ]);

            const stuList = (studentsRes.data || []).sort((a: Student, b: Student) => {
                const na = parseInt(a.roll), nb = parseInt(b.roll);
                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                return a.roll.localeCompare(b.roll);
            });
            setStudents(stuList);

            // Build grid from existing records
            const newGrid: AttendanceGrid = new Map();
            for (const stu of stuList) {
                newGrid.set(stu.id, new Map());
            }
            for (const rec of (attRes.data || []) as { student_id: string; att_date: string; status: string }[]) {
                const day = new Date(rec.att_date).getDate();
                const studentMap = newGrid.get(rec.student_id);
                if (studentMap) {
                    studentMap.set(day, rec.status as CellStatus);
                }
            }
            setGrid(newGrid);
            // Deep copy for change detection
            const copy: AttendanceGrid = new Map();
            for (const [sid, dayMap] of newGrid) {
                copy.set(sid, new Map(dayMap));
            }
            setOriginalGrid(copy);
            setHasChanges(false);
        } catch {
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    }, [supabase, selectedClass, selectedSection, year, month, daysInMonth]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    // Toggle cell status
    const toggleCell = useCallback((studentId: string, day: number) => {
        setGrid((prev) => {
            const next = new Map(prev);
            const studentMap = new Map(next.get(studentId) || new Map());
            const current = studentMap.get(day);
            // Cycle: null -> P -> A -> null
            let newStatus: CellStatus;
            if (current === null || current === undefined) newStatus = "P";
            else if (current === "P") newStatus = "A";
            else newStatus = null;

            if (newStatus === null) {
                studentMap.delete(day);
            } else {
                studentMap.set(day, newStatus);
            }
            next.set(studentId, studentMap);
            return next;
        });
        setHasChanges(true);
    }, []);

    // Mark all present / all absent for a day
    const markAllForDay = useCallback((day: number, status: "P" | "A") => {
        setGrid((prev) => {
            const next = new Map(prev);
            for (const [sid, dayMap] of next) {
                const newDayMap = new Map(dayMap);
                newDayMap.set(day, status);
                next.set(sid, newDayMap);
            }
            return next;
        });
        setHasChanges(true);
    }, []);

    // Save changes
    const saveChanges = useCallback(async () => {
        if (!selectedClass || !selectedSection) return;
        setSaving(true);
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            let accessToken = session?.access_token || "";
            if (!accessToken) {
                const { data: refreshed } = await supabase.auth.refreshSession();
                accessToken = refreshed.session?.access_token || "";
            }

            // Collect all non-null cells as records
            const records: { student_id: string; class_id: string; section_id: string; att_date: string; status: "P" | "A" }[] = [];
            for (const [studentId, dayMap] of grid) {
                for (const [day, status] of dayMap) {
                    if (status) {
                        records.push({
                            student_id: studentId,
                            class_id: selectedClass,
                            section_id: selectedSection,
                            att_date: `${year}-${pad2(month)}-${pad2(day)}`,
                            status,
                        });
                    }
                }
            }

            if (records.length === 0) {
                toast.info("No attendance data to save");
                setSaving(false);
                return;
            }

            const res = await fetch("/api/attendance/batch", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({ records }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "Save failed");
                return;
            }
            toast.success(`Saved ${json.data.upserted} attendance records`);
            setHasChanges(false);
            // Update original grid
            const copy: AttendanceGrid = new Map();
            for (const [sid, dayMap] of grid) {
                copy.set(sid, new Map(dayMap));
            }
            setOriginalGrid(copy);
            onSaveComplete?.();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Save failed");
        } finally {
            setSaving(false);
        }
    }, [supabase, grid, selectedClass, selectedSection, year, month, onSaveComplete]);

    // Filter students
    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(
            (s) => s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q)
        );
    }, [students, searchQuery]);

    if (!selectedClass || !selectedSection) {
        return (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
                <PenLine className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">Select a class and section to enter attendance manually</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-10 w-48 rounded-lg bg-slate-100 animate-pulse" />
                <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />
            </div>
        );
    }

    if (students.length === 0) {
        return (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
                <p className="text-sm text-slate-400">No students found for this class/section</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative max-w-xs flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search student..."
                        className="pl-9 h-9 rounded-lg bg-white border-slate-200 text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1 mr-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Unsaved changes
                        </span>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void loadData()}
                        disabled={saving}
                        className="h-8 rounded-lg text-xs"
                    >
                        <RotateCcw className="h-3 w-3 mr-1.5" />
                        Reset
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => void saveChanges()}
                        disabled={saving || !hasChanges}
                        className="h-8 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            <>
                                <Save className="h-3 w-3 mr-1.5" />
                                Save All
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Tip */}
            <p className="text-[10px] text-muted-foreground">
                Tip: Click a cell to toggle: <span className="text-emerald-600 font-semibold">Present</span> →{" "}
                <span className="text-red-600 font-semibold">Absent</span> → Empty. Click a day header to mark all.
            </p>

            {/* Grid */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50/80">
                                <th className="sticky left-0 z-20 bg-slate-50/95 backdrop-blur-sm text-left py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px] min-w-[50px] border-r border-slate-100">
                                    Roll
                                </th>
                                <th className="sticky left-[50px] z-20 bg-slate-50/95 backdrop-blur-sm text-left py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px] min-w-[120px] border-r border-slate-100">
                                    Name
                                </th>
                                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                                    <th
                                        key={d}
                                        className="text-center py-2.5 px-0 font-semibold text-slate-400 w-[32px] min-w-[32px] cursor-pointer hover:text-blue-600 transition-colors"
                                        title={`Click to mark all Present for day ${d}. Ctrl+Click for all Absent.`}
                                        onClick={(e) => {
                                            markAllForDay(d, e.ctrlKey || e.metaKey ? "A" : "P");
                                        }}
                                    >
                                        {d}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((student, idx) => {
                                const dayMap = grid.get(student.id) || new Map();
                                return (
                                    <tr
                                        key={student.id}
                                        className={`border-t border-slate-50 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                                    >
                                        <td className="sticky left-0 z-10 bg-inherit py-1.5 px-3 font-mono font-semibold text-slate-600 border-r border-slate-50 text-[11px]">
                                            {student.roll}
                                        </td>
                                        <td className="sticky left-[50px] z-10 bg-inherit py-1.5 px-3 font-medium text-slate-700 truncate max-w-[120px] border-r border-slate-50 text-[11px]">
                                            {student.name}
                                        </td>
                                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                                            const status = dayMap.get(d);
                                            const origStatus = originalGrid.get(student.id)?.get(d);
                                            const isChanged = status !== origStatus;
                                            return (
                                                <td
                                                    key={d}
                                                    className={`text-center py-1.5 px-0 cursor-pointer select-none transition-all duration-100 ${
                                                        isChanged ? "ring-1 ring-blue-300 ring-inset" : ""
                                                    }`}
                                                    onClick={() => toggleCell(student.id, d)}
                                                >
                                                    {status === "P" ? (
                                                        <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-md bg-emerald-100 text-emerald-700 font-bold text-[10px] hover:bg-emerald-200 transition-colors">
                                                            P
                                                        </span>
                                                    ) : status === "A" ? (
                                                        <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-md bg-red-100 text-red-600 font-bold text-[10px] hover:bg-red-200 transition-colors">
                                                            A
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-md hover:bg-slate-100 text-slate-200 text-[10px] transition-colors">
                                                            ·
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{filtered.length} student{filtered.length !== 1 ? "s" : ""}</span>
                    <span className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-emerald-100 text-emerald-700 font-bold text-[8px]">P</span>
                            Present
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-red-100 text-red-600 font-bold text-[8px]">A</span>
                            Absent
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-slate-300 font-bold text-[8px]">·</span>
                            Empty
                        </span>
                    </span>
                </div>
            </div>
        </div>
    );
}
