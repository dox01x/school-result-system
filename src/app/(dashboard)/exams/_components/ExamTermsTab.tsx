"use client";

import { useState, useMemo, useEffect } from "react";
import type { Exam } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Plus,
    Pencil,
    Trash2 as Trash,
    ClipboardList as ClipboardText,
    Copy,
    Search,
    Filter,
    AlertTriangle,
    Layers,
    Calendar,
    CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ExamTermsTabProps {
    exams: Exam[];
    loading: boolean;
    supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>;
    onRefresh: () => void;
}

const getTypeLabel = (type: string) => {
    switch (type) {
        case "mct":
            return "MCT Exam";
        case "semester":
            return "Semester Exam";
        case "standalone":
            return "Standalone Exam";
        default:
            return type.toUpperCase();
    }
};

const getTypeBadgeStyle = (type: string) => {
    switch (type) {
        case "mct":
            return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 font-bold";
        case "semester":
            return "bg-primary/10 text-primary border-primary/30 font-bold";
        case "standalone":
            return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold";
        default:
            return "bg-muted text-muted-foreground border-border font-medium";
    }
};

export function ExamTermsTab({ exams, loading, supabase, onRefresh }: ExamTermsTabProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingExam, setEditingExam] = useState<Exam | null>(null);
    const [form, setForm] = useState({ name: "", exam_type: "semester", term: 1 });
    const [nameError, setNameError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Search and filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [termFilter, setTermFilter] = useState("all");

    // Clone / Duplicate state
    const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
    const [sourceExamToClone, setSourceExamToClone] = useState<Exam | null>(null);
    const [cloneForm, setCloneForm] = useState({
        name: "",
        exam_type: "semester",
        term: 1,
        copySubjectConfig: true,
    });
    const [cloning, setCloning] = useState(false);

    // Dependent stats map per exam (configured subjects, marks count)
    const [examStats, setExamStats] = useState<
        Record<string, { subjectConfigsCount: number; marksCount: number; schedulesCount: number }>
    >({});

    // Deletion confirmation with pre-flight check state
    const [deleteModalState, setDeleteModalState] = useState<{
        open: boolean;
        exam: Exam | null;
        checking: boolean;
        marksCount: number;
        resultsCount: number;
        schedulesCount: number;
        seatPlansCount: number;
        dutiesCount: number;
    }>({
        open: false,
        exam: null,
        checking: false,
        marksCount: 0,
        resultsCount: 0,
        schedulesCount: 0,
        seatPlansCount: 0,
        dutiesCount: 0,
    });

    // Load stats per exam (subject config counts, schedules)
    useEffect(() => {
        if (exams.length === 0) return;
        let isCancelled = false;

        void (async () => {
            try {
                const [cfgRes, schedRes] = await Promise.all([
                    supabase.from("exam_subject_config").select("exam_id"),
                    supabase.from("exam_schedules").select("exam_id"),
                ]);

                const stats: Record<
                    string,
                    { subjectConfigsCount: number; marksCount: number; schedulesCount: number }
                > = {};

                exams.forEach((e) => {
                    stats[e.id] = {
                        subjectConfigsCount: 0,
                        marksCount: 0,
                        schedulesCount: 0,
                    };
                });

                (cfgRes.data || []).forEach((row: { exam_id: string }) => {
                    if (stats[row.exam_id]) {
                        stats[row.exam_id].subjectConfigsCount++;
                    }
                });

                (schedRes.data || []).forEach((row: { exam_id: string }) => {
                    if (stats[row.exam_id]) {
                        stats[row.exam_id].schedulesCount++;
                    }
                });

                if (!isCancelled) {
                    setExamStats(stats);
                }
            } catch {
                // Non-critical background stats
            }
        })();

        return () => {
            isCancelled = true;
        };
    }, [exams, supabase]);

    // Filtered exams
    const filteredExams = useMemo(() => {
        return exams.filter((e) => {
            const matchesSearch = searchQuery
                ? e.name.toLowerCase().includes(searchQuery.toLowerCase())
                : true;
            const matchesType = typeFilter === "all" ? true : e.exam_type === typeFilter;
            const matchesTerm =
                termFilter === "all"
                    ? true
                    : termFilter === "standalone"
                    ? e.exam_type === "standalone"
                    : e.term?.toString() === termFilter;

            return matchesSearch && matchesType && matchesTerm;
        });
    }, [exams, searchQuery, typeFilter, termFilter]);

    // Grouping for term view
    const termGroups = useMemo(() => {
        return [1, 2, 3]
            .map((term) => ({
                term,
                mct: filteredExams.find((e) => e.exam_type === "mct" && e.term === term),
                semester: filteredExams.find((e) => e.exam_type === "semester" && e.term === term),
                others: filteredExams.filter(
                    (e) => e.term === term && e.exam_type !== "mct" && e.exam_type !== "semester"
                ),
            }))
            .filter((g) => g.mct || g.semester || g.others.length > 0);
    }, [filteredExams]);

    const standaloneExams = useMemo(() => {
        return filteredExams.filter((e) => e.exam_type === "standalone");
    }, [filteredExams]);

    // Validation
    const validateForm = () => {
        const trimmed = form.name.trim();
        if (!trimmed) {
            setNameError("Exam name is required");
            return false;
        }
        if (trimmed.length < 2) {
            setNameError("Exam name must be at least 2 characters");
            return false;
        }
        // Check for duplicate name
        const duplicate = exams.find(
            (e) => e.name.toLowerCase() === trimmed.toLowerCase() && e.id !== editingExam?.id
        );
        if (duplicate) {
            setNameError(`An exam named "${duplicate.name}" already exists`);
            return false;
        }
        setNameError("");
        return true;
    };

    // Save Create / Edit
    const handleSave = async () => {
        if (!validateForm()) return;
        setSubmitting(true);
        try {
            const isStandalone = form.exam_type === "standalone";
            const payload = {
                name: form.name.trim(),
                exam_type: form.exam_type,
                term: isStandalone ? null : form.term,
            };

            if (editingExam) {
                const { error } = await supabase.from("exams").update(payload).eq("id", editingExam.id);
                if (error) {
                    if (error.code === "23505") {
                        throw new Error(`An exam with name "${form.name.trim()}" already exists`);
                    }
                    throw error;
                }
                toast.success(`Exam "${form.name.trim()}" updated successfully`);
            } else {
                const { error } = await supabase.from("exams").insert(payload);
                if (error) {
                    if (error.code === "23505") {
                        throw new Error(`An exam with name "${form.name.trim()}" already exists`);
                    }
                    throw error;
                }
                toast.success(`Exam "${form.name.trim()}" created successfully`);
            }

            setForm({ name: "", exam_type: "semester", term: 1 });
            setEditingExam(null);
            setDialogOpen(false);
            onRefresh();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save exam");
        } finally {
            setSubmitting(false);
        }
    };

    // Pre-flight check before opening deletion modal
    const initiateDelete = async (exam: Exam) => {
        setDeleteModalState({
            open: true,
            exam,
            checking: true,
            marksCount: 0,
            resultsCount: 0,
            schedulesCount: 0,
            seatPlansCount: 0,
            dutiesCount: 0,
        });

        try {
            const [marksRes, resultsRes, schedRes, seatRes, dutyRes] = await Promise.all([
                supabase.from("marks").select("id", { count: "exact", head: true }).eq("exam_id", exam.id),
                supabase.from("results").select("id", { count: "exact", head: true }).eq("exam_id", exam.id),
                supabase.from("exam_schedules").select("id", { count: "exact", head: true }).eq("exam_id", exam.id),
                supabase.from("exam_seat_plans").select("id", { count: "exact", head: true }).eq("exam_id", exam.id),
                supabase.from("exam_duties").select("id", { count: "exact", head: true }).eq("exam_id", exam.id),
            ]);

            setDeleteModalState((prev) => ({
                ...prev,
                checking: false,
                marksCount: marksRes.count || 0,
                resultsCount: resultsRes.count || 0,
                schedulesCount: schedRes.count || 0,
                seatPlansCount: seatRes.count || 0,
                dutiesCount: dutyRes.count || 0,
            }));
        } catch {
            setDeleteModalState((prev) => ({ ...prev, checking: false }));
        }
    };

    // Execute deletion
    const executeDelete = async () => {
        const exam = deleteModalState.exam;
        if (!exam) return;

        try {
            const { error } = await supabase.from("exams").delete().eq("id", exam.id);
            if (error) throw error;
            toast.success(`Exam "${exam.name}" deleted successfully`);
            setDeleteModalState((prev) => ({ ...prev, open: false, exam: null }));
            onRefresh();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to delete exam");
        }
    };

    // Open Edit modal
    const openEdit = (exam: Exam) => {
        setEditingExam(exam);
        setForm({
            name: exam.name,
            exam_type: exam.exam_type,
            term: exam.term ?? 1,
        });
        setNameError("");
        setDialogOpen(true);
    };

    // Open Clone / Duplicate modal
    const openClone = (exam: Exam) => {
        setSourceExamToClone(exam);
        const nextTerm = exam.term ? (exam.term === 3 ? 1 : exam.term + 1) : 1;
        setCloneForm({
            name: `Copy of ${exam.name}`,
            exam_type: exam.exam_type,
            term: exam.exam_type === "standalone" ? 1 : nextTerm,
            copySubjectConfig: true,
        });
        setCloneDialogOpen(true);
    };

    // Execute Clone / Duplicate
    const handleCloneSave = async () => {
        if (!sourceExamToClone || !cloneForm.name.trim()) {
            toast.error("Exam name is required");
            return;
        }

        const trimmed = cloneForm.name.trim();
        const duplicate = exams.find((e) => e.name.toLowerCase() === trimmed.toLowerCase());
        if (duplicate) {
            toast.error(`An exam named "${duplicate.name}" already exists`);
            return;
        }

        setCloning(true);
        try {
            const isStandalone = cloneForm.exam_type === "standalone";
            // 1. Insert new Exam
            const { data: newExam, error: examError } = await supabase
                .from("exams")
                .insert({
                    name: trimmed,
                    exam_type: cloneForm.exam_type,
                    term: isStandalone ? null : cloneForm.term,
                })
                .select("id, name, exam_type, term")
                .single();

            if (examError) throw examError;

            // 2. Clone subject config if requested
            if (cloneForm.copySubjectConfig && newExam) {
                const { data: sourceConfigs, error: cfgError } = await supabase
                    .from("exam_subject_config")
                    .select("subject_id, full_marks, weight_percent")
                    .eq("exam_id", sourceExamToClone.id);

                if (!cfgError && sourceConfigs && sourceConfigs.length > 0) {
                    const clonedConfigs = sourceConfigs.map((c) => ({
                        exam_id: newExam.id,
                        subject_id: c.subject_id,
                        full_marks: c.full_marks,
                        weight_percent: c.weight_percent,
                    }));
                    await supabase.from("exam_subject_config").insert(clonedConfigs);
                }
            }

            toast.success(`Exam duplicated as "${trimmed}"`);
            setCloneDialogOpen(false);
            setSourceExamToClone(null);
            onRefresh();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to duplicate exam");
        } finally {
            setCloning(false);
        }
    };

    const renderExamCard = (exam: Exam) => {
        const stats = examStats[exam.id];
        return (
            <div
                key={exam.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-border bg-card p-3.5 group hover:border-primary/40 hover:bg-muted/30 transition-all duration-200 gap-3"
            >
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`text-[10px] rounded-md uppercase tracking-wider ${getTypeBadgeStyle(exam.exam_type)}`}>
                        {getTypeLabel(exam.exam_type)}
                    </Badge>
                    <div>
                        <span className="font-bold text-sm text-foreground block">{exam.name}</span>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            {exam.term && <span>Term {exam.term}</span>}
                            {stats && stats.subjectConfigsCount > 0 && (
                                <>
                                    <span>•</span>
                                    <span className="text-primary font-medium flex items-center gap-1">
                                        <Layers size={11} /> {stats.subjectConfigsCount} subjects configured
                                    </span>
                                </>
                            )}
                            {stats && stats.schedulesCount > 0 && (
                                <>
                                    <span>•</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                        <Calendar size={11} /> {stats.schedulesCount} scheduled
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 self-end sm:self-center opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground rounded-lg"
                        onClick={() => openClone(exam)}
                        title="Duplicate this exam configuration"
                    >
                        <Copy size={13} />
                        <span className="hidden md:inline">Duplicate</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={() => openEdit(exam)}
                        title="Edit exam"
                    >
                        <Pencil size={13} strokeWidth={1.5} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20"
                        onClick={() => initiateDelete(exam)}
                        title="Delete exam"
                    >
                        <Trash size={13} strokeWidth={1.5} />
                    </Button>
                </div>
            </div>
        );
    };

    const hasActiveDangerInDeletion =
        deleteModalState.marksCount > 0 ||
        deleteModalState.resultsCount > 0 ||
        deleteModalState.schedulesCount > 0;

    return (
        <div className="space-y-6">
            {/* Top Filter & Creation Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border">
                <div className="flex items-center gap-2.5 flex-wrap flex-1">
                    {/* Search */}
                    <div className="relative w-full sm:w-56">
                        <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search exams..."
                            className="pl-9 h-9.5 text-xs rounded-xl bg-muted/40 border-border/80"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Type Filter */}
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="h-9.5 w-[140px] text-xs font-semibold rounded-xl bg-muted/40 border-border/80">
                            <SelectValue placeholder="Exam Type" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border shadow-md">
                            <SelectItem value="all" className="text-xs font-medium">All Types</SelectItem>
                            <SelectItem value="semester" className="text-xs font-medium">Semester</SelectItem>
                            <SelectItem value="mct" className="text-xs font-medium">MCT</SelectItem>
                            <SelectItem value="standalone" className="text-xs font-medium">Standalone</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Term Filter */}
                    <Select value={termFilter} onValueChange={setTermFilter}>
                        <SelectTrigger className="h-9.5 w-[130px] text-xs font-semibold rounded-xl bg-muted/40 border-border/80">
                            <SelectValue placeholder="Term" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border shadow-md">
                            <SelectItem value="all" className="text-xs font-medium">All Terms</SelectItem>
                            <SelectItem value="1" className="text-xs font-medium">Term 1</SelectItem>
                            <SelectItem value="2" className="text-xs font-medium">Term 2</SelectItem>
                            <SelectItem value="3" className="text-xs font-medium">Term 3</SelectItem>
                            <SelectItem value="standalone" className="text-xs font-medium">Standalone</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Add Exam Button */}
                <Button
                    className="bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-bold text-xs h-9.5 px-4 shadow-none gap-1.5 self-end sm:self-center"
                    onClick={() => {
                        setForm({ name: "", exam_type: "semester", term: 1 });
                        setNameError("");
                        setEditingExam(null);
                        setDialogOpen(true);
                    }}
                >
                    <Plus size={15} /> Add Exam
                </Button>
            </div>

            {/* Empty State */}
            {exams.length === 0 && !loading ? (
                <Card className="bg-transparent rounded-2xl border-2 border-dashed border-border p-12 text-center shadow-none">
                    <CardContent className="py-8 space-y-3">
                        <div className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto text-muted-foreground/40 bg-muted">
                            <ClipboardText size={28} strokeWidth={1.2} />
                        </div>
                        <h3 className="font-semibold text-lg text-foreground">No exams configured</h3>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                            Add terms and examination cycles such as MCTs, Semester exams, or Annual exams.
                        </p>
                    </CardContent>
                </Card>
            ) : filteredExams.length === 0 ? (
                <Card className="bg-transparent rounded-2xl border-2 border-dashed border-border p-12 text-center shadow-none">
                    <CardContent className="py-8 space-y-2">
                        <Filter size={28} strokeWidth={1.2} className="text-muted-foreground/40 mx-auto" />
                        <h3 className="font-semibold text-base text-foreground">No matching exams</h3>
                        <p className="text-xs text-muted-foreground">Try adjusting your search query or filter criteria.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {/* Render standard Term Groups (Term 1, 2, 3) */}
                    {termGroups.map(({ term, mct, semester, others }) => (
                        <Card key={term} className="bg-card rounded-2xl border-border shadow-none overflow-hidden">
                            <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border flex flex-row items-center justify-between">
                                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <span>Term {term} Examination Series</span>
                                </CardTitle>
                                <Badge variant="secondary" className="text-[10px] font-bold">
                                    {[mct, semester, ...others].filter(Boolean).length} Exams
                                </Badge>
                            </CardHeader>
                            <CardContent className="p-3.5 space-y-2.5">
                                {[mct, semester, ...others].filter(Boolean).map((exam) => exam && renderExamCard(exam))}
                                {!mct && typeFilter === "all" && (
                                    <p className="text-xs text-muted-foreground italic pl-2 py-1">
                                        No MCT exam configured for Term {term}
                                    </p>
                                )}
                                {!semester && typeFilter === "all" && (
                                    <p className="text-xs text-muted-foreground italic pl-2 py-1">
                                        No Semester exam configured for Term {term}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ))}

                    {/* Render Standalone Exams if any */}
                    {standaloneExams.length > 0 && (
                        <Card className="bg-card rounded-2xl border-border shadow-none overflow-hidden">
                            <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border flex flex-row items-center justify-between">
                                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Standalone &amp; Custom Exams
                                </CardTitle>
                                <Badge variant="secondary" className="text-[10px] font-bold">
                                    {standaloneExams.length} Exams
                                </Badge>
                            </CardHeader>
                            <CardContent className="p-3.5 space-y-2.5">
                                {standaloneExams.map((exam) => renderExamCard(exam))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Dialog: Create / Edit Exam */}
            <Dialog
                open={dialogOpen}
                onOpenChange={(o) => {
                    setDialogOpen(o);
                    if (!o) {
                        setEditingExam(null);
                        setNameError("");
                    }
                }}
            >
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold">
                            {editingExam ? "Edit Exam" : "Create New Exam"}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Define the examination title, type (Semester, MCT, or Standalone), and academic term.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSave();
                        }}
                        className="space-y-4 py-2"
                    >
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Exam Name *</Label>
                            <Input
                                id="exam-name-input"
                                placeholder='e.g., "1st Semester Exam", "1st MCT", "Pre-Test"'
                                value={form.name}
                                onChange={(e) => {
                                    setForm({ ...form, name: e.target.value });
                                    if (nameError) setNameError("");
                                }}
                                className={`h-10 rounded-xl ${nameError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                            />
                            {nameError && (
                                <p className="text-[11px] text-destructive font-medium">{nameError}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Exam Type</Label>
                                <Select
                                    value={form.exam_type}
                                    onValueChange={(v) => setForm({ ...form, exam_type: v })}
                                >
                                    <SelectTrigger className="h-10 rounded-xl bg-muted/40 font-medium text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border shadow-md">
                                        <SelectItem value="semester" className="text-xs font-medium">Semester</SelectItem>
                                        <SelectItem value="mct" className="text-xs font-medium">MCT</SelectItem>
                                        <SelectItem value="standalone" className="text-xs font-medium">Standalone</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {form.exam_type !== "standalone" ? (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Academic Term</Label>
                                    <Select
                                        value={(form.term || 1).toString()}
                                        onValueChange={(v) => setForm({ ...form, term: parseInt(v, 10) })}
                                    >
                                        <SelectTrigger className="h-10 rounded-xl bg-muted/40 font-medium text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-border shadow-md">
                                            <SelectItem value="1" className="text-xs font-medium">1st Term</SelectItem>
                                            <SelectItem value="2" className="text-xs font-medium">2nd Term</SelectItem>
                                            <SelectItem value="3" className="text-xs font-medium">3rd Term</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-muted-foreground">Scope</Label>
                                    <div className="h-10 rounded-xl bg-muted/40 border border-border flex items-center px-3 text-xs text-muted-foreground font-medium">
                                        Independent Exam
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="gap-2 pt-2">
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-border text-foreground font-semibold rounded-xl text-xs"
                                >
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold text-xs shadow-none"
                            >
                                {submitting ? "Saving..." : editingExam ? "Update Exam" : "Create Exam"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dialog: Duplicate / Clone Exam */}
            <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <Copy size={18} className="text-primary" /> Duplicate Exam
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Clone configuration from <span className="font-bold text-foreground">{sourceExamToClone?.name}</span> into a new exam.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">New Exam Name *</Label>
                            <Input
                                placeholder='e.g., "2nd MCT", "2nd Semester Exam"'
                                value={cloneForm.name}
                                onChange={(e) => setCloneForm({ ...cloneForm, name: e.target.value })}
                                className="h-10 rounded-xl text-xs font-medium"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Exam Type</Label>
                                <Select
                                    value={cloneForm.exam_type}
                                    onValueChange={(v) => setCloneForm({ ...cloneForm, exam_type: v })}
                                >
                                    <SelectTrigger className="h-10 rounded-xl bg-muted/40 font-medium text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border shadow-md">
                                        <SelectItem value="semester" className="text-xs font-medium">Semester</SelectItem>
                                        <SelectItem value="mct" className="text-xs font-medium">MCT</SelectItem>
                                        <SelectItem value="standalone" className="text-xs font-medium">Standalone</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {cloneForm.exam_type !== "standalone" && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Target Term</Label>
                                    <Select
                                        value={cloneForm.term.toString()}
                                        onValueChange={(v) =>
                                            setCloneForm({ ...cloneForm, term: parseInt(v, 10) })
                                        }
                                    >
                                        <SelectTrigger className="h-10 rounded-xl bg-muted/40 font-medium text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-border shadow-md">
                                            <SelectItem value="1" className="text-xs font-medium">1st Term</SelectItem>
                                            <SelectItem value="2" className="text-xs font-medium">2nd Term</SelectItem>
                                            <SelectItem value="3" className="text-xs font-medium">3rd Term</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* Copy Subject Configuration Checkbox */}
                        <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-muted/30 border border-border">
                            <Checkbox
                                id="clone-subjects-check"
                                checked={cloneForm.copySubjectConfig}
                                onCheckedChange={(c) =>
                                    setCloneForm({ ...cloneForm, copySubjectConfig: Boolean(c) })
                                }
                                className="mt-0.5 rounded-md"
                            />
                            <div className="space-y-0.5">
                                <label
                                    htmlFor="clone-subjects-check"
                                    className="text-xs font-bold leading-none cursor-pointer text-foreground"
                                >
                                    Copy Subject Configuration
                                </label>
                                <p className="text-[11px] text-muted-foreground">
                                    Duplicates subject full marks and weightings to the new exam. Does NOT duplicate student marks or results.
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setCloneDialogOpen(false)}
                            className="rounded-xl text-xs font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCloneSave}
                            disabled={cloning || !cloneForm.name.trim()}
                            className="rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {cloning ? "Cloning..." : "Create Duplicated Exam"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Custom Pre-flight Deletion Warning Dialog */}
            <Dialog
                open={deleteModalState.open}
                onOpenChange={(open) => {
                    if (!open) setDeleteModalState((prev) => ({ ...prev, open: false, exam: null }));
                }}
            >
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
                            <AlertTriangle size={18} /> Delete &quot;{deleteModalState.exam?.name}&quot;?
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Please review dependent academic records before proceeding with deletion.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        {deleteModalState.checking ? (
                            <div className="py-6 text-center text-xs text-muted-foreground font-medium animate-pulse">
                                Checking dependent marks and schedules...
                            </div>
                        ) : hasActiveDangerInDeletion ? (
                            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 space-y-2 text-xs">
                                <p className="font-bold text-destructive flex items-center gap-1.5">
                                    <AlertTriangle size={14} /> Warning: Linked Academic Data Found
                                </p>
                                <div className="space-y-1 text-muted-foreground">
                                    {deleteModalState.marksCount > 0 && (
                                        <p>
                                            • <strong className="text-foreground">{deleteModalState.marksCount}</strong> Student Mark records
                                        </p>
                                    )}
                                    {deleteModalState.resultsCount > 0 && (
                                        <p>
                                            • <strong className="text-foreground">{deleteModalState.resultsCount}</strong> Calculated Term Results
                                        </p>
                                    )}
                                    {deleteModalState.schedulesCount > 0 && (
                                        <p>
                                            • <strong className="text-foreground">{deleteModalState.schedulesCount}</strong> Scheduled Exam Papers
                                        </p>
                                    )}
                                    {deleteModalState.seatPlansCount > 0 && (
                                        <p>
                                            • <strong className="text-foreground">{deleteModalState.seatPlansCount}</strong> Seat Allocation entries
                                        </p>
                                    )}
                                    {deleteModalState.dutiesCount > 0 && (
                                        <p>
                                            • <strong className="text-foreground">{deleteModalState.dutiesCount}</strong> Invigilation Duty rosters
                                        </p>
                                    )}
                                </div>
                                <p className="text-[11px] text-destructive/90 font-medium pt-1">
                                    Deleting this exam will permanently cascade and erase all linked records listed above.
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                No student marks or schedules are currently linked to this exam. It is safe to delete.
                            </p>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteModalState((prev) => ({ ...prev, open: false, exam: null }))}
                            className="rounded-xl text-xs font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={executeDelete}
                            className="rounded-xl text-xs font-bold"
                        >
                            Confirm Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
