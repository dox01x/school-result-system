"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
    Search,
    Loader2,
    X,
    GraduationCap,
    User,
    School,
    BookOpen,
    ClipboardList,
    Megaphone,
    Briefcase,
    ChevronRight,
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

export function MobileSearch() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<GlobalSearchHit[]>([]);
    
    // Profile dialogs
    const [studentOpen, setStudentOpen] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    const [teacherOpen, setTeacherOpen] = useState(false);
    const [teacherLoading, setTeacherLoading] = useState(false);
    const [teacher, setTeacher] = useState<Teacher | null>(null);

    const [staffOpen, setStaffOpen] = useState(false);
    const [staffLoading, setStaffLoading] = useState(false);
    const [staff, setStaff] = useState<Staff | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

    if (!supabaseRef.current) {
        supabaseRef.current = createClient();
    }

    // Auto-focus input when dialog opens
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        } else {
            setQuery("");
            setResults([]);
        }
    }, [isOpen]);

    // Live search debounced query
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
        }, 250);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    const onPick = useCallback(
        async (hit: GlobalSearchHit) => {
            if (hit.type !== "student" && hit.type !== "teacher" && hit.type !== "staff") {
                setIsOpen(false);
                router.push(hit.href);
                return;
            }

            if (hit.type === "student") {
                setSelectedStudentId(hit.id);
                setStudentOpen(true);
                setIsOpen(false);
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
                        setIsOpen(false);
                        router.push(hit.href);
                        return;
                    }
                    setStaff(data as unknown as Staff);
                    setStaffOpen(true);
                    setIsOpen(false);
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
                    setIsOpen(false);
                    router.push(hit.href);
                    return;
                }
                setTeacher(data as unknown as Teacher);
                setTeacherOpen(true);
                setIsOpen(false);
            } finally {
                setTeacherLoading(false);
            }
        },
        [router]
    );

    return (
        <>
            {/* Header Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="p-2 text-muted-foreground hover:text-foreground active:scale-95 rounded-lg transition-colors"
                aria-label="Search"
            >
                <Search size={18} strokeWidth={1.8} />
            </button>

            {/* Mobile Search Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-[calc(100vw-24px)] w-full sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
                    {/* Search Input Bar */}
                    <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border bg-muted/30">
                        <Search className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
                        <input
                            ref={inputRef}
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search students, exams, classes…"
                            autoComplete="off"
                            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery("")}
                                className="p-1 text-muted-foreground hover:text-foreground rounded-md"
                                aria-label="Clear search"
                            >
                                <X size={15} />
                            </button>
                        )}
                        {loading && (
                            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                        )}
                    </div>

                    {/* Search Results Area */}
                    <div className="max-h-[60vh] overflow-y-auto thin-scrollbar p-2">
                        {query.trim().length === 0 ? (
                            <div className="py-8 text-center text-xs text-muted-foreground">
                                Type a name, roll number, class, or exam to search…
                            </div>
                        ) : loading && results.length === 0 ? (
                            <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Searching…
                            </div>
                        ) : results.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                                No results found for &ldquo;{query}&rdquo;
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {results.map((r) => {
                                    const Icon = typeIcons[r.type];
                                    return (
                                        <button
                                            key={`${r.type}-${r.id}`}
                                            type="button"
                                            onClick={() => void onPick(r)}
                                            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/70 active:bg-muted transition-colors text-left group"
                                        >
                                            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                                                <Icon size={16} strokeWidth={1.8} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
                                                    {r.title}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                                    <span className="font-medium text-primary/80">{typeLabel[r.type]}</span>
                                                    {r.subtitle ? ` · ${r.subtitle}` : ""}
                                                </p>
                                            </div>
                                            {(r.type === "teacher" && teacherLoading) ||
                                            (r.type === "staff" && staffLoading) ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

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

            {/* Teacher Profile Dialog */}
            <Dialog
                open={teacherOpen}
                onOpenChange={(open) => {
                    setTeacherOpen(open);
                    if (!open) setTeacher(null);
                }}
            >
                <DialogContent className="max-w-[calc(100vw-24px)] sm:max-w-md p-5 rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <User className="h-5 w-5 text-primary" /> Teacher Profile
                        </DialogTitle>
                    </DialogHeader>
                    {teacher && (
                        <div className="space-y-4 py-2">
                            <div className="rounded-xl border bg-card p-4 flex flex-col items-center text-center">
                                <div className="h-16 w-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
                                    {teacher.name.charAt(0).toUpperCase()}
                                </div>
                                <h3 className="mt-2.5 font-bold text-base text-foreground">{teacher.name}</h3>
                                {teacher.designation && (
                                    <Badge variant="secondary" className="mt-1 text-[10px]">
                                        {teacher.designation}
                                    </Badge>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2 rounded-lg bg-muted/40">
                                    <p className="text-[10px] text-muted-foreground">Email</p>
                                    <p className="font-semibold text-foreground truncate">{teacher.email || "—"}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-muted/40">
                                    <p className="text-[10px] text-muted-foreground">Phone</p>
                                    <p className="font-semibold text-foreground truncate">{teacher.phone || "—"}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-muted/40 col-span-2">
                                    <p className="text-[10px] text-muted-foreground">Specialty</p>
                                    <p className="font-semibold text-foreground truncate">{teacher.subject_specialty || "—"}</p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="w-full text-xs"
                                onClick={() => {
                                    setTeacherOpen(false);
                                    router.push("/administration/teachers-rooms");
                                }}
                            >
                                Open Teachers Directory
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Staff Profile Dialog */}
            <Dialog
                open={staffOpen}
                onOpenChange={(open) => {
                    setStaffOpen(open);
                    if (!open) setStaff(null);
                }}
            >
                <DialogContent className="max-w-[calc(100vw-24px)] sm:max-w-md p-5 rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <Briefcase className="h-5 w-5 text-emerald-600" /> Staff Profile
                        </DialogTitle>
                    </DialogHeader>
                    {staff && (
                        <div className="space-y-4 py-2">
                            <div className="rounded-xl border bg-card p-4 flex flex-col items-center text-center">
                                <div className="h-16 w-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center text-emerald-600 font-bold text-2xl">
                                    {staff.name.charAt(0).toUpperCase()}
                                </div>
                                <h3 className="mt-2.5 font-bold text-base text-foreground">{staff.name}</h3>
                                {staff.designation && (
                                    <Badge variant="secondary" className="mt-1 text-[10px]">
                                        {staff.designation}
                                    </Badge>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2 rounded-lg bg-muted/40">
                                    <p className="text-[10px] text-muted-foreground">Email</p>
                                    <p className="font-semibold text-foreground truncate">{staff.email || "—"}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-muted/40">
                                    <p className="text-[10px] text-muted-foreground">Phone</p>
                                    <p className="font-semibold text-foreground truncate">{staff.phone || "—"}</p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="w-full text-xs"
                                onClick={() => {
                                    setStaffOpen(false);
                                    router.push("/administration/staff");
                                }}
                            >
                                Open Staff Directory
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
