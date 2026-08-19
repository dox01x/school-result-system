"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { printHtml } from "@/lib/print-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
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
import { 
    Plus, Pencil, Trash2, CheckCircle, Printer, FileText, 
    ChevronDown, Clock, Filter, Search, X, Coins, Receipt, 
    DollarSign, Edit3, Check, Eye, SlidersHorizontal, Send
} from "lucide-react";
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
    paper_checking_rate?: number | null;
    paper_recheck_rate?: number | null;
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
    recheck_teacher_id?: string | null;
    total_copies: number;
    date_given: string;
    date_returned: string | null;
    date_received_from_hall: string | null;
    date_recheck_given?: string | null;
    date_recheck_returned?: string | null;
    recheck_status?: string | null;
    status: string;
    notes: string | null;
}

interface PaperDistFormData {
    class_id: string;
    section_id: string;
    subject_id: string;
    teacher_id: string;
    recheck_teacher_id: string;
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
    recheck_teacher_id: "",
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

    // Remuneration & Class Rates State
    const [schoolInfo, setSchoolInfo] = useState<{ id?: string; name?: string; address?: string; phone?: string; logo_url?: string; paper_checking_rate?: number | null } | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<"distributions" | "remuneration">("distributions");
    const [remunerationStatusFilter, setRemunerationStatusFilter] = useState<"all" | "returned">("all");
    const [classRatesModalOpen, setClassRatesModalOpen] = useState<boolean>(false);
    const [editingClassRates, setEditingClassRates] = useState<Record<string, string>>({});
    const [editingClassRecheckRates, setEditingClassRecheckRates] = useState<Record<string, string>>({});
    const [savingClassRates, setSavingClassRates] = useState<boolean>(false);

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

    // Load classes, subjects, teachers, sections, routines, school_info on mount
    useEffect(() => {
        const load = async () => {
            let loadedClasses: ClassInfo[] = [];
            try {
                const { data: primaryClasses, error: classErr } = await supabase
                    .from("classes")
                    .select("id, name, numeric_value, paper_checking_rate, paper_recheck_rate")
                    .order("numeric_value");
                if (!classErr && primaryClasses) {
                    loadedClasses = primaryClasses;
                } else {
                    const { data: fallbackClasses } = await supabase
                        .from("classes")
                        .select("id, name, numeric_value")
                        .order("numeric_value");
                    loadedClasses = (fallbackClasses || []).map(c => ({ ...c, paper_checking_rate: 0, paper_recheck_rate: 0 }));
                }
            } catch {
                const { data: fallbackClasses } = await supabase
                    .from("classes")
                    .select("id, name, numeric_value")
                    .order("numeric_value");
                loadedClasses = (fallbackClasses || []).map(c => ({ ...c, paper_checking_rate: 0, paper_recheck_rate: 0 }));
            }

            const [subjectRes, teacherRes, sectionRes, routineRes, schoolRes] = await Promise.all([
                supabase.from("subjects").select("id, name, class_id"),
                supabase.from("teachers").select("id, name, designation, phone").order("name"),
                supabase.from("sections").select("id, name, class_id"),
                supabase.from("class_routines").select("class_id, section_id, subject_id, teacher_id").order("day_of_week").order("start_time"),
                supabase.from("school_info").select("id, name, address, phone, logo_url, paper_checking_rate").limit(1).maybeSingle(),
            ]);

            setClasses(loadedClasses);
            const initialMap: Record<string, string> = {};
            const initialRecheckMap: Record<string, string> = {};
            loadedClasses.forEach(c => {
                initialMap[c.id] = c.paper_checking_rate !== undefined && c.paper_checking_rate !== null ? String(c.paper_checking_rate) : "0";
                initialRecheckMap[c.id] = c.paper_recheck_rate !== undefined && c.paper_recheck_rate !== null ? String(c.paper_recheck_rate) : "0";
            });
            setEditingClassRates(initialMap);
            setEditingClassRecheckRates(initialRecheckMap);

            if (subjectRes.data) setSubjects(subjectRes.data);
            if (teacherRes.data) setTeachers(teacherRes.data);
            if (sectionRes.data) setSections(sectionRes.data);
            if (routineRes.data) setRoutines(routineRes.data);
            if (schoolRes.data) setSchoolInfo(schoolRes.data);
        };
        load();
    }, [supabase]);

    // Save Class Rates directly to DB
    const handleSaveClassRatesFromTab = async () => {
        setSavingClassRates(true);
        try {
            const updatePromises = classes.map(c => {
                const numVal = Math.max(0, parseFloat(editingClassRates[c.id]) || 0);
                const recheckVal = Math.max(0, parseFloat(editingClassRecheckRates[c.id]) || 0);
                return supabase.from("classes").update({ 
                    paper_checking_rate: numVal,
                    paper_recheck_rate: recheckVal,
                }).eq("id", c.id);
            });
            await Promise.all(updatePromises);
            setClasses(prev => prev.map(c => ({
                ...c,
                paper_checking_rate: Math.max(0, parseFloat(editingClassRates[c.id]) || 0),
                paper_recheck_rate: Math.max(0, parseFloat(editingClassRecheckRates[c.id]) || 0),
            })));
            setClassRatesModalOpen(false);
            toast.success("Class-wise checking & rechecking rates saved successfully");
        } catch (err: any) {
            console.error("Failed to save class rates:", err);
            toast.error("Failed to save class rates");
        } finally {
            setSavingClassRates(false);
        }
    };

    const handleApplyPresetInTab = () => {
        const updatedMain = { ...editingClassRates };
        const updatedRecheck = { ...editingClassRecheckRates };
        classes.forEach(c => {
            const num = c.numeric_value ?? 0;
            if (num <= 2) {
                updatedMain[c.id] = "2";
                updatedRecheck[c.id] = "1";
            } else if (num <= 5) {
                updatedMain[c.id] = "3";
                updatedRecheck[c.id] = "1.5";
            } else {
                updatedMain[c.id] = "4";
                updatedRecheck[c.id] = "2";
            }
        });
        setEditingClassRates(updatedMain);
        setEditingClassRecheckRates(updatedRecheck);
        toast.info("Applied preset: Main Checking (2/3/4 BDT) & Recheck (1/1.5/2 BDT). Click Save to store.");
    };

