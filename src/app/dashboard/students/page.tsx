"use client";

import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    CLASS_COLUMNS,
    EXAM_COLUMNS,
    RESULT_COLUMNS,
    SECTION_COLUMNS,
    SHEET_CONFIG_COLUMNS,
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
import { Plus, Pencil, Trash2, GraduationCap, Upload, RefreshCw, MoveRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Papa from "papaparse";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StudentProfileSheet } from "@/components/students/student-profile-sheet";

function StudentsPageContent() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
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
            router.replace("/dashboard/students", { scroll: false });
        })();
        return () => {
            cancelled = true;
        };
    }, [studentIdParam, supabase, router]);

    const fetchClasses = useCallback(async () => {
        const { data } = await supabase.from("classes").select(CLASS_COLUMNS).order("numeric_value");
        setClasses(data || []);
        if (data && data.length > 0 && !selectedClass) {
            setSelectedClass(data[0].id);
        }
    }, []);

    const fetchSections = useCallback(async () => {
        if (!selectedClass) return;
        const { data } = await supabase
            .from("sections")
            .select(SECTION_COLUMNS)
            .eq("class_id", selectedClass)
            .order("name");
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
            const sorted = (studentsRes.data || []).sort((a, b) => {
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
    }, [selectedClass, selectedSection]);

    useEffect(() => { fetchClasses(); }, [fetchClasses]);
    useEffect(() => { fetchSections(); }, [fetchSections]);
    useEffect(() => { fetchStudents(); }, [fetchStudents]);

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
            // Check if roll already exists in target class/section
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
            fetchStudents(); // Refresh current list
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to transfer student");
        } finally {
            setTransferring(false);
        }
    };

    // Shared fetch logic
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
        const existingGroups = new Map((existingStudents || []).map(s => [s.roll, s.group_name]));

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
    }, [selectedClass, selectedSection, fetchStudents]);

    // Auto-sync interval management
    useEffect(() => {
        if (autoSyncRef.current) {
            clearInterval(autoSyncRef.current);
            autoSyncRef.current = null;
        }

        if (!autoSyncEnabled || !sheetsForm.sheetId || !sheetsForm.range) {
            setSyncStatus("idle");
            return;
        }

        const doSync = async () => {
            setSyncStatus("syncing");
            try {
                await fetchSheetData(sheetsForm.sheetId, sheetsForm.range, true);
                setLastSyncTime(new Date());
                setSyncStatus("idle");
            } catch {
                setSyncStatus("error");
            }
        };

        doSync();
        autoSyncRef.current = setInterval(doSync, syncIntervalSec * 1000);

        return () => {
            if (autoSyncRef.current) {
                clearInterval(autoSyncRef.current);
                autoSyncRef.current = null;
            }
        };
    }, [autoSyncEnabled, syncIntervalSec, sheetsForm.sheetId, sheetsForm.range, fetchSheetData]);

    // Stop auto-sync and reset sheets form if selections change
    useEffect(() => {
        setAutoSyncEnabled(false);
        setSheetsForm({ sheetId: "", range: "" });
    }, [selectedClass, selectedSection]);

    // Pre-fill sheets form from saved config (NO auto-sync — only fills the UI fields)
    useEffect(() => {
        if (!selectedClass || !selectedSection) return;

        (async () => {
            try {
                const { data: config } = await supabase
                    .from("sheet_configs")
                    .select(SHEET_CONFIG_COLUMNS)
                    .eq("type", "students")
                    .eq("class_id", selectedClass)
                    .eq("section_id", selectedSection)
                    .maybeSingle();

                if (config) {
                    setSheetsForm({ sheetId: config.sheet_id, range: config.sheet_range });
                }
            } catch (err) {
                console.error("Sheet config load error:", err);
            }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedClass, selectedSection]);

    const handleSave = async () => {
        if (!form.roll.trim() || !form.name.trim() || !selectedClass || !selectedSection) return;
        try {
            // Auto-generate student_id if left blank on new student creation
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
                // Only include student_id if it has a value (avoid UNIQUE constraint on null)
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
                toast.success("Student added");
            }
            setForm({ roll: "", name: "", group_name: "None", student_id: "", gender: "", father_name: "", mother_name: "", date_of_birth: "", phone: "", address: "", blood_group: "" });
            setEditingStudent(null);
            setDialogOpen(false);
            fetchStudents();
        } catch (err: unknown) {
            console.error("Save student error:", err);
            toast.error(err instanceof Error ? err.message : "Failed to save student");
        }
    };

    const handleDelete = (student: Student) => {
        setConfirmState({
            open: true,
            title: `Delete "${student.name}"?`,
            description: `Roll: ${student.roll}. This student and all their marks will be permanently removed.`,
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from("students").delete().eq("id", student.id);
                    if (error) throw error;
                    toast.success("Student deleted");
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
                    toast.error("No valid rows found. CSV must have 'roll' and 'name' columns.");
                    return;
                }

                try {
                    const { error } = await supabase.from("students").insert(toInsert);
                    if (error) throw error;
                    toast.success(`${toInsert.length} students imported`);
                    fetchStudents();
                } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Import failed");
                }
            },
        });
        e.target.value = "";
    };

    // Google Sheets import manually
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

    // Promotion moved to Settings > Yearly Promotion

    return (<>
        <div className="space-y-6">
            <PageHeader
                icon={GraduationCap}
                iconBg="bg-violet-50"
                iconColor="text-violet-600"
                title="Students"
                subtitle="Manage student enrollment and records."
                actions={
                    <div className="flex items-center gap-2 flex-wrap">
                        {bgSyncing && <span className="text-xs text-blue-600 flex items-center font-medium"><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Syncing...</span>}
                        {lastSyncTime && !bgSyncing && <span className="text-xs text-slate-400 font-medium">Synced: {lastSyncTime.toLocaleTimeString()}</span>}
                        <Button variant="outline" onClick={() => setImportDialogOpen(true)} disabled={!selectedSection} className="rounded-xl border-slate-200 hover:bg-slate-50">
                            <Upload className="h-4 w-4 mr-2" />Import
                        </Button>
                        <Button
                            onClick={() => { setForm({ roll: "", name: "", group_name: "None", student_id: "", gender: "", father_name: "", mother_name: "", date_of_birth: "", phone: "", address: "", blood_group: "" }); setEditingStudent(null); setDialogOpen(true); }}
                            disabled={!selectedSection}
                            className="bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 btn-press"
                        >
                            <Plus className="h-4 w-4 mr-2" />Add Student
                        </Button>
                    </div>
                }
            />

            {/* Filter Card */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Class</p>
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                            <SelectTrigger className="w-[160px] h-9 rounded-lg border-slate-200 bg-white text-sm">
                                <SelectValue placeholder="Select class" />
                            </SelectTrigger>
                            <SelectContent>
                                {classes.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Section</p>
                        <Select value={selectedSection} onValueChange={setSelectedSection}>
                            <SelectTrigger className="w-[160px] h-9 rounded-lg border-slate-200 bg-white text-sm">
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
            </div>

            {/* Auto-sync indicator bar */}
            {autoSyncEnabled && (
                <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                    <CardContent className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            <p className="text-sm text-primary dark:text-emerald-400 font-medium">
                                Auto-Sync ON â€” every {syncIntervalSec}s
                                {syncStatus === "syncing" && " (syncing...)"}
                                {syncStatus === "error" && " (error, retrying...)"}
                                {lastSyncTime && syncStatus === "idle" && ` â€” last: ${lastSyncTime.toLocaleTimeString()}`}
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setAutoSyncEnabled(false)} className="h-7 text-xs">
                            Stop Sync
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingStudent(null); if (open) setTimeout(() => rollInputRef.current?.focus(), 100); }}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingStudent ? "Edit Student" : "Add Student"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <div className="space-y-5 py-4">
                        {/* Core Info */}
                        <div className="grid gap-4 grid-cols-2">
                            <div className="space-y-2">
                                <Label>Roll Number *</Label>
                                <Input ref={rollInputRef} placeholder="e.g., 01" value={form.roll} onChange={(e) => setForm({ ...form, roll: e.target.value })} id="student-roll" data-field-index={0} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("student-name")?.focus(); }}} />
                            </div>
                            <div className="space-y-2">
                                <Label>Student ID</Label>
                                <Input placeholder="Auto-generated if empty" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Student Name *</Label>
                            <Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} id="student-name" />
                        </div>

                        {/* Personal Info */}
                        <div className="grid gap-4 grid-cols-2">
                            <div className="space-y-2">
                                <Label>Gender</Label>
                                <Select value={form.gender || "_none"} onValueChange={(v) => setForm({ ...form, gender: v === "_none" ? "" : v })}>
                                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">Not specified</SelectItem>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Date of Birth</Label>
                                <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid gap-4 grid-cols-2">
                            <div className="space-y-2">
                                <Label>Father&apos;s Name</Label>
                                <Input placeholder="Father's full name" value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Mother&apos;s Name</Label>
                                <Input placeholder="Mother's full name" value={form.mother_name} onChange={(e) => setForm({ ...form, mother_name: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid gap-4 grid-cols-2">
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input placeholder="+880 1XXX XXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Blood Group</Label>
                                <Input placeholder="e.g., A+, B-, O+" value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Address</Label>
                            <Input placeholder="Full address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                        </div>

                        {/* Group */}
                        <div className="space-y-2">
                            <Label>Group</Label>
                            <div className="flex w-full gap-2 pt-1">
                                {[{ value: "None", label: "None (General)" }, { value: "Science", label: "Science" }, { value: "Arts", label: "Arts" }, { value: "Commerce", label: "Commerce" }].map((opt) => (
                                    <label key={opt.value} className={`flex-1 flex items-center justify-center px-3 py-2.5 rounded-full border cursor-pointer transition-colors text-center ${form.group_name === opt.value ? "border-primary bg-primary/5 ring-1 ring-primary/30 text-primary font-medium" : "border-slate-200 bg-card hover:bg-slate-50 text-slate-600"}`}>
                                        <input type="radio" name="student-group" value={opt.value} checked={form.group_name === opt.value} onChange={() => setForm({ ...form, group_name: opt.value })} className="sr-only" />
                                        <span className="text-xs sm:text-sm whitespace-nowrap">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">{editingStudent ? "Update" : "Add"}</Button>
                    </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

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
                <DialogContent>
                    <DialogHeader><DialogTitle>Transfer Student</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="text-sm border-b pb-4 mb-2">
                            <p className="text-muted-foreground">Transferring</p>
                            <p className="font-semibold text-lg">{transferStudent?.name}</p>
                            <p className="text-xs text-muted-foreground">Current: {classes.find(c => c.id === transferStudent?.class_id)?.name} - {sections.find(s => s.id === transferStudent?.section_id)?.name} (Roll: {transferStudent?.roll})</p>
                        </div>
                        <div className="space-y-2">
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
                        <div className="space-y-2">
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
                        <div className="space-y-2">
                            <Label>New Roll Number</Label>
                            <Input value={transferRoll} onChange={(e) => setTransferRoll(e.target.value)} placeholder="Enter roll number" />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleTransfer} disabled={transferring || !transferTargetClass || !transferTargetSection || !transferRoll.trim()}>{transferring ? "Transferring..." : "Transfer"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import Dialog */}
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Import Students</DialogTitle></DialogHeader>
                    <Tabs defaultValue="csv" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="csv">CSV File</TabsTrigger>
                            <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="csv" className="space-y-6 pt-4 pb-2 min-h-[280px] flex flex-col">
                            <p className="text-sm text-muted-foreground">
                                Upload a CSV file with student data. Required headers: <strong className="font-mono bg-muted px-1 py-0.5 rounded">roll</strong>, <strong className="font-mono bg-muted px-1 py-0.5 rounded">name</strong>.
                            </p>
                            <div className="flex-1 flex justify-center items-center border-2 border-dashed rounded-lg p-8 hover:bg-muted/50 transition-colors">
                                <label className="flex flex-col items-center cursor-pointer w-full text-center">
                                    <Upload className="h-10 w-10 text-muted-foreground mb-4 mx-auto" />
                                    <span className="font-medium text-sm">Click to select CSV file</span>
                                    <input type="file" accept=".csv" className="hidden" onChange={(e) => {
                                        handleCSVImport(e);
                                        setImportDialogOpen(false);
                                    }} />
                                </label>
                            </div>
                        </TabsContent>

                        <TabsContent value="sheets" className="space-y-4 pt-4 min-h-[280px] flex flex-col">
                            <div className="space-y-3 flex-1">
                                <Input placeholder="Sheet ID or Link (e.g. docs.google.com/...)" value={sheetsForm.sheetId} onChange={(e) => {
                                    let val = e.target.value;
                                    const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                                    if (match) val = match[1];
                                    setSheetsForm({ ...sheetsForm, sheetId: val });
                                }} className="h-9" />
                                <Input placeholder="Range (e.g. A1:B50)" value={sheetsForm.range} onChange={(e) => setSheetsForm({ ...sheetsForm, range: e.target.value })} className="h-9" />
                                
                                <div className="flex items-center justify-between bg-muted/30 border rounded-md p-2 mt-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium">Auto-Sync</span>
                                        {autoSyncEnabled && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <input
                                                    type="range" min={5} max={10} value={syncIntervalSec}
                                                    onChange={(e) => setSyncIntervalSec(parseInt(e.target.value))}
                                                    className="w-20 h-1 bg-muted rounded-full appearance-none cursor-pointer accent-emerald-500"
                                                />
                                                <span className="text-[10px] text-muted-foreground">{syncIntervalSec}s</span>
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        variant={autoSyncEnabled ? "secondary" : "outline"}
                                        size="sm"
                                        className={`h-7 px-2 text-xs ${autoSyncEnabled ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border-emerald-200" : ""}`}
                                        onClick={async () => {
                                            if (!autoSyncEnabled) {
                                                if (!sheetsForm.sheetId || !sheetsForm.range) { toast.error("Required for sync"); return; }
                                                await supabase.from("sheet_configs").delete().eq("type", "students").eq("class_id", selectedClass).eq("section_id", selectedSection);
                                                await supabase.from("sheet_configs").insert({
                                                    type: "students", class_id: selectedClass, section_id: selectedSection,
                                                    sheet_id: sheetsForm.sheetId, sheet_range: sheetsForm.range
                                                });
                                                setAutoSyncEnabled(true);
                                                setImportDialogOpen(false);
                                                toast.success(`Sync Started`);
                                            } else {
                                                setAutoSyncEnabled(false);
                                                toast.info("Sync Stopped");
                                            }
                                        }}
                                    >
                                        <RefreshCw className={`h-3 w-3 mr-1 ${autoSyncEnabled ? "animate-spin text-emerald-600" : "text-muted-foreground"}`} />
                                        {autoSyncEnabled ? "ON" : "OFF"}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-dashed mt-auto">
                                <div className="text-xs text-muted-foreground flex gap-1 items-center">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> need: roll, name
                                </div>
                                <div className="flex gap-2">
                                    <DialogClose asChild><Button variant="ghost" size="sm">Cancel</Button></DialogClose>
                                    <Button size="sm" onClick={handleGoogleSheetsFetch} disabled={sheetsLoading}>{sheetsLoading ? "..." : "Import"}</Button>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {!loading && students.length === 0 && selectedSection && (
                <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-semibold text-lg mb-1">No students yet</h3>
                        <p className="text-sm text-muted-foreground">Add students manually or import from CSV.</p>
                    </CardContent>
                </Card>
            )}

            {students.length > 0 && (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-20">Roll</TableHead>
                                    <TableHead className="w-28 text-muted-foreground">ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="text-muted-foreground">Gender</TableHead>
                                    <TableHead className="text-muted-foreground">Phone</TableHead>
                                    <TableHead className="text-muted-foreground">Father&apos;s Name</TableHead>
                                    <TableHead>Group</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.map((student) => (
                                    <TableRow key={student.id} className="cursor-pointer hover:bg-slate-50/80 transition-colors" onClick={() => { setProfileStudent(student); setProfileDialogOpen(true); }}>
                                        <TableCell className="font-mono">{student.roll}</TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{student.student_id || '-'}</TableCell>
                                        <TableCell className="font-medium">{student.name}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{student.gender || '-'}</TableCell>
                                        <TableCell className="font-mono text-sm">{student.phone || '-'}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{student.father_name || '-'}</TableCell>
                                        <TableCell>
                                            {student.group_name ? (
                                                <Badge variant="secondary" className="font-normal">{student.group_name}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-teal-600 hover:bg-teal-100 hover:text-teal-700 active:bg-teal-200 rounded-full" title="Transfer Student" onClick={(e) => { e.stopPropagation(); setTransferStudent(student); setTransferTargetClass(student.class_id); setTransferRoll(student.roll); setTransferDialogOpen(true); }}>
                                                    <MoveRight className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditingStudent(student); setForm({ roll: student.roll, name: student.name, group_name: student.group_name || "None", student_id: student.student_id || "", gender: student.gender || "", father_name: student.father_name || "", mother_name: student.mother_name || "", date_of_birth: student.date_of_birth || "", phone: student.phone || "", address: student.address || "", blood_group: student.blood_group || "" }); setDialogOpen(true); }}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20" onClick={(e) => { e.stopPropagation(); handleDelete(student); }}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {/* Quick-add row */}
                        <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/10">
                            <Input
                                ref={quickAddRollRef}
                                placeholder="Roll"
                                value={quickAdd.roll}
                                onChange={(e) => setQuickAdd({ ...quickAdd, roll: e.target.value })}
                                className="w-20 h-8 text-sm text-center font-mono"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        document.getElementById("quick-add-name")?.focus();
                                    }
                                }}
                            />
                            <Input
                                id="quick-add-name"
                                placeholder="Student name — press Enter to add"
                                value={quickAdd.name}
                                onChange={(e) => setQuickAdd({ ...quickAdd, name: e.target.value })}
                                className="flex-1 h-8 text-sm"
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
                                            toast.error(err instanceof Error ? err.message : "Failed to add");
                                        }
                                    }
                                }}
                            />
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Enter ↵</span>
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
                    Loading…
                </div>
            }
        >
            <StudentsPageContent />
        </Suspense>
    );
}
