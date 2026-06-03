"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Search,
    Loader2,
    GraduationCap,
    User,
    School,
    BookOpen,
    ClipboardList,
    Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GlobalSearchHit } from "@/lib/global-search-types";
import { createClient } from "@/lib/supabase/client";
import { STUDENT_COLUMNS } from "@/lib/supabase/select-columns";
import type { Student, Teacher } from "@/lib/database.types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const typeIcons: Record<GlobalSearchHit["type"], typeof GraduationCap> = {
    student: GraduationCap,
    teacher: User,
    class: School,
    subject: BookOpen,
    exam: ClipboardList,
    notice: Megaphone,
};

const typeLabel: Record<GlobalSearchHit["type"], string> = {
    student: "Student",
    teacher: "Teacher",
    class: "Class",
    subject: "Subject",
    exam: "Exam",
    notice: "Notice",
};

export function GlobalSearch() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<GlobalSearchHit[]>([]);
    const [focused, setFocused] = useState(false);
    const [studentOpen, setStudentOpen] = useState(false);
    const [studentLoading, setStudentLoading] = useState(false);
    const [student, setStudent] = useState<Student | null>(null);
    const [studentAttendanceRows, setStudentAttendanceRows] = useState<{ att_date: string; status: string }[]>([]);
    const [studentAttendanceLoading, setStudentAttendanceLoading] = useState(false);
    const [teacherOpen, setTeacherOpen] = useState(false);
    const [teacherLoading, setTeacherLoading] = useState(false);
    const [teacher, setTeacher] = useState<Teacher | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

    if (!supabaseRef.current) {
        supabaseRef.current = createClient();
    }

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setFocused(false);
            }
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    useEffect(() => {
        if (!studentOpen || !student) {
            setStudentAttendanceRows([]);
            return;
        }
        let cancelled = false;
        setStudentAttendanceLoading(true);
        void (async () => {
            const supabase = supabaseRef.current!;
            const { data, error } = await supabase
                .from("attendance_records")
                .select("att_date,status")
                .eq("student_id", student.id)
                .order("att_date", { ascending: false });
            if (!cancelled && !error) {
                setStudentAttendanceRows((data as { att_date: string; status: string }[]) || []);
            }
            if (!cancelled) setStudentAttendanceLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [studentOpen, student]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const q = query.trim();
        if (q.length < 1) {
            setResults([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
                if (!res.ok) {
                    setResults([]);
                    return;
                }
                const data = (await res.json()) as { results?: GlobalSearchHit[] };
                setResults(data.results ?? []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 280);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    const onPick = useCallback(
        async (hit: GlobalSearchHit) => {
            setQuery("");
            setResults([]);
            setFocused(false);

            if (hit.type !== "student" && hit.type !== "teacher") {
                router.push(hit.href);
                return;
            }

            const supabase = supabaseRef.current!;

            if (hit.type === "student") {
                setStudentLoading(true);
                try {
                    const { data, error } = await supabase
                        .from("students")
                        .select(STUDENT_COLUMNS)
                        .eq("id", hit.id)
                        .maybeSingle();
                    if (error || !data) {
                        router.push(hit.href);
                        return;
                    }
                    setStudent(data as unknown as Student);
                    setStudentOpen(true);
                } finally {
                    setStudentLoading(false);
                }
                return;
            }

            setTeacherLoading(true);
            try {
                const { data, error } = await supabase
                    .from("teachers")
                    .select("id,name,email,phone,designation,subject_specialty,employee_type,created_at")
                    .eq("id", hit.id)
                    .maybeSingle();
                if (error || !data) {
                    router.push(hit.href);
                    return;
                }
                setTeacher(data as unknown as Teacher);
                setTeacherOpen(true);
            } finally {
                setTeacherLoading(false);
            }
        },
        [router]
    );

    const showPanel = focused && query.trim().length >= 1;
    const empty = !loading && showPanel && results.length === 0;

    return (
        <div ref={wrapRef} className="relative w-full md:max-w-sm lg:max-w-md min-w-0">
            <div
                className={cn(
                    "flex items-center gap-2 rounded-xl bg-muted/50 border px-3 py-2 text-sm transition-all duration-300 ease-out",
                    focused
                        ? "border-primary/35 shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] w-full"
                        : "border-border/80 w-full md:w-[min(100%,13.5rem)]"
                )}
            >
                <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setFocused(true)}
                    placeholder="Search everything…"
                    autoComplete="off"
                    aria-label="Global search"
                    aria-expanded={showPanel}
                    aria-controls="global-search-results"
                    className="bg-transparent outline-none w-full min-w-0 text-sm text-foreground placeholder:text-muted-foreground"
                />
                <kbd className="hidden xl:inline pointer-events-none select-none rounded border border-border bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                    ⌘K
                </kbd>
            </div>

            {showPanel && (
                <div
                    id="global-search-results"
                    role="listbox"
                    className="absolute top-[calc(100%+6px)] left-0 right-0 z-[100] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg max-h-[min(70vh,22rem)] overflow-y-auto py-1 thin-scrollbar"
                >
                    {loading && (
                        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Searching…
                        </div>
                    )}
                    {empty && (
                        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No matches found.</p>
                    )}
                    {!loading &&
                        results.map((r) => {
                            const Icon = typeIcons[r.type];
                            return (
                                <button
                                    key={`${r.type}-${r.id}`}
                                    type="button"
                                    role="option"
                                    className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/80 transition-colors"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        void onPick(r);
                                    }}
                                >
                                    <div className="mt-0.5 rounded-lg bg-muted p-1.5 shrink-0">
                                        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            {typeLabel[r.type]}
                                            {r.subtitle ? ` · ${r.subtitle}` : ""}
                                        </p>
                                    </div>
                                    {(r.type === "student" && studentLoading) || (r.type === "teacher" && teacherLoading) ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1 shrink-0" />
                                    ) : null}
                                </button>
                            );
                        })}
                </div>
            )}

            <Dialog
                open={studentOpen}
                onOpenChange={(open) => {
                    setStudentOpen(open);
                    if (!open) setStudent(null);
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" /> Student Profile
                        </DialogTitle>
                    </DialogHeader>
                    {student && (
                        <div className="space-y-4 py-4">
                            <div className="relative overflow-hidden rounded-xl border bg-card shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
                                <div className="absolute top-0 inset-x-0 h-20 bg-primary" />
                                <div className="relative pt-10 pb-6 px-6 flex flex-col items-center text-center">
                                    <div className="h-20 w-20 rounded-full border-4 border-card bg-muted flex items-center justify-center text-primary font-bold text-3xl shadow-sm relative z-10">
                                        {student.name.charAt(0).toUpperCase()}
                                    </div>
                                    <h3 className="mt-3 font-bold text-[19px] text-foreground tracking-tight leading-tight">
                                        {student.name}
                                    </h3>
                                    <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                                        <Badge
                                            variant="secondary"
                                            className="bg-slate-100 hover:bg-slate-100 text-slate-600 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5"
                                        >
                                            Roll: {student.roll}
                                        </Badge>
                                        {student.student_id && (
                                            <Badge
                                                variant="secondary"
                                                className="bg-primary/10 hover:bg-primary/10 text-primary font-mono text-[10px] uppercase tracking-wider px-2 py-0.5"
                                            >
                                                ID: {student.student_id}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {[
                                    { label: "Gender", value: student.gender },
                                    { label: "Date of Birth", value: student.date_of_birth },
                                    { label: "Father's Name", value: student.father_name },
                                    { label: "Mother's Name", value: student.mother_name },
                                    { label: "Phone", value: student.phone },
                                    { label: "Blood Group", value: student.blood_group },
                                    { label: "Group", value: student.group_name || "General" },
                                ].map((item) => (
                                    <div key={item.label} className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground">{item.label}</p>
                                        <p className="font-medium">{item.value || "—"}</p>
                                    </div>
                                ))}
                            </div>

                            {student.address && (
                                <div className="text-sm space-y-0.5">
                                    <p className="text-xs text-muted-foreground">Address</p>
                                    <p className="font-medium">{student.address}</p>
                                </div>
                            )}
                            <div className="rounded-xl border bg-muted/10 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-foreground">Attendance Summary</p>
                                    {studentAttendanceLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
                                </div>
                                {(() => {
                                    const monthlyMap = new Map<string, { present: number; absent: number }>();
                                    for (const row of studentAttendanceRows) {
                                        const monthKey = row.att_date.slice(0, 7);
                                        const current = monthlyMap.get(monthKey) || { present: 0, absent: 0 };
                                        if (row.status === "P") current.present += 1;
                                        if (row.status === "A") current.absent += 1;
                                        monthlyMap.set(monthKey, current);
                                    }
                                    const monthlySummary = Array.from(monthlyMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
                                    const currentMonthKey = new Date().toISOString().slice(0, 7);
                                    const currentMonth = monthlyMap.get(currentMonthKey) || { present: 0, absent: 0 };
                                    return (
                                        <>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="rounded-lg border bg-card px-3 py-2">
                                                    <p className="text-[11px] text-muted-foreground">This Month Present</p>
                                                    <p className="text-lg font-semibold text-emerald-600">{currentMonth.present}</p>
                                                </div>
                                                <div className="rounded-lg border bg-card px-3 py-2">
                                                    <p className="text-[11px] text-muted-foreground">This Month Absent</p>
                                                    <p className="text-lg font-semibold text-red-600">{currentMonth.absent}</p>
                                                </div>
                                            </div>
                                            {monthlySummary.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">No attendance records yet.</p>
                                            ) : (
                                                <div className="space-y-2 max-h-44 overflow-y-auto">
                                                    {monthlySummary.slice(0, 12).map(([monthKey, value]) => (
                                                        <div key={monthKey} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
                                                            <span className="font-medium">{monthKey}</span>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-emerald-600 font-semibold">P: {value.present}</span>
                                                                <span className="text-red-600 font-semibold">A: {value.absent}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={teacherOpen}
                onOpenChange={(open) => {
                    setTeacherOpen(open);
                    if (!open) setTeacher(null);
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" /> Teacher Profile
                        </DialogTitle>
                    </DialogHeader>
                    {teacher && (
                        <div className="space-y-4 py-4">
                            <div className="relative overflow-hidden rounded-xl border bg-card shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
                                <div className="absolute top-0 inset-x-0 h-20 bg-primary" />
                                <div className="relative pt-10 pb-6 px-6 flex flex-col items-center text-center">
                                    <div className="h-20 w-20 rounded-full border-4 border-card bg-muted flex items-center justify-center text-primary font-bold text-3xl shadow-sm relative z-10">
                                        {teacher.name.charAt(0).toUpperCase()}
                                    </div>
                                    <h3 className="mt-3 font-bold text-[19px] text-foreground tracking-tight leading-tight">
                                        {teacher.name}
                                    </h3>
                                    <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                                        {teacher.designation && (
                                            <Badge
                                                variant="secondary"
                                                className="bg-slate-100 hover:bg-slate-100 text-slate-600 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5"
                                            >
                                                {teacher.designation}
                                            </Badge>
                                        )}
                                        {teacher.subject_specialty && (
                                            <Badge
                                                variant="secondary"
                                                className="bg-primary/10 hover:bg-primary/10 text-primary font-mono text-[10px] uppercase tracking-wider px-2 py-0.5"
                                            >
                                                {teacher.subject_specialty}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {[
                                    { label: "Email", value: teacher.email },
                                    { label: "Phone", value: teacher.phone },
                                    { label: "Employee Type", value: teacher.employee_type },
                                ].map((item) => (
                                    <div key={item.label} className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground">{item.label}</p>
                                        <p className="font-medium truncate">{item.value || "—"}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end">
                                <Button type="button" variant="outline" onClick={() => router.push("/dashboard/administration/teachers-rooms")}>
                                    Open Teachers Page
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
