// Exam Schedule — Grid layout with Shift management, instructions, print
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { printHtml } from "@/lib/print-utils";
import {
    CLASS_COLUMNS,
    EXAM_COLUMNS,
    EXAM_SCHEDULE_COLUMNS,
    SUBJECT_COLUMNS,
} from "@/lib/supabase/select-columns";
import type { Class, Subject, Exam, ExamSchedule } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarCheck, Plus, Trash2 as Trash, Printer, X, CalendarPlus, AlertCircle as WarningCircle, Bold as TextB, Italic as TextItalic, Underline as TextUnderline, Type as TextT, Layers as Stack, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";

interface SchoolInfo {
    name: string;
    address: string;
    phone: string;
    email: string;
    logo_url: string;
}

interface Shift {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    class_ids: string[];
}

interface Instruction {
    id: string;
    text: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
}

const DAY_NAMES: Record<number, string> = {
    0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday",
    4: "Thursday", 5: "Friday", 6: "Saturday"
};

function formatDateDisplay(dateStr: string) {
    try {
        const d = new Date(dateStr + "T00:00:00");
        const day = DAY_NAMES[d.getDay()] || "";
        const dd = d.getDate().toString().padStart(2, "0");
        const mm = (d.getMonth() + 1).toString().padStart(2, "0");
        const yyyy = d.getFullYear();
        return {
            date: `${dd}/${mm}/${yyyy}`,
            day,
        };
    } catch { return { date: dateStr, day: "" }; }
}

function formatTime12(t: string) {
    try {
        const [h, m] = t.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
    } catch { return t; }
}

