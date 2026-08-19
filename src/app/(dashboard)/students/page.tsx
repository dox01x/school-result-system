"use client";

import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    CLASS_COLUMNS,
    SECTION_COLUMNS,
    STUDENT_COLUMNS,
} from "@/lib/supabase/select-columns";
import type { Class, Section, Student } from "@/lib/database.types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, GraduationCap, Upload, RefreshCw, Search, Phone, User } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Papa from "papaparse";
import dynamic from "next/dynamic";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getCachedClasses, getCachedSections } from "@/lib/cache/master-data-cache";
import { prefetchStudentProfile } from "@/components/students/student-profile-sheet";
const StudentProfileSheet = dynamic(
    () => import("@/components/students/student-profile-sheet").then((m) => m.StudentProfileSheet),
    { ssr: false }
);

function StudentsPageContent() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [profileStudent, setProfileStudent] = useState<Student | null>(null);
    const [profileDialogOpen, setProfileDialogOpen] = useState(false);
    const [form, setForm] = useState({ roll: "", name: "", group_name: "None", student_id: "", gender: "", father_name: "", mother_name: "", date_of_birth: "", phone: "", address: "", blood_group: "" });
    // Transfer state
    const [transferDialogOpen, setTransferDialogOpen] = useState(false);
    const [transferStudent, setTransferStudent] = useState<Student | null>(null);
    const [transferTargetClass, setTransferTargetClass] = useState("");
    const [transferTargetSection, setTransferTargetSection] = useState("");
    const [transferTargetSections, setTransferTargetSections] = useState<Section[]>([]);
    const [transferring, setTransferring] = useState(false);
    const [transferRoll, setTransferRoll] = useState("");
    // Google Sheets import state
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [sheetsForm, setSheetsForm] = useState({ sheetId: "", range: "" });
    const [sheetsLoading, setSheetsLoading] = useState(false);
    // Auto-sync state
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
    const [syncIntervalSec, setSyncIntervalSec] = useState(7);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
    const autoSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [bgSyncing, setBgSyncing] = useState(false);
    // Confirm dialog state
    const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; description: string; onConfirm: () => void }>({ open: false, title: "", description: "", onConfirm: () => {} });
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const searchParams = useSearchParams();
    const studentIdParam = searchParams.get("studentId");
    const rollInputRef = useRef<HTMLInputElement>(null);
    const quickAddRollRef = useRef<HTMLInputElement>(null);
    const [quickAdd, setQuickAdd] = useState({ roll: "", name: "" });

    useEffect(() => {
        if (!studentIdParam) return;
        let cancelled = false;
        void (async () => {
            const { data: s, error } = await supabase
                .from("students")
                .select(STUDENT_COLUMNS)
                .eq("id", studentIdParam)
                .maybeSingle();
            if (cancelled || error || !s) return;
            setProfileStudent(s);
            setProfileDialogOpen(true);
            router.replace("/students", { scroll: false });
        })();
        return () => {
            cancelled = true;
        };
    }, [studentIdParam, supabase, router]);

    const fetchClasses = useCallback(async () => {
        const data = await getCachedClasses();
        setClasses(data || []);
        if (data && data.length > 0 && !selectedClass) {
            setSelectedClass(data[0].id);
        }
    }, [selectedClass]);

    const fetchSections = useCallback(async () => {
        if (!selectedClass) return;
        const data = await getCachedSections(selectedClass);
        setSections(data || []);
        if (data && data.length > 0) {
            setSelectedSection(data[0].id);
        } else {
            setSelectedSection("");
        }
    }, [selectedClass]);

    const fetchStudents = useCallback(async () => {
        if (!selectedClass || !selectedSection) {
            setStudents([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const studentsRes = await supabase
                .from("students")
                .select(STUDENT_COLUMNS)
                .eq("class_id", selectedClass)
                .eq("section_id", selectedSection)
                .order("roll");
            
            if (studentsRes.error) throw studentsRes.error;
            const sorted = (studentsRes.data || []).sort((a: Student, b: Student) => {
                const na = parseInt(a.roll), nb = parseInt(b.roll);
                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                return a.roll.localeCompare(b.roll);
            });
            setStudents(sorted);
        } catch {
            toast.error("Failed to load students");
        } finally {
            setLoading(false);
        }
    }, [selectedClass, selectedSection, supabase]);

    // Fast initial parallel bootstrap with master data cache
    const initialLoadDone = useRef(false);
    useEffect(() => {
        if (initialLoadDone.current) return;
        initialLoadDone.current = true;

        let cancelled = false;
        void (async () => {
            setLoading(true);
            try {
                const [classesData, sectionsData] = await Promise.all([
                    getCachedClasses(),
                    getCachedSections(),
                ]);

                if (cancelled) return;

                setClasses(classesData);
                setSections(sectionsData);

                if (classesData.length > 0) {
                    const firstClassId = classesData[0].id;
                    setSelectedClass(firstClassId);

                    const classSections = sectionsData.filter((s) => s.class_id === firstClassId);
                    if (classSections.length > 0) {
                        const firstSecId = classSections[0].id;
                        setSelectedSection(firstSecId);

                        const studentsRes = await supabase
                            .from("students")
                            .select(STUDENT_COLUMNS)
                            .eq("class_id", firstClassId)
                            .eq("section_id", firstSecId)
                            .order("roll");

                        if (!cancelled) {
                            const sorted = (studentsRes.data || []).sort((a: Student, b: Student) => {
                                const na = parseInt(a.roll), nb = parseInt(b.roll);
                                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                                return a.roll.localeCompare(b.roll);
                            });
                            setStudents(sorted);
                        }
                    }
                }
            } catch {
                toast.error("Failed to load student records");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [supabase]);

    useEffect(() => {
        if (!initialLoadDone.current) return;
        fetchSections();
    }, [selectedClass, fetchSections]);

    useEffect(() => {
        if (!initialLoadDone.current) return;
        fetchStudents();
    }, [selectedSection, fetchStudents]);

    useEffect(() => {
        const fetchTargetSections = async () => {
            if (!transferTargetClass) {
                setTransferTargetSections([]);
                setTransferTargetSection("");
                return;
            }
            const { data } = await supabase
                .from("sections")
                .select(SECTION_COLUMNS)
                .eq("class_id", transferTargetClass)
                .order("name");
            setTransferTargetSections(data || []);
            if (data && data.length > 0) {
                setTransferTargetSection(data[0].id);
            } else {
                setTransferTargetSection("");
            }
        };
        fetchTargetSections();
    }, [transferTargetClass, supabase]);

    const handleTransfer = async () => {
        if (!transferStudent || !transferTargetClass || !transferTargetSection || !transferRoll.trim()) {
            toast.error("Please fill all fields");
            return;
        }
        setTransferring(true);
        try {
            const { data: existing } = await supabase
                .from("students")
                .select("id")
                .eq("class_id", transferTargetClass)
                .eq("section_id", transferTargetSection)
                .eq("roll", transferRoll.trim())
                .maybeSingle();

            if (existing) {
                toast.error("Roll number already exists in target class and section");
                return;
            }

            const { error } = await supabase
                .from("students")
                .update({
                    class_id: transferTargetClass,
                    section_id: transferTargetSection,
                    roll: transferRoll.trim()
                })
                .eq("id", transferStudent.id);

            if (error) throw new Error(error.message);

            toast.success("Student transferred successfully");
            setTransferDialogOpen(false);
            fetchStudents();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to transfer student");
        } finally {
            setTransferring(false);
        }
    };

    const fetchSheetData = useCallback(async (sheetId: string, range: string, silent = false): Promise<number> => {
        const res = await fetch("/api/sheets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheetId, range }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to fetch sheet");
        const rows: string[][] = json.data || [];
        if (rows.length < 2) { if (!silent) toast.error("No data rows found"); return 0; }

        const headers = rows[0].map((h: string) => h.toLowerCase().trim());
        const rollIdx = headers.findIndex((h) => h === "roll");
        const nameIdx = headers.findIndex((h) => h === "name");
        
        if (rollIdx < 0 || nameIdx < 0) { if (!silent) toast.error("Sheet must have 'roll' and 'name' columns"); return 0; }

        const { data: existingStudents } = await supabase
            .from("students")
            .select("roll, group_name")
            .eq("class_id", selectedClass)
            .eq("section_id", selectedSection);
        const existingGroups = new Map(((existingStudents || []) as any[]).map((s: any) => [s.roll, s.group_name]));

        const toUpsert = [];
        for (let i = 1; i < rows.length; i++) {
            const roll = (rows[i][rollIdx] || "").toString().trim();
            const name = (rows[i][nameIdx] || "").toString().trim();
            
            const grpIdx = headers.findIndex((h) => h === "group");
            let group_name: string | null = null;
            if (grpIdx >= 0 && rows[i][grpIdx]) {
                const val = rows[i][grpIdx].toString().trim();
                if (["Science", "Arts", "Commerce"].includes(val)) group_name = val;
            }

            if (!group_name && existingGroups.has(roll)) {
                group_name = existingGroups.get(roll) || null;
            }

            if (roll && name) {
                toUpsert.push({ class_id: selectedClass, section_id: selectedSection, roll, name, group_name });
            }
        }

        if (toUpsert.length > 0) {
            const { error } = await supabase.from("students").upsert(toUpsert, { onConflict: "class_id,section_id,roll" });
            if (!error) {
                fetchStudents();
            } else {
                if (!silent) toast.error("Database upsert failed");
                return 0;
            }
        }
        return toUpsert.length;
    }, [selectedClass, selectedSection, fetchStudents, supabase]);

    useEffect(() => {
        if (autoSyncRef.current) {
            clearInterval(autoSyncRef.current);
            autoSyncRef.current = null;
        }

        if (!autoSyncEnabled || !sheetsForm.sheetId || !sheetsForm.range) {
            setSyncStatus("idle");
            return;
        }

        setSyncStatus("syncing");
        autoSyncRef.current = setInterval(async () => {
            try {
                setBgSyncing(true);
                await fetchSheetData(sheetsForm.sheetId, sheetsForm.range, true);
                setLastSyncTime(new Date());
                setSyncStatus("idle");
            } catch {
                setSyncStatus("error");
            } finally {
                setBgSyncing(false);
            }
        }, syncIntervalSec * 1000);

        return () => {
            if (autoSyncRef.current) {
                clearInterval(autoSyncRef.current);
                autoSyncRef.current = null;
            }
        };
    }, [autoSyncEnabled, sheetsForm.sheetId, sheetsForm.range, syncIntervalSec, fetchSheetData]);

    const handleSave = async () => {
        if (!form.roll.trim() || !form.name.trim() || !selectedClass || !selectedSection) return;
        try {
            let finalStudentId = form.student_id.trim() || null;
            if (!finalStudentId) {
                finalStudentId = `STU-${Math.floor(100000 + Math.random() * 900000)}`;
            }
            const payload = {
                class_id: selectedClass,
                section_id: selectedSection,
                roll: form.roll.trim(),
                name: form.name.trim(),
                group_name: form.group_name === "None" ? null : form.group_name,
                ...(finalStudentId ? { student_id: finalStudentId } : {}),
                gender: form.gender || '',
                father_name: form.father_name.trim(),
                mother_name: form.mother_name.trim(),
                date_of_birth: form.date_of_birth.trim(),
                phone: form.phone.trim(),
                address: form.address.trim(),
                blood_group: form.blood_group.trim(),
            };

            if (editingStudent) {
                const { error } = await supabase
                    .from("students")
                    .update(payload)
                    .eq("id", editingStudent.id);
                if (error) throw new Error(error.message);
                toast.success("Student updated");
            } else {
                const { error } = await supabase.from("students").insert(payload);
                if (error) throw new Error(error.message);
                toast.success("Student registered successfully");
            }
            setForm({ roll: "", name: "", group_name: "None", student_id: "", gender: "", father_name: "", mother_name: "", date_of_birth: "", phone: "", address: "", blood_group: "" });
            setEditingStudent(null);
            setDialogOpen(false);
            fetchStudents();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save student");
        }
    };

    const handleDelete = (student: Student) => {
        setConfirmState({
            open: true,
            title: `Delete "${student.name}"?`,
            description: `Roll: ${student.roll}. This student and all associated marks will be permanently removed.`,
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from("students").delete().eq("id", student.id);
                    if (error) throw error;
                    toast.success("Student record deleted");
                    fetchStudents();
                } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Failed to delete");
                }
                setConfirmState(prev => ({ ...prev, open: false }));
            },
        });
    };

    const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedClass || !selectedSection) return;
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rows = results.data as { roll?: string; name?: string; Roll?: string; Name?: string; group?: string; Group?: string; }[];
                const toInsert = rows
                    .map((r) => {
                        let grp: string | null = (r.group || r.Group || "").toString().trim();
                        if (!["Science", "Arts", "Commerce"].includes(grp)) grp = null;

                        return {
                            class_id: selectedClass,
                            section_id: selectedSection,
                            roll: (r.roll || r.Roll || "").toString().trim(),
                            name: (r.name || r.Name || "").toString().trim(),
                            group_name: grp,
                        };
                    })
                    .filter((r) => r.roll && r.name);

                if (toInsert.length === 0) {
                    toast.error("No valid rows found. CSV must contain 'roll' and 'name' columns.");
                    return;
                }

                try {
                    const { error } = await supabase.from("students").insert(toInsert);
                    if (error) throw error;
                    toast.success(`${toInsert.length} students imported successfully`);
                    fetchStudents();
                } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Import failed");
                }
            },
        });
        e.target.value = "";
    };

    const handleGoogleSheetsFetch = async () => {
        if (!sheetsForm.sheetId || !sheetsForm.range) { toast.error("Sheet ID and Range are required"); return; }
        if (!selectedClass || !selectedSection) { toast.error("Select class and section first"); return; }
        setSheetsLoading(true);
        try {
            const count = await fetchSheetData(sheetsForm.sheetId, sheetsForm.range);
            if (count > 0) {
                toast.success(`${count} students imported from Google Sheets`);
                
                await supabase.from("sheet_configs").delete()
                    .eq("type", "students")
                    .eq("class_id", selectedClass)
                    .eq("section_id", selectedSection);
                
                await supabase.from("sheet_configs").insert({
                    type: "students",
                    class_id: selectedClass,
                    section_id: selectedSection,
                    sheet_id: sheetsForm.sheetId,
                    sheet_range: sheetsForm.range
                });

                setImportDialogOpen(false);
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to fetch Google Sheets data");
        } finally {
            setSheetsLoading(false);
        }
    };

    // Filtered students by search query
    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.roll.toLowerCase().includes(q) ||
                (s.student_id && s.student_id.toLowerCase().includes(q)) ||
                (s.phone && s.phone.includes(q))
        );
    }, [students, searchQuery]);

    return (<>
        <div className="space-y-6">
            <PageHeader
                icon={GraduationCap}
                title="Student Directory"
                subtitle="Manage student enrollments, profiles, records, and transfers."
                actions={
                    <div className="flex items-center gap-2 flex-wrap">
                        {bgSyncing && (
                            <span className="text-xs text-primary flex items-center font-medium bg-primary/10 px-2.5 py-1 rounded-lg">
                                <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" strokeWidth={2} /> Syncing
                            </span>
                        )}
                        <Button
                            variant="outline"
                            onClick={() => setImportDialogOpen(true)}
                            disabled={!selectedSection}
                            className="gap-2"
                        >
                            <Upload className="h-4 w-4" strokeWidth={1.8} /> Import
                        </Button>
                        <Button
                            onClick={() => {
                                setForm({ roll: "", name: "", group_name: "None", student_id: "", gender: "", father_name: "", mother_name: "", date_of_birth: "", phone: "", address: "", blood_group: "" });
                                setEditingStudent(null);
                                setDialogOpen(true);
                            }}
                            disabled={!selectedSection}
                            className="gap-2 font-semibold shadow-xs"
                        >
                            <Plus size={16} strokeWidth={2} /> Add Student
                        </Button>
                    </div>
                }
            />

            {/* Filter Funnel & Search Card */}
            <div className="bg-card rounded-2xl border border-border/80 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-end justify-between gap-4">
                <div className="flex items-end gap-3 flex-1 flex-wrap sm:flex-nowrap">
                    <div className="flex-1 min-w-[140px] space-y-1.5">
                        <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-bold">Class</Label>
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                            <SelectTrigger className="w-full bg-background border-border text-xs sm:text-sm font-medium">
                                <SelectValue placeholder="Select class" />
                            </SelectTrigger>
                            <SelectContent>
                                {classes.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex-1 min-w-[140px] space-y-1.5">
                        <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-bold">Section</Label>
                        <Select value={selectedSection} onValueChange={setSelectedSection}>
                            <SelectTrigger className="w-full bg-background border-border text-xs sm:text-sm font-medium">
                                <SelectValue placeholder="Select section" />
                            </SelectTrigger>
                            <SelectContent>
                                {sections.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Filter by name, roll, or ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 bg-background border-border text-xs"
                        />
                    </div>
                    {students.length > 0 && (
                        <Badge variant="outline" className="h-9 px-3 bg-muted/40 font-semibold shrink-0 text-xs flex items-center">
                            {filteredStudents.length} / {students.length} Students
                        </Badge>
                    )}
                </div>
            </div>

            {/* Auto-sync indicator bar */}
            {autoSyncEnabled && (
                <Card className="border-emerald-500/20 bg-emerald-500/5">
                    <CardContent className="flex items-center justify-between py-3 px-4">
                        <div className="flex items-center gap-2.5">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <p className="text-xs sm:text-sm text-foreground font-medium">
                                Auto-Sync Active (every {syncIntervalSec}s)
                                {syncStatus === "syncing" && " — Syncing…"}
                                {lastSyncTime && syncStatus === "idle" && ` — Last sync: ${lastSyncTime.toLocaleTimeString()}`}
                            </p>
                        </div>
                        <Button variant="outline" size="xs" onClick={() => setAutoSyncEnabled(false)}>
                            Stop Sync
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Add / Edit Student Modal Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingStudent(null); if (open) setTimeout(() => rollInputRef.current?.focus(), 100); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingStudent ? "Edit Student Profile" : "Register New Student"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                        <div className="space-y-4 py-2">
                            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="student-roll">Roll Number *</Label>
                                    <Input
                                        ref={rollInputRef}
                                        id="student-roll"
                                        placeholder="e.g., 01"
                                        value={form.roll}
                                        onChange={(e) => setForm({ ...form, roll: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="student-id">Student ID</Label>
                                    <Input
                                        id="student-id"
                                        placeholder="Auto-generated if empty"
                                        value={form.student_id}
                                        onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="student-name">Student Full Name *</Label>
                                <Input
                                    id="student-name"
                                    placeholder="Enter full legal name"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Gender</Label>
                                    <Select value={form.gender || "_none"} onValueChange={(v) => setForm({ ...form, gender: v === "_none" ? "" : v })}>
                                        <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="_none">Not specified</SelectItem>
                                            <SelectItem value="Male">Male</SelectItem>
                                            <SelectItem value="Female">Female</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Date of Birth</Label>
                                    <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Father&apos;s Name</Label>
                                    <Input placeholder="Father's full name" value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Mother&apos;s Name</Label>
                                    <Input placeholder="Mother's full name" value={form.mother_name} onChange={(e) => setForm({ ...form, mother_name: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Contact Phone</Label>
                                    <Input placeholder="+880 1XXX XXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Blood Group</Label>
                                    <Input placeholder="e.g., A+, B+, O+" value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })} />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Residential Address</Label>
                                <Input placeholder="Full home address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                            </div>

                            <div className="space-y-1.5">
                                <Label>Academic Stream / Group</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                    {[{ value: "None", label: "General" }, { value: "Science", label: "Science" }, { value: "Arts", label: "Arts" }, { value: "Commerce", label: "Commerce" }].map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setForm({ ...form, group_name: opt.value })}
                                            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center ${form.group_name === opt.value ? "bg-primary text-primary-foreground border-primary shadow-xs" : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                            <Button type="submit">{editingStudent ? "Update Record" : "Save Student"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Student Profile Sheet */}
            <StudentProfileSheet
                open={profileDialogOpen}
                onOpenChange={setProfileDialogOpen}
                studentId={profileStudent?.id || null}
                onStudentUpdated={fetchStudents}
                onRequestEdit={(student) => {
                    setEditingStudent(student);
                    setForm({
                        roll: student.roll,
                        name: student.name,
                        group_name: student.group_name || "None",
                        student_id: student.student_id || "",
                        gender: student.gender || "",
                        father_name: student.father_name || "",
                        mother_name: student.mother_name || "",
                        date_of_birth: student.date_of_birth || "",
                        phone: student.phone || "",
                        address: student.address || "",
                        blood_group: student.blood_group || "",
                    });
                    setDialogOpen(true);
                }}
                onRequestTransfer={(student) => {
                    setTransferStudent(student);
                    setTransferTargetClass(student.class_id);
                    setTransferRoll(student.roll);
                    setTransferDialogOpen(true);
                }}
                onRequestDelete={handleDelete}
            />

            {/* Transfer Dialog */}
            <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Transfer Student</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="p-3 rounded-xl bg-muted/40 border border-border">
                            <p className="text-xs text-muted-foreground">Transferring</p>
                            <p className="font-bold text-base text-foreground mt-0.5">{transferStudent?.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">Roll: {transferStudent?.roll}</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Target Class</Label>
                            <Select value={transferTargetClass} onValueChange={setTransferTargetClass}>
                                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                                <SelectContent>
                                    {classes.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Target Section</Label>
                            <Select value={transferTargetSection} onValueChange={setTransferTargetSection} disabled={transferTargetSections.length === 0}>
                                <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                                <SelectContent>
                                    {transferTargetSections.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>New Roll Number</Label>
                            <Input value={transferRoll} onChange={(e) => setTransferRoll(e.target.value)} placeholder="e.g., 01" />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleTransfer} disabled={transferring || !transferTargetClass || !transferTargetSection || !transferRoll.trim()}>
                            {transferring ? "Transferring..." : "Confirm Transfer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import Dialog */}
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Import Students</DialogTitle></DialogHeader>
                    <Tabs defaultValue="csv" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="csv">CSV File</TabsTrigger>
                            <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="csv" className="space-y-4 pt-4 min-h-[220px] flex flex-col justify-between">
                            <p className="text-xs text-muted-foreground">
                                Upload a CSV file with student data. Required headers: <strong className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">roll</strong>, <strong className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">name</strong>.
                            </p>
                            <div className="border-2 border-dashed border-border rounded-xl p-6 hover:bg-muted/40 transition-colors text-center cursor-pointer">
                                <label className="flex flex-col items-center cursor-pointer w-full">
                                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                    <span className="font-semibold text-sm text-foreground">Click to upload CSV</span>
                                    <span className="text-xs text-muted-foreground mt-1">.csv spreadsheet files only</span>
                                    <input type="file" accept=".csv" className="hidden" onChange={(e) => {
                                        handleCSVImport(e);
                                        setImportDialogOpen(false);
                                    }} />
                                </label>
                            </div>
                        </TabsContent>

                        <TabsContent value="sheets" className="space-y-3 pt-4 min-h-[220px]">
                            <div className="space-y-2">
                                <Input placeholder="Sheet ID or URL (docs.google.com/...)" value={sheetsForm.sheetId} onChange={(e) => {
                                    let val = e.target.value;
                                    const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                                    if (match) val = match[1];
                                    setSheetsForm({ ...sheetsForm, sheetId: val });
                                }} className="h-9" />
                                <Input placeholder="Range (e.g., Sheet1!A1:C50)" value={sheetsForm.range} onChange={(e) => setSheetsForm({ ...sheetsForm, range: e.target.value })} className="h-9" />
                            </div>
                            <div className="flex justify-end gap-2 pt-3">
                                <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
                                <Button size="sm" onClick={handleGoogleSheetsFetch} disabled={sheetsLoading}>
                                    {sheetsLoading ? "Importing..." : "Fetch & Import"}
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Empty State */}
            {!loading && students.length === 0 && selectedSection && (
                <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card shadow-xs">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mb-4 mx-auto">
                        <GraduationCap size={28} strokeWidth={1.8} />
                    </div>
                    <h3 className="font-bold text-lg text-foreground mb-1">No students found in this section</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                        Add students manually using the quick-add bar or import via CSV/Google Sheets.
                    </p>
                    <Button onClick={() => setDialogOpen(true)} className="gap-2">
                        <Plus size={16} /> Add First Student
                    </Button>
                </div>
            )}

            {/* Student Records Table */}
            {students.length > 0 && (
                <Card className="rounded-2xl overflow-hidden shadow-xs">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16 text-center">Roll</TableHead>
                                    <TableHead>Student Name</TableHead>
                                    <TableHead className="hidden sm:table-cell">Student ID</TableHead>
                                    <TableHead className="hidden md:table-cell">Gender</TableHead>
                                    <TableHead className="hidden lg:table-cell">Contact Phone</TableHead>
                                    <TableHead>Stream / Group</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStudents.map((student) => (
                                    <TableRow
                                        key={student.id}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors group"
                                        onMouseEnter={() => prefetchStudentProfile(student.id)}
                                        onClick={() => { setProfileStudent(student); setProfileDialogOpen(true); }}
                                    >
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="font-mono font-bold text-xs bg-background">
                                                {student.roll}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                                                    {student.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                                        {student.name}
                                                    </p>
                                                    {student.father_name && (
                                                        <p className="text-[11px] text-muted-foreground truncate">
                                                            S/D of {student.father_name}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground hidden sm:table-cell">
                                            {student.student_id || "-"}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs hidden md:table-cell">
                                            {student.gender || "-"}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground hidden lg:table-cell">
                                            {student.phone ? (
                                                <span className="flex items-center gap-1">
                                                    <Phone size={11} /> {student.phone}
                                                </span>
                                            ) : "-"}
                                        </TableCell>
                                        <TableCell>
                                            {student.group_name && student.group_name !== "None" ? (
                                                <Badge variant="secondary" className="text-[10.5px] font-semibold uppercase">
                                                    {student.group_name}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">General</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {/* Quick-Add Row */}
                        <div className="flex items-center gap-2 p-3 bg-muted/20 border-t border-border">
                            <Input
                                ref={quickAddRollRef}
                                placeholder="Roll"
                                value={quickAdd.roll}
                                onChange={(e) => setQuickAdd({ ...quickAdd, roll: e.target.value })}
                                className="w-20 h-9 text-xs text-center font-mono font-bold bg-background"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        document.getElementById("quick-add-name")?.focus();
                                    }
                                }}
                            />
                            <Input
                                id="quick-add-name"
                                placeholder="Student name (Press Enter to add)"
                                value={quickAdd.name}
                                onChange={(e) => setQuickAdd({ ...quickAdd, name: e.target.value })}
                                className="flex-1 h-9 text-xs bg-background"
                                onKeyDown={async (e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        if (!quickAdd.roll.trim() || !quickAdd.name.trim() || !selectedClass || !selectedSection) return;
                                        try {
                                            const { error } = await supabase.from("students").insert({
                                                class_id: selectedClass,
                                                section_id: selectedSection,
                                                roll: quickAdd.roll.trim(),
                                                name: quickAdd.name.trim(),
                                            });
                                            if (error) throw error;
                                            toast.success(`Added: ${quickAdd.name.trim()}`);
                                            setQuickAdd({ roll: "", name: "" });
                                            fetchStudents();
                                            setTimeout(() => quickAddRollRef.current?.focus(), 100);
                                        } catch (err: unknown) {
                                            toast.error(err instanceof Error ? err.message : "Failed to add student");
                                        }
                                    }
                                }}
                            />
                            <span className="text-[10px] text-muted-foreground font-semibold px-2 hidden sm:inline select-none">
                                Press ↵
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>

        <ConfirmDialog
            open={confirmState.open}
            onOpenChange={(open) => setConfirmState(prev => ({ ...prev, open }))}
            title={confirmState.title}
            description={confirmState.description}
            confirmLabel="Delete"
            variant="destructive"
            onConfirm={confirmState.onConfirm}
        />
    </>);
}

export default function StudentsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
                    Loading student records…
                </div>
            }
        >
            <StudentsPageContent />
        </Suspense>
    );
}
