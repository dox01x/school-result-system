"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { printHtml } from "@/lib/print-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CheckCircle, Printer, FileText } from "lucide-react";
import type { Exam } from "@/lib/database.types";

interface ClassInfo {
    id: string;
    name: string;
    numeric_value: number | null;
}

interface SectionInfo {
    id: string;
    name: string;
    class_id: string;
}

interface SubjectInfo {
    id: string;
    name: string;
    class_id: string;
}

interface TeacherInfo {
    id: string;
    name: string;
    designation: string;
    phone: string;
}

interface RoutineInfo {
    class_id: string;
    section_id: string;
    subject_id: string;
    teacher_id: string;
}

interface ScheduleInfo {
    id: string;
    class_id: string;
    subject_id: string;
    exam_date: string;
    start_time: string;
    end_time: string;
}


interface Distribution {
    id: string;
    exam_id: string;
    class_id: string;
    section_id: string | null;
    subject_id: string;
    teacher_id: string;
    total_copies: number;
    date_given: string;
    date_returned: string | null;
    date_received_from_hall: string | null;
    status: string;
    notes: string | null;
}

interface FormData {
    class_id: string;
    section_id: string;
    subject_id: string;
    teacher_id: string;
    total_copies: string;
    date_given: string;
    date_returned: string;
    date_received_from_hall: string;
    notes: string;
}

const emptyForm: FormData = {
    class_id: "",
    section_id: "",
    subject_id: "",
    teacher_id: "",
    total_copies: "",
    date_given: "",
    date_returned: "",
    date_received_from_hall: new Date().toISOString().split("T")[0],
    notes: "",
};