    // Load distributions and schedules when exam changes
    const loadDistributions = useCallback(async (examId: string, silent = false) => {
        if (!examId) return;
        if (!silent) setLoading(true);
        const { data, error } = await supabase
            .from("exam_paper_distributions")
            .select("id, exam_id, class_id, section_id, subject_id, teacher_id, recheck_teacher_id, total_copies, date_given, date_returned, date_received_from_hall, date_recheck_given, date_recheck_returned, recheck_status, status, notes")
            .eq("exam_id", examId)
            .order("date_given");
        if (error) {
            // Fallback for previous schema if columns not yet added
            const { data: fallbackData, error: fbError } = await supabase
                .from("exam_paper_distributions")
                .select("id, exam_id, class_id, section_id, subject_id, teacher_id, total_copies, date_given, date_returned, date_received_from_hall, status, notes")
                .eq("exam_id", examId)
                .order("date_given");
            if (fbError) {
                toast.error("Failed to load distributions");
            } else {
                setDistributions((fallbackData || []).map(d => ({ ...d, recheck_teacher_id: null })));
            }
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
                        recheck_teacher_id: null,
                        total_copies: 0,
                        date_given: "",
                        date_returned: null,
                        date_received_from_hall: null,
                        date_recheck_given: null,
                        date_recheck_returned: null,
                        recheck_status: null,
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
                            recheck_teacher_id: null,
                            total_copies: 0,
                            date_given: "",
                            date_returned: null,
                            date_received_from_hall: null,
                            date_recheck_given: null,
                            date_recheck_returned: null,
                            recheck_status: null,
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
                const recheckName = d.recheck_teacher_id ? getTeacherName(d.recheck_teacher_id).toLowerCase() : "";
                
                const matches = clsName.includes(query) || subjName.includes(query) || tName.includes(query) || recheckName.includes(query);
                if (!matches) return false;
            }

            return true;
        });
    }, [sortedDisplayRows, selectedStatus, searchQuery, getClassNameWithSection, getRoutineTeacherId, getTeacherName, getSubjectName, classes, sections, subjects, teachers]);

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
            recheck_teacher_id: dist.recheck_teacher_id || "",
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
            recheck_teacher_id: "",
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
            recheck_teacher_id: form.recheck_teacher_id || null,
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

    // Remuneration Calculation per Teacher (Class-Based Rates with Rechecking)
    const teacherRemunerationList = useMemo(() => {
        if (!selectedExam) return [];

        const activeDists = distributions.filter(d => {
            if (d.status === "pending_distribution") return false;
            if (remunerationStatusFilter === "returned" && d.status !== "returned") return false;
            return true;
        });

        // Group by teacher (both Main Examiner & Recheck Teacher)
        const map = new Map<string, {
            teacherId: string;
            teacherName: string;
            items: {
                distId: string;
                className: string;
                subjectName: string;
                dutyType: "main" | "recheck";
                copies: number;
                mainRate: number;
                mainAmount: number;
                recheckRate: number;
                recheckAmount: number;
                totalAmount: number;
                status: string;
                dateGiven: string;
                dateReturned: string | null;
            }[];
            mainCopies: number;
            mainAmount: number;
            recheckCopies: number;
            recheckAmount: number;
            totalCopies: number;
            totalAmount: number;
        }>();

        activeDists.forEach(d => {
            const cls = classes.find(c => c.id === d.class_id);
            const sec = sections.find(s => s.id === d.section_id);
            const sub = subjects.find(s => s.id === d.subject_id);

            const className = cls?.name ? `${cls.name}${sec?.name ? ` (${sec.name})` : ""}` : "—";
            const subjectName = sub?.name || "—";
            const copies = Number(d.total_copies) || 0;
            const mainRate = Number(cls?.paper_checking_rate) || 0;
            const mainAmount = copies * mainRate;
            const recheckRate = Number(cls?.paper_recheck_rate) || 0;
            const recheckAmount = copies * recheckRate;

            // 1. Main Examiner Duty
            if (d.teacher_id) {
                const teacher = teachers.find(t => t.id === d.teacher_id);
                const teacherName = teacher?.name || "Unknown Teacher";

                if (!map.has(d.teacher_id)) {
                    map.set(d.teacher_id, {
                        teacherId: d.teacher_id,
                        teacherName,
                        items: [],
                        mainCopies: 0,
                        mainAmount: 0,
                        recheckCopies: 0,
                        recheckAmount: 0,
                        totalCopies: 0,
                        totalAmount: 0,
                    });
                }

                const entry = map.get(d.teacher_id)!;
                entry.items.push({
                    distId: `${d.id}-main`,
                    className,
                    subjectName,
                    dutyType: "main",
                    copies,
                    mainRate,
                    mainAmount,
                    recheckRate: 0,
                    recheckAmount: 0,
                    totalAmount: mainAmount,
                    status: d.status,
                    dateGiven: d.date_given,
                    dateReturned: d.date_returned,
                });
                entry.mainCopies += copies;
                entry.mainAmount += mainAmount;
                entry.totalCopies += copies;
                entry.totalAmount += mainAmount;
            }

            // 2. Recheck Examiner Duty (if assigned)
            if (d.recheck_teacher_id) {
                const recheckTeacher = teachers.find(t => t.id === d.recheck_teacher_id);
                const recheckTeacherName = recheckTeacher?.name || "Unknown Teacher";

                if (!map.has(d.recheck_teacher_id)) {
                    map.set(d.recheck_teacher_id, {
                        teacherId: d.recheck_teacher_id,
                        teacherName: recheckTeacherName,
                        items: [],
                        mainCopies: 0,
                        mainAmount: 0,
                        recheckCopies: 0,
                        recheckAmount: 0,
                        totalCopies: 0,
                        totalAmount: 0,
                    });
                }

                const entry = map.get(d.recheck_teacher_id)!;
                entry.items.push({
                    distId: `${d.id}-recheck`,
                    className,
                    subjectName,
                    dutyType: "recheck",
                    copies,
                    mainRate: 0,
                    mainAmount: 0,
                    recheckRate,
                    recheckAmount,
                    totalAmount: recheckAmount,
                    status: d.status,
                    dateGiven: d.date_given,
                    dateReturned: d.date_returned,
                });
                entry.recheckCopies += copies;
                entry.recheckAmount += recheckAmount;
                entry.totalCopies += copies;
                entry.totalAmount += recheckAmount;
            }
        });

        let result = Array.from(map.values()).sort((a, b) => a.teacherName.localeCompare(b.teacherName));
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(r => 
                r.teacherName.toLowerCase().includes(q) || 
                r.items.some(i => i.subjectName.toLowerCase().includes(q) || i.className.toLowerCase().includes(q))
            );
        }
        return result;
    }, [distributions, remunerationStatusFilter, teachers, classes, sections, subjects, searchQuery, selectedExam]);

    const remunerationStats = useMemo(() => {
        const totalTeachers = teacherRemunerationList.length;
        const totalMainCopies = teacherRemunerationList.reduce((acc, t) => acc + t.mainCopies, 0);
        const totalMainAmount = teacherRemunerationList.reduce((acc, t) => acc + t.mainAmount, 0);
        const totalRecheckCopies = teacherRemunerationList.reduce((acc, t) => acc + t.recheckCopies, 0);
        const totalRecheckAmount = teacherRemunerationList.reduce((acc, t) => acc + t.recheckAmount, 0);
        const totalCopies = totalMainCopies + totalRecheckCopies;
        const totalAmount = totalMainAmount + totalRecheckAmount;
        return { totalTeachers, totalMainCopies, totalMainAmount, totalRecheckCopies, totalRecheckAmount, totalCopies, totalAmount };
    }, [teacherRemunerationList]);

    // Print Remuneration Bill for All Teachers (Clean English, No Emojis, Dual Main & Recheck Columns)
    const handlePrintRemunerationBill = () => {
        if (!selectedExam) {
            toast.error("Please select an exam first");
            return;
        }

        if (teacherRemunerationList.length === 0) {
            toast.warning("No evaluated paper distributions found for remuneration bill.");
            return;
        }

        const examName = exams.find(e => e.id === selectedExam)?.name || "Exam";
        let tableRowsHtml = "";
        let slCount = 0;
        teacherRemunerationList.forEach((teacherData) => {
            slCount++;
            const rowCount = teacherData.items.length;
            teacherData.items.forEach((item, itemIdx) => {
                const isFirst = itemIdx === 0;
                const isRecheck = item.dutyType === "recheck";
                tableRowsHtml += `
                    <tr>
                        ${isFirst ? `<td rowspan="${rowCount}" style="border:1px solid #000;padding:5px 3px;text-align:center;font-family:monospace;vertical-align:middle;font-weight:700">${slCount.toString().padStart(2, "0")}</td>` : ""}
                        ${isFirst ? `<td rowspan="${rowCount}" style="border:1px solid #000;padding:5px 6px;font-weight:700;vertical-align:middle;text-align:left">${teacherData.teacherName}</td>` : ""}
                        <td style="border:1px solid #000;padding:5px 4px;text-align:left">${item.className}</td>
                        <td style="border:1px solid #000;padding:5px 4px;text-align:left">${item.subjectName}${isRecheck ? ` <br><span style="font-size:9.5px;font-weight:700;color:#1e3a8a">(Recheck)</span>` : ""}</td>
                        <td style="border:1px solid #000;padding:5px 3px;text-align:center;font-weight:700;font-family:monospace">${item.copies}</td>
                        <td style="border:1px solid #000;padding:5px 3px;text-align:center;font-family:monospace">${!isRecheck ? `BDT ${item.mainRate}` : `—`}</td>
                        <td style="border:1px solid #000;padding:5px 3px;text-align:center;font-weight:${!isRecheck ? 'bold' : 'normal'};font-family:monospace">${!isRecheck ? `BDT ${item.mainAmount.toLocaleString()}` : `—`}</td>
                        <td style="border:1px solid #000;padding:5px 3px;text-align:center;font-family:monospace">${isRecheck ? `BDT ${item.recheckRate}` : `—`}</td>
                        <td style="border:1px solid #000;padding:5px 3px;text-align:center;font-weight:${isRecheck ? 'bold' : 'normal'};font-family:monospace">${isRecheck ? `BDT ${item.recheckAmount.toLocaleString()}` : `—`}</td>
                        <td style="border:1px solid #000;padding:5px 3px;text-align:center;font-weight:bold;font-family:monospace">BDT ${item.totalAmount.toLocaleString()}</td>
                        ${isFirst ? `<td rowspan="${rowCount}" style="border:1px solid #000;padding:5px 3px;width:75px;vertical-align:middle;text-align:center"></td>` : ""}
                    </tr>
                `;
            });
            if (rowCount > 1) {
                tableRowsHtml += `
                    <tr style="background:#f8fafc;font-weight:bold">
                        <td colspan="4" style="border:1px solid #000;padding:4px 6px;text-align:right;font-size:10.5px;color:#000">Subtotal (${teacherData.teacherName}):</td>
                        <td style="border:1px solid #000;padding:4px 3px;text-align:center;font-family:monospace;font-size:11px">${teacherData.totalCopies}</td>
                        <td style="border:1px solid #000;padding:4px 3px;text-align:center;color:#666">—</td>
                        <td style="border:1px solid #000;padding:4px 3px;text-align:center;font-family:monospace;font-size:11px">BDT ${teacherData.mainAmount.toLocaleString()}</td>
                        <td style="border:1px solid #000;padding:4px 3px;text-align:center;color:#666">—</td>
                        <td style="border:1px solid #000;padding:4px 3px;text-align:center;font-family:monospace;font-size:11px;color:#1e3a8a">BDT ${teacherData.recheckAmount.toLocaleString()}</td>
                        <td style="border:1px solid #000;padding:4px 3px;text-align:center;font-family:monospace;font-size:11px;font-weight:900">BDT ${teacherData.totalAmount.toLocaleString()}</td>
                        <td style="border:1px solid #000;padding:4px 3px"></td>
                    </tr>
                `;
            }
        });

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Paper Checking Remuneration Bill - ${examName}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #000000;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.3;
            padding: 10mm 12mm;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        @page {
            size: A4 portrait;
            margin: 8mm 10mm;
        }
        
        .header-container {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            margin-bottom: 6px;
            padding-bottom: 2px;
            text-align: center;
        }
        .header-logo {
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            max-height: 48px;
            max-width: 48px;
            object-fit: contain;
        }
        .school-title {
            font-size: 20px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0;
            line-height: 1.2;
        }
        .school-subtitle {
            font-size: 11px;
            color: #333333;
            margin-top: 2px;
        }
        .exam-name-header {
            font-size: 16px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #000000;
            margin-top: 4px;
        }

        .report-header-center {
            text-align: center;
            margin: 4px 0 14px 0;
            border-bottom: 1.5px solid #000000;
            padding-bottom: 8px;
        }
        .report-title {
            font-size: 14px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #000000;
            margin-bottom: 0;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 20px;
        }
        th {
            background: #ffffff;
            color: #000;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 9.5px;
            letter-spacing: 0.2px;
            padding: 5px 3px;
            border: 1px solid #000;
            text-align: center;
            vertical-align: middle;
            line-height: 1.2;
        }
        td {
            padding: 5px 4px;
            border: 1px solid #000;
            vertical-align: middle;
            text-align: center;
            font-size: 11px;
            line-height: 1.25;
        }
        td.text-left {
            text-align: left;
            padding-left: 6px;
        }
        tr {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .footer-row td {
            background: #f1f5f9 !important;
            font-weight: 900;
            font-size: 12px;
            border-top: 2px solid #000;
        }

        .signatures {
            width: 100%;
            margin-top: 36px;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .sig-table {
            width: 100%;
            border-collapse: collapse;
            border: none;
        }
        .sig-table td {
            border: none;
            background: transparent !important;
            text-align: center;
            padding: 0 15px;
            vertical-align: top;
        }
        .sig-line {
            width: 155px;
            margin: 0 auto;
            border-top: 1.5px solid #000;
            padding-top: 4px;
            font-size: 9.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .print-footer {
            margin-top: 14px;
            text-align: center;
            font-size: 8.5px;
            color: #666;
            border-top: 1px dashed #999;
            padding-top: 5px;
        }
    </style>
</head>
<body>
    <!-- School Header -->
    <div style="text-align:center;margin-bottom:14px">
        <h1 style="font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;margin:0;line-height:1.2;color:#000">${schoolInfo?.name || "School Name"}</h1>
        <p style="font-size:11px;font-weight:500;color:#222;margin-top:2px">${schoolInfo?.address || ""} ${schoolInfo?.phone ? "• " + schoolInfo.phone : ""}</p>
    </div>

    <!-- Report Header Bar -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5px solid #000;padding-bottom:8px;margin-bottom:16px">
        <div>
            <div style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:-0.3px;line-height:1.1;color:#000;margin-bottom:4px">REMUNERATION BILL</div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#000">${examName} &bull; PAPER EVALUATION &amp; RECHECKING</div>
        </div>
        <div style="text-align:right">
            <div style="font-size:22px;font-weight:900;color:#000;line-height:1.1;margin-bottom:4px">${new Date().toLocaleDateString('en-GB', { weekday: 'long' })}</div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#000">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</div>
        </div>
    </div>

    <!-- Bill Table -->
    <table>
        <thead>
            <tr>
                <th style="width: 28px">SL.</th>
                <th style="width: 85px" class="text-left">TEACHER<br>NAME</th>
                <th style="width: 85px" class="text-left">CLASS &amp;<br>SECTION</th>
                <th style="width: 80px" class="text-left">SUBJECT</th>
                <th style="width: 42px">COPIES</th>
                <th style="width: 50px">RATE</th>
                <th style="width: 68px">MAIN<br>AMOUNT</th>
                <th style="width: 62px">RECHECK<br>RATE</th>
                <th style="width: 62px">RECHECK<br>AMT</th>
                <th style="width: 68px">TOTAL<br>AMOUNT</th>
                <th style="width: 75px">SIGNATURE<br>/ REMARKS</th>
            </tr>
        </thead>
        <tbody>
            ${tableRowsHtml}
            <tr class="footer-row">
                <td colspan="4" style="text-align: right; padding-right: 10px;">GRAND TOTAL</td>
                <td style="font-family:monospace; text-align: center;">${remunerationStats.totalCopies}</td>
                <td style="font-family:monospace; font-size:9px; text-align: center;">Class-wise</td>
                <td style="font-family:monospace; text-align: center;">BDT ${remunerationStats.totalMainAmount.toLocaleString()}</td>
                <td style="font-family:monospace; font-size:9px; text-align: center;">Class-wise</td>
                <td style="font-family:monospace; color:#1e3a8a; text-align: center;">BDT ${remunerationStats.totalRecheckAmount.toLocaleString()}</td>
                <td style="font-family:monospace; font-size:11.5px; font-weight:900; text-align: center;">BDT ${remunerationStats.totalAmount.toLocaleString()}</td>
                <td></td>
            </tr>
        </tbody>
    </table>

    <!-- Signature Block -->
    <div class="signatures">
        <table class="sig-table">
            <tr>
                <td><div class="sig-line">Prepared By</div></td>
                <td><div class="sig-line">Exam Controller / In-Charge</div></td>
                <td><div class="sig-line">Principal / Headmaster</div></td>
            </tr>
        </table>
    </div>

    <!-- Footer Note -->
    <div class="print-footer">
        Computer Generated Official Remuneration Document • ${schoolInfo?.name || "School"}
    </div>
</body>
</html>`;

        printHtml(html);
    };

    // Print Individual Teacher Remuneration Slip / Voucher (Clean English, No Emojis)
    const handlePrintTeacherVoucher = (teacherData: {
        teacherName: string;
        items: {
            className: string;
            subjectName: string;
            dutyType: "main" | "recheck";
            copies: number;
            mainRate: number;
            mainAmount: number;
            recheckRate: number;
            recheckAmount: number;
            totalAmount: number;
        }[];
        mainCopies: number;
        mainAmount: number;
        recheckCopies: number;
        recheckAmount: number;
        totalCopies: number;
        totalAmount: number;
    }) => {
        const examName = exams.find(e => e.id === selectedExam)?.name || "Exam";

        let itemRows = "";
        teacherData.items.forEach((item, idx) => {
            const isRecheck = item.dutyType === "recheck";
            itemRows += `
                <tr>
                    <td style="border:1px solid #000;padding:6px;text-align:center;font-family:monospace">${idx + 1}</td>
                    <td style="border:1px solid #000;padding:6px;font-weight:600">${item.className}</td>
                    <td style="border:1px solid #000;padding:6px">${item.subjectName}</td>
                    <td style="border:1px solid #000;padding:6px;text-align:center;font-size:10.5px;font-weight:700">${isRecheck ? '<span style="color:#1e3a8a">Recheck</span>' : 'Main Checking'}</td>
                    <td style="border:1px solid #000;padding:6px;text-align:center;font-family:monospace;font-weight:600">${item.copies}</td>
                    <td style="border:1px solid #000;padding:6px;text-align:center;font-family:monospace">BDT ${isRecheck ? item.recheckRate : item.mainRate}</td>
                    <td style="border:1px solid #000;padding:6px;text-align:right;font-family:monospace;font-weight:bold">BDT ${item.totalAmount.toLocaleString()}</td>
                </tr>
            `;
        });

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Paper Checking Voucher - ${teacherData.teacherName}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #000;
            background: #fff;
            font-size: 11.5px;
            padding: 12mm 15mm;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        @page { size: A4 portrait; margin: 10mm; }
        .voucher-box {
            border: 1.5px solid #000;
            border-radius: 6px;
            padding: 16px;
        }
        .header-container {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 12px;
        }
        .school-title {
            font-size: 18px;
            font-weight: 900;
            text-transform: uppercase;
        }
        .school-subtitle {
            font-size: 10.5px;
            color: #333;
        }
        .exam-name-header {
            font-size: 15px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #000;
            margin-top: 5px;
        }
        .voucher-title {
            text-align: center;
            font-size: 13.5px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            margin: 6px 0 14px 0;
            padding-bottom: 4px;
            border-bottom: 1.5px solid #000;
        }
        .meta-grid {
            display: flex;
            justify-content: space-between;
            margin-bottom: 14px;
            font-size: 11.5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 16px;
        }
        th {
            background: #f1f5f9;
            padding: 6px;
            border: 1px solid #000;
            font-size: 10px;
            text-transform: uppercase;
        }
        td {
            padding: 6px;
            border: 1px solid #000;
        }
        .sig-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            text-align: center;
        }
        .sig-box {
            width: 160px;
            border-top: 1.5px solid #000;
            padding-top: 4px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
        }
    </style>
</head>
<body>
    <div class="voucher-box">
        <!-- School Header -->
        <div style="text-align:center;margin-bottom:14px">
            <h1 style="font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;margin:0;line-height:1.2;color:#000">${schoolInfo?.name || "School Name"}</h1>
            <p style="font-size:11px;font-weight:500;color:#222;margin-top:2px">${schoolInfo?.address || ""} ${schoolInfo?.phone ? "• " + schoolInfo.phone : ""}</p>
        </div>

        <!-- Report Header Bar -->
        <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5px solid #000;padding-bottom:8px;margin-bottom:14px">
            <div>
                <div style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:-0.3px;line-height:1.1;color:#000;margin-bottom:4px">REMUNERATION BILL</div>
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#000">${examName} &bull; ${teacherData.teacherName}</div>
            </div>
            <div style="text-align:right">
                <div style="font-size:22px;font-weight:900;color:#000;line-height:1.1;margin-bottom:4px">${new Date().toLocaleDateString('en-GB', { weekday: 'long' })}</div>
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#000">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</div>
            </div>
        </div>

        <div class="meta-grid">
            <div>
                <div><strong>Teacher Name:</strong> <span style="font-size:12.5px;font-weight:700">${teacherData.teacherName}</span></div>
            </div>
            <div style="text-align: right">
                <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                <div><strong>Scope:</strong> Evaluated &amp; Rechecked Scripts</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 35px">Sl.</th>
                    <th>Class &amp; Section</th>
                    <th>Subject</th>
                    <th style="width: 130px; text-align:center">Duty Scope</th>
                    <th style="width: 65px; text-align:center">Copies</th>
                    <th style="width: 70px; text-align:center">Rate</th>
                    <th style="width: 95px; text-align:right">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${itemRows}
                <tr style="background:#f1f5f9; font-weight:bold">
                    <td colspan="4" style="text-align:right; font-weight:bold">TOTAL PAYABLE AMOUNT</td>
                    <td style="text-align:center; font-family:monospace">${teacherData.totalCopies}</td>
                    <td style="text-align:center; font-family:monospace; font-size:10px">Class-wise</td>
                    <td style="text-align:right; font-family:monospace; font-size:12px">BDT ${teacherData.totalAmount.toLocaleString()}</td>
                </tr>
            </tbody>
        </table>

        <div class="sig-section">
            <div class="sig-box">Teacher / Receiver Signature</div>
            <div class="sig-box">Exam Controller / In-Charge</div>
            <div class="sig-box">Principal / Headmaster</div>
        </div>
    </div>
</body>
</html>`;

        printHtml(html);
    };

    // Print Distribution List (Clean English, No Emojis)
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
                <td style="border:1px solid #000;padding:5px 6px">${teacherName} ${teacherPhone ? `<br/><span style="font-size:9px;color:#555">Phone: ${teacherPhone}</span>` : ""}</td>
                <td style="border:1px solid #000;padding:5px 6px;text-align:center;font-weight:bold">${isVirtual ? "0" : d.total_copies}</td>
                <td style="border:1px solid #000;padding:5px 6px;text-align:center">${isVirtual || d.date_given === "1970-01-01" ? "—" : formatDate(d.date_given)}</td>
                <td style="border:1px solid #000;padding:5px 6px;text-align:center">${!isVirtual && d.date_returned ? formatDate(d.date_returned) : "—"}</td>
                <td style="border:1px solid #000;padding:5px 6px;text-align:center"><span style="background:${statusBg};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold">${statusText}</span></td>
                <td style="border:1px solid #000;padding:5px 6px;font-size:10px">${d.notes || ""}</td>
            </tr>`;
        });

        const thStyle = `border:1px solid #000;padding:6px 6px;text-align:center;font-weight:bold;background:#f0f0f0;font-size:11px`;
        const totalPendingCopies = rowsToPrint.filter(r => r.status === "pending").reduce((sum, r) => sum + r.total_copies, 0);
        const dateObj = selectedDate !== "all" ? new Date(selectedDate + 'T00:00:00') : new Date();
        const dayName = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('en-GB', { weekday: 'long' }) : '';
        const formattedDateStr = !isNaN(dateObj.getTime())
            ? dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()
            : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${filterTitle}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #000; padding: 6mm 10mm; font-size: 11.5px; }
        @page { size: A4 portrait; margin: 8mm 10mm; }
    </style>
</head>
<body>
    <!-- School Header -->
    <div style="text-align:center;margin-bottom:14px">
        <h1 style="font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;margin:0;line-height:1.2;color:#000">${schoolInfo?.name || "School Name"}</h1>
        <p style="font-size:11px;font-weight:500;color:#222;margin-top:2px">${schoolInfo?.address || ""} ${schoolInfo?.phone ? "• " + schoolInfo.phone : ""}</p>
    </div>

    <!-- Report Header Bar -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5px solid #000;padding-bottom:8px;margin-bottom:16px">
        <div>
            <div style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:-0.3px;line-height:1.1;color:#000;margin-bottom:4px">${filterTitle.toUpperCase()}</div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#000">${examName}${selectedDate !== "all" ? ` &bull; ${formatDate(selectedDate)}` : ""} &bull; ${rowsToPrint.length} ENTRIES (${totalPendingCopies} SCRIPTS)</div>
        </div>
        <div style="text-align:right">
            <div style="font-size:22px;font-weight:900;color:#000;line-height:1.1;margin-bottom:4px">${dayName}</div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#000">${formattedDateStr}</div>
        </div>
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
            {/* Top Sub-Tab Switcher */}
            <div className="flex items-center gap-2 border-b border-border pb-3">
                <Button
                    variant={activeSubTab === "distributions" ? "default" : "outline"}
                    onClick={() => setActiveSubTab("distributions")}
                    className={`rounded-xl h-10 px-4 font-semibold text-xs gap-2 ${
                        activeSubTab === "distributions" ? "bg-primary text-primary-foreground shadow-none" : "border-border text-foreground"
                    }`}
                >
                    <FileText className="h-4 w-4" /> Paper Distributions
                </Button>
                <Button
                    variant={activeSubTab === "remuneration" ? "default" : "outline"}
                    onClick={() => setActiveSubTab("remuneration")}
                    className={`rounded-xl h-10 px-4 font-semibold text-xs gap-2 ${
                        activeSubTab === "remuneration" 
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-none" 
                            : "border-border text-foreground hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    }`}
                >
                    <Coins className="h-4 w-4" /> Checking Remuneration & Bill
                </Button>
            </div>

            {/* Sub-Tab 1: Paper Distributions */}
            {activeSubTab === "distributions" && (
                <>
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
                                                <Table className="w-full">
                                                    <TableHeader>
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableHead className="text-xs w-8 text-center px-2">#</TableHead>
                                                            <TableHead className="text-xs px-2">Class &amp; Sec</TableHead>
                                                            <TableHead className="text-xs px-2">Subject</TableHead>
                                                            <TableHead className="text-xs px-2">Received (Hall)</TableHead>
                                                            <TableHead className="text-xs px-2">Examiner</TableHead>
                                                            <TableHead className="text-xs px-2">Rechecker</TableHead>
                                                            <TableHead className="text-xs text-center w-12 px-1">Copies</TableHead>
                                                            <TableHead className="text-xs px-2">Given</TableHead>
                                                            <TableHead className="text-xs px-2">Returned</TableHead>
                                                            <TableHead className="text-xs text-center px-2">Status</TableHead>
                                                            <TableHead className="text-xs px-2">Remarks</TableHead>
                                                            <TableHead className="text-xs text-center w-[85px] sticky right-0 bg-muted/80 backdrop-blur-xs z-20 shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.08)]">
                                                                Actions
                                                            </TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {filteredDisplayRows.map((d, idx) => {
                                                            const isVirtual = d.status === "pending_distribution";
                                                            return (
                                                                <TableRow key={d.id} className="group/row hover:bg-muted/50 transition-colors">
                                                                    <TableCell className="text-xs text-center text-muted-foreground px-2">{idx + 1}</TableCell>
                                                                    <TableCell className="text-xs font-bold text-foreground px-2 whitespace-nowrap">
                                                                        {getClassNameWithSection(d)}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs px-2">{getSubjectName(d.subject_id)}</TableCell>
                                                                    <TableCell className="text-xs px-2 whitespace-nowrap">
                                                                        {d.date_received_from_hall ? (
                                                                            <div className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                                                                                <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                                                                                <span>{formatDate(d.date_received_from_hall)}</span>
                                                                            </div>
                                                                        ) : isVirtual ? (
                                                                            <span className="text-muted-foreground/45">—</span>
                                                                        ) : (
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-6 rounded-md text-[9.5px] px-1.5 font-bold border-dashed border-emerald-500/50 hover:bg-emerald-50 hover:text-emerald-600 gap-1 text-emerald-600"
                                                                                onClick={() => handleMarkReceivedFromHall(d.id)}
                                                                                title="Mark as Received from Hall"
                                                                            >
                                                                                <CheckCircle className="h-2.5 w-2.5" /> Mark Received
                                                                            </Button>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs px-2">
                                                                        {(() => {
                                                                            const teacherId = isVirtual 
                                                                                ? getRoutineTeacherId(d.class_id, d.section_id, d.subject_id)
                                                                                : d.teacher_id;
                                                                            if (teacherId) {
                                                                                const desig = getTeacherDesignation(teacherId);
                                                                                return (
                                                                                    <div>
                                                                                        <div className="font-semibold text-foreground text-xs">{getTeacherName(teacherId)}</div>
                                                                                        {desig && desig !== "—" && (
                                                                                            <div className="text-[10px] text-muted-foreground">{desig}</div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return <span className="text-muted-foreground/45">—</span>;
                                                                        })()}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs px-2">
                                                                        {d.recheck_teacher_id ? (
                                                                            <div>
                                                                                <div className="font-semibold text-primary text-xs">{getTeacherName(d.recheck_teacher_id)}</div>
                                                                                {(() => {
                                                                                    const desig = getTeacherDesignation(d.recheck_teacher_id);
                                                                                    return desig && desig !== "—" ? (
                                                                                        <div className="text-[10px] text-muted-foreground">{desig}</div>
                                                                                    ) : null;
                                                                                })()}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-muted-foreground/40 text-[11px]">—</span>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-center font-mono font-bold px-1">
                                                                        {isVirtual ? <span className="text-muted-foreground/45">—</span> : d.total_copies}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs px-2 text-[11px] whitespace-nowrap">
                                                                        {!isVirtual && d.date_given && d.date_given !== "1970-01-01" ? (
                                                                            formatDate(d.date_given)
                                                                        ) : isVirtual ? (
                                                                            <span className="text-muted-foreground/45">—</span>
                                                                        ) : (
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-6 rounded-md text-[9.5px] px-1.5 font-bold border-dashed border-blue-500/50 hover:bg-blue-50 hover:text-blue-600 gap-1 text-blue-600"
                                                                                onClick={() => handleMarkGiven(d.id)}
                                                                                title="Mark as Given to Teacher"
                                                                            >
                                                                                <Send className="h-2.5 w-2.5" /> Mark Given
                                                                            </Button>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs px-2 whitespace-nowrap">
                                                                        {!isVirtual && d.date_returned ? (
                                                                            <span className="text-[11px]">{formatDate(d.date_returned)}</span>
                                                                        ) : isVirtual ? (
                                                                            <span className="text-muted-foreground/45">—</span>
                                                                        ) : (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md px-1.5 font-medium"
                                                                                onClick={() => handleMarkReturned(d.id)}
                                                                            >
                                                                                Mark Returned
                                                                            </Button>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-center px-2 whitespace-nowrap">
                                                                        {isVirtual ? (
                                                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/60 text-muted-foreground border-border">
                                                                                Not Distributed
                                                                            </Badge>
                                                                        ) : (
                                                                            <Badge
                                                                                variant={d.status === "returned" ? "default" : "secondary"}
                                                                                className={`text-[10px] px-2 py-0.5 capitalize font-semibold shadow-none ${
                                                                                    d.status === "returned" 
                                                                                        ? "bg-emerald-600 text-white hover:bg-emerald-600" 
                                                                                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                                                                }`}
                                                                            >
                                                                                {d.status === "returned" ? "Returned" : "Pending"}
                                                                            </Badge>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-[11px] text-muted-foreground max-w-[100px] truncate px-2">
                                                                        {d.notes || "—"}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-center px-1 sticky right-0 bg-card group-hover/row:bg-muted/50 transition-colors z-10 shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.08)]">
                                                                        {!isVirtual ? (
                                                                            <div className="flex items-center justify-center gap-1">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                                                                                    onClick={() => handleEdit(d)}
                                                                                    title="Edit Distribution"
                                                                                >
                                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                                    onClick={() => triggerDelete(d.id)}
                                                                                    title="Delete Distribution"
                                                                                >
                                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </div>
                                                                        ) : (
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-7 rounded-lg text-[10.5px] px-2 font-bold hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                                                                                onClick={() => handleAssign(d)}
                                                                            >
                                                                                Entry
                                                                            </Button>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>

                                            {/* Mobile Card List View */}
                                            <div className="md:hidden divide-y divide-border">
                                                {filteredDisplayRows.map((d, idx) => {
                                                    const isVirtual = d.status === "pending_distribution";
                                                    return (
                                                        <div key={d.id} className="p-4 space-y-3">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="space-y-0.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                                                                        <span className="font-bold text-sm text-foreground">{getClassNameWithSection(d)}</span>
                                                                    </div>
                                                                    <div className="text-xs font-medium text-primary">{getSubjectName(d.subject_id)}</div>
                                                                </div>
                                                                {isVirtual ? (
                                                                    <Badge variant="outline" className="text-[10px] bg-muted/60 text-muted-foreground border-border">
                                                                        Not Distributed
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge
                                                                        variant={d.status === "returned" ? "default" : "secondary"}
                                                                        className={`text-[10px] capitalize font-semibold shadow-none ${
                                                                            d.status === "returned" 
                                                                                ? "bg-emerald-600 text-white" 
                                                                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                                                        }`}
                                                                    >
                                                                        {d.status === "returned" ? "Returned" : "Pending"}
                                                                    </Badge>
                                                                )}
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-xl border border-border/50">
                                                                <div>
                                                                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Examiner</span>
                                                                    <span className="font-semibold text-foreground">
                                                                        {(() => {
                                                                            const teacherId = isVirtual ? getRoutineTeacherId(d.class_id, d.section_id, d.subject_id) : d.teacher_id;
                                                                            return teacherId ? getTeacherName(teacherId) : "—";
                                                                        })()}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Rechecker</span>
                                                                    <span className="font-semibold text-primary">
                                                                        {d.recheck_teacher_id ? getTeacherName(d.recheck_teacher_id) : "—"}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Copies</span>
                                                                    <span className="font-bold font-mono text-foreground">{isVirtual ? "—" : d.total_copies}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Status</span>
                                                                    <span>{isVirtual ? "—" : d.status === "returned" ? "Returned" : "Pending"}</span>
                                                                </div>
                                                            </div>

                                                            {d.notes && (
                                                                <div className="text-xs text-muted-foreground bg-muted/20 p-2 rounded-lg">
                                                                    <span className="font-bold text-[10px] text-muted-foreground block uppercase tracking-wider mb-0.5">Remarks</span>
                                                                    {d.notes}
                                                                </div>
                                                            )}

                                                            {/* Actions */}
                                                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                                                                {!isVirtual ? (
                                                                    <>
                                                                        {(!d.date_given || d.date_given === "1970-01-01") && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg px-2 text-xs font-medium"
                                                                                onClick={() => handleMarkGiven(d.id)}
                                                                            >
                                                                                <Send className="h-3.5 w-3.5 mr-1" /> Given
                                                                            </Button>
                                                                        )}
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
                </>
            )}

            {/* Sub-Tab 2: Paper Checking Remuneration & Bill */}
            {activeSubTab === "remuneration" && (
                <>
                    {/* Top Filters & Exam Selector for Remuneration */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <Select value={selectedExam} onValueChange={setSelectedExam}>
                                <SelectTrigger className="w-full sm:w-[240px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                                    <SelectValue placeholder="Select Exam" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border shadow-md">
                                    {exams.map(e => (
                                        <SelectItem key={e.id} value={e.id} className="rounded-lg">{e.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {selectedExam && (
                                <div className="relative w-full sm:w-[240px]">
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
                        </div>

                        {selectedExam && teacherRemunerationList.length > 0 && (
                            <Button
                                onClick={handlePrintRemunerationBill}
                                className="h-11 px-5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-none"
                            >
                                <Printer className="h-4 w-4" /> Print Remuneration Bill
                            </Button>
                        )}
                    </div>

                    {!selectedExam ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Coins className="h-12 w-12 text-muted-foreground/30 mb-4" />
                            <p className="text-muted-foreground font-medium">Select an exam to calculate and view paper checking remuneration bill</p>
                        </div>
                    ) : (
                        <>
                            {/* Remuneration KPI & Class Rates Settings */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                <Card className="shadow-none border-border rounded-xl bg-card">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Class Rates</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setClassRatesModalOpen(true)}
                                                className="h-5 px-1.5 text-[10px] font-bold text-primary hover:text-primary"
                                            >
                                                <SlidersHorizontal className="h-3 w-3 mr-1" /> Configure
                                            </Button>
                                        </div>
                                        <p className="text-sm font-bold text-foreground mt-1">Checking &amp; Recheck</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Custom per-class evaluation fees</p>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-none border-border rounded-xl bg-card">
                                    <CardContent className="p-4 text-center">
                                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Evaluators &amp; Recheckers</p>
                                        <p className="text-2xl font-black text-foreground">{remunerationStats.totalTeachers}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Teachers in bill</p>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-none border-border rounded-xl bg-card">
                                    <CardContent className="p-4 text-center">
                                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Main vs Recheck Amount</p>
                                        <p className="text-xs font-bold text-foreground">
                                            Main: <span className="font-mono text-emerald-600">BDT {remunerationStats.totalMainAmount.toLocaleString()}</span>
                                        </p>
                                        <p className="text-xs font-bold text-foreground mt-0.5">
                                            Recheck: <span className="font-mono text-primary">BDT {remunerationStats.totalRecheckAmount.toLocaleString()}</span>
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-none border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl">
                                    <CardContent className="p-4 text-center">
                                        <p className="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold mb-1 flex items-center justify-center gap-1">
                                            <Coins className="h-3.5 w-3.5" /> Total Remuneration Bill
                                        </p>
                                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">BDT {remunerationStats.totalAmount.toLocaleString()}</p>
                                        <p className="text-[10px] text-emerald-600/80 font-medium mt-0.5">{remunerationStats.totalCopies} total scripts evaluated</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Remuneration Table Card */}
                            <Card className="shadow-none border-border rounded-xl">
                                <CardHeader className="py-3 bg-muted/30 border-b border-border rounded-t-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <Receipt className="h-4 w-4 text-emerald-600" />
                                            Teacher Remuneration Bill Sheet
                                        </CardTitle>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setClassRatesModalOpen(true)}
                                            className="h-7 text-xs font-semibold rounded-lg px-2 border-border"
                                        >
                                            <SlidersHorizontal className="h-3 w-3 mr-1 text-muted-foreground" /> Class Rates
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
                                            <Button
                                                variant={remunerationStatusFilter === "all" ? "default" : "ghost"}
                                                size="sm"
                                                onClick={() => setRemunerationStatusFilter("all")}
                                                className="h-7 text-xs rounded-lg px-2.5 font-semibold"
                                            >
                                                All Assigned
                                            </Button>
                                            <Button
                                                variant={remunerationStatusFilter === "returned" ? "default" : "ghost"}
                                                size="sm"
                                                onClick={() => setRemunerationStatusFilter("returned")}
                                                className="h-7 text-xs rounded-lg px-2.5 font-semibold text-emerald-600 hover:text-emerald-700"
                                            >
                                                Returned Only
                                            </Button>
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePrintRemunerationBill}
                                            className="h-9 px-3 text-xs font-semibold rounded-xl gap-1.5 border-border shadow-none"
                                        >
                                            <Printer className="h-4 w-4 text-primary" /> Print Bill Sheet
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {teacherRemunerationList.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-center">
                                            <Receipt className="h-10 w-10 text-muted-foreground/30 mb-3" />
                                            <p className="text-muted-foreground text-sm">No paper checking distributions found for this exam</p>
                                        </div>
                                    ) : (
                                        <Table className="w-full min-w-[880px]">
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="text-xs w-9 text-center px-1">Sl.</TableHead>
                                                    <TableHead className="text-xs px-2 min-w-[130px]">Teacher Name</TableHead>
                                                    <TableHead className="text-xs px-2 min-w-[100px]">Class &amp; Sec</TableHead>
                                                    <TableHead className="text-xs px-2 min-w-[110px]">Subject</TableHead>
                                                    <TableHead className="text-xs text-center px-1.5 w-16">Duty</TableHead>
                                                    <TableHead className="text-xs text-center px-1.5 w-14">Copies</TableHead>
                                                    <TableHead className="text-xs text-center px-1.5">Main Rate</TableHead>
                                                    <TableHead className="text-xs text-right px-2">Main Amt</TableHead>
                                                    <TableHead className="text-xs text-center px-1.5">Recheck Rate</TableHead>
                                                    <TableHead className="text-xs text-right px-2">Recheck Amt</TableHead>
                                                    <TableHead className="text-xs text-right px-2.5">Total Amount</TableHead>
                                                    <TableHead className="text-xs text-center w-16 px-1">Slip</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {teacherRemunerationList.map((teacherData, tIdx) => {
                                                    const rowCount = teacherData.items.length;
                                                    return (
                                                        <React.Fragment key={teacherData.teacherId}>
                                                            {teacherData.items.map((item, itemIdx) => {
                                                                const isFirst = itemIdx === 0;
                                                                const isRecheck = item.dutyType === "recheck";
                                                                return (
                                                                    <TableRow key={item.distId} className="hover:bg-muted/30">
                                                                        {isFirst && (
                                                                            <TableCell
                                                                                rowSpan={rowCount}
                                                                                className="text-xs text-center font-mono text-muted-foreground align-middle border-r border-border/40 bg-background/30 font-semibold px-1 py-2"
                                                                            >
                                                                                {(tIdx + 1).toString().padStart(2, "0")}
                                                                            </TableCell>
                                                                        )}
                                                                        {isFirst && (
                                                                            <TableCell
                                                                                rowSpan={rowCount}
                                                                                className="text-xs font-bold text-foreground align-middle border-r border-border/40 bg-background/30 px-2 py-2"
                                                                            >
                                                                                {teacherData.teacherName}
                                                                            </TableCell>
                                                                        )}
                                                                        <TableCell className="text-xs font-medium px-2 py-2">{item.className}</TableCell>
                                                                        <TableCell className="text-xs px-2 py-2">{item.subjectName}</TableCell>
                                                                        <TableCell className="text-xs text-center px-1.5 py-2">
                                                                            <Badge
                                                                                variant={isRecheck ? "outline" : "secondary"}
                                                                                className={`text-[10px] px-1.5 py-0.5 font-semibold ${
                                                                                    isRecheck 
                                                                                        ? "bg-primary/10 text-primary border-primary/30" 
                                                                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                                                }`}
                                                                            >
                                                                                {isRecheck ? "Recheck" : "Main"}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-center font-mono font-semibold px-1.5 py-2">
                                                                            {item.copies}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-center font-mono text-muted-foreground px-1.5 py-2">
                                                                            {!isRecheck ? `BDT ${item.mainRate}` : "—"}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-right font-mono font-semibold text-foreground px-2 py-2">
                                                                            {!isRecheck ? `BDT ${item.mainAmount.toLocaleString()}` : "—"}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-center font-mono text-muted-foreground px-1.5 py-2">
                                                                            {isRecheck ? `BDT ${item.recheckRate}` : "—"}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-right font-mono font-semibold text-primary px-2 py-2">
                                                                            {isRecheck ? `BDT ${item.recheckAmount.toLocaleString()}` : "—"}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-right font-mono font-bold text-foreground px-2.5 py-2 whitespace-nowrap">
                                                                            BDT {item.totalAmount.toLocaleString()}
                                                                        </TableCell>
                                                                        {isFirst && (
                                                                            <TableCell
                                                                                rowSpan={rowCount}
                                                                                className="text-xs text-center align-middle border-l border-border/40 bg-background/30 px-1 py-2"
                                                                            >
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={() => handlePrintTeacherVoucher(teacherData)}
                                                                                    className="h-7 px-2 text-[11px] font-semibold text-primary hover:bg-primary/10 gap-1 rounded-lg"
                                                                                    title="Print Individual Teacher Bill Slip"
                                                                                >
                                                                                    <Printer className="h-3 w-3" /> Slip
                                                                                </Button>
                                                                            </TableCell>
                                                                        )}
                                                                    </TableRow>
                                                                );
                                                            })}
                                                            {rowCount > 1 && (
                                                                <TableRow className="bg-muted/40 font-semibold border-b border-border/80">
                                                                    <TableCell colSpan={5} className="text-xs text-right text-muted-foreground font-bold px-2 py-2">
                                                                        Subtotal ({teacherData.teacherName}):
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-center font-mono font-bold px-1.5 py-2">
                                                                        {teacherData.totalCopies}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-center text-muted-foreground px-1.5 py-2">—</TableCell>
                                                                    <TableCell className="text-xs text-right font-mono font-semibold px-2 py-2">
                                                                        BDT {teacherData.mainAmount.toLocaleString()}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-center text-muted-foreground px-1.5 py-2">—</TableCell>
                                                                    <TableCell className="text-xs text-right font-mono font-semibold text-primary px-2 py-2">
                                                                        BDT {teacherData.recheckAmount.toLocaleString()}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 px-2.5 py-2 whitespace-nowrap">
                                                                        BDT {teacherData.totalAmount.toLocaleString()}
                                                                    </TableCell>
                                                                    <TableCell className="border-l border-border/40 bg-background/30 px-1 py-2"></TableCell>
                                                                </TableRow>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </TableBody>
                                            <TableFooter>
                                                <TableRow className="bg-muted/70 font-black border-t-2 border-border text-foreground">
                                                    <TableCell colSpan={5} className="text-xs font-black text-right px-2 py-2.5">
                                                        GRAND TOTAL
                                                    </TableCell>
                                                    <TableCell className="text-xs font-black text-center font-mono px-1.5 py-2.5">
                                                        {remunerationStats.totalCopies}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-black text-center font-mono text-[10px] px-1.5 py-2.5">
                                                        Class-wise
                                                    </TableCell>
                                                    <TableCell className="text-xs font-black text-right font-mono px-2 py-2.5">
                                                        BDT {remunerationStats.totalMainAmount.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-black text-center font-mono text-[10px] px-1.5 py-2.5">
                                                        Class-wise
                                                    </TableCell>
                                                    <TableCell className="text-xs font-black text-right font-mono text-primary px-2 py-2.5">
                                                        BDT {remunerationStats.totalRecheckAmount.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-black text-right font-mono text-emerald-600 dark:text-emerald-400 px-2.5 py-2.5 whitespace-nowrap" style={{ fontSize: "13px" }}>
                                                        BDT {remunerationStats.totalAmount.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="border-l border-border/40 bg-background/30 px-1 py-2.5"></TableCell>
                                                </TableRow>
                                            </TableFooter>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </>
            )}

            {/* Class Rates Configuration Modal */}
            <Dialog open={classRatesModalOpen} onOpenChange={setClassRatesModalOpen}>
                <DialogContent className="sm:max-w-2xl rounded-xl p-6 border-border">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4 text-primary" />
                                Class-Wise Checking &amp; Recheck Rates (BDT)
                            </DialogTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleApplyPresetInTab}
                                className="h-7 text-[11px] font-semibold rounded-lg px-2 border-dashed border-primary/50 text-primary hover:bg-primary/5"
                            >
                                Apply Standard Preset
                            </Button>
                        </div>
                    </DialogHeader>
                    <div className="py-3 space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Set evaluation fee and rechecking fee per script for each class.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                            {classes.map((cls) => (
                                <div key={cls.id} className="p-3 rounded-xl bg-muted/60 border border-border/70 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-foreground">{cls.name}</Label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-semibold text-muted-foreground block">Main Checking</span>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-[10px]">BDT</span>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.5"
                                                    value={editingClassRates[cls.id] ?? "0"}
                                                    onChange={(e) => setEditingClassRates(prev => ({ ...prev, [cls.id]: e.target.value }))}
                                                    className="pl-8 h-8 bg-card border-border/80 text-xs font-mono font-bold rounded-lg text-right"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-semibold text-primary block">Recheck</span>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-[10px]">BDT</span>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.5"
                                                    value={editingClassRecheckRates[cls.id] ?? "0"}
                                                    onChange={(e) => setEditingClassRecheckRates(prev => ({ ...prev, [cls.id]: e.target.value }))}
                                                    className="pl-8 h-8 bg-card border-border/80 text-xs font-mono font-bold rounded-lg text-right text-primary"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter className="pt-2">
                        <Button
                            variant="outline"
                            onClick={() => setClassRatesModalOpen(false)}
                            className="rounded-xl px-4 h-10 border-border font-semibold text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveClassRatesFromTab}
                            disabled={savingClassRates}
                            className="rounded-xl px-4 h-10 bg-primary text-primary-foreground font-semibold text-xs"
                        >
                            {savingClassRates ? "Saving..." : "Save Class Rates"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Examiner Teacher *</Label>
                                <Select value={form.teacher_id} onValueChange={v => handleFormChange("teacher_id", v)}>
                                    <SelectTrigger className="h-10 rounded-xl">
                                        <SelectValue placeholder="Select Examiner" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {teachers.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name} — {t.designation}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recheck Teacher</Label>
                                    <span className="text-[10px] text-muted-foreground font-medium">(Optional)</span>
                                </div>
                                <Select 
                                    value={form.recheck_teacher_id || "_none"} 
                                    onValueChange={v => handleFormChange("recheck_teacher_id", v === "_none" ? "" : v)}
                                >
                                    <SelectTrigger className="h-10 rounded-xl">
                                        <SelectValue placeholder="Select Rechecker (Optional)" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="_none">None (No Rechecker)</SelectItem>
                                        {teachers.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name} — {t.designation}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
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
