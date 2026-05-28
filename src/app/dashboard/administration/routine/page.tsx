// Class Routine Dashboard — table grid, click-to-edit, print with school info
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    CLASS_COLUMNS,
    CLASS_ROUTINE_COLUMNS,
    SECTION_COLUMNS,
    SUBJECT_COLUMNS,
    TEACHER_COLUMNS,
} from "@/lib/supabase/select-columns";
import type { Class, Section, Subject, Teacher, ClassRoutine } from "@/lib/database.types";
import type { RoutineSettings } from "@/types/routine";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    CalendarClock, Trash2, AlertCircle, Printer,
    Users, LayoutGrid, AlertTriangle
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";

const DAY_NAMES = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

type ViewMode = "class" | "teacher";

interface SchoolInfo {
    name: string;
    address: string;
    phone: string;
    email: string;
    logo_url: string;
}

function timeToMinutes(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

function formatTime12(t: string): string {
    try {
        const [h, m] = t.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
    } catch { return t; }
}

function generatePeriodSlots(settings: RoutineSettings | null) {
    const periodsPerDay = settings?.periods_per_day ?? 7;
    const fallbackDuration = settings?.period_duration_minutes ?? 45;
    const periodDurations = settings?.period_durations || [];
    const breakAfterPeriod = settings?.break_after_period ?? 3;
    const breakDuration = settings?.break_duration_minutes ?? 20;
    const classStartTime = settings?.class_start_time ?? "08:00";

    const [startH, startM] = classStartTime.split(":").map(Number);
    let currentMinutes = startH * 60 + startM;
    const slots: { period: number; start: string; end: string }[] = [];

    for (let p = 1; p <= periodsPerDay; p++) {
        const startMin = currentMinutes;
        const currentPeriodDuration = periodDurations[p - 1] ?? fallbackDuration;
        const endMin = startMin + currentPeriodDuration;
        slots.push({
            period: p,
            start: `${Math.floor(startMin / 60).toString().padStart(2, "0")}:${(startMin % 60).toString().padStart(2, "0")}`,
            end: `${Math.floor(endMin / 60).toString().padStart(2, "0")}:${(endMin % 60).toString().padStart(2, "0")}`,
        });
        currentMinutes = endMin;
        if (p === breakAfterPeriod && breakDuration > 0 && p < periodsPerDay) {
            currentMinutes += breakDuration;
        }
    }
    return slots;
}

export default function RoutinePage() {
    const supabase = useMemo(() => createClient(), []);

    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [routines, setRoutines] = useState<ClassRoutine[]>([]);
    const [allRoutines, setAllRoutines] = useState<ClassRoutine[]>([]);
    const [settings, setSettings] = useState<RoutineSettings | null>(null);
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);

    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedTeacher, setSelectedTeacher] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>("class");
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [conflictWarnings, setConflictWarnings] = useState<string[]>([]);

    // For teacher view editing, we need to pick class+section
    const [dialogClassId, setDialogClassId] = useState("");
    const [dialogSectionId, setDialogSectionId] = useState("");
    const [dialogSections, setDialogSections] = useState<Section[]>([]);
    const [dialogSubjects, setDialogSubjects] = useState<Subject[]>([]);

    const [formData, setFormData] = useState({
        id: "",
        subject_id: "",
        teacher_id: "",
        day_of_week: 0,
        start_time: "08:00",
        end_time: "08:45",
    });

    const periodSlots = useMemo(() => generatePeriodSlots(settings), [settings]);
    const workingDays = useMemo(() => settings?.working_days || DAY_NAMES, [settings]);

    // Load initial data
    useEffect(() => {
        (async () => {
            const [cRes, tRes, settingsRes, schoolRes] = await Promise.all([
                supabase.from("classes").select(CLASS_COLUMNS).order("numeric_value"),
                supabase.from("teachers").select(TEACHER_COLUMNS).order("name"),
                fetch("/api/administration/routine/settings").then((r) => r.json()),
                supabase.from("school_info").select("name, address, phone, email, logo_url").limit(1).single(),
            ]);
            setClasses(cRes.data || []);
            setTeachers(tRes.data || []);
            if (settingsRes.success && settingsRes.data) setSettings(settingsRes.data);
            if (schoolRes.data) setSchoolInfo(schoolRes.data as SchoolInfo);
            setLoading(false);
        })();
    }, [supabase]);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.from("class_routines").select(CLASS_ROUTINE_COLUMNS).order("day_of_week").order("start_time");
            setAllRoutines(data || []);
        })();
    }, [supabase]);

    useEffect(() => {
        if (!selectedClass) { setSections([]); setSelectedSection(""); return; }
        (async () => {
            const { data } = await supabase.from("sections").select(SECTION_COLUMNS).eq("class_id", selectedClass).order("name");
            setSections(data || []);
            setSelectedSection("");
        })();
    }, [selectedClass, supabase]);

    useEffect(() => {
        if (!selectedClass) { setSubjects([]); return; }
        (async () => {
            const { data } = await supabase.from("subjects").select(SUBJECT_COLUMNS).eq("class_id", selectedClass).order("name");
            setSubjects(data || []);
        })();
    }, [selectedClass, supabase]);

    // Load dialog sections/subjects when class changes (for teacher view)
    useEffect(() => {
        if (!dialogClassId) { setDialogSections([]); setDialogSectionId(""); setDialogSubjects([]); return; }
        (async () => {
            const [secRes, subRes] = await Promise.all([
                supabase.from("sections").select(SECTION_COLUMNS).eq("class_id", dialogClassId).order("name"),
                supabase.from("subjects").select(SUBJECT_COLUMNS).eq("class_id", dialogClassId).order("name"),
            ]);
            setDialogSections(secRes.data || []);
            setDialogSubjects(subRes.data || []);
            setDialogSectionId("");
        })();
    }, [dialogClassId, supabase]);

    const loadRoutines = useCallback(async () => {
        if (viewMode === "class") {
            if (!selectedClass || !selectedSection) { setRoutines([]); return; }
            const { data } = await supabase.from("class_routines").select(CLASS_ROUTINE_COLUMNS)
                .eq("class_id", selectedClass).eq("section_id", selectedSection)
                .order("day_of_week").order("start_time");
            setRoutines(data || []);
        } else {
            if (!selectedTeacher) { setRoutines([]); return; }
            const { data } = await supabase.from("class_routines").select(CLASS_ROUTINE_COLUMNS)
                .eq("teacher_id", selectedTeacher)
                .order("day_of_week").order("start_time");
            setRoutines(data || []);
        }
    }, [selectedClass, selectedSection, selectedTeacher, viewMode, supabase]);

    useEffect(() => { loadRoutines(); }, [loadRoutines]);

    // Conflict check
    useEffect(() => {
        if (!formData.teacher_id || !formData.start_time || !formData.end_time) { setConflictWarnings([]); return; }
        const check = async () => {
            try {
                const res = await fetch("/api/administration/routine/conflict-check", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        teacher_id: formData.teacher_id,
                        day_of_week: formData.day_of_week, start_time: formData.start_time,
                        end_time: formData.end_time, exclude_id: formData.id || undefined,
                    }),
                });
                const result = await res.json();
                if (result.success && result.data.has_conflict) {
                    setConflictWarnings(result.data.conflicts.map((c: { message: string }) => c.message));
                } else { setConflictWarnings([]); }
            } catch { /* ignore */ }
        };
        const timer = setTimeout(check, 300);
        return () => clearTimeout(timer);
    }, [formData.teacher_id, formData.day_of_week, formData.start_time, formData.end_time, formData.id]);

    const getName = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name || "";
    const getTeacher = (id: string) => teachers.find((x) => x.id === id);

    const findRoutineForSlot = (dayIndex: number, slot: { start: string; end: string }) => {
        return routines.find((r) => r.day_of_week === dayIndex && r.start_time === slot.start && r.end_time === slot.end);
    };

    const openCellDialog = (dayIndex: number, slot: { period: number; start: string; end: string }) => {
        const existing = findRoutineForSlot(dayIndex, slot);
        if (existing) {
            setFormData({ id: existing.id, subject_id: existing.subject_id, teacher_id: existing.teacher_id, day_of_week: dayIndex, start_time: slot.start, end_time: slot.end });
            if (viewMode === "teacher") {
                setDialogClassId(existing.class_id);
                setDialogSectionId(existing.section_id);
            }
        } else {
            setFormData({ id: "", subject_id: "", teacher_id: viewMode === "teacher" ? selectedTeacher : "", day_of_week: dayIndex, start_time: slot.start, end_time: slot.end });
            if (viewMode === "teacher") {
                setDialogClassId("");
                setDialogSectionId("");
            }
        }
        setConflictWarnings([]);
        setDialogOpen(true);
    };

    const handleSave = async (skipDuplicateCheck = false) => {
        const classId = viewMode === "class" ? selectedClass : dialogClassId;
        const sectionId = viewMode === "class" ? selectedSection : dialogSectionId;

        if (!formData.subject_id || !formData.teacher_id || !classId || !sectionId) {
            toast.error("Please fill in all required fields");
            return;
        }

        // Check if same subject is already assigned to a different teacher in the same class+section
        if (!skipDuplicateCheck) {
            const existingForSubject = allRoutines.find(
                (r) => r.class_id === classId && r.section_id === sectionId && r.subject_id === formData.subject_id && r.teacher_id !== formData.teacher_id && r.id !== formData.id
            );
            if (existingForSubject) {
                const currentTeacherName = getName(teachers, existingForSubject.teacher_id);
                const newTeacherName = getName(teachers, formData.teacher_id);
                const subjectName = getName(viewMode === "class" ? subjects : dialogSubjects, formData.subject_id);
                const confirmed = window.confirm(
                    `"${subjectName}" is currently assigned to "${currentTeacherName}".\n\nDo you want to change the teacher to "${newTeacherName}"?`
                );
                if (!confirmed) return;
            }
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/administration/routine", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    class_id: classId,
                    section_id: sectionId,
                }),
            });
            const result = await res.json();
            if (!result.success) { toast.error(result.error); return; }
            toast.success(formData.id ? "Updated" : "Added");
            setDialogOpen(false);
            loadRoutines();
            const { data } = await supabase.from("class_routines").select(CLASS_ROUTINE_COLUMNS).order("day_of_week").order("start_time");
            setAllRoutines(data || []);
        } catch { toast.error("Failed to save"); }
        finally { setSubmitting(false); }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/administration/routine?id=${id}`, { method: "DELETE" });
            const result = await res.json();
            if (!result.success) { toast.error(result.error); return; }
            toast.success("Deleted");
            loadRoutines();
            const { data } = await supabase.from("class_routines").select(CLASS_ROUTINE_COLUMNS).order("day_of_week").order("start_time");
            setAllRoutines(data || []);
        } catch { toast.error("Failed to delete"); }
    };

    const hasConflict = (r: ClassRoutine) => {
        return allRoutines.some((other) =>
            other.id !== r.id && other.teacher_id === r.teacher_id && other.day_of_week === r.day_of_week &&
            timeToMinutes(other.start_time) < timeToMinutes(r.end_time) && timeToMinutes(r.start_time) < timeToMinutes(other.end_time)
        );
    };

    const globalConflicts = useMemo(() => {
        const conflicts: { teacherName: string; day: string; details: string }[] = [];
        const byTeacherDay = new Map<string, ClassRoutine[]>();
        for (const r of allRoutines) {
            const key = `${r.teacher_id}__${r.day_of_week}`;
            if (!byTeacherDay.has(key)) byTeacherDay.set(key, []);
            byTeacherDay.get(key)!.push(r);
        }
        for (const [, group] of byTeacherDay) {
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    const a = group[i], b = group[j];
                    if (timeToMinutes(a.start_time) < timeToMinutes(b.end_time) && timeToMinutes(b.start_time) < timeToMinutes(a.end_time)) {
                        conflicts.push({ teacherName: getName(teachers, a.teacher_id), day: DAY_NAMES[a.day_of_week] || `Day ${a.day_of_week}`, details: `${formatTime12(a.start_time)}-${formatTime12(a.end_time)} ↔ ${formatTime12(b.start_time)}-${formatTime12(b.end_time)}` });
                    }
                }
            }
        }
        return conflicts;
    }, [allRoutines, teachers]);

    const handlePrint = () => {
        document.body.classList.add("printing-routine");
        // Inject landscape @page style
        const landscapeStyle = document.createElement("style");
        landscapeStyle.id = "routine-landscape-print";
        landscapeStyle.textContent = "@page { size: A4 landscape !important; margin: 6mm !important; }";
        document.head.appendChild(landscapeStyle);
        setTimeout(() => {
            window.print();
            document.body.classList.remove("printing-routine");
            landscapeStyle.remove();
        }, 100);
    };

    if (loading) {
        return (<div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>);
    }

    const selectedClassName = getName(classes, selectedClass);
    const selectedSectionName = getName(sections, selectedSection);
    const hasSelection = viewMode === "class" ? (selectedClass && selectedSection) : selectedTeacher;

    // For teacher view dialog, use dialog-specific subjects; for class view use main subjects
    const activeSubjects = viewMode === "teacher" ? dialogSubjects : subjects;

    return (
        <div className="space-y-5">
            {/* Header */}
            <PageHeader
                icon={CalendarClock}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                title="Class Routine"
                subtitle="Weekly class schedule with conflict detection."
                actions={
                    hasSelection ? (
                        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                            <Printer className="h-4 w-4" /> Print
                        </Button>
                    ) : undefined
                }
            />

            {/* Conflict Alerts */}
            {globalConflicts.length > 0 && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 p-3 no-print">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{globalConflicts.length} Conflict{globalConflicts.length > 1 ? "s" : ""} Detected</p>
                            {globalConflicts.slice(0, 3).map((c, i) => (
                                <p key={i} className="text-xs text-amber-700 dark:text-amber-400/80 mt-0.5"><span className="font-medium">{c.teacherName}</span> — {c.day}: {c.details}</p>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* View Toggle & Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap no-print">
                <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
                    <button onClick={() => setViewMode("class")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "class" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                        <LayoutGrid className="h-3.5 w-3.5" /> Class View
                    </button>
                    <button onClick={() => setViewMode("teacher")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "teacher" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                        <Users className="h-3.5 w-3.5" /> Teacher View
                    </button>
                </div>
                {viewMode === "class" ? (
                    <>
                        <Select value={selectedClass} onValueChange={setSelectedClass}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Select Class" /></SelectTrigger><SelectContent>{classes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent></Select>
                        <Select value={selectedSection} onValueChange={setSelectedSection}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Select Section" /></SelectTrigger><SelectContent>{sections.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent></Select>
                    </>
                ) : (
                    <Select value={selectedTeacher} onValueChange={setSelectedTeacher}><SelectTrigger className="w-[220px]"><SelectValue placeholder="Select Teacher" /></SelectTrigger><SelectContent>{teachers.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent></Select>
                )}
                {teachers.length === 0 && (<div className="flex items-center gap-1.5 text-amber-600 text-sm"><AlertCircle className="h-4 w-4" /><span>Add teachers first</span></div>)}
            </div>

            {/* Print Header with School Info */}
            <div className="print-header">
                {schoolInfo?.logo_url && (
                    <img src={schoolInfo.logo_url} alt="Logo" style={{ height: 48, margin: "0 auto 6px", display: "block" }} />
                )}
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{schoolInfo?.name || "School Name"}</h2>
                {schoolInfo?.address && <p style={{ fontSize: 12, margin: "2px 0" }}>{schoolInfo.address}</p>}
                {(schoolInfo?.phone || schoolInfo?.email) && (
                    <p style={{ fontSize: 11, margin: "2px 0", color: "#555" }}>
                        {schoolInfo?.phone && `Phone: ${schoolInfo.phone}`}
                        {schoolInfo?.phone && schoolInfo?.email && " | "}
                        {schoolInfo?.email && `Email: ${schoolInfo.email}`}
                    </p>
                )}
                <div style={{ borderTop: "2px solid #1a365d", marginTop: 8, paddingTop: 6 }}>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>
                        {viewMode === "class"
                            ? `Class: ${selectedClassName} — Section: ${selectedSectionName}`
                            : `Teacher: ${getName(teachers, selectedTeacher)}`}
                    </p>
                    <p style={{ fontSize: 12, color: "#555" }}>Weekly Class Routine</p>
                </div>
            </div>

            {/* TABLE GRID */}
            {hasSelection ? (
                <div className="routine-table-wrapper">
                    <table className="routine-table">
                        <thead>
                            <tr>
                                <th className="day-header">Day</th>
                                {periodSlots.map((slot) => (
                                    <th key={slot.period} className="period-header">
                                        <div className="font-semibold">Period {slot.period}</div>
                                        <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85 }}>{formatTime12(slot.start)} - {formatTime12(slot.end)}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {workingDays.map((dayName, dayIndex) => (
                                <tr key={dayIndex}>
                                    <td className="day-cell"><span className="font-semibold text-xs uppercase tracking-wide">{dayName}</span></td>
                                    {periodSlots.map((slot) => {
                                        const entry = findRoutineForSlot(dayIndex, slot);
                                        const conflict = entry ? hasConflict(entry) : false;
                                        const teacher = entry ? getTeacher(entry.teacher_id) : null;

                                        return (
                                            <td
                                                key={slot.period}
                                                onClick={() => openCellDialog(dayIndex, slot)}
                                                className={`period-cell ${entry ? "filled" : "empty"} ${conflict ? "conflict" : ""}`}
                                            >
                                                {entry ? (
                                                    <div className="cell-content">
                                                        {conflict && <AlertTriangle className="h-3 w-3 text-red-500 absolute top-1 right-1 no-print" />}
                                                        {viewMode === "class" ? (
                                                            <>
                                                                <div className="subject-name">{getName(subjects, entry.subject_id)}</div>
                                                                <div className="teacher-name">{teacher?.name || ""}</div>
                                                                {teacher?.phone && <div className="teacher-phone">{teacher.phone}</div>}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="subject-name">{getName(classes, entry.class_id)} — {getName(sections, entry.section_id)}</div>
                                                                <div className="teacher-name">{getName(subjects, entry.subject_id)}</div>
                                                            </>
                                                        )}
                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }} className="delete-btn no-print">
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="empty-cell">—</div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg no-print">
                    <CalendarClock className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-1">{viewMode === "class" ? "Select Class & Section" : "Select a Teacher"}</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">{viewMode === "class" ? "Choose a class and section to view or manage the weekly routine." : "Choose a teacher to view their weekly schedule."}</p>
                </div>
            )}

            {/* Teacher Quick Overview */}
            {viewMode === "class" && !selectedClass && teachers.length > 0 && (
                <div className="no-print">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Teacher Overview</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {teachers.map((t) => {
                            const count = allRoutines.filter((r) => r.teacher_id === t.id).length;
                            const conflict = globalConflicts.some((c) => c.teacherName === t.name);
                            return (
                                <button key={t.id} onClick={() => { setViewMode("teacher"); setSelectedTeacher(t.id); }}
                                    className={`text-left rounded-lg p-3 transition-colors ${conflict ? "bg-red-50 dark:bg-red-500/10 border border-red-200 hover:bg-red-100" : "bg-accent/50 hover:bg-accent"}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium truncate">{t.name}</span>
                                        <Badge variant="secondary" className="text-[10px] ml-2 shrink-0">{count}</Badge>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">{t.designation || t.subject_specialty || "Teacher"}</div>
                                    {conflict && (<div className="flex items-center gap-1 mt-1"><AlertTriangle className="h-3 w-3 text-red-500" /><span className="text-[10px] text-red-600 font-medium">Has conflicts</span></div>)}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{formData.id ? "Edit" : "Add"} — {DAY_NAMES[formData.day_of_week]}, {formData.start_time} - {formData.end_time}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        {conflictWarnings.length > 0 && (
                            <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3">
                                <div className="flex items-center gap-1.5 mb-1"><AlertTriangle className="h-4 w-4 text-red-500" /><span className="text-sm font-medium text-red-700 dark:text-red-400">Conflict Warning</span></div>
                                {conflictWarnings.map((w, i) => (<p key={i} className="text-xs text-red-600 dark:text-red-400/80 mt-0.5">{w}</p>))}
                            </div>
                        )}

                        {/* Teacher view: need to pick class + section */}
                        {viewMode === "teacher" && (
                            <>
                                <div className="grid gap-1.5">
                                    <Label>Class *</Label>
                                    <Select value={dialogClassId} onValueChange={setDialogClassId}>
                                        <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                                        <SelectContent>{classes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Section *</Label>
                                    <Select value={dialogSectionId} onValueChange={setDialogSectionId}>
                                        <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                                        <SelectContent>{dialogSections.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}

                        <div className="grid gap-1.5">
                            <Label>Subject *</Label>
                            <Select value={formData.subject_id} onValueChange={(v) => setFormData((p) => ({ ...p, subject_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                                <SelectContent>{activeSubjects.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Teacher *</Label>
                            <Select value={formData.teacher_id} onValueChange={(v) => setFormData((p) => ({ ...p, teacher_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select Teacher" /></SelectTrigger>
                                <SelectContent>{teachers.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        <Button onClick={() => handleSave()} disabled={submitting} className="mt-2">{submitting ? "Saving..." : formData.id ? "Update" : "Add Period"}</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Styles */}
            <style jsx global>{`
                .print-header { display: none; text-align: center; }
                .routine-table-wrapper { overflow-x: auto; border-radius: 8px; border: 1px solid #cbd5e0; }
                .dark .routine-table-wrapper { border-color: #4a5568; }
                .routine-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .routine-table th, .routine-table td {
                    border-right: 1px solid #cbd5e0;
                    border-bottom: 1px solid #cbd5e0;
                    padding: 6px 8px;
                    text-align: center;
                    vertical-align: middle;
                }
                .routine-table th:last-child, .routine-table td:last-child { border-right: none; }
                .routine-table tbody tr:last-child td { border-bottom: none; }
                .dark .routine-table th, .dark .routine-table td { border-color: #4a5568; }
                .day-header { background: #1a365d; color: #fff; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; width: 100px; min-width: 100px; border-color: #2d3748 !important; }
                .period-header { background: #1a365d; color: #fff; font-size: 11px; padding: 6px 4px; min-width: 110px; border-color: #2d3748 !important; }
                .day-cell { background: #f0f4ff; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; }
                .dark .day-cell { background: hsl(var(--muted)); }
                .period-cell { position: relative; min-height: 60px; transition: background-color 0.15s; cursor: pointer; }
                .period-cell.empty:hover { background: hsl(var(--accent)); }
                .period-cell.filled { background: hsl(var(--accent) / 0.5); }
                .period-cell.filled:hover { background: hsl(var(--accent)); }
                .period-cell.conflict { background: hsl(0 84% 96%) !important; }
                .dark .period-cell.conflict { background: hsl(0 60% 15% / 0.5) !important; }
                .cell-content { position: relative; }
                .subject-name { font-weight: 600; font-size: 11px; line-height: 1.3; color: hsl(var(--foreground)); }
                .teacher-name { font-size: 10px; color: hsl(var(--muted-foreground)); margin-top: 1px; }
                .teacher-phone { font-size: 9px; color: hsl(var(--muted-foreground)); opacity: 0.7; }
                .empty-cell { color: hsl(var(--muted-foreground)); opacity: 0.3; font-size: 14px; }
                .delete-btn { position: absolute; top: -2px; right: -2px; opacity: 0; padding: 2px; border-radius: 4px; transition: opacity 0.15s; color: hsl(var(--muted-foreground)); }
                .period-cell:hover .delete-btn { opacity: 1; }
                .delete-btn:hover { color: hsl(0 72% 50%); background: hsl(0 72% 50% / 0.1); }
            `}</style>
        </div>
    );
}