export default function ExamSchedulePage() {
    const supabase = useMemo(() => createClient(), []);

    const [classes, setClasses] = useState<Class[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
    const [subjectsByClass, setSubjectsByClass] = useState<Record<string, Subject[]>>({});

    const [selectedExam, setSelectedExam] = useState("");
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [selectedShiftId, setSelectedShiftId] = useState("");
    const [examDates, setExamDates] = useState<string[]>([]);
    const [newDate, setNewDate] = useState("");
    const [instructions, setInstructions] = useState<Instruction[]>([]);
    const [newInstruction, setNewInstruction] = useState("");

    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dateDialogOpen, setDateDialogOpen] = useState(false);
    const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [shiftForm, setShiftForm] = useState<Shift>({
        id: "", name: "", start_time: "10:00", end_time: "13:00", class_ids: [],
    });

    const [formData, setFormData] = useState({
        id: "",
        class_id: "",
        subject_id: "",
        exam_date: "",
    });

    // Load initial data
    useEffect(() => {
        (async () => {
            const [cRes, eRes, schoolRes] = await Promise.all([
                supabase.from("classes").select(CLASS_COLUMNS).order("numeric_value"),
                supabase.from("exams").select(EXAM_COLUMNS).order("term").order("exam_type"),
                supabase.from("school_info").select("name, address, phone, email, logo_url").limit(1).single(),
            ]);
            setClasses(cRes.data || []);
            setExams(eRes.data || []);
            if (schoolRes.data) setSchoolInfo(schoolRes.data as SchoolInfo);
            setLoading(false);
        })();
    }, [supabase]);

    // Load subjects for all classes
    useEffect(() => {
        if (classes.length === 0) return;
        (async () => {
            const { data } = await supabase.from("subjects").select(SUBJECT_COLUMNS).order("name");
            if (data) {
                const map: Record<string, Subject[]> = {};
                for (const s of data) {
                    if (!map[s.class_id]) map[s.class_id] = [];
                    map[s.class_id].push(s);
                }
                setSubjectsByClass(map);
            }
        })();
    }, [classes, supabase]);

    // Load schedules when exam changes
    const loadSchedules = useCallback(async () => {
        if (!selectedExam) { setSchedules([]); return; }
        const { data } = await supabase
            .from("exam_schedules")
            .select(EXAM_SCHEDULE_COLUMNS)
            .eq("exam_id", selectedExam)
            .order("exam_date");
        setSchedules(data || []);
    }, [selectedExam, supabase]);

    useEffect(() => { loadSchedules(); }, [loadSchedules]);

    // When exam changes, load saved config from localStorage
    useEffect(() => {
        if (!selectedExam) return;
        try {
            const saved = localStorage.getItem(`exam_config_${selectedExam}`);
            if (saved) {
                const config = JSON.parse(saved);
                setShifts(config.shifts || []);
                setExamDates(config.dates || []);
                setInstructions(config.instructions || []);
                if (config.shifts?.length > 0) {
                    setSelectedShiftId(config.selectedShiftId || config.shifts[0].id);
                }
            } else {
                setShifts([]);
                setExamDates([]);
                setInstructions([]);
                setSelectedShiftId("");
            }
        } catch {
            setShifts([]); setExamDates([]); setInstructions([]); setSelectedShiftId("");
        }
    }, [selectedExam]);

    // Save config to localStorage when things change
    useEffect(() => {
        if (!selectedExam) return;
        const config = { shifts, dates: examDates, instructions, selectedShiftId };
        localStorage.setItem(`exam_config_${selectedExam}`, JSON.stringify(config));
    }, [shifts, examDates, instructions, selectedShiftId, selectedExam]);

    const getName = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name || "";
    const selectedShift = shifts.find((s) => s.id === selectedShiftId);
    const shiftClasses = selectedShift ? classes.filter((c) => selectedShift.class_ids.includes(c.id)) : [];
    const activeSubjects = subjectsByClass[formData.class_id] || [];
    const examName = getName(exams, selectedExam);

    // Shift CRUD
    const openAddShift = () => {
        setShiftForm({ id: "", name: "", start_time: "10:00", end_time: "13:00", class_ids: [] });
        setShiftDialogOpen(true);
    };

    const openEditShift = (shift: Shift) => {
        setShiftForm({ ...shift });
        setShiftDialogOpen(true);
    };

    const saveShift = () => {
        if (!shiftForm.name.trim()) { toast.error("Shift name is required"); return; }
        if (shiftForm.class_ids.length === 0) { toast.error("Select at least one class"); return; }

        if (shiftForm.id) {
            setShifts((prev) => prev.map((s) => s.id === shiftForm.id ? { ...shiftForm } : s));
            toast.success("Shift updated");
        } else {
            const newShift = { ...shiftForm, id: Date.now().toString() };
            setShifts((prev) => [...prev, newShift]);
            setSelectedShiftId(newShift.id);
            toast.success("Shift created");
        }
        setShiftDialogOpen(false);
    };

    const deleteShift = (id: string) => {
        setShifts((prev) => prev.filter((s) => s.id !== id));
        if (selectedShiftId === id) {
            const remaining = shifts.filter((s) => s.id !== id);
            setSelectedShiftId(remaining.length > 0 ? remaining[0].id : "");
        }
        toast.success("Shift deleted");
    };

    const toggleShiftClass = (classId: string) => {
        setShiftForm((prev) => ({
            ...prev,
            class_ids: prev.class_ids.includes(classId)
                ? prev.class_ids.filter((c) => c !== classId)
                : [...prev.class_ids, classId],
        }));
    };

    // Date management
    const addDate = () => {
        if (!newDate) { toast.error("Please select a date"); return; }
        if (examDates.includes(newDate)) { toast.error("Date already exists"); return; }
        setExamDates((prev) => [...prev, newDate].sort());
        setNewDate("");
        toast.success("Date added");
    };

    const removeDate = (date: string) => {
        const hasSchedules = schedules.some((s) => s.exam_date === date);
        if (hasSchedules) {
            const confirmed = window.confirm("This date has scheduled exams. Removing will delete them. Continue?");
            if (!confirmed) return;
            (async () => {
                for (const s of schedules.filter((s) => s.exam_date === date)) {
                    await supabase.from("exam_schedules").delete().eq("id", s.id);
                }
                loadSchedules();
            })();
        }
        setExamDates((prev) => prev.filter((d) => d !== date));
    };

    // Cell operations
    const findSchedule = (classId: string, date: string) => {
        return schedules.find((s) => s.class_id === classId && s.exam_date === date);
    };

    const openCellDialog = (classId: string, date: string) => {
        const existing = findSchedule(classId, date);
        if (existing) {
            setFormData({ id: existing.id, class_id: classId, subject_id: existing.subject_id, exam_date: date });
        } else {
            setFormData({ id: "", class_id: classId, subject_id: "", exam_date: date });
        }
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.subject_id) { toast.error("Please select a subject"); return; }
        if (!selectedShift) return;

        // Check if same subject is already scheduled for this class+exam on a different date
        const duplicate = schedules.find(
            (s) => s.class_id === formData.class_id && s.subject_id === formData.subject_id && s.exam_id === selectedExam && s.id !== formData.id
        );
        if (duplicate) {
            const subjectName = getName(subjectsByClass[formData.class_id] || [], formData.subject_id);
            const { date: dupDate } = formatDateDisplay(duplicate.exam_date);
            const confirmed = window.confirm(
                `"${subjectName}" is already scheduled on ${dupDate} for this class.\n\nDo you want to assign it again on a different date?`
            );
            if (!confirmed) return;
        }

        setSubmitting(true);
        try {
            const payload = {
                exam_id: selectedExam,
                class_id: formData.class_id,
                subject_id: formData.subject_id,
                exam_date: formData.exam_date,
                start_time: selectedShift.start_time,
                end_time: selectedShift.end_time,
                room_id: null,
                invigilator_id: null,
            };
            const res = await fetch("/api/administration/exam-schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData.id ? { ...payload, id: formData.id } : payload),
            });
            const result = await res.json();
            if (!result.success) { toast.error(result.error); return; }
            toast.success(formData.id ? "Updated" : "Added");
            setDialogOpen(false);
            loadSchedules();
        } catch { toast.error("Failed to save"); }
        finally { setSubmitting(false); }
    };

    const handleDeleteEntry = async (id: string) => {
        try {
            await fetch(`/api/administration/exam-schedule?id=${id}`, { method: "DELETE" });
            toast.success("Deleted");
            loadSchedules();
        } catch { toast.error("Failed to delete"); }
    };

    // Instructions
    const addInstruction = () => {
        if (!newInstruction.trim()) return;
        setInstructions((prev) => [...prev, {
            id: Date.now().toString(), text: newInstruction.trim(),
            bold: false, italic: false, underline: false,
        }]);
        setNewInstruction("");
    };

    const toggleStyle = (id: string, style: "bold" | "italic" | "underline") => {
        setInstructions((prev) => prev.map((i) => i.id === id ? { ...i, [style]: !i[style] } : i));
    };

    const removeInstruction = (id: string) => {
        setInstructions((prev) => prev.filter((i) => i.id !== id));
    };

    const handlePrint = () => {
        if (!selectedShift) return;

        // Build table header cells from exam dates
        const headerCells = examDates.map((date) => {
            const { date: formatted, day } = formatDateDisplay(date);
            return `<th>${formatted}<br><span style="font-weight:400;font-size:8px;opacity:0.7">${day}</span></th>`;
        }).join("");

        // Build table body rows
        const bodyRows = shiftClasses.map((cls) => {
            const cells = examDates.map((date) => {
                const entry = findSchedule(cls.id, date);
                if (!entry) return `<td class="empty">—</td>`;
                return `<td><div class="subj">${getName(subjectsByClass[cls.id] || [], entry.subject_id)}</div></td>`;
            }).join("");
            return `<tr><td class="day-col">${cls.name}</td>${cells}</tr>`;
        }).join("");

        // Build instructions HTML
        let instructionsHtml = "";
        if (instructions.length > 0) {
            const items = instructions.map((inst, idx) => {
                let style = "";
                if (inst.bold) style += "font-weight:700;";
                if (inst.italic) style += "font-style:italic;";
                if (inst.underline) style += "text-decoration:underline;";
                return `<li><span class="inst-num">${idx + 1}.</span> <span style="${style}">${inst.text}</span></li>`;
            }).join("");
            instructionsHtml = `<div class="inst-section"><h4>Instructions:</h4><ul>${items}</ul></div>`;
        }

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Exam Schedule - ${examName}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
<style>
@page { size: A4 landscape; margin: 8mm 6mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; color: #000; font-size: 12px; line-height: 1.5; background: #fff; padding: 20px; }

.school-info { text-align: center; margin-bottom: 20px; }
.school-info img { max-height: 46px; margin-bottom: 8px; }
.school-info h2 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
.school-info p { font-size: 11px; color: #666; margin-top: 3px; }

.header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px solid #e5e5e5; }
.header-title h1 { font-size: 22px; font-weight: 900; letter-spacing: -1px; line-height: 1; text-transform: uppercase; }
.header-title p { font-size: 11px; font-weight: 600; color: #666; letter-spacing: 2px; text-transform: uppercase; margin-top: 5px; }

table { width: 100%; border-collapse: collapse; border: 1px solid #e5e5e5; }
th { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #000; padding: 8px 4px; text-align: center; border: 1px solid #e5e5e5; border-bottom: 2px solid #ccc; vertical-align: middle; }
td { padding: 6px 4px; text-align: center; vertical-align: middle; font-size: 11px; border: 1px solid #e5e5e5; }
td.day-col { font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; width: 85px; min-width: 85px; }
td.empty { color: #ccc; }
.subj { font-weight: 700; font-size: 10px; color: #000; }

.inst-section { margin-top: 24px; }
.inst-section h4 { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #000; margin-bottom: 8px; }
.inst-section ul { list-style: none; padding: 0; }
.inst-section li { font-size: 11px; line-height: 1.6; display: flex; align-items: flex-start; gap: 4px; }
.inst-num { font-weight: 800; min-width: 16px; color: #000; }

.footer { text-align: center; font-size: 9px; color: #999; margin-top: 24px; padding-top: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
@media print { body { padding: 10px; } }
</style></head><body>

<div class="school-info">
${schoolInfo?.logo_url ? `<img src="${schoolInfo.logo_url}" alt="Logo">` : ""}
<h2>${schoolInfo?.name || "School Name"}</h2>
<p>${schoolInfo?.address || ""}${schoolInfo?.phone ? " • " + schoolInfo.phone : ""}${schoolInfo?.email ? " • " + schoolInfo.email : ""}</p>
</div>

<div class="header">
<div class="header-title"><h1>${examName}</h1><p>${selectedShift.name} — Time: ${formatTime12(selectedShift.start_time)} to ${formatTime12(selectedShift.end_time)}</p></div>
</div>

<table>
<thead><tr><th style="width:85px">Class</th>${headerCells}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>

${instructionsHtml}

<div class="footer">Computer Generated Document &bull; No Signature Required</div>

</body></html>`;

        printHtml(html);
    };

    if (loading) {
        return (<div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>);
    }

    const hasGrid = selectedExam && examDates.length > 0 && selectedShift && shiftClasses.length > 0;

    return (
        <div className="space-y-5">
            {/* Header */}
            <PageHeader
                icon={CalendarCheck}
                title="Exam Schedule"
                subtitle="Create exam routines with shifts. Manage dates, classes, and print."
                className="no-print"
                actions={
                    hasGrid ? (
                        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                            <Printer size={16} strokeWidth={1.5} className=" " /> Print
                        </Button>
                    ) : undefined
                }
            />

            {/* Controls Row */}
            <div className="flex items-end gap-3 flex-wrap no-print">
                <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Exam</Label>
                    <Select value={selectedExam} onValueChange={(v) => setSelectedExam(v)}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select Exam" /></SelectTrigger>
                        <SelectContent>{exams.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
                {selectedExam && (
                    <>
                        <div className="grid gap-1.5">
                            <Label className="text-xs text-muted-foreground">Shift</Label>
                            <div className="flex gap-1.5">
                                <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select Shift" /></SelectTrigger>
                                    <SelectContent>
                                        {shifts.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" size="icon" className="h-9 w-9" onClick={openAddShift} title="Add Shift">
                                    <Plus size={16} strokeWidth={1.5} className=" " />
                                </Button>
                                {selectedShift && (
                                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => openEditShift(selectedShift)} title="Edit Shift">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setDateDialogOpen(true)} className="gap-1.5 h-9">
                            <CalendarPlus className="h-4 w-4" /> Dates ({examDates.length})
                        </Button>
                    </>
                )}
            </div>

            {/* Print Header */}
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
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#1a365d" }}>{examName}</p>
                    {selectedShift && (
                        <p style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                            {selectedShift.name} — Time: {formatTime12(selectedShift.start_time)} to {formatTime12(selectedShift.end_time)}
                        </p>
                    )}
                </div>
            </div>

            {/* GRID TABLE */}
            {hasGrid ? (
                <div className="routine-table-wrapper">
                    <table className="routine-table">
                        <thead>
                            <tr>
                                <th className="day-header" style={{ minWidth: 90 }}>Class</th>
                                {examDates.map((date) => {
                                    const { date: formatted, day } = formatDateDisplay(date);
                                    return (
                                        <th key={date} className="period-header" style={{ minWidth: 120 }}>
                                            <div>{formatted}</div>
                                            <div style={{ fontSize: 10, opacity: 0.85, fontWeight: 400 }}>{day}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {shiftClasses.map((cls) => (
                                <tr key={cls.id}>
                                    <td className="day-cell">{cls.name}</td>
                                    {examDates.map((date) => {
                                        const entry = findSchedule(cls.id, date);
                                        return (
                                            <td
                                                key={date}
                                                className={`period-cell ${entry ? "filled" : "empty"}`}
                                                onClick={() => openCellDialog(cls.id, date)}
                                                style={{ cursor: "pointer" }}
                                            >
                                                {entry ? (
                                                    <div className="cell-content">
                                                        <div className="subject-name">{getName(subjectsByClass[cls.id] || [], entry.subject_id)}</div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id); }}
                                                            className="delete-btn no-print"
                                                        >
                                                            <X size={12} strokeWidth={1.5} className=" " />
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
            ) : selectedExam ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg no-print">
                    <CalendarCheck className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-1">
                        {shifts.length === 0 ? "Create a Shift" : examDates.length === 0 ? "Add Exam Dates" : "Select a Shift"}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        {shifts.length === 0
                            ? "Click the \"+\" button next to shift dropdown to create your first shift."
                            : examDates.length === 0
                            ? "Click \"Dates\" to add exam dates as columns."
                            : "Select a shift from the dropdown to view the schedule grid."}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg no-print">
                    <CalendarCheck className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-1">Select an Exam</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">Choose an exam to create its schedule.</p>
                </div>
            )}

            {/* Missing Subjects Alert */}
            {hasGrid && (() => {
                const missingByClass: { className: string; missing: string[] }[] = [];
                for (const cls of shiftClasses) {
                    const allSubjects = subjectsByClass[cls.id] || [];
                    const scheduledSubjectIds = schedules
                        .filter((s) => s.class_id === cls.id && s.exam_id === selectedExam)
                        .map((s) => s.subject_id);
                    const missing = allSubjects.filter((s) => !s.is_optional && !scheduledSubjectIds.includes(s.id));
                    if (missing.length > 0) {
                        missingByClass.push({ className: cls.name, missing: missing.map((m) => m.name) });
                    }
                }
                if (missingByClass.length === 0) return null;
                return (
                    <div className="mt-3 p-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 no-print">
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold text-sm mb-2">
                            <WarningCircle size={16} strokeWidth={1.5} className=" " /> Missing Subjects
                        </div>
                        <div className="space-y-1">
                            {missingByClass.map((item) => (
                                <p key={item.className} className="text-xs text-amber-800 dark:text-amber-300">
                                    <strong>{item.className}:</strong> {item.missing.join(", ")}
                                </p>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Instructions Section */}
            {hasGrid && (
                <div className="exam-instructions-section">
                    <h3 className="text-sm font-semibold mb-3 no-print flex items-center gap-1.5">
                        <TextT className="h-4 w-4" /> Instructions
                    </h3>

                    {/* Add instruction - no-print */}
                    <div className="flex gap-2 mb-3 no-print">
                        <Input
                            value={newInstruction}
                            onChange={(e) => setNewInstruction(e.target.value)}
                            placeholder="Add an instruction..."
                            onKeyDown={(e) => { if (e.key === "Enter") addInstruction(); }}
                            className="flex-1"
                        />
                        <Button size="sm" onClick={addInstruction} className="gap-1">
                            <Plus size={12} strokeWidth={1.5} className=".5 .5" /> Add
                        </Button>
                    </div>

                    {/* Instructions list */}
                    {instructions.length > 0 && (
                        <div className="instructions-list">
                            <h4 className="instructions-title">Instructions:</h4>
                            <ul className="instructions-bullets">
                                {instructions.map((inst, idx) => (
                                    <li key={inst.id}>
                                        <span className="instruction-number">{idx + 1}.</span>
                                        <span
                                            className="instruction-text"
                                            style={{
                                                fontWeight: inst.bold ? 700 : 400,
                                                fontStyle: inst.italic ? "italic" : "normal",
                                                textDecoration: inst.underline ? "underline" : "none",
                                            }}
                                        >
                                            {inst.text}
                                        </span>
                                        <div className="instruction-actions no-print">
                                            <button onClick={() => toggleStyle(inst.id, "bold")} className={`action-btn ${inst.bold ? "active" : ""}`} title="TextB">
                                                <TextB className="h-3 w-3" />
                                            </button>
                                            <button onClick={() => toggleStyle(inst.id, "italic")} className={`action-btn ${inst.italic ? "active" : ""}`} title="TextItalic">
                                                <TextItalic className="h-3 w-3" />
                                            </button>
                                            <button onClick={() => toggleStyle(inst.id, "underline")} className={`action-btn ${inst.underline ? "active" : ""}`} title="TextUnderline">
                                                <TextUnderline className="h-3 w-3" />
                                            </button>
                                            <button onClick={() => removeInstruction(inst.id)} className="action-btn delete" title="Remove">
                                                <Trash size={12} strokeWidth={1.5} className=" " />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Shift Management Dialog */}
            <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Stack className="h-4 w-4" />
                            {shiftForm.id ? "Edit" : "Create"} Shift
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); saveShift(); }} className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label>Shift Name *</Label>
                            <Input
                                value={shiftForm.name}
                                onChange={(e) => setShiftForm((p) => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. Morning Shift"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label>Start Time</Label>
                                <Input type="time" value={shiftForm.start_time} onChange={(e) => setShiftForm((p) => ({ ...p, start_time: e.target.value }))} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>End Time</Label>
                                <Input type="time" value={shiftForm.end_time} onChange={(e) => setShiftForm((p) => ({ ...p, end_time: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Classes in this Shift *</Label>
                            <div className="flex flex-wrap gap-2 p-3 border rounded-md max-h-[200px] overflow-y-auto">
                                {classes.map((c) => (
                                    <label key={c.id} className="flex items-center gap-1.5 text-sm cursor-pointer select-none min-w-[100px]">
                                        <input
                                            type="checkbox"
                                            checked={shiftForm.class_ids.includes(c.id)}
                                            onChange={() => toggleShiftClass(c.id)}
                                            className="rounded accent-[#1a365d] h-4 w-4"
                                        />
                                        {c.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button type="submit" className="flex-1">
                                {shiftForm.id ? "Update Shift" : "Create Shift"}
                            </Button>
                            {shiftForm.id && (
                                <Button type="button" variant="outline" className="text-destructive hover:text-red-700 hover:bg-destructive/10" onClick={() => { deleteShift(shiftForm.id); setShiftDialogOpen(false); }}>
                                    <Trash size={16} strokeWidth={1.5} className=" " />
                                </Button>
                            )}
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Date Management Dialog */}
            <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Manage Exam Dates</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="flex gap-2">
                            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="flex-1" />
                            <Button size="sm" onClick={addDate} className="gap-1"><Plus size={12} strokeWidth={1.5} className=".5 .5" /> Add</Button>
                        </div>
                        {examDates.length > 0 ? (
                            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                                {examDates.map((date) => {
                                    const { date: formatted, day } = formatDateDisplay(date);
                                    return (
                                        <div key={date} className="flex items-center justify-between px-3 py-2 rounded-md border text-sm">
                                            <div>
                                                <span className="font-medium">{formatted}</span>
                                                <span className="text-muted-foreground ml-2">({day})</span>
                                            </div>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive hover:bg-destructive/10" onClick={() => removeDate(date)}>
                                                <Trash size={12} strokeWidth={1.5} className=" " />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No dates added yet</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Cell PencilSimple Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>
                            {formData.id ? "Edit" : "Assign Subject"} — {getName(classes, formData.class_id)}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="grid gap-4 py-2">
                        <div className="text-sm text-muted-foreground">
                            Date: <strong>{formatDateDisplay(formData.exam_date).date}</strong> ({formatDateDisplay(formData.exam_date).day})
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Subject *</Label>
                            <Select value={formData.subject_id} onValueChange={(v) => setFormData((p) => ({ ...p, subject_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                                <SelectContent>
                                    {activeSubjects.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                            {activeSubjects.length === 0 && (
                                <p className="text-xs text-amber-600 flex items-center gap-1">
                                    <WarningCircle size={12} strokeWidth={1.5} className=" " /> No subjects found for this class
                                </p>
                            )}
                        </div>
                        <Button type="submit" disabled={submitting} className="mt-2">
                            {submitting ? "Saving..." : formData.id ? "Update" : "Assign"}
                        </Button>
                    </form>
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
                .day-header { background: #1a365d; color: #fff; font-weight: 700; font-size: 11px; text-transform: uppercase; }
                .period-header { background: #1a365d; color: #fff; font-size: 11px; padding: 6px 4px; }
                .day-cell { background: #f0f4ff; font-weight: 600; font-size: 11px; white-space: nowrap; }
                .dark .day-cell { background: hsl(var(--muted)); }
                .period-cell { position: relative; min-height: 45px; transition: background-color 0.15s; }
                .period-cell.empty:hover { background: hsl(var(--accent)); }
                .period-cell.filled { background: hsl(var(--accent) / 0.5); }
                .period-cell.filled:hover { background: hsl(var(--accent)); }
                .cell-content { position: relative; }
                .subject-name { font-weight: 600; font-size: 12px; line-height: 1.3; color: hsl(var(--foreground)); }
                .empty-cell { color: hsl(var(--muted-foreground)); opacity: 0.3; font-size: 14px; }
                .delete-btn { position: absolute; top: -2px; right: -2px; opacity: 0; padding: 2px; border-radius: 4px; transition: opacity 0.15s; color: hsl(var(--muted-foreground)); background: none; border: none; cursor: pointer; }
                .period-cell:hover .delete-btn { opacity: 1; }
                .delete-btn:hover { color: hsl(0 72% 50%); background: hsl(0 72% 50% / 0.1); }

                /* Instructions — no border */
                .instructions-list { margin-top: 8px; padding: 8px 0; }
                .instructions-title { font-weight: 700; font-size: 13px; margin-bottom: 8px; color: #1a365d; }
                .dark .instructions-title { color: hsl(var(--foreground)); }
                .instructions-bullets { list-style: none; padding: 0; margin: 0; }
                .instructions-bullets li {
                    display: flex;
                    align-items: flex-start;
                    gap: 6px;
                    padding: 3px 0;
                    font-size: 12px;
                    line-height: 1.5;
                }
                .instruction-number { font-weight: 600; min-width: 18px; color: #1a365d; }
                .dark .instruction-number { color: hsl(var(--muted-foreground)); }
                .instruction-text { flex: 1; }
                .instruction-actions { display: flex; gap: 2px; margin-left: 8px; }
                .action-btn {
                    padding: 3px;
                    border-radius: 4px;
                    color: hsl(var(--muted-foreground));
                    transition: all 0.15s;
                    cursor: pointer;
                    background: none;
                    border: none;
                }
                .action-btn:hover { background: hsl(var(--accent)); }
                .action-btn.active { color: #1a365d; background: #e2e8f0; }
                .action-btn.delete:hover { color: hsl(0 72% 50%); background: hsl(0 72% 50% / 0.1); }
            `}</style>
        </div>
    );
}
