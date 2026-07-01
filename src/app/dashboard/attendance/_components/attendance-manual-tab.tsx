"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STUDENT_COLUMNS } from "@/lib/supabase/select-columns";
import type { Student } from "@/lib/database.types";
import type { AttendanceFilterState } from "./attendance-filters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search as MagnifyingGlass, Save as FloppyDisk, Loader2 as SpinnerGap, Pencil as PencilSimpleLine, CheckCircle, RotateCcw as ArrowCounterClockwise } from "lucide-react";

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
    const supabase = useMemo(() => createClient() as any, []);
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

    // Funnels students
    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(
            (s) => s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q)
        );
    }, [students, searchQuery]);

    if (!selectedClass || !selectedSection) {
        return (
            <div className="rounded-2xl border-2 border-dashed border-border/50 p-12 text-center">
                <PencilSimpleLine size={40} strokeWidth={1.5} className="text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">Select a class and section to enter attendance manually</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-10 w-48 rounded-lg bg-muted animate-pulse" />
                <div className="h-64 rounded-xl bg-muted animate-pulse" />
            </div>
        );
    }

    if (students.length === 0) {
        return (
            <div className="rounded-2xl border-2 border-dashed border-border/50 p-12 text-center">
                <p className="text-sm text-slate-400">No students found for this class/section</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative max-w-xs flex-1">
                    <MagnifyingGlass size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search student..."
                        className="pl-9 h-11 rounded-xl bg-muted border-0 text-sm font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <span className="text-[10px] text-amber-600 font-bold uppercase tracking-widest flex items-center gap-1.5 mr-2">
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            Unsaved changes
                        </span>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => void loadData()}
                        disabled={saving}
                        className="h-11 rounded-xl border-border/50 bg-white hover:bg-muted/50 text-muted-foreground font-bold shadow-none"
                    >
                        <ArrowCounterClockwise size={16} strokeWidth={2} className="mr-2" />
                        Reset
                    </Button>
                    <Button
                        onClick={() => void saveChanges()}
                        disabled={saving || !hasChanges}
                        className="h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-none px-6"
                    >
                        {saving ? (
                            <>
                                <SpinnerGap size={16} strokeWidth={2} className="mr-2 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            <>
                                <FloppyDisk size={16} strokeWidth={2} className="mr-2" />
                                Save All
                            </>
                        )}
                    </Button>
                </div>
            </div>


            {/* Grid */}
            <div className="bg-card rounded-2xl border border-border/50 shadow-none overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="sticky left-0 z-20 bg-muted/50 text-left py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px] min-w-[50px] border-r border-border/50">
                                    Roll
                                </th>
                                <th className="sticky left-[66px] z-20 bg-muted/50 text-left py-3 px-4 font-bold text-muted-foreground uppercase tracking-widest text-[10px] min-w-[120px] border-r border-border/50">
                                    Name
                                </th>
                                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                                    <th
                                        key={d}
                                        className="text-center py-3 px-0 font-bold text-muted-foreground/60 w-[32px] min-w-[32px] cursor-pointer hover:text-foreground transition-colors"
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
                                        className={`border-t border-border/50 hover:bg-muted/50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-muted/50/30"}`}
                                    >
                                        <td className="sticky left-0 z-10 bg-inherit py-2 px-4 font-mono font-bold text-muted-foreground border-r border-border/50 text-[11px]">
                                            {student.roll}
                                        </td>
                                        <td className="sticky left-[66px] z-10 bg-inherit py-2 px-4 font-bold text-foreground truncate max-w-[120px] border-r border-border/50 text-[11px]">
                                            {student.name}
                                        </td>
                                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                                            const status = dayMap.get(d);
                                            const origStatus = originalGrid.get(student.id)?.get(d);
                                            const isChanged = status !== origStatus;
                                            return (
                                                <td
                                                    key={d}
                                                    className={`text-center py-2 px-0 cursor-pointer select-none transition-all duration-100 ${
                                                        isChanged ? "bg-blue-50/50" : ""
                                                    }`}
                                                    onClick={() => toggleCell(student.id, d)}
                                                >
                                                    {status === "P" ? (
                                                        <span className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-lg bg-muted text-foreground font-black text-[10px] hover:bg-muted/80 transition-colors">
                                                            P
                                                        </span>
                                                    ) : status === "A" ? (
                                                        <span className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-lg bg-red-100 text-red-600 font-black text-[10px] hover:bg-red-200 transition-colors">
                                                            A
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-lg hover:bg-muted text-muted-foreground/30 text-[10px] transition-colors">
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
                <div className="border-t border-border/50 bg-muted/50 px-4 py-3 flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                    <span>{filtered.length} student{filtered.length !== 1 ? "s" : ""}</span>

                </div>
            </div>
        </div>
    );
}
