// Class Routine Dashboard — table grid, click-to-edit, print with school info
"use client";

import { useEffect, useState, useMemo, useCallback, type MouseEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { printHtml } from "@/lib/print-utils";
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
import { CalendarCheck, Trash2 as Trash, AlertCircle as WarningCircle, Printer, Users, LayoutGrid as GridFour, AlertTriangle as Warning, Plus } from "lucide-react";
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
                supabase.from("teachers").select(TEACHER_COLUMNS).eq("employee_type", "teacher").order("name"),
                fetch("/api/administration/routine/settings").then((r) => r.json()),
                (supabase as any).from("school_info").select("name, address, phone, email, logo_url").limit(1).single(),
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
            const { data } = await (supabase as any).from("class_routines").select(CLASS_ROUTINE_COLUMNS).order("day_of_week").order("start_time");
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

    const findRoutinesForSlot = (dayIndex: number, slot: { start: string; end: string }) => {
        return routines.filter((r) => r.day_of_week === dayIndex && r.start_time === slot.start && r.end_time === slot.end);
    };

    const openCellDialog = (dayIndex: number, slot: { period: number; start: string; end: string }, existingId?: string) => {
        if (existingId) {
            const existing = routines.find((r) => r.id === existingId);
            if (existing) {
                setFormData({ id: existing.id, subject_id: existing.subject_id, teacher_id: existing.teacher_id, day_of_week: dayIndex, start_time: slot.start, end_time: slot.end });
                if (viewMode === "teacher") {
                    setDialogClassId(existing.class_id);
                    setDialogSectionId(existing.section_id);
                }
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
        // Build table HTML from current data
        const headerCells = periodSlots.map((slot) =>
            `<th>Period ${slot.period}<br><span style="font-weight:400;font-size:8px;color:#000">${formatTime12(slot.start)} - ${formatTime12(slot.end)}</span></th>`
        ).join("");

        const bodyRows = workingDays.map((dayName, dayIndex) => {
            const cells = periodSlots.map((slot) => {
                const entries = findRoutinesForSlot(dayIndex, slot);
                if (entries.length === 0) return `<td class="empty">—</td>`;
                if (viewMode === "class") {
                    const parts = entries.map((entry) => {
                        const teacher = getTeacher(entry.teacher_id);
                        return `<div class="subj">${getName(subjects, entry.subject_id)}</div><div class="tchr">${teacher?.name || ""}</div>${teacher?.phone ? `<div class="tchr-ph">${teacher.phone}</div>` : ""}`;
                    });
                    return `<td>${parts.join('<div class="multi-sep"></div>')}</td>`;
                } else {
                    const parts = entries.map((entry) => {
                        return `<div class="subj">${getName(classes, entry.class_id)} — ${getName(sections, entry.section_id)}</div><div class="tchr">${getName(subjects, entry.subject_id)}</div>`;
                    });
                    return `<td>${parts.join('<div class="multi-sep"></div>')}</td>`;
                }
            }).join("");
            return `<tr><td class="day-col">${dayName}</td>${cells}</tr>`;
        }).join("");

        const title = viewMode === "class"
            ? `Class: ${selectedClassName} — Section: ${selectedSectionName}`
            : `Teacher: ${getName(teachers, selectedTeacher)}`;

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Class Routine</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
<style>
@page { size: A4 landscape; margin: 8mm 6mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; color: #000; font-size: 12px; line-height: 1.5; background: #fff; padding: 20px; }

.school-info { text-align: center; margin-bottom: 20px; }
.school-info img { max-height: 46px; margin-bottom: 8px; }
.school-info h2 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #000; }
.school-info p { font-size: 11px; color: #000; margin-top: 3px; }

.header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #000; }
.header-title h1 { font-size: 22px; font-weight: 900; letter-spacing: -1px; line-height: 1; text-transform: uppercase; color: #000; }
.header-title p { font-size: 11px; font-weight: 600; color: #000; letter-spacing: 2px; text-transform: uppercase; margin-top: 5px; }

.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
.info-item { display: flex; align-items: baseline; }
.info-item .lbl { flex-shrink: 0; display: flex; justify-content: space-between; margin-right: 6px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #000; }
.info-item .lbl::after { content: ':'; }
.info-item .val { font-size: 13px; font-weight: 600; color: #000; }

table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
th { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #000; padding: 8px 4px; text-align: center; border: 1px solid #000; border-bottom: 2.5px solid #000; vertical-align: middle; }
td { padding: 6px 4px; text-align: center; vertical-align: middle; font-size: 11px; border: 1px solid #000; color: #000; }
td.day-col { font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; width: 85px; min-width: 85px; color: #000; }
td.empty { color: #000; }
.subj { font-weight: 700; font-size: 10px; color: #000; }
.tchr { font-size: 8.5px; color: #000; margin-top: 1px; }
.tchr-ph { font-size: 7.5px; color: #000; margin-top: 1px; }
.multi-sep { border-top: 1px dashed #000; margin: 3px 0; }

.footer { text-align: center; font-size: 9px; color: #000; margin-top: 24px; padding-top: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
@media print { body { padding: 10px; } }
</style></head><body>

<div class="school-info">
${schoolInfo?.logo_url ? `<img src="${schoolInfo.logo_url}" alt="Logo">` : ""}
<h2>${schoolInfo?.name || "School Name"}</h2>
<p>${schoolInfo?.address || ""}${schoolInfo?.phone ? " • " + schoolInfo.phone : ""}${schoolInfo?.email ? " • " + schoolInfo.email : ""}</p>
</div>

<div class="header">
<div class="header-title"><h1>Weekly Class Routine</h1><p>${title}</p></div>
</div>

<table>
<thead><tr><th style="width:85px">Day</th>${headerCells}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>

<div class="footer">Computer Generated Document &bull; No Signature Required</div>

</body></html>`;

        printHtml(html);
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
                icon={CalendarCheck}
                title="Class Routine"
                subtitle="Weekly class schedule with conflict detection."
                className="no-print"
                actions={
                    hasSelection ? (
                        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                            <Printer size={16} strokeWidth={1.5} className=" " /> Print
                        </Button>
                    ) : undefined
                }
            />

            {/* Conflict Alerts */}
            {globalConflicts.length > 0 && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 p-3 no-print">
                    <div className="flex items-start gap-2">
                        <Warning size={16} strokeWidth={1.5} className=" text-amber-600 shrink-0 mt-0.5" />
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
                        <GridFour className="h-3.5 w-3.5" /> Class View
                    </button>
                    <button onClick={() => setViewMode("teacher")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "teacher" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                        <Users size={12} strokeWidth={1.5} className=".5 .5" /> Teacher View
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
                {teachers.length === 0 && (<div className="flex items-center gap-1.5 text-amber-600 text-sm"><WarningCircle size={16} strokeWidth={1.5} className=" " /><span>Add teachers first</span></div>)}
            </div>

            {/* Print Header with School Info */}
            <div className="print-header">
                {schoolInfo?.logo_url && (
                    <img src={schoolInfo.logo_url} alt="Logo" />
                )}
                <h2>{schoolInfo?.name || "School Name"}</h2>
                {schoolInfo?.address && <p style={{ fontSize: 13 }}>{schoolInfo.address}</p>}
                {(schoolInfo?.phone || schoolInfo?.email) && (
                    <p style={{ fontSize: 11 }}>
                        {schoolInfo?.phone && `☎ ${schoolInfo.phone}`}
                        {schoolInfo?.phone && schoolInfo?.email && "  •  "}
                        {schoolInfo?.email && `✉ ${schoolInfo.email}`}
                    </p>
                )}
                <div className="print-header-divider">
                    <p>
                        {viewMode === "class"
                            ? `Class: ${selectedClassName} — Section: ${selectedSectionName}`
                            : `Teacher: ${getName(teachers, selectedTeacher)}`}
                    </p>
                    <p>Weekly Class Routine</p>
                </div>
            </div>

            {/* TABLE GRID */}
            {hasSelection ? (
                <>
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
                                        const entries = findRoutinesForSlot(dayIndex, slot);
                                        const anyConflict = entries.some((e) => hasConflict(e));

                                        return (
                                            <td
                                                key={slot.period}
                                                className={`period-cell ${entries.length > 0 ? "filled" : "empty"} ${anyConflict ? "conflict" : ""}`}
                                                onClick={() => { if (entries.length === 0) openCellDialog(dayIndex, slot); }}
                                            >
                                                {entries.length > 0 ? (
                                                    <div className="cell-content multi-cell">
                                                        {entries.map((entry, idx) => {
                                                            const conflict = hasConflict(entry);
                                                            const teacher = getTeacher(entry.teacher_id);
                                                            return (
                                                                <div key={entry.id} className={`multi-entry ${idx > 0 ? "multi-entry-border" : ""}`}>
                                                                    {conflict && <Warning size={10} strokeWidth={1.5} className="text-red-500 absolute top-0 right-0 no-print" />}
                                                                    <div className="multi-entry-content" onClick={(e: MouseEvent) => { e.stopPropagation(); openCellDialog(dayIndex, slot, entry.id); }}>
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
                                                                    </div>
                                                                    <button onClick={(e: MouseEvent) => { e.stopPropagation(); handleDelete(entry.id); }} className="delete-btn no-print">
                                                                        <Trash size={10} strokeWidth={1.5} />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                        <button
                                                            onClick={(e: MouseEvent) => { e.stopPropagation(); openCellDialog(dayIndex, slot); }}
                                                            className="add-more-btn no-print"
                                                            title="Add another subject"
                                                        >
                                                            <Plus size={12} strokeWidth={2} />
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

                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg no-print">
                    <CalendarCheck className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-1">{viewMode === "class" ? "Select Class & Section" : "Select a Teacher"}</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">{viewMode === "class" ? "Choose a class and section to view or manage the weekly routine." : "Choose a teacher to view their weekly schedule."}</p>
                </div>
            )}

            {/* Teacher Quick Overview */}
            {viewMode === "class" && !selectedClass && teachers.length > 0 && (
                <div className="no-print">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users size={16} strokeWidth={1.5} className=" text-muted-foreground" /> Teacher Overview</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {teachers.map((t) => {
                            const count = allRoutines.filter((r) => r.teacher_id === t.id).length;
                            const conflict = globalConflicts.some((c) => c.teacherName === t.name);
                            return (
                                <button key={t.id} onClick={() => { setViewMode("teacher"); setSelectedTeacher(t.id); }}
                                    className={`text-left rounded-lg p-3 transition-colors ${conflict ? "bg-destructive/10 dark:bg-destructive/100/10 border border-red-200 hover:bg-red-100" : "bg-accent/50 hover:bg-accent"}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium truncate">{t.name}</span>
                                        <Badge variant="secondary" className="text-[10px] ml-2 shrink-0">{count}</Badge>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">{t.designation || t.subject_specialty || "Teacher"}</div>
                                    {conflict && (<div className="flex items-center gap-1 mt-1"><Warning size={12} strokeWidth={1.5} className=" text-red-500" /><span className="text-[10px] text-destructive font-medium">Has conflicts</span></div>)}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Add/PencilSimple Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{formData.id ? "Edit" : "Add"} — {DAY_NAMES[formData.day_of_week]}, {formData.start_time} - {formData.end_time}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="grid gap-4 py-2">
                        {conflictWarnings.length > 0 && (
                            <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-destructive/10 dark:bg-destructive/100/10 p-3">
                                <div className="flex items-center gap-1.5 mb-1"><Warning size={16} strokeWidth={1.5} className=" text-red-500" /><span className="text-sm font-medium text-red-700 dark:text-red-400">Conflict Warning</span></div>
                                {conflictWarnings.map((w, i) => (<p key={i} className="text-xs text-destructive dark:text-red-400/80 mt-0.5">{w}</p>))}
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
                        <Button type="submit" disabled={submitting} className="mt-2">{submitting ? "Saving..." : formData.id ? "Update" : "Add Period"}</Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Styles */}
            <style jsx global>{`
                .print-header { display: none; text-align: center; }

                /* ── Routine Table — Premium On-Screen Design ── */
                .routine-table-wrapper {
                    overflow-x: auto;
                    border-radius: 12px;
                    border: 1px solid hsl(var(--border));
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03);
                    background: hsl(var(--card));
                }
                .dark .routine-table-wrapper {
                    border-color: rgba(255,255,255,0.08);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                }
                .routine-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    font-size: 12px;
                }
                .routine-table th, .routine-table td {
                    border-right: 1px solid hsl(var(--border));
                    border-bottom: 1px solid hsl(var(--border));
                    padding: 8px 10px;
                    text-align: center;
                    vertical-align: middle;
                }
                .routine-table th:last-child, .routine-table td:last-child { border-right: none; }
                .routine-table tbody tr:last-child td { border-bottom: none; }
                .dark .routine-table th, .dark .routine-table td { border-color: rgba(255,255,255,0.06); }

                /* Header row — elegant gradient */
                .day-header {
                    background: linear-gradient(135deg, #1e3a5f 0%, #1a365d 100%);
                    color: #fff;
                    font-weight: 700;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    width: 100px;
                    min-width: 100px;
                    border-color: #2d4a6f !important;
                }
                .period-header {
                    background: linear-gradient(135deg, #1e3a5f 0%, #1a365d 100%);
                    color: #fff;
                    font-size: 11px;
                    padding: 8px 6px;
                    min-width: 110px;
                    border-color: #2d4a6f !important;
                }

                /* Day column cells */
                .day-cell {
                    background: #eef2f8;
                    font-weight: 700;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    white-space: nowrap;
                    color: #1a365d;
                }
                .dark .day-cell { background: hsl(var(--muted)); color: hsl(var(--foreground)); }

                /* Alternating row stripes */
                .routine-table tbody tr:nth-child(even) .day-cell { background: #e5e9f0; }
                .routine-table tbody tr:nth-child(even) .period-cell { background: hsl(var(--muted) / 0.25); }
                .dark .routine-table tbody tr:nth-child(even) .day-cell { background: hsl(var(--muted) / 0.7); }
                .dark .routine-table tbody tr:nth-child(even) .period-cell { background: hsl(var(--muted) / 0.15); }

                /* Period cells */
                .period-cell {
                    position: relative;
                    min-height: 60px;
                    transition: all 0.2s ease;
                    cursor: pointer;
                }
                .period-cell.empty:hover {
                    background: hsl(var(--accent)) !important;
                    box-shadow: inset 0 0 0 2px hsl(var(--border));
                }
                .period-cell.filled {
                    background: hsl(var(--accent) / 0.4);
                }
                .period-cell.filled:hover {
                    background: hsl(var(--accent) / 0.7);
                    box-shadow: inset 0 0 0 2px hsl(var(--ring));
                }
                .period-cell.conflict {
                    background: hsl(0 84% 96%) !important;
                    box-shadow: inset 0 0 0 1px hsl(0 70% 85%);
                }
                .dark .period-cell.conflict { background: hsl(0 60% 15% / 0.5) !important; }

                /* Cell content */
                .cell-content { position: relative; }
                .subject-name {
                    font-weight: 700;
                    font-size: 11.5px;
                    line-height: 1.3;
                    color: hsl(var(--foreground));
                }
                .teacher-name {
                    font-size: 10px;
                    color: hsl(var(--muted-foreground));
                    margin-top: 2px;
                    font-weight: 500;
                }
                .teacher-phone {
                    font-size: 9px;
                    color: hsl(var(--muted-foreground));
                    opacity: 0.65;
                    margin-top: 1px;
                }
                .empty-cell {
                    color: hsl(var(--muted-foreground));
                    opacity: 0.2;
                    font-size: 14px;
                }

                /* Multi-subject cell */
                .multi-cell {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                }
                .multi-entry {
                    position: relative;
                    padding: 3px 2px;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: background 0.15s;
                }
                .multi-entry:hover {
                    background: hsl(var(--accent) / 0.5);
                }
                .multi-entry-border {
                    border-top: 1px dashed hsl(var(--border));
                }
                .multi-entry-content {
                    cursor: pointer;
                }

                /* Add more button in multi-cell */
                .add-more-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 3px auto 0;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 1.5px dashed hsl(var(--border));
                    color: hsl(var(--muted-foreground));
                    background: none;
                    cursor: pointer;
                    opacity: 0;
                    transition: all 0.15s ease;
                }
                .period-cell:hover .add-more-btn {
                    opacity: 1;
                }
                .add-more-btn:hover {
                    border-color: hsl(var(--ring));
                    color: hsl(var(--foreground));
                    background: hsl(var(--accent));
                }

                /* Delete button */
                .delete-btn {
                    position: absolute;
                    top: -2px;
                    right: -2px;
                    opacity: 0;
                    padding: 3px;
                    border-radius: 6px;
                    transition: all 0.15s ease;
                    color: hsl(var(--muted-foreground));
                    background: none;
                    border: none;
                    cursor: pointer;
                }
                .multi-entry:hover .delete-btn { opacity: 1; }
                .period-cell:hover .delete-btn { opacity: 1; }
                .delete-btn:hover {
                    color: hsl(0 72% 50%);
                    background: hsl(0 72% 50% / 0.1);
                }
            `}</style>
        </div>
    );
}