export function PaperCheckingTab({ exams }: { exams: Exam[] }) {
    const [selectedExam, setSelectedExam] = useState("");
    const [distributions, setDistributions] = useState<Distribution[]>([]);
    const [classes, setClasses] = useState<ClassInfo[]>([]);
    const [sections, setSections] = useState<SectionInfo[]>([]);
    const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
    const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
    const [routines, setRoutines] = useState<RoutineInfo[]>([]);
    const [schedules, setSchedules] = useState<ScheduleInfo[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>("all");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [isFieldDisabled, setIsFieldDisabled] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [idToDelete, setIdToDelete] = useState<string | null>(null);

    const triggerDelete = (id: string) => {
        setIdToDelete(id);
        setDeleteConfirmOpen(true);
    };

    const handleFormChange = (field: keyof FormData, value: string) => {
        setForm(prev => {
            const next = { ...prev, [field]: value };
            if (field === "class_id") {
                next.section_id = "";
                next.subject_id = "";
            }
            if (next.class_id && next.section_id && next.subject_id && !next.teacher_id) {
                const match = routines.find(r => 
                    r.class_id === next.class_id && 
                    r.section_id === next.section_id && 
                    r.subject_id === next.subject_id
                );
                if (match && match.teacher_id) {
                    next.teacher_id = match.teacher_id;
                }
            }
            return next;
        });
    };

    const supabase = useMemo(() => createClient(), []);

    // Load classes, subjects, teachers, sections, routines on mount
    useEffect(() => {
        const load = async () => {
            const [classRes, subjectRes, teacherRes, sectionRes, routineRes] = await Promise.all([
                supabase.from("classes").select("id, name, numeric_value").order("numeric_value"),
                supabase.from("subjects").select("id, name, class_id"),
                supabase.from("teachers").select("id, name, designation, phone").order("name"),
                supabase.from("sections").select("id, name, class_id"),
                supabase.from("class_routines").select("class_id, section_id, subject_id, teacher_id").order("day_of_week").order("start_time"),
            ]);
            if (classRes.data) setClasses(classRes.data);
            if (subjectRes.data) setSubjects(subjectRes.data);
            if (teacherRes.data) setTeachers(teacherRes.data);
            if (sectionRes.data) setSections(sectionRes.data);
            if (routineRes.data) setRoutines(routineRes.data);
        };
        load();
    }, [supabase]);

    // Load distributions and schedules when exam changes
    const loadDistributions = useCallback(async (examId: string, silent = false) => {
        if (!examId) return;
        if (!silent) setLoading(true);
        const { data, error } = await supabase
            .from("exam_paper_distributions")
            .select("id, exam_id, class_id, section_id, subject_id, teacher_id, total_copies, date_given, date_returned, date_received_from_hall, status, notes")
            .eq("exam_id", examId)
            .order("date_given");
        if (error) {
            toast.error("Failed to load distributions");
        } else {
            setDistributions(data || []);
        }
        if (!silent) setLoading(false);
    }, [supabase]);

    const loadSchedules = useCallback(async (examId: string) => {
        if (!examId) return;
        const { data } = await supabase
            .from("exam_schedules")
            .select("id, class_id, subject_id, exam_date, start_time, end_time")
            .eq("exam_id", examId);
        setSchedules(data || []);
    }, [supabase]);

    useEffect(() => {
        if (selectedExam) {
            Promise.resolve().then(() => {
                loadDistributions(selectedExam);
                loadSchedules(selectedExam);
            });
        } else {
            Promise.resolve().then(() => {
                setDistributions([]);
                setSchedules([]);
            });
        }
    }, [selectedExam, loadDistributions, loadSchedules]);

    // Derived unique exam dates from schedules
    const availableDates = useMemo(() => {
        const dates = schedules.map(s => s.exam_date);
        return Array.from(new Set(dates)).sort();
    }, [schedules]);

    // Auto-select today's date if it has scheduled exams
    useEffect(() => {
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const targetDate = availableDates.includes(todayStr) ? todayStr : "all";
        Promise.resolve().then(() => {
            setSelectedDate(prev => prev !== targetDate ? targetDate : prev);
        });
    }, [availableDates]);

    // Build the pre-populated (virtual + saved) list of distributions
    const displayRows = useMemo(() => {
        // 1. Filter saved distributions matching the date filter
        const matchedDists = distributions.filter(d => 
            selectedDate === "all" || schedules.some(s => 
                s.class_id === d.class_id && 
                s.subject_id === d.subject_id && 
                s.exam_date === selectedDate
            )
        );

        // Group distributions by class and subject
        const processedDists: Distribution[] = [];
        const distsByClassSubj: { [key: string]: Distribution[] } = {};
        
        matchedDists.forEach(d => {
            const key = `${d.class_id}||${d.subject_id}`;
            if (!distsByClassSubj[key]) distsByClassSubj[key] = [];
            distsByClassSubj[key].push(d);
        });

        Object.keys(distsByClassSubj).forEach(key => {
            const [classId] = key.split("||");
            const classSections = sections.filter(s => s.class_id === classId);
            const list = distsByClassSubj[key];
            
            if (classSections.length === 0) {
                // No sections, add first non-section distribution
                const d = list.find(x => !x.section_id);
                if (d) processedDists.push(d);
            } else {
                const unmatched = [...list];
                const matchedSecs = new Set<string>();

                // First pass: exact matches
                classSections.forEach(sec => {
                    const idx = unmatched.findIndex(x => x.section_id === sec.id);
                    if (idx !== -1) {
                        processedDists.push(unmatched[idx]);
                        matchedSecs.add(sec.id);
                        unmatched.splice(idx, 1);
                    }
                });

                // Second pass: assign null section_id distributions to remaining sections
                classSections.forEach(sec => {
                    if (!matchedSecs.has(sec.id)) {
                        const idx = unmatched.findIndex(x => !x.section_id);
                        if (idx !== -1) {
                            processedDists.push({
                                ...unmatched[idx],
                                section_id: sec.id
                            });
                            matchedSecs.add(sec.id);
                            unmatched.splice(idx, 1);
                        }
                    }
                });
            }
        });

        // 2. Add virtual rows for active schedules lacking a distribution
        const activeSchedules = selectedDate === "all"
            ? schedules
            : schedules.filter(s => s.exam_date === selectedDate);

        const uniqueActive: { [key: string]: ScheduleInfo } = {};
        activeSchedules.forEach(s => {
            const key = `${s.class_id}||${s.subject_id}`;
            if (!uniqueActive[key]) {
                uniqueActive[key] = s;
            }
        });

        const rows = [...processedDists];

        Object.values(uniqueActive).forEach(schedule => {
            const classSections = sections.filter(sec => sec.class_id === schedule.class_id);
            if (classSections.length === 0) {
                const hasDist = rows.some(r => r.class_id === schedule.class_id && !r.section_id && r.subject_id === schedule.subject_id);
                if (!hasDist) {
                    rows.push({
                        id: `virtual||${schedule.id}||${schedule.class_id}||none||${schedule.subject_id}`,
                        exam_id: selectedExam,
                        class_id: schedule.class_id,
                        section_id: null,
                        subject_id: schedule.subject_id,
                        teacher_id: "",
                        total_copies: 0,
                        date_given: "",
                        date_returned: null,
                        date_received_from_hall: null,
                        status: "pending_distribution",
                        notes: "",
                    });
                }
            } else {
                classSections.forEach(sec => {
                    const hasDist = rows.some(r => 
                        r.class_id === schedule.class_id && 
                        r.section_id === sec.id && 
                        r.subject_id === schedule.subject_id
                    );
                    if (!hasDist) {
                        rows.push({
                            id: `virtual||${schedule.id}||${schedule.class_id}||${sec.id}||${schedule.subject_id}`,
                            exam_id: selectedExam,
                            class_id: schedule.class_id,
                            section_id: sec.id,
                            subject_id: schedule.subject_id,
                            teacher_id: "",
                            total_copies: 0,
                            date_given: "",
                            date_returned: null,
                            date_received_from_hall: null,
                            status: "pending_distribution",
                            notes: "",
                        });
                    }
                });
            }
        });

        return rows;
    }, [schedules, distributions, sections, selectedDate, selectedExam]);

    // Sort display rows by Class (numeric_value) first, then by Shift (start_time)
    const sortedDisplayRows = useMemo(() => {
        return [...displayRows].sort((a, b) => {
            const classA = classes.find(c => c.id === a.class_id);
            const classB = classes.find(c => c.id === b.class_id);
            const valA = classA?.numeric_value ?? 999;
            const valB = classB?.numeric_value ?? 999;

            if (valA !== valB) {
                return valA - valB;
            }

            const schedA = schedules.find(s => s.class_id === a.class_id && s.subject_id === a.subject_id);
            const schedB = schedules.find(s => s.class_id === b.class_id && s.subject_id === b.subject_id);
            const timeA = schedA?.start_time || "";
            const timeB = schedB?.start_time || "";

            return timeA.localeCompare(timeB);
        });
    }, [displayRows, classes, schedules]);

    // Filtered sections by selected class in form
    const filteredSections = useMemo(() => {
        if (!form.class_id) return [];
        return sections.filter(s => s.class_id === form.class_id);
    }, [sections, form.class_id]);

    // Filtered subjects by selected class in form
    const filteredSubjects = useMemo(() => {
        if (!form.class_id) return [];
        return subjects.filter(s => s.class_id === form.class_id);
    }, [subjects, form.class_id]);



    // Open dialog for add
    const handleAdd = () => {
        setEditingId(null);
        setForm(emptyForm);
        setIsFieldDisabled(false);
        setDialogOpen(true);
    };

    // Open dialog for edit
    const handleEdit = (dist: Distribution) => {
        setEditingId(dist.id);
        setForm({
            class_id: dist.class_id,
            section_id: dist.section_id || "",
            subject_id: dist.subject_id,
            teacher_id: dist.teacher_id,
            total_copies: String(dist.total_copies),
            date_given: dist.date_given === "1970-01-01" ? "" : dist.date_given,
            date_returned: dist.date_returned || "",
            date_received_from_hall: dist.date_received_from_hall || "",
            notes: dist.notes || "",
        });
        setIsFieldDisabled(true);
        setDialogOpen(true);
    };

    // Open dialog for assigning a virtual row
    const handleAssign = (d: Distribution) => {
        const routineTeacherId = getRoutineTeacherId(d.class_id, d.section_id, d.subject_id);
        setEditingId(null);
        setForm({
            class_id: d.class_id,
            section_id: d.section_id || "",
            subject_id: d.subject_id,
            teacher_id: routineTeacherId,
            total_copies: "",
            date_given: "",
            date_returned: "",
            date_received_from_hall: new Date().toISOString().split("T")[0],
            notes: "",
        });
        setIsFieldDisabled(true);
        setDialogOpen(true);
    };

    // Save (add or update)
    const handleSave = async () => {
        const classHasSections = filteredSections.length > 0;
        if (!form.class_id || (classHasSections && !form.section_id) || !form.subject_id || !form.teacher_id || !form.total_copies) {
            toast.error("Please fill all required fields");
            return;
        }
        setSaving(true);
        const record = {
            exam_id: selectedExam,
            class_id: form.class_id,
            section_id: form.section_id || null,
            subject_id: form.subject_id,
            teacher_id: form.teacher_id,
            total_copies: parseInt(form.total_copies),
            date_given: form.date_given || "1970-01-01",
            date_returned: form.date_returned || null,
            date_received_from_hall: form.date_received_from_hall || null,
            status: form.date_returned ? "returned" : "pending",
            notes: form.notes || null,
        };

        if (editingId) {
            const { error } = await supabase
                .from("exam_paper_distributions")
                .update(record)
                .eq("id", editingId);
            if (error) toast.error("Failed to update");
            else toast.success("Distribution updated");
        } else {
            // Check if there is already a record for this class_id, section_id, subject_id, and exam_id
            const targetSectionId = form.section_id || null;
            const duplicate = distributions.find(d => 
                d.class_id === form.class_id && 
                d.section_id === targetSectionId && 
                d.subject_id === form.subject_id
            );
            if (duplicate) {
                // If it already exists, update the existing one!
                const { error } = await supabase
                    .from("exam_paper_distributions")
                    .update(record)
                    .eq("id", duplicate.id);
                if (error) toast.error("Failed to update existing distribution");
                else toast.success("Existing distribution updated");
            } else {
                const { error } = await supabase
                    .from("exam_paper_distributions")
                    .insert(record);
                if (error) toast.error("Failed to add distribution");
                else toast.success("Distribution added");
            }
        }
        setSaving(false);
        setDialogOpen(false);
        loadDistributions(selectedExam, true);
    };

    // Delete
    const handleDelete = async () => {
        if (!idToDelete) return;
        setSaving(true);
        const { error } = await supabase
            .from("exam_paper_distributions")
            .delete()
            .eq("id", idToDelete);
        if (error) toast.error("Failed to delete");
        else {
            toast.success("Distribution deleted");
            loadDistributions(selectedExam, true);
        }
        setSaving(false);
        setDeleteConfirmOpen(false);
        setIdToDelete(null);
    };

    // Mark as returned
    const handleMarkReturned = async (id: string) => {
        const today = new Date().toISOString().split("T")[0];
        const { error } = await supabase
            .from("exam_paper_distributions")
            .update({ date_returned: today, status: "returned" })
            .eq("id", id);
        if (error) toast.error("Failed to update");
        else {
            toast.success("Marked as returned");
            loadDistributions(selectedExam, true);
        }
    };

    // Mark as received from exam hall
    const handleMarkReceivedFromHall = async (id: string) => {
        const todayStr = new Date().toISOString().split("T")[0];
        const { error } = await supabase
            .from("exam_paper_distributions")
            .update({ date_received_from_hall: todayStr })
            .eq("id", id);
        if (error) {
            toast.error("Failed to update receipt date");
        } else {
            toast.success("Papers marked as received from hall");
            loadDistributions(selectedExam, true);
        }
    };

    // Mark as given to teacher
    const handleMarkGiven = async (id: string) => {
        const todayStr = new Date().toISOString().split("T")[0];
        const { error } = await supabase
            .from("exam_paper_distributions")
            .update({ date_given: todayStr })
            .eq("id", id);
        if (error) {
            toast.error("Failed to update date");
        } else {
            toast.success("Papers marked as given");
            loadDistributions(selectedExam, true);
        }
    };

    // Helper to get routine teacher ID
    const getRoutineTeacherId = useCallback((classId: string, sectionId: string | null, subjectId: string) => {
        if (!sectionId) return "";
        const match = routines.find(r => 
            r.class_id === classId && 
            r.section_id === sectionId && 
            r.subject_id === subjectId
        );
        return match?.teacher_id || "";
    }, [routines]);

    // Helper to get name by ID
    const getClassName = (id: string) => classes.find(c => c.id === id)?.name || "—";
    const getSectionName = (id: string | null) => {
        if (!id) return "";
        return sections.find(s => s.id === id)?.name || "";
    };
    const getClassNameWithSection = (dist: Distribution) => {
        const cls = getClassName(dist.class_id);
        const sec = getSectionName(dist.section_id);
        return sec ? `${cls} - ${sec}` : cls;
    };
    const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name || "—";
    const getTeacherName = (id: string) => teachers.find(t => t.id === id)?.name || "—";
    const getTeacherDesignation = (id: string) => teachers.find(t => t.id === id)?.designation || "—";

    const formatDate = (d: string) => {
        if (!d) return "—";
        const date = new Date(d + "T00:00:00");
        return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    };





    // Summary stats (calculates totals of only actual saved distributions)
    const stats = useMemo(() => {
        // Filter out virtual rows from the displayed rows
        const actualDists = displayRows.filter(d => d.status !== "pending_distribution");

        const total = actualDists.length;
        const pending = actualDists.filter(d => d.status === "pending").length;
        const returned = actualDists.filter(d => d.status === "returned").length;
        const totalCopies = actualDists.reduce((sum, d) => sum + d.total_copies, 0);
        return { total, pending, returned, totalCopies };
    }, [displayRows]);

    // Print
    const handlePrint = () => {
        const examName = exams.find(e => e.id === selectedExam)?.name || "";

        let rowsHtml = "";
        sortedDisplayRows.forEach((d, idx) => {
            const isVirtual = d.status === "pending_distribution";
            const statusBg = isVirtual ? "#e2e8f0" : d.status === "returned" ? "#d4edda" : "#fff3cd";
            const statusText = isVirtual ? "Not Assigned" : d.status === "returned" ? "Returned" : "Pending";
            rowsHtml += `<tr>
                <td style="border:1px solid #000;padding:4px 6px;text-align:center">${idx + 1}</td>
                <td style="border:1px solid #000;padding:4px 6px">${getClassNameWithSection(d)}</td>
                <td style="border:1px solid #000;padding:4px 6px">${getSubjectName(d.subject_id)}</td>
                <td style="border:1px solid #000;padding:4px 6px;text-align:center">${d.date_received_from_hall ? formatDate(d.date_received_from_hall) : ""}</td>
                <td style="border:1px solid #000;padding:4px 6px">${(() => {
                    const teacherId = isVirtual 
                        ? getRoutineTeacherId(d.class_id, d.section_id, d.subject_id)
                        : d.teacher_id;
                    return teacherId ? getTeacherName(teacherId) : "";
                })()}</td>
                <td style="border:1px solid #000;padding:4px 6px;text-align:center">${isVirtual ? "" : d.total_copies}</td>
                <td style="border:1px solid #000;padding:4px 6px;text-align:center">${isVirtual || d.date_given === "1970-01-01" ? "" : formatDate(d.date_given)}</td>
                <td style="border:1px solid #000;padding:4px 6px;text-align:center">${!isVirtual && d.date_returned ? formatDate(d.date_returned) : ""}</td>
                <td style="border:1px solid #000;padding:4px 6px;text-align:center"><span style="background:${statusBg};padding:2px 8px;border-radius:4px;font-size:10px">${statusText}</span></td>
                <td style="border:1px solid #000;padding:4px 6px;font-size:10px">${d.notes || ""}</td>
            </tr>`;
        });

        const thStyle = `border:1px solid #000;padding:5px 6px;text-align:center;font-weight:bold;background:#f0f0f0;font-size:11px`;

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Paper Checking Distribution</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #000; padding: 5mm; font-size: 12px; }
        @page { size: A4; margin: 5mm; }
    </style>
</head>
<body>
    <div style="text-align:center;margin-bottom:12px;border-bottom:2px solid #000;padding-bottom:8px">
        <h2 style="font-size:16px;font-weight:bold;margin:0 0 4px 0">Paper Checking Distribution List</h2>
        <p style="font-size:12px;margin:2px 0"><strong>Exam:</strong> ${examName}</p>
        ${selectedDate !== "all" ? `<p style="font-size:11px;margin:2px 0"><strong>Exam Date:</strong> ${formatDate(selectedDate)}</p>` : ""}
        <p style="font-size:11px;margin:2px 0;color:#555">Total: ${stats.total} distributions | ${stats.totalCopies} copies | Pending: ${stats.pending} | Returned: ${stats.returned}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:10px">
        <thead>
            <tr>
                <th style="${thStyle}">Sl.</th>
                <th style="${thStyle}">Class</th>
                <th style="${thStyle}">Subject</th>
                <th style="${thStyle}">Received (Hall)</th>
                <th style="${thStyle}">Teacher</th>
                <th style="${thStyle}">Copies</th>
                <th style="${thStyle}">Date Given</th>
                <th style="${thStyle}">Date Returned</th>
                <th style="${thStyle}">Status</th>
                <th style="${thStyle}">Remarks</th>
            </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
    </table>

    <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:11px">
        <div>
            <div style="border-top:1px solid #000;width:150px;text-align:center;padding-top:4px">Date</div>
        </div>
        <div>
            <div style="border-top:1px solid #000;width:250px;text-align:center;padding-top:4px">Head Teacher / Exam Controller's Signature</div>
        </div>
    </div>
</body>
</html>`;

        printHtml(html);
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-card p-4 rounded-2xl border border-border/50">
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                    <SelectTrigger className="w-full sm:w-[220px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Select Exam" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50 shadow-md">
                        {exams.map(e => (
                            <SelectItem key={e.id} value={e.id} className="rounded-lg">{e.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {selectedExam && availableDates.length > 0 && (
                    <Select value={selectedDate} onValueChange={setSelectedDate}>
                        <SelectTrigger className="w-full sm:w-[200px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                            <SelectValue placeholder="All Dates" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border/50 shadow-md">
                            <SelectItem value="all" className="rounded-lg">All Dates</SelectItem>
                            {availableDates.map(date => (
                                <SelectItem key={date} value={date} className="rounded-lg">
                                    {formatDate(date)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                <div className="w-full sm:w-auto sm:ml-auto flex flex-col sm:flex-row gap-2">
                    {selectedExam && sortedDisplayRows.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={handlePrint}
                            className="w-full sm:w-auto h-11 rounded-xl font-semibold shadow-none border-border/50 transition-all duration-200 gap-2"
                        >
                            <Printer className="h-4 w-4" /> Print List
                        </Button>
                    )}
                    {selectedExam && (
                        <Button
                            onClick={handleAdd}
                            className="w-full sm:w-auto h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-none transition-all duration-200 gap-2"
                        >
                            <Plus className="h-4 w-4" /> Add Distribution
                        </Button>
                    )}
                </div>
            </div>

            {!selectedExam && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground font-medium">Select an exam to manage paper checking distributions</p>
                </div>
            )}

            {selectedExam && (
                <>
                    {/* Stats Cards */}
                    {sortedDisplayRows.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Card className="shadow-none border-border/50 rounded-2xl">
                                <CardContent className="p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Total Distributions</p>
                                    <p className="text-2xl font-black text-foreground">{stats.total}</p>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border-border/50 rounded-2xl">
                                <CardContent className="p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Total Copies</p>
                                    <p className="text-2xl font-black text-foreground">{stats.totalCopies}</p>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border-border/50 rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
                                <CardContent className="p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold mb-1">Pending</p>
                                    <p className="text-2xl font-black text-amber-600">{stats.pending}</p>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border-border/50 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800">
                                <CardContent className="p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold mb-1">Returned</p>
                                    <p className="text-2xl font-black text-emerald-600">{stats.returned}</p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Table */}
                    <Card className="shadow-none border-border/50 rounded-2xl">
                        <CardHeader className="py-3 bg-muted/30 border-b border-border/50 rounded-t-2xl">
                            <CardTitle className="text-sm">Paper Distributions</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex justify-center py-12 text-muted-foreground text-sm">Loading...</div>
                            ) : sortedDisplayRows.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
                                    <p className="text-muted-foreground text-sm">No scheduled exams found for this date</p>
                                    <p className="text-muted-foreground/60 text-xs mt-1">Please schedule exams first under Seat Plan or Schedules</p>
                                </div>
                            ) : (
                                <>
                                    {/* Desktop View */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="text-xs w-10">#</TableHead>
                                                    <TableHead className="text-xs">Class & Section</TableHead>
                                                    <TableHead className="text-xs">Subject</TableHead>
                                                    <TableHead className="text-xs">Received (Hall)</TableHead>
                                                    <TableHead className="text-xs">Teacher</TableHead>
                                                    <TableHead className="text-xs text-center">Copies</TableHead>
                                                    <TableHead className="text-xs">Date Given</TableHead>
                                                    <TableHead className="text-xs">Date Returned</TableHead>
                                                    <TableHead className="text-xs text-center">Status</TableHead>
                                                    <TableHead className="text-xs">Remarks</TableHead>
                                                    <TableHead className="text-xs text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sortedDisplayRows.map((d, idx) => {
                                                    const isVirtual = d.status === "pending_distribution";
                                                    return (
                                                        <TableRow key={d.id}>
                                                            <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                                                            <TableCell className="text-xs font-semibold text-foreground">
                                                                {getClassNameWithSection(d)}
                                                            </TableCell>
                                                            <TableCell className="text-xs">{getSubjectName(d.subject_id)}</TableCell>
                                                             <TableCell className="text-xs">
                                                                 {d.date_received_from_hall ? (
                                                                     <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                                                                         <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                                                         <span>{formatDate(d.date_received_from_hall)}</span>
                                                                     </div>
                                                                 ) : isVirtual ? (
                                                                     <span className="text-muted-foreground/45">—</span>
                                                                 ) : (
                                                                     <Button
                                                                         variant="outline"
                                                                         size="sm"
                                                                         className="h-7 rounded-lg text-[10px] px-2 font-bold border-dashed border-emerald-500/50 hover:bg-emerald-50 hover:text-emerald-600 gap-1 text-emerald-600"
                                                                         onClick={() => handleMarkReceivedFromHall(d.id)}
                                                                         title="Mark as Received from Hall"
                                                                     >
                                                                         <CheckCircle className="h-3 w-3" /> Mark Received
                                                                     </Button>
                                                                 )}
                                                             </TableCell>
                                                            <TableCell className="text-xs">
                                                                {(() => {
                                                                    const teacherId = isVirtual 
                                                                        ? getRoutineTeacherId(d.class_id, d.section_id, d.subject_id)
                                                                        : d.teacher_id;
                                                                    if (teacherId) {
                                                                        return (
                                                                            <>
                                                                                <div className="font-medium">{getTeacherName(teacherId)}</div>
                                                                                <div className="text-[10px] text-muted-foreground">{getTeacherDesignation(teacherId)}</div>
                                                                            </>
                                                                        );
                                                                    }
                                                                    return <span className="text-muted-foreground/45">—</span>;
                                                                })()}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-center font-mono font-bold">
                                                                {isVirtual ? <span className="text-muted-foreground/45">—</span> : d.total_copies}
                                                            </TableCell>
                                                            <TableCell className="text-xs">
                                                                {isVirtual ? (
                                                                    <span className="text-muted-foreground/45">—</span>
                                                                ) : d.date_given === "1970-01-01" ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-7 rounded-lg text-[10px] px-2 font-bold border-dashed border-amber-500/50 hover:bg-amber-50 hover:text-amber-600 gap-1 text-amber-600"
                                                                        onClick={() => handleMarkGiven(d.id)}
                                                                        title="Mark as Given to Teacher"
                                                                    >
                                                                        <CheckCircle className="h-3 w-3" /> Mark Given
                                                                    </Button>
                                                                ) : (
                                                                    formatDate(d.date_given)
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-xs">
                                                                {!isVirtual && d.date_returned ? formatDate(d.date_returned) : "—"}
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge
                                                                    variant="secondary"
                                                                    className={`text-[10px] rounded-md border-0 ${
                                                                        isVirtual
                                                                            ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                                                            : d.status === "returned"
                                                                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                                                            : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                                                    }`}
                                                                >
                                                                    {isVirtual ? "Not Assigned" : d.status === "returned" ? "Returned" : "Pending"}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{d.notes || "—"}</TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    {!isVirtual ? (
                                                                        <>
                                                                            {d.status === "pending" && (
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                                                    onClick={() => handleMarkReturned(d.id)}
                                                                                    title="Mark as Returned"
                                                                                >
                                                                                    <CheckCircle className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            )}
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7"
                                                                                onClick={() => handleEdit(d)}
                                                                                title="Edit"
                                                                            >
                                                                                <Pencil className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                                onClick={() => triggerDelete(d.id)}
                                                                                title="Delete"
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </>
                                                                    ) : (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-7 rounded-lg text-[10px] px-2 font-bold hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                                                                            onClick={() => handleAssign(d)}
                                                                        >
                                                                            Entry
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Mobile View */}
                                    <div className="md:hidden divide-y divide-border/50">
                                        {sortedDisplayRows.map((d, idx) => {
                                            const isVirtual = d.status === "pending_distribution";
                                            return (
                                                <div key={d.id} className="p-4 space-y-3">
                                                    {/* Header: Sl. & Class/Section & Status */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                                                            <span className="text-sm font-bold text-foreground">
                                                                {getClassNameWithSection(d)}
                                                            </span>
                                                        </div>
                                                        <Badge
                                                            variant="secondary"
                                                            className={`text-[10px] rounded-md border-0 ${
                                                                isVirtual
                                                                    ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                                                    : d.status === "returned"
                                                                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                                                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                                            }`}
                                                        >
                                                            {isVirtual ? "Not Assigned" : d.status === "returned" ? "Returned" : "Pending"}
                                                        </Badge>
                                                    </div>

                                                    {/* Info Grid */}
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                                                        <div>
                                                            <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Subject</span>
                                                            <span className="font-semibold text-foreground">{getSubjectName(d.subject_id)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Teacher</span>
                                                            <div className="font-medium text-foreground leading-tight">
                                                                {(() => {
                                                                    const teacherId = isVirtual 
                                                                        ? getRoutineTeacherId(d.class_id, d.section_id, d.subject_id)
                                                                        : d.teacher_id;
                                                                    if (teacherId) {
                                                                        return (
                                                                            <>
                                                                                <div className="font-semibold">{getTeacherName(teacherId)}</div>
                                                                                <div className="text-[10px] text-muted-foreground leading-tight">{getTeacherDesignation(teacherId)}</div>
                                                                            </>
                                                                        );
                                                                    }
                                                                    return <span className="text-muted-foreground/45">—</span>;
                                                                })()}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Copies</span>
                                                            <span className="font-mono font-bold text-foreground">
                                                                {isVirtual ? "—" : d.total_copies}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Received (Hall)</span>
                                                            <div className="mt-0.5">
                                                                {d.date_received_from_hall ? (
                                                                    <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                                                                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                                                        <span>{formatDate(d.date_received_from_hall)}</span>
                                                                    </div>
                                                                ) : isVirtual ? (
                                                                    <span className="text-muted-foreground/45">—</span>
                                                                ) : (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-6 rounded-md text-[9px] px-2 font-bold border-dashed border-emerald-500/50 hover:bg-emerald-50 hover:text-emerald-600 gap-1 text-emerald-600"
                                                                        onClick={() => handleMarkReceivedFromHall(d.id)}
                                                                    >
                                                                        <CheckCircle className="h-2.5 w-2.5" /> Mark Received
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {!isVirtual && (
                                                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed border-border/50 text-xs">
                                                            <div>
                                                                <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Date Given</span>
                                                                {d.date_given === "1970-01-01" ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-6 rounded-md text-[9px] px-2 font-bold border-dashed border-amber-500/50 hover:bg-amber-50 hover:text-amber-600 gap-1 text-amber-600 mt-0.5"
                                                                        onClick={() => handleMarkGiven(d.id)}
                                                                    >
                                                                        <CheckCircle className="h-2.5 w-2.5" /> Mark Given
                                                                    </Button>
                                                                ) : (
                                                                    <span className="font-medium text-foreground">{formatDate(d.date_given)}</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Date Returned</span>
                                                                <span className="font-medium text-foreground">{d.date_returned ? formatDate(d.date_returned) : "—"}</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Remarks / Notes */}
                                                    {!isVirtual && d.notes && (
                                                        <div className="bg-muted/40 p-2 rounded-xl text-[11px] text-muted-foreground border border-border/30">
                                                            <span className="font-bold text-[10px] text-muted-foreground block uppercase tracking-wider mb-0.5">Remarks</span>
                                                            {d.notes}
                                                        </div>
                                                    )}

                                                    {/* Actions */}
                                                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                                                        {!isVirtual ? (
                                                            <>
                                                                {d.status === "pending" && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg px-2 text-xs"
                                                                        onClick={() => handleMarkReturned(d.id)}
                                                                    >
                                                                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Return
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 rounded-lg px-2 text-xs"
                                                                    onClick={() => handleEdit(d)}
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg px-2 text-xs"
                                                                    onClick={() => triggerDelete(d.id)}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 w-full rounded-lg text-[11px] font-bold hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                                                                onClick={() => handleAssign(d)}
                                                            >
                                                                Entry Distribution
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Distribution" : "Add Paper Distribution"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Class *</Label>
                                <Select value={form.class_id} onValueChange={v => handleFormChange("class_id", v)} disabled={isFieldDisabled}>
                                    <SelectTrigger className="h-10 rounded-xl">
                                        <SelectValue placeholder="Select Class" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {classes.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                    Section {filteredSections.length > 0 && "*"}
                                </Label>
                                <Select value={form.section_id} onValueChange={v => handleFormChange("section_id", v)} disabled={isFieldDisabled || !form.class_id || filteredSections.length === 0}>
                                    <SelectTrigger className="h-10 rounded-xl">
                                        <SelectValue placeholder={filteredSections.length === 0 ? "No Sections" : "Select Section"} />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {filteredSections.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject *</Label>
                                <Select value={form.subject_id} onValueChange={v => handleFormChange("subject_id", v)} disabled={isFieldDisabled || !form.class_id}>
                                    <SelectTrigger className="h-10 rounded-xl">
                                        <SelectValue placeholder="Select Subject" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {filteredSubjects.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Teacher *</Label>
                            <Select value={form.teacher_id} onValueChange={v => handleFormChange("teacher_id", v)}>
                                <SelectTrigger className="h-10 rounded-xl">
                                    <SelectValue placeholder="Select Teacher" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {teachers.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.name} — {t.designation}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Copies *</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={form.total_copies}
                                    onChange={e => handleFormChange("total_copies", e.target.value)}
                                    className="h-10 rounded-xl"
                                    placeholder="e.g. 40"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Received from Hall</Label>
                                <Input
                                    type="date"
                                    value={form.date_received_from_hall}
                                    onChange={e => handleFormChange("date_received_from_hall", e.target.value)}
                                    className="h-10 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date Given *</Label>
                                <Input
                                    type="date"
                                    value={form.date_given}
                                    onChange={e => handleFormChange("date_given", e.target.value)}
                                    className="h-10 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date Returned</Label>
                                <Input
                                    type="date"
                                    value={form.date_returned}
                                    onChange={e => handleFormChange("date_returned", e.target.value)}
                                    className="h-10 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Remarks</Label>
                            <Input
                                value={form.notes}
                                onChange={e => handleFormChange("notes", e.target.value)}
                                className="h-10 rounded-xl"
                                placeholder="Any notes..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" className="rounded-xl">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleSave} disabled={saving} className="rounded-xl">
                            {saving ? "Saving..." : editingId ? "Update" : "Add"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent className="sm:max-w-[400px] rounded-2xl p-6 border-border/50">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-foreground">Confirm Delete</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Are you sure you want to delete this paper distribution? This action cannot be undone.
                        </p>
                    </div>
                    <DialogFooter className="pt-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDeleteConfirmOpen(false);
                                setIdToDelete(null);
                            }}
                            className="rounded-xl px-4 h-10 border-border/50 font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={saving}
                            className="rounded-xl px-4 h-10 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
                        >
                            {saving ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
