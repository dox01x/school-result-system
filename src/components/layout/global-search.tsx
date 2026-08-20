"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
    Search,
    Loader2,
    GraduationCap,
    User,
    School,
    BookOpen,
    ClipboardList,
    Megaphone,
    Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GlobalSearchHit } from "@/lib/global-search-types";
import { createClient } from "@/lib/supabase/client";
import type { Teacher, Staff } from "@/lib/database.types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const StudentProfileSheet = dynamic(
    () => import("@/components/students/student-profile-sheet").then((m) => m.StudentProfileSheet),
    { ssr: false }
);

const typeIcons: Record<GlobalSearchHit["type"], typeof GraduationCap> = {
    student: GraduationCap,
    teacher: User,
    staff: Briefcase,
    class: School,
    subject: BookOpen,
    exam: ClipboardList,
    notice: Megaphone,
};

const typeLabel: Record<GlobalSearchHit["type"], string> = {
    student: "Student",
    teacher: "Teacher",
    staff: "Staff",
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
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [teacherOpen, setTeacherOpen] = useState(false);
    const [teacherLoading, setTeacherLoading] = useState(false);
    const [teacher, setTeacher] = useState<Teacher | null>(null);
    const [staffOpen, setStaffOpen] = useState(false);
    const [staffLoading, setStaffLoading] = useState(false);
    const [staff, setStaff] = useState<Staff | null>(null);
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

            if (hit.type !== "student" && hit.type !== "teacher" && hit.type !== "staff") {
                router.push(hit.href);
                return;
            }

            if (hit.type === "student") {
                setSelectedStudentId(hit.id);
                setStudentOpen(true);
                return;
            }

            const supabase = supabaseRef.current!;

            if (hit.type === "staff") {
                setStaffLoading(true);
                try {
                    const { data, error } = await supabase
                        .from("staffs")
                        .select("id,name,email,phone,designation,created_at")
                        .eq("id", hit.id)
                        .maybeSingle();
                    if (error || !data) {
                        router.push(hit.href);
                        return;
                    }
                    setStaff(data as unknown as Staff);
                    setStaffOpen(true);
                } finally {
                    setStaffLoading(false);
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
                    "flex items-center gap-2 rounded-lg border px-3 h-9 text-sm transition-all duration-150",
                    focused
                        ? "border-primary/40 ring-2 ring-ring/20 w-full"
                        : "border-border bg-transparent w-full md:w-[min(100%,13rem)]"
                )}
            >
                <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                <input
                    ref={inputRef}
                    type="search"
                    role="combobox"
                    aria-autocomplete="list"
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
                    className="absolute top-[calc(100%+4px)] left-0 right-0 z-[100] rounded-xl border border-border bg-popover text-popover-foreground shadow-md max-h-[min(70vh,22rem)] overflow-y-auto py-1 thin-scrollbar"
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
                                    aria-selected={false}
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
                                    {(r.type === "teacher" && teacherLoading) || (r.type === "staff" && staffLoading) ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1 shrink-0" />
                                    ) : null}
                                </button>
                            );
                        })}
                </div>
            )}

            {/* Full Student Profile Sheet */}
            <StudentProfileSheet
                open={studentOpen}
                onOpenChange={(open) => {
                    setStudentOpen(open);
                    if (!open) setSelectedStudentId(null);
                }}
                studentId={selectedStudentId}
                onRequestEdit={(s) => {
                    setStudentOpen(false);
                    router.push(`/students?studentId=${encodeURIComponent(s.id)}`);
                }}
                onRequestTransfer={(s) => {
                    setStudentOpen(false);
                    router.push(`/students?studentId=${encodeURIComponent(s.id)}`);
                }}
                onRequestDelete={(s) => {
                    setStudentOpen(false);
                    router.push(`/students?studentId=${encodeURIComponent(s.id)}`);
                }}
            />

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
                                <Button type="button" variant="outline" onClick={() => router.push("/administration/teachers-rooms")}>
                                    Open Teachers Page
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={staffOpen}
                onOpenChange={(open) => {
                    setStaffOpen(open);
                    if (!open) setStaff(null);
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-emerald-600" /> Staff Profile
                        </DialogTitle>
                    </DialogHeader>
                    {staff && (
                        <div className="space-y-4 py-4">
                            <div className="relative overflow-hidden rounded-xl border bg-card shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
                                <div className="absolute top-0 inset-x-0 h-20 bg-emerald-600" />
                                <div className="relative pt-10 pb-6 px-6 flex flex-col items-center text-center">
                                    <div className="h-20 w-20 rounded-full border-4 border-card bg-muted flex items-center justify-center text-emerald-600 font-bold text-3xl shadow-sm relative z-10">
                                        {staff.name.charAt(0).toUpperCase()}
                                    </div>
                                    <h3 className="mt-3 font-bold text-[19px] text-foreground tracking-tight leading-tight">
                                        {staff.name}
                                    </h3>
                                    <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                                        {staff.designation && (
                                            <Badge
                                                variant="secondary"
                                                className="bg-slate-100 hover:bg-slate-100 text-slate-600 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5"
                                            >
                                                {staff.designation}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {[
                                    { label: "Email", value: staff.email },
                                    { label: "Phone", value: staff.phone },
                                    { label: "Designation", value: staff.designation },
                                ].map((item) => (
                                    <div key={item.label} className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground">{item.label}</p>
                                        <p className="font-medium truncate">{item.value || "—"}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end">
                                <Button type="button" variant="outline" onClick={() => router.push("/administration/staff")}>
                                    Open Staff Page
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
