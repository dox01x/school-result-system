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
import { Plus, Pencil, Trash2, CheckCircle, Printer, FileText, ChevronDown, Clock, Filter, Search, X } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface PaperDistFormData {
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

const emptyForm: PaperDistFormData = {
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
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<PaperDistFormData>(emptyForm);
    const [isFieldDisabled, setIsFieldDisabled] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [idToDelete, setIdToDelete] = useState<string | null>(null);

    const triggerDelete = (id: string) => {
        setIdToDelete(id);
        setDeleteConfirmOpen(true);
    };

    const handleFormChange = (field: keyof PaperDistFormData, value: string) => {
        setForm(prev => {
            const next = { ...prev, [field]: value };
            if (field === "class_id") {
                next.section_id = "";
                next.subject_id = "";
            }
            if (field === "subject_id" || field === "section_id" || field === "class_id") {
                const classId = next.class_id;
                const sectionId = next.section_id;
                const subjectId = next.subject_id;
                if (classId && subjectId) {
                    const match = routines.find(r => 
                        r.class_id === classId && 
                        (sectionId ? r.section_id === sectionId : true) && 
                        r.subject_id === subjectId
                    );
                    if (match && match.teacher_id) {
                        next.teacher_id = match.teacher_id;
                    }
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

    // Helper functions
    const getRoutineTeacherId = useCallback((classId: string, sectionId: string | null, subjectId: string) => {
        if (!sectionId) return "";
        const match = routines.find(r => 
            r.class_id === classId && 
            r.section_id === sectionId && 
            r.subject_id === subjectId
        );
        return match?.teacher_id || "";
    }, [routines]);

    const getClassName = useCallback((id: string) => classes.find(c => c.id === id)?.name || "—", [classes]);
    const getSectionName = useCallback((id: string | null) => {
        if (!id) return "";
        return sections.find(s => s.id === id)?.name || "";
    }, [sections]);
    const getClassNameWithSection = useCallback((dist: Distribution) => {
        const cls = getClassName(dist.class_id);
        const sec = getSectionName(dist.section_id);
        return sec ? `${cls} - ${sec}` : cls;
    }, [getClassName, getSectionName]);
    const getSubjectName = useCallback((id: string) => subjects.find(s => s.id === id)?.name || "—", [subjects]);
    const getTeacherName = useCallback((id: string) => teachers.find(t => t.id === id)?.name || "—", [teachers]);
    const getTeacherDesignation = useCallback((id: string) => teachers.find(t => t.id === id)?.designation || "—", [teachers]);

    const formatDate = useCallback((d: string) => {
        if (!d) return "—";
        const date = new Date(d + "T00:00:00");
        return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }, []);

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

    // Filtered display rows by status and search query
    const filteredDisplayRows = useMemo(() => {
        return sortedDisplayRows.filter(d => {
            // Status filter
            if (selectedStatus === "pending" && d.status !== "pending") return false;
            if (selectedStatus === "returned" && d.status !== "returned") return false;
            if (selectedStatus === "unassigned" && d.status !== "pending_distribution") return false;

            // Search query filter
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                const clsName = getClassNameWithSection(d).toLowerCase();
                const subjName = getSubjectName(d.subject_id).toLowerCase();
                const teacherId = d.status === "pending_distribution"
                    ? getRoutineTeacherId(d.class_id, d.section_id, d.subject_id)
                    : d.teacher_id;
                const tName = teacherId ? getTeacherName(teacherId).toLowerCase() : "";
                
                const matches = clsName.includes(query) || subjName.includes(query) || tName.includes(query);
                if (!matches) return false;
            }

            return true;
        });
    }, [sortedDisplayRows, selectedStatus, searchQuery, getRoutineTeacherId, getTeacherName, getSubjectName, classes, sections, subjects, teachers]);

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





    // Summary stats (calculates totals of saved distributions & unassigned items)
    const stats = useMemo(() => {
        const actualDists = displayRows.filter(d => d.status !== "pending_distribution");
        const virtualDists = displayRows.filter(d => d.status === "pending_distribution");

        const total = actualDists.length;
        const pending = actualDists.filter(d => d.status === "pending").length;
        const returned = actualDists.filter(d => d.status === "returned").length;
        const unassigned = virtualDists.length;

        const totalCopies = actualDists.reduce((sum, d) => sum + d.total_copies, 0);
        const pendingCopies = actualDists.filter(d => d.status === "pending").reduce((sum, d) => sum + d.total_copies, 0);
        const returnedCopies = actualDists.filter(d => d.status === "returned").reduce((sum, d) => sum + d.total_copies, 0);

        return { total, pending, returned, unassigned, totalCopies, pendingCopies, returnedCopies };
    }, [displayRows]);

    // Print
    const handlePrint = (overrideStatus?: string) => {
        const statusToUse = overrideStatus || selectedStatus;
        const rowsToPrint = sortedDisplayRows.filter(d => {
            if (statusToUse === "all") return true;
            if (statusToUse === "pending") return d.status === "pending";
            if (statusToUse === "returned") return d.status === "returned";
            if (statusToUse === "unassigned") return d.status === "pending_distribution";
            return true;
        });

        if (rowsToPrint.length === 0) {
            toast.warning("No distribution records match the selected status filter to print.");
            return;
        }

        const examName = exams.find(e => e.id === selectedExam)?.name || "";
        const filterTitle = statusToUse === "pending" 
            ? "Pending Paper Checking List" 
            : statusToUse === "returned" 
            ? "Returned Paper Checking List" 
            : statusToUse === "unassigned" 
            ? "Unassigned Exam Paper List" 
            : "Paper Checking Distribution List";

        let rowsHtml = "";
        rowsToPrint.forEach((d, idx) => {
            const isVirtual = d.status === "pending_distribution";
            const statusBg = isVirtual ? "#e2e8f0" : d.status === "returned" ? "#d4edda" : "#fff3cd";
            const statusText = isVirtual ? "Not Assigned" : d.status === "returned" ? "Returned" : "Pending Return";
            
            const teacherId = isVirtual 
                ? getRoutineTeacherId(d.class_id, d.section_id, d.subject_id)
                : d.teacher_id;
            const teacherName = teacherId ? getTeacherName(teacherId) : "—";
            const teacherPhone = teacherId ? (teachers.find(t => t.id === teacherId)?.phone || "") : "";

            rowsHtml += `<tr>
                <td style="border:1px solid #000;padding:5px 6px;text-align:center">${idx + 1}</td>
                <td style="border:1px solid #000;padding:5px 6px;font-weight:bold">${getClassNameWithSection(d)}</td>
                <td style="border:1px solid #000;padding:5px 6px">${getSubjectName(d.subject_id)}</td>
                <td style="border:1px solid #000;padding:5px 6px">${teacherName} ${teacherPhone ? `<br/><span style="font-size:9px;color:#555">📱 ${teacherPhone}</span>` : ""}</td>
                <td style="border:1px solid #000;padding:5px 6px;text-align:center;font-weight:bold">${isVirtual ? "0" : d.total_copies}</td>
                <td style="border:1px solid #000;padding:5px 6px;text-align:center">${isVirtual || d.date_given === "1970-01-01" ? "—" : formatDate(d.date_given)}</td>
                <td style="border:1px solid #000;padding:5px 6px;text-align:center">${!isVirtual && d.date_returned ? formatDate(d.date_returned) : "—"}</td>
                <td style="border:1px solid #000;padding:5px 6px;text-align:center"><span style="background:${statusBg};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold">${statusText}</span></td>
                <td style="border:1px solid #000;padding:5px 6px;font-size:10px">${d.notes || ""}</td>
            </tr>`;
        });

        const thStyle = `border:1px solid #000;padding:6px 6px;text-align:center;font-weight:bold;background:#f0f0f0;font-size:11px`;
        const totalPendingCopies = rowsToPrint.filter(r => r.status === "pending").reduce((sum, r) => sum + r.total_copies, 0);

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${filterTitle}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #000; padding: 6mm; font-size: 12px; }
        @page { size: A4 portrait; margin: 6mm; }
    </style>
</head>
<body>
    <div style="text-align:center;margin-bottom:14px;border-bottom:2px solid #000;padding-bottom:10px">
        <h2 style="font-size:18px;font-weight:bold;margin:0 0 4px 0">${filterTitle}</h2>
        <p style="font-size:13px;margin:3px 0"><strong>Exam:</strong> ${examName}</p>
        ${selectedDate !== "all" ? `<p style="font-size:11px;margin:2px 0"><strong>Exam Date:</strong> ${formatDate(selectedDate)}</p>` : ""}
        <p style="font-size:11px;margin:3px 0;color:#333">Total Listed: ${rowsToPrint.length} entries | Total Pending Copies: ${totalPendingCopies} scripts</p>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
            <tr>
                <th style="${thStyle}">Sl.</th>
                <th style="${thStyle}">Class & Section</th>
                <th style="${thStyle}">Subject</th>
                <th style="${thStyle}">Examiner Teacher</th>
                <th style="${thStyle}">Copies</th>
                <th style="${thStyle}">Date Given</th>
                <th style="${thStyle}">Date Returned</th>
                <th style="${thStyle}">Status</th>
                <th style="${thStyle}">Remarks</th>
            </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
    </table>

    <div style="margin-top:35px;display:flex;justify-content:space-between;font-size:11px">
        <div>
            <div style="border-top:1px solid #000;width:160px;text-align:center;padding-top:4px">Report Generated Date</div>
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
            <div className="flex flex-col gap-4 bg-card p-4 rounded-2xl border border-border">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    {/* Exam Selector */}
                    <Select value={selectedExam} onValueChange={setSelectedExam}>
                        <SelectTrigger className="w-full lg:w-[220px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                            <SelectValue placeholder="Select Exam" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border shadow-md">
                            {exams.map(e => (
                                <SelectItem key={e.id} value={e.id} className="rounded-lg">{e.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {selectedExam && availableDates.length > 0 && (
                        <Select value={selectedDate} onValueChange={setSelectedDate}>
                            <SelectTrigger className="w-full lg:w-[170px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                                <SelectValue placeholder="All Exam Dates" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border shadow-md">
                                <SelectItem value="all" className="rounded-lg">All Dates</SelectItem>
                                {availableDates.map(date => (
                                    <SelectItem key={date} value={date} className="rounded-lg">
                                        {formatDate(date)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {selectedExam && (
                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger className="w-full lg:w-[190px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border shadow-md">
                                <SelectItem value="all" className="rounded-lg font-medium">All Statuses</SelectItem>
                                <SelectItem value="pending" className="rounded-lg text-amber-600 font-semibold">Pending Returns Only</SelectItem>
                                <SelectItem value="returned" className="rounded-lg text-emerald-600 font-semibold">Returned Papers Only</SelectItem>
                                <SelectItem value="unassigned" className="rounded-lg text-muted-foreground font-medium">Not Distributed Yet</SelectItem>
                            </SelectContent>
                        </Select>
                    )}

                    {selectedExam && (
                        <div className="relative w-full lg:w-[220px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search teacher, subject..."
                                className="w-full h-11 pl-9 pr-8 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-xs font-medium shadow-none focus-visible:ring-1 focus-visible:ring-ring/30"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    )}

                    <div className="w-full lg:w-auto lg:ml-auto flex flex-col sm:flex-row gap-2">
                        {selectedExam && sortedDisplayRows.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full sm:w-auto h-11 rounded-xl font-semibold shadow-none border-border transition-all duration-200 gap-2"
                                    >
                                        <Printer className="h-4 w-4 text-primary" /> Print Reports <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64 rounded-xl border-border shadow-md">
                                    <DropdownMenuItem onClick={() => handlePrint()} className="rounded-lg cursor-pointer py-2.5">
                                        <Printer className="mr-2.5 h-4 w-4 text-primary" />
                                        <div>
                                            <div className="font-semibold text-xs">Print Filtered List</div>
                                            <div className="text-[10px] text-muted-foreground">Print currently displayed rows</div>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handlePrint("pending")} className="rounded-lg cursor-pointer py-2.5 bg-amber-500/10 focus:bg-amber-500/20">
                                        <Clock className="mr-2.5 h-4 w-4 text-amber-600" />
                                        <div>
                                            <div className="font-semibold text-xs text-amber-700 dark:text-amber-400">Print Pending List Only</div>
                                            <div className="text-[10px] text-amber-600/80">Teachers with unreturned scripts</div>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handlePrint("returned")} className="rounded-lg cursor-pointer py-2.5 bg-emerald-500/10 focus:bg-emerald-500/20">
                                        <CheckCircle className="mr-2.5 h-4 w-4 text-emerald-600" />
                                        <div>
                                            <div className="font-semibold text-xs text-emerald-700 dark:text-emerald-400">Print Returned List</div>
                                            <div className="text-[10px] text-emerald-600/80">Teachers who returned all scripts</div>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handlePrint("unassigned")} className="rounded-lg cursor-pointer py-2.5">
                                        <FileText className="mr-2.5 h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <div className="font-semibold text-xs">Print Unassigned List</div>
                                            <div className="text-[10px] text-muted-foreground">Exam papers not assigned yet</div>
                                        </div>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
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

                {/* Quick Status Filter Tabs */}
                {selectedExam && sortedDisplayRows.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
                            <Filter className="h-3 w-3" /> Quick Filter:
                        </span>
                        <Button
                            variant={selectedStatus === "all" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setSelectedStatus("all")}
                            className={`h-8 rounded-lg text-xs font-semibold px-3 transition-all ${
                                selectedStatus === "all" ? "shadow-xs" : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            All ({sortedDisplayRows.length})
                        </Button>
                        <Button
                            variant={selectedStatus === "pending" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setSelectedStatus("pending")}
                            className={`h-8 rounded-lg text-xs font-semibold px-3 transition-all gap-1.5 ${
                                selectedStatus === "pending"
                                    ? "bg-amber-600 text-white hover:bg-amber-700 shadow-xs"
                                    : "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            }`}
                        >
                            <Clock className="h-3 w-3" />
                            Pending Returns ({stats.pending})
                        </Button>
                        <Button
                            variant={selectedStatus === "returned" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setSelectedStatus("returned")}
                            className={`h-8 rounded-lg text-xs font-semibold px-3 transition-all gap-1.5 ${
                                selectedStatus === "returned"
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                                    : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            }`}
                        >
                            <CheckCircle className="h-3 w-3" />
                            Returned Papers ({stats.returned})
                        </Button>
                        <Button
                            variant={selectedStatus === "unassigned" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setSelectedStatus("unassigned")}
                            className={`h-8 rounded-lg text-xs font-semibold px-3 transition-all gap-1.5 ${
                                selectedStatus === "unassigned"
                                    ? "bg-slate-700 text-white hover:bg-slate-800 shadow-xs"
                                    : "text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            Not Distributed ({stats.unassigned})
                        </Button>
                    </div>
                )}
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
                            <Card 
                                onClick={() => setSelectedStatus("all")}
                                className={`shadow-none border-border rounded-xl cursor-pointer transition-all ${selectedStatus === "all" ? 'ring-2 ring-primary border-transparent' : 'hover:border-primary/50'}`}
                            >
                                <CardContent className="p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Total Assigned</p>
                                    <p className="text-2xl font-black text-foreground">{stats.total}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{stats.totalCopies} total copies</p>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border-border rounded-xl">
                                <CardContent className="p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Total Copies</p>
                                    <p className="text-2xl font-black text-foreground">{stats.totalCopies}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Distributed to teachers</p>
                                </CardContent>
                            </Card>
                            <Card 
                                onClick={() => setSelectedStatus("pending")}
                                className={`shadow-none rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 cursor-pointer transition-all ${selectedStatus === "pending" ? 'ring-2 ring-amber-500 border-transparent' : 'hover:border-amber-400'}`}
                            >
                                <CardContent className="p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold mb-1 flex items-center justify-center gap-1">
                                        <Clock className="h-3 w-3" /> Pending Returns
                                    </p>
                                    <p className="text-2xl font-black text-amber-600">{stats.pending}</p>
                                    <p className="text-[10px] text-amber-600/80 font-medium mt-0.5">{stats.pendingCopies} unreturned copies</p>
                                </CardContent>
                            </Card>
                            <Card 
                                onClick={() => setSelectedStatus("returned")}
                                className={`shadow-none rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 cursor-pointer transition-all ${selectedStatus === "returned" ? 'ring-2 ring-emerald-500 border-transparent' : 'hover:border-emerald-400'}`}
                            >
                                <CardContent className="p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold mb-1 flex items-center justify-center gap-1">
                                        <CheckCircle className="h-3 w-3" /> Returned Papers
                                    </p>
                                    <p className="text-2xl font-black text-emerald-600">{stats.returned}</p>
                                    <p className="text-[10px] text-emerald-600/80 font-medium mt-0.5">{stats.returnedCopies} checked copies</p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Table */}
                    <Card className="shadow-none border-border rounded-xl">
                        <CardHeader className="py-3 bg-muted/30 border-b border-border rounded-t-2xl flex flex-row items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm">
                                    Paper Distributions
                                </CardTitle>
                                {selectedStatus !== "all" && (
                                    <Badge 
                                        variant="secondary" 
                                        className={`text-xs px-2.5 py-0.5 font-semibold capitalize border-0 ${
                                            selectedStatus === "pending" 
                                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                                : selectedStatus === "returned"
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                        }`}
                                    >
                                        Filter: {selectedStatus === "pending" ? "Pending Returns Only" : selectedStatus === "returned" ? "Returned Papers Only" : "Not Distributed"}
                                    </Badge>
                                )}
                                {searchQuery && (
                                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                                        Search: &quot;{searchQuery}&quot;
                                    </Badge>
                                )}
                            </div>
                            {(selectedStatus !== "all" || searchQuery) && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => { setSelectedStatus("all"); setSearchQuery(""); }} 
                                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Clear Filters
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex justify-center py-12 text-muted-foreground text-sm">Loading...</div>
                            ) : filteredDisplayRows.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
                                    <p className="text-muted-foreground text-sm">No records match the selected filter</p>
                                    <Button variant="link" size="sm" onClick={() => setSelectedStatus("all")} className="mt-1 text-xs">Reset Filters</Button>
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
                                                {filteredDisplayRows.map((d, idx) => {
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
                                        {filteredDisplayRows.map((d, idx) => {
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
                                                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed border-border text-xs">
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
                <DialogContent className="sm:max-w-lg rounded-xl">
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
                <DialogContent className="sm:max-w-[400px] rounded-xl p-6 border-border">
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
                            className="rounded-xl px-4 h-10 border-border font-semibold"
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
