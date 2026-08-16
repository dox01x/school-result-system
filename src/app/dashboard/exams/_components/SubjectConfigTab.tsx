"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { Exam, Class, Subject, ExamSubjectConfig } from "@/lib/database.types";
import { SUBJECT_COLUMNS } from "@/lib/supabase/select-columns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    SlidersHorizontal as Sliders,
    Save as FloppyDisk,
    Plus,
    Trash2 as Trash,
    Search,
    RotateCcw,
    Copy,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Layers,
    CheckSquare,
    SquareX,
    Calculator,
    ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface SubjectConfigTabProps {
    exams: Exam[];
    classes: Class[];
    examConfigs: ExamSubjectConfig[];
    supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>;
    onRefresh: () => void;
}

interface SubjectEdit {
    full_marks: string;
    weight_percent: string;
}

export function SubjectConfigTab({
    exams,
    classes,
    examConfigs,
    supabase,
    onRefresh,
}: SubjectConfigTabProps) {
    const [selectedExamId, setSelectedExamId] = useState<string>("");
    const [selectedClassId, setSelectedClassId] = useState<string>("");
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loadingSubjects, setLoadingSubjects] = useState(false);
    const [configEdits, setConfigEdits] = useState<Record<string, SubjectEdit>>({});
    const [originalEdits, setOriginalEdits] = useState<Record<string, SubjectEdit>>({});
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [groupFilter, setGroupFilter] = useState<string>("all");

    // Copy from another exam dialog state
    const [copyDialogOpen, setCopyDialogOpen] = useState(false);
    const [sourceExamId, setSourceExamId] = useState<string>("");
    const [copyingConfig, setCopyingConfig] = useState(false);

    // Unsaved changes confirmation dialog state
    const [unsavedNavDialog, setUnsavedNavDialog] = useState<{
        open: boolean;
        pendingAction: (() => void) | null;
        title: string;
        description: string;
    }>({ open: false, pendingAction: null, title: "", description: "" });

    // Custom bulk modal
    const [bulkMarksDialogOpen, setBulkMarksDialogOpen] = useState(false);
    const [bulkMarksValue, setBulkMarksValue] = useState("100");
    const [bulkWeightDialogOpen, setBulkWeightDialogOpen] = useState(false);
    const [bulkWeightValue, setBulkWeightValue] = useState("100");

    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    // Check if there are dirty/unsaved edits
    const isDirty = useMemo(() => {
        const editKeys = Object.keys(configEdits);
        const origKeys = Object.keys(originalEdits);
        if (editKeys.length !== origKeys.length) return true;
        for (const key of editKeys) {
            const current = configEdits[key];
            const orig = originalEdits[key];
            if (!orig) return true;
            if (current.full_marks !== orig.full_marks || current.weight_percent !== orig.weight_percent) {
                return true;
            }
        }
        return false;
    }, [configEdits, originalEdits]);

    // Initial exam / class selection if empty
    useEffect(() => {
        if (!selectedExamId && exams.length > 0) {
            setSelectedExamId(exams[0].id);
        }
        if (!selectedClassId && classes.length > 0) {
            setSelectedClassId(classes[0].id);
        }
    }, [exams, classes, selectedExamId, selectedClassId]);

    // Fetch subjects whenever selected class changes
    useEffect(() => {
        if (!selectedClassId) {
            setSubjects([]);
            return;
        }
        let isCancelled = false;
        setLoadingSubjects(true);
        void (async () => {
            try {
                const { data, error } = await supabase
                    .from("subjects")
                    .select(SUBJECT_COLUMNS)
                    .eq("class_id", selectedClassId)
                    .order("name");
                if (error) throw error;
                if (!isCancelled) {
                    setSubjects(data || []);
                }
            } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Failed to load class subjects");
            } finally {
                if (!isCancelled) setLoadingSubjects(false);
            }
        })();
        return () => {
            isCancelled = true;
        };
    }, [selectedClassId, supabase]);

    // Populate edits when exam, class, subjects or examConfigs change
    useEffect(() => {
        if (!selectedExamId || subjects.length === 0) {
            setConfigEdits({});
            setOriginalEdits({});
            return;
        }

        const selectedExamObj = exams.find((e) => e.id === selectedExamId);
        const ownConfigs = examConfigs.filter((c) => c.exam_id === selectedExamId);
        const hasOwnConfig = ownConfigs.length > 0;

        const edits: Record<string, SubjectEdit> = {};

        if (hasOwnConfig) {
            ownConfigs.forEach((cfg) => {
                const sub = subjects.find((s) => s.id === cfg.subject_id);
                if (sub) {
                    edits[sub.id] = {
                        full_marks: cfg.full_marks.toString(),
                        weight_percent: cfg.weight_percent.toString(),
                    };
                }
            });
        } else {
            // Find fallback exam configuration of same type if available
            let fallbackExamId: string | null = null;
            if (selectedExamObj) {
                const sameTypeExams = exams
                    .filter((e) => e.exam_type === selectedExamObj.exam_type && e.id !== selectedExamId)
                    .sort((a, b) => (a.term ?? 0) - (b.term ?? 0));
                for (const ex of sameTypeExams) {
                    if (examConfigs.some((c) => c.exam_id === ex.id)) {
                        fallbackExamId = ex.id;
                        break;
                    }
                }
            }

            subjects.forEach((sub) => {
                if (fallbackExamId) {
                    const fallback = examConfigs.find(
                        (c) => c.exam_id === fallbackExamId && c.subject_id === sub.id
                    );
                    if (fallback) {
                        edits[sub.id] = {
                            full_marks: fallback.full_marks.toString(),
                            weight_percent: fallback.weight_percent.toString(),
                        };
                    } else {
                        edits[sub.id] = {
                            full_marks: sub.full_marks.toString(),
                            weight_percent: "100",
                        };
                    }
                } else {
                    edits[sub.id] = {
                        full_marks: sub.full_marks.toString(),
                        weight_percent: "100",
                    };
                }
            });
        }

        setConfigEdits(edits);
        setOriginalEdits(JSON.parse(JSON.stringify(edits)));
    }, [selectedExamId, subjects, examConfigs, exams]);

    // Handle protected navigation when changing Exam or Class with dirty changes
    const handleExamChange = (newExamId: string) => {
        if (newExamId === selectedExamId) return;
        if (isDirty) {
            setUnsavedNavDialog({
                open: true,
                title: "Unsaved Subject Changes",
                description: "You have unsaved changes in the current exam configuration. If you switch exams without saving, your edits will be discarded.",
                pendingAction: () => setSelectedExamId(newExamId),
            });
        } else {
            setSelectedExamId(newExamId);
        }
    };

    const handleClassChange = (newClassId: string) => {
        if (newClassId === selectedClassId) return;
        if (isDirty) {
            setUnsavedNavDialog({
                open: true,
                title: "Unsaved Subject Changes",
                description: "You have unsaved changes for this class. Switching to another class without saving will discard your edits.",
                pendingAction: () => setSelectedClassId(newClassId),
            });
        } else {
            setSelectedClassId(newClassId);
        }
    };

    // Filtered subjects list
    const availableGroups = useMemo(() => {
        const groups = new Set<string>();
        subjects.forEach((s) => {
            if (s.group_name && s.group_name.trim()) groups.add(s.group_name.trim());
        });
        return Array.from(groups);
    }, [subjects]);

    const activeSubjects = useMemo(() => {
        return subjects.filter((s) => Boolean(configEdits[s.id]));
    }, [subjects, configEdits]);

    const removedSubjects = useMemo(() => {
        return subjects.filter((s) => !configEdits[s.id]);
    }, [subjects, configEdits]);

    const filteredActiveSubjects = useMemo(() => {
        return activeSubjects.filter((s) => {
            const matchesSearch = searchQuery
                ? s.name.toLowerCase().includes(searchQuery.toLowerCase())
                : true;
            const matchesGroup =
                groupFilter === "all"
                    ? true
                    : groupFilter === "none"
                    ? !s.group_name || s.group_name === "Common"
                    : s.group_name === groupFilter;
            return matchesSearch && matchesGroup;
        });
    }, [activeSubjects, searchQuery, groupFilter]);

    // Summary calculation metrics
    const metrics = useMemo(() => {
        let totalFullMarks = 0;
        let weightedContributionSum = 0;
        let hasInvalidValues = false;

        activeSubjects.forEach((s) => {
            const edit = configEdits[s.id];
            if (edit) {
                const fm = parseFloat(edit.full_marks);
                const wp = parseFloat(edit.weight_percent);
                if (isNaN(fm) || fm <= 0 || isNaN(wp) || wp <= 0 || wp > 100) {
                    hasInvalidValues = true;
                } else {
                    totalFullMarks += fm;
                    weightedContributionSum += (fm * wp) / 100;
                }
            }
        });

        const avgWeight =
            activeSubjects.length > 0
                ? Math.round(
                      (activeSubjects.reduce(
                          (acc, s) => acc + (parseFloat(configEdits[s.id]?.weight_percent) || 0),
                          0
                      ) /
                          activeSubjects.length) *
                          10
                  ) / 10
                : 0;

        return {
            totalSubjectsInClass: subjects.length,
            activeCount: activeSubjects.length,
            removedCount: removedSubjects.length,
            totalFullMarks: Math.round(totalFullMarks),
            effectiveContributionTotal: Math.round(weightedContributionSum * 100) / 100,
            avgWeight,
            hasInvalidValues,
        };
    }, [subjects, activeSubjects, removedSubjects, configEdits]);

    // Single subject removal
    const handleRemoveSubject = (subjectId: string) => {
        setConfigEdits((prev) => {
            const next = { ...prev };
            delete next[subjectId];
            return next;
        });
        const sub = subjects.find((s) => s.id === subjectId);
        toast.info(`${sub?.name || "Subject"} excluded from this exam`);
    };

    // Single subject re-add
    const handleReAddSubject = (subject: Subject) => {
        setConfigEdits((prev) => ({
            ...prev,
            [subject.id]: {
                full_marks: subject.full_marks.toString(),
                weight_percent: "100",
            },
        }));
        toast.success(`${subject.name} included in exam configuration`);
    };

    // Bulk actions
    const handleIncludeAllSubjects = () => {
        const edits: Record<string, SubjectEdit> = { ...configEdits };
        subjects.forEach((sub) => {
            if (!edits[sub.id]) {
                edits[sub.id] = {
                    full_marks: sub.full_marks.toString(),
                    weight_percent: "100",
                };
            }
        });
        setConfigEdits(edits);
        toast.success("All class subjects included");
    };

    const handleClearAllSubjects = () => {
        setConfigEdits({});
        toast.info("All subjects excluded from this configuration");
    };

    const handleResetToClassDefaults = () => {
        const edits: Record<string, SubjectEdit> = {};
        subjects.forEach((sub) => {
            edits[sub.id] = {
                full_marks: sub.full_marks.toString(),
                weight_percent: "100",
            };
        });
        setConfigEdits(edits);
        toast.success("Reset all subjects to class default marks (100% weight)");
    };

    const handleApplyBulkMarks = () => {
        const val = parseInt(bulkMarksValue, 10);
        if (isNaN(val) || val <= 0) {
            toast.error("Please enter a valid positive integer for full marks");
            return;
        }
        setConfigEdits((prev) => {
            const next: Record<string, SubjectEdit> = {};
            Object.entries(prev).forEach(([subId, edit]) => {
                next[subId] = {
                    ...edit,
                    full_marks: val.toString(),
                };
            });
            return next;
        });
        setBulkMarksDialogOpen(false);
        toast.success(`Set Full Marks = ${val} for all active subjects`);
    };

    const handleApplyBulkWeight = () => {
        const val = parseFloat(bulkWeightValue);
        if (isNaN(val) || val <= 0 || val > 100) {
            toast.error("Weight percentage must be between 0.1 and 100");
            return;
        }
        setConfigEdits((prev) => {
            const next: Record<string, SubjectEdit> = {};
            Object.entries(prev).forEach(([subId, edit]) => {
                next[subId] = {
                    ...edit,
                    weight_percent: val.toString(),
                };
            });
            return next;
        });
        setBulkWeightDialogOpen(false);
        toast.success(`Set Weight = ${val}% for all active subjects`);
    };

    // Copy configuration from another exam
    const handleCopyFromExam = async () => {
        if (!sourceExamId || !selectedClassId || !selectedExamId) return;
        setCopyingConfig(true);
        try {
            const sourceConfigs = examConfigs.filter((c) => c.exam_id === sourceExamId);
            if (sourceConfigs.length === 0) {
                toast.error("The selected source exam has no saved subject configuration");
                setCopyingConfig(false);
                return;
            }

            const edits: Record<string, SubjectEdit> = {};
            let matchedCount = 0;

            subjects.forEach((sub) => {
                const match = sourceConfigs.find((c) => c.subject_id === sub.id);
                if (match) {
                    edits[sub.id] = {
                        full_marks: match.full_marks.toString(),
                        weight_percent: match.weight_percent.toString(),
                    };
                    matchedCount++;
                }
            });

            if (matchedCount === 0) {
                toast.warning("No matching subjects found in the source exam for this class");
            } else {
                setConfigEdits(edits);
                const sourceExamName = exams.find((e) => e.id === sourceExamId)?.name || "Exam";
                toast.success(`Loaded configuration for ${matchedCount} subjects from "${sourceExamName}"`);
                setCopyDialogOpen(false);
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to copy configuration");
        } finally {
            setCopyingConfig(false);
        }
    };

    // Save configuration to Database
    const handleSave = async (isSilent = false) => {
        if (!selectedExamId || !selectedClassId) {
            toast.error("Please select both an exam and a class");
            return;
        }

        // Validate edits
        const activeIds = Object.keys(configEdits);
        for (const subId of activeIds) {
            const edit = configEdits[subId];
            const fm = parseInt(edit.full_marks, 10);
            const wp = parseFloat(edit.weight_percent);
            const sub = subjects.find((s) => s.id === subId);

            if (isNaN(fm) || fm <= 0) {
                toast.error(`Invalid Full Marks for "${sub?.name || 'Subject'}". Must be greater than 0.`);
                return;
            }
            if (isNaN(wp) || wp <= 0 || wp > 100) {
                toast.error(`Invalid Weight % for "${sub?.name || 'Subject'}". Must be between 0.1 and 100.`);
                return;
            }
        }

        setSaving(true);
        try {
            const upserts = activeIds.map((subId) => {
                const edit = configEdits[subId];
                const sub = subjects.find((s) => s.id === subId);
                return {
                    exam_id: selectedExamId,
                    subject_id: subId,
                    full_marks: parseInt(edit.full_marks, 10) || sub?.full_marks || 100,
                    weight_percent: parseFloat(edit.weight_percent) || 100,
                };
            });

            // Delete subjects from this class that were excluded from config
            const removedIds = subjects.filter((s) => !activeIds.includes(s.id)).map((s) => s.id);
            if (removedIds.length > 0) {
                const { error: delError } = await supabase
                    .from("exam_subject_config")
                    .delete()
                    .eq("exam_id", selectedExamId)
                    .in("subject_id", removedIds);
                if (delError) throw delError;
            }

            if (upserts.length > 0) {
                const { error: upsertError } = await supabase
                    .from("exam_subject_config")
                    .upsert(upserts, { onConflict: "exam_id,subject_id" });
                if (upsertError) throw upsertError;
            }

            setOriginalEdits(JSON.parse(JSON.stringify(configEdits)));
            toast.success(
                isSilent ? "Configuration saved" : "Subject configuration successfully saved!"
            );
            onRefresh();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save configuration");
        } finally {
            setSaving(false);
        }
    };

    // Keyboard navigation in table
    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        subId: string,
        field: "full_marks" | "weight_percent"
    ) => {
        if (["e", "E", "+", "-"].includes(e.key)) {
            e.preventDefault();
            return;
        }
        const visibleSubs = filteredActiveSubjects;
        const idx = visibleSubs.findIndex((s) => s.id === subId);
        if (e.key === "Enter") {
            e.preventDefault();
            handleSave(true);
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            const next = visibleSubs[idx + 1];
            if (next) inputRefs.current[`${next.id}-${field}`]?.focus();
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            const prev = visibleSubs[idx - 1];
            if (prev) inputRefs.current[`${prev.id}-${field}`]?.focus();
            return;
        }
    };

    const activeExam = exams.find((e) => e.id === selectedExamId);
    const activeClass = classes.find((c) => c.id === selectedClassId);

    return (
        <div className="space-y-6">
            {/* Top Toolbar & Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card p-4 sm:p-5 rounded-2xl border border-border">
                <div className="flex items-center gap-3 flex-wrap flex-1">
                    <div className="space-y-1">
                        <Label className="text-xs font-semibold text-muted-foreground">Select Exam</Label>
                        <Select value={selectedExamId} onValueChange={handleExamChange}>
                            <SelectTrigger className="w-[220px] h-10 rounded-xl bg-muted/60 border-border/80 font-bold text-xs shadow-none hover:bg-muted focus:ring-1 focus:ring-primary">
                                <SelectValue placeholder="Select Exam Term" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border shadow-md">
                                {exams.map((e) => (
                                    <SelectItem key={e.id} value={e.id} className="rounded-lg font-medium text-xs">
                                        <div className="flex items-center gap-2">
                                            <span>{e.name}</span>
                                            {e.term && (
                                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                                                    Term {e.term}
                                                </span>
                                            )}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs font-semibold text-muted-foreground">Select Class</Label>
                        <Select value={selectedClassId} onValueChange={handleClassChange}>
                            <SelectTrigger className="w-[180px] h-10 rounded-xl bg-muted/60 border-border/80 font-bold text-xs shadow-none hover:bg-muted focus:ring-1 focus:ring-primary">
                                <SelectValue placeholder="Select Class" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border shadow-md">
                                {classes.map((c) => (
                                    <SelectItem key={c.id} value={c.id} className="rounded-lg font-medium text-xs">
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {isDirty && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold self-end mb-0.5 animate-in fade-in">
                            <AlertCircle size={14} className="animate-pulse" />
                            <span>Unsaved changes</span>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
                    {/* Bulk Tools Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10 rounded-xl text-xs font-semibold border-border gap-1.5 hover:bg-muted"
                                disabled={!selectedExamId || !selectedClassId || subjects.length === 0}
                            >
                                <Sliders size={14} />
                                <span>Bulk Actions</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl border-border shadow-lg text-xs">
                            <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                Marks & Weight Shortcuts
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                                onClick={() => {
                                    setBulkMarksValue("100");
                                    setBulkMarksDialogOpen(true);
                                }}
                                className="gap-2 cursor-pointer font-medium"
                            >
                                <Calculator size={14} /> Batch Set Full Marks...
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => {
                                    setBulkWeightValue("100");
                                    setBulkWeightDialogOpen(true);
                                }}
                                className="gap-2 cursor-pointer font-medium"
                            >
                                <ArrowUpDown size={14} /> Batch Set Weight %...
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleResetToClassDefaults}
                                className="gap-2 cursor-pointer font-medium"
                            >
                                <RotateCcw size={14} /> Reset to Class Defaults
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                Exam Copy & Scope
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                                onClick={() => {
                                    const otherExams = exams.filter((e) => e.id !== selectedExamId);
                                    if (otherExams.length > 0) setSourceExamId(otherExams[0].id);
                                    setCopyDialogOpen(true);
                                }}
                                className="gap-2 cursor-pointer font-medium"
                            >
                                <Copy size={14} /> Copy from Another Exam...
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleIncludeAllSubjects}
                                className="gap-2 cursor-pointer font-medium"
                            >
                                <CheckSquare size={14} /> Include All Subjects
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleClearAllSubjects}
                                className="gap-2 cursor-pointer font-medium text-destructive focus:text-destructive"
                            >
                                <SquareX size={14} /> Exclude All Subjects
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Main Save Button */}
                    <Button
                        onClick={() => handleSave(false)}
                        disabled={saving || !selectedExamId || !selectedClassId || subjects.length === 0}
                        className={`h-10 px-4 rounded-xl font-bold text-xs gap-2 transition-all shadow-none ${
                            isDirty
                                ? "bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-primary/20"
                                : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                    >
                        <FloppyDisk size={15} />
                        <span>{saving ? "Saving..." : "Save Config"}</span>
                    </Button>
                </div>
            </div>

            {/* Empty State: Missing Selection */}
            {(!selectedExamId || !selectedClassId) && (
                <Card className="bg-transparent rounded-2xl border-2 border-dashed border-border shadow-none">
                    <CardContent className="py-16 text-center">
                        <Sliders size={36} strokeWidth={1.2} className="text-muted-foreground/40 mb-3 mx-auto" />
                        <h3 className="font-semibold text-lg text-foreground mb-1">Select an Exam and Class</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            Choose an examination term and a class from the top controls to configure subject marks and weighting.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Empty State: No subjects in class */}
            {selectedExamId && selectedClassId && !loadingSubjects && subjects.length === 0 && (
                <Card className="bg-transparent rounded-2xl border-2 border-dashed border-border shadow-none">
                    <CardContent className="py-16 text-center">
                        <Layers size={36} strokeWidth={1.2} className="text-muted-foreground/40 mb-3 mx-auto" />
                        <h3 className="font-semibold text-lg text-foreground mb-1">No Subjects Registered</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            Class <span className="font-semibold text-foreground">{activeClass?.name}</span> does not have any registered subjects yet. Add subjects in the Academic &gt; Subjects module first.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Content: Summary Strip + Subject Table */}
            {selectedExamId && selectedClassId && subjects.length > 0 && (
                <div className="space-y-4">
                    {/* Summary KPI Strip */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="bg-card rounded-2xl border-border shadow-none">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Configured Subjects</p>
                                    <div className="flex items-baseline gap-1.5">
                                        <p className="text-xl font-black text-foreground">{metrics.activeCount}</p>
                                        <span className="text-xs text-muted-foreground">/ {metrics.totalSubjectsInClass}</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground font-medium">
                                        {metrics.removedCount > 0 ? `${metrics.removedCount} excluded` : "All included"}
                                    </p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    <CheckSquare size={18} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-card rounded-2xl border-border shadow-none">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Full Marks</p>
                                    <p className="text-xl font-black text-foreground">{metrics.totalFullMarks}</p>
                                    <p className="text-[11px] text-muted-foreground font-medium">Exam marks aggregate</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    <Calculator size={18} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-card rounded-2xl border-border shadow-none">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Effective Weight</p>
                                    <p className="text-xl font-black text-foreground">{metrics.avgWeight}%</p>
                                    <p className="text-[11px] text-muted-foreground font-medium">Average weight share</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                    <ArrowUpDown size={18} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-card rounded-2xl border-border shadow-none">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</p>
                                    <div className="flex items-center gap-1.5 pt-0.5">
                                        {metrics.hasInvalidValues ? (
                                            <Badge variant="destructive" className="text-[10px] font-bold rounded-lg gap-1">
                                                <AlertCircle size={12} /> Check Marks
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-[10px] font-bold rounded-lg border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 gap-1">
                                                <CheckCircle2 size={12} /> Config Valid
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground font-medium pt-0.5">
                                        {isDirty ? "Unsaved edits" : "Synced"}
                                    </p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                    <Sparkles size={18} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Table Card */}
                    <Card className="bg-card rounded-2xl border-border shadow-none overflow-hidden">
                        <CardHeader className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
                            <div className="flex items-center gap-2 flex-wrap">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <span>{activeExam?.name}</span>
                                    <span className="text-muted-foreground">/</span>
                                    <span>Class {activeClass?.name}</span>
                                </CardTitle>
                                <Badge variant="secondary" className="rounded-md text-[10px] font-bold">
                                    {filteredActiveSubjects.length} of {activeSubjects.length} Active
                                </Badge>
                            </div>

                            {/* Search & Stream Filter Controls */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="relative w-full sm:w-48">
                                    <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search subject..."
                                        className="h-8 pl-8 text-xs rounded-xl bg-background border-border/80"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                {availableGroups.length > 0 && (
                                    <Select value={groupFilter} onValueChange={setGroupFilter}>
                                        <SelectTrigger className="h-8 w-[130px] rounded-xl text-xs bg-background border-border/80 font-medium">
                                            <SelectValue placeholder="Stream/Group" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-border shadow-md">
                                            <SelectItem value="all" className="text-xs">All Groups</SelectItem>
                                            <SelectItem value="none" className="text-xs">Common Only</SelectItem>
                                            {availableGroups.map((g) => (
                                                <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="p-0">
                            {filteredActiveSubjects.length === 0 ? (
                                <div className="py-12 text-center space-y-2">
                                    <SquareX size={32} strokeWidth={1.2} className="text-muted-foreground/40 mx-auto" />
                                    <p className="text-xs text-muted-foreground font-medium">
                                        {searchQuery || groupFilter !== "all"
                                            ? "No subjects match your search or filter"
                                            : "No active subjects configured for this exam."}
                                    </p>
                                    {removedSubjects.length > 0 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleIncludeAllSubjects}
                                            className="h-8 text-xs rounded-xl font-semibold gap-1.5"
                                        >
                                            <Plus size={13} /> Include All Subjects
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                <TableHead className="w-12 text-center text-xs font-bold">#</TableHead>
                                                <TableHead className="text-xs font-bold">Subject Name</TableHead>
                                                <TableHead className="text-center text-xs font-bold">Stream / Type</TableHead>
                                                <TableHead className="text-center text-xs font-bold">Class Default</TableHead>
                                                <TableHead className="text-center w-36 text-xs font-bold">
                                                    Full Marks
                                                    <span className="block text-[10px] text-muted-foreground font-normal">Exam scale</span>
                                                </TableHead>
                                                <TableHead className="text-center w-36 text-xs font-bold">
                                                    Weight %
                                                    <span className="block text-[10px] text-muted-foreground font-normal">Result contribution</span>
                                                </TableHead>
                                                <TableHead className="text-center text-xs font-bold">
                                                    Effective Contrib.
                                                    <span className="block text-[10px] text-muted-foreground font-normal">Full × Weight</span>
                                                </TableHead>
                                                <TableHead className="w-14 text-center text-xs font-bold">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredActiveSubjects.map((sub, idx) => {
                                                const edit = configEdits[sub.id];
                                                if (!edit) return null;
                                                const fm = parseFloat(edit.full_marks) || 0;
                                                const wp = parseFloat(edit.weight_percent) || 0;
                                                const effectiveContrib = Math.round(((fm * wp) / 100) * 100) / 100;
                                                const isFmInvalid = isNaN(fm) || fm <= 0;
                                                const isWpInvalid = isNaN(wp) || wp <= 0 || wp > 100;

                                                return (
                                                    <TableRow key={sub.id} className="hover:bg-muted/40 transition-colors">
                                                        <TableCell className="text-center text-xs text-muted-foreground font-mono">
                                                            {idx + 1}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-0.5">
                                                                <span className="font-bold text-xs text-foreground">{sub.name}</span>
                                                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                                                    <span>Pass: {sub.pass_marks}</span>
                                                                    {sub.has_mcq && <Badge variant="outline" className="px-1 py-0 text-[9px]">MCQ</Badge>}
                                                                    {sub.has_practical && <Badge variant="outline" className="px-1 py-0 text-[9px]">PRAC</Badge>}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {sub.group_name && sub.group_name !== "Common" ? (
                                                                <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 text-primary">
                                                                    {sub.group_name}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">Common</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-center text-xs text-muted-foreground font-mono">
                                                            {sub.full_marks}
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <Input
                                                                ref={(el) => { inputRefs.current[`${sub.id}-full_marks`] = el; }}
                                                                type="number"
                                                                min={1}
                                                                value={edit.full_marks}
                                                                className={`text-center h-8.5 text-xs font-semibold rounded-lg ${
                                                                    isFmInvalid ? "border-destructive focus-visible:ring-destructive" : ""
                                                                }`}
                                                                onChange={(e) =>
                                                                    setConfigEdits((prev) => ({
                                                                        ...prev,
                                                                        [sub.id]: { ...prev[sub.id], full_marks: e.target.value },
                                                                    }))
                                                                }
                                                                onKeyDown={(e) => handleKeyDown(e, sub.id, "full_marks")}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <Input
                                                                ref={(el) => { inputRefs.current[`${sub.id}-weight_percent`] = el; }}
                                                                type="number"
                                                                min={0.1}
                                                                max={100}
                                                                step={1}
                                                                value={edit.weight_percent}
                                                                className={`text-center h-8.5 text-xs font-semibold rounded-lg ${
                                                                    isWpInvalid ? "border-destructive focus-visible:ring-destructive" : ""
                                                                }`}
                                                                onChange={(e) =>
                                                                    setConfigEdits((prev) => ({
                                                                        ...prev,
                                                                        [sub.id]: { ...prev[sub.id], weight_percent: e.target.value },
                                                                    }))
                                                                }
                                                                onKeyDown={(e) => handleKeyDown(e, sub.id, "weight_percent")}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-center text-xs font-bold text-foreground font-mono">
                                                            {effectiveContrib}
                                                        </TableCell>
                                                        <TableCell className="p-2 text-center">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20 rounded-lg"
                                                                onClick={() => handleRemoveSubject(sub.id)}
                                                                title="Exclude subject from this exam"
                                                            >
                                                                <Trash size={14} />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {/* Excluded Subjects Section */}
                            {removedSubjects.length > 0 && (
                                <div className="p-4 border-t border-border bg-muted/20 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                            <span>Excluded Subjects ({removedSubjects.length}):</span>
                                            <span className="text-[11px] font-normal text-muted-foreground/80">Click a subject or &quot;Re-add All&quot; to restore</span>
                                        </p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleIncludeAllSubjects}
                                            className="h-7 text-xs font-semibold text-primary hover:bg-primary/10 gap-1 rounded-lg"
                                        >
                                            <Plus size={12} /> Re-add All Excluded
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {removedSubjects.map((sub) => (
                                            <Button
                                                key={sub.id}
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs gap-1.5 border-dashed border-border/80 text-foreground font-semibold rounded-xl hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-all"
                                                onClick={() => handleReAddSubject(sub)}
                                            >
                                                <Plus size={13} className="text-primary" />
                                                <span>{sub.name}</span>
                                                <span className="text-[10px] text-muted-foreground font-mono">({sub.full_marks})</span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Dialog: Batch Set Full Marks */}
            <Dialog open={bulkMarksDialogOpen} onOpenChange={setBulkMarksDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <Calculator size={18} className="text-primary" />
                            Batch Set Full Marks
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Apply a uniform Full Marks value to all active subjects for this exam.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Full Marks Value</Label>
                            <Input
                                type="number"
                                min={1}
                                value={bulkMarksValue}
                                onChange={(e) => setBulkMarksValue(e.target.value)}
                                className="h-10 rounded-xl"
                                placeholder="100"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {[100, 75, 50, 25].map((preset) => (
                                <Button
                                    key={preset}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBulkMarksValue(preset.toString())}
                                    className="h-8 text-xs rounded-lg font-semibold"
                                >
                                    {preset} Marks
                                </Button>
                            ))}
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setBulkMarksDialogOpen(false)}
                            className="rounded-xl text-xs font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApplyBulkMarks}
                            className="rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            Apply to Active Subjects
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Batch Set Weight % */}
            <Dialog open={bulkWeightDialogOpen} onOpenChange={setBulkWeightDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <ArrowUpDown size={18} className="text-primary" />
                            Batch Set Weight %
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Apply a uniform weight contribution percentage to all active subjects for this exam.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Weight Percentage (%)</Label>
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={bulkWeightValue}
                                onChange={(e) => setBulkWeightValue(e.target.value)}
                                className="h-10 rounded-xl"
                                placeholder="100"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {[100, 50, 25, 20].map((preset) => (
                                <Button
                                    key={preset}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBulkWeightValue(preset.toString())}
                                    className="h-8 text-xs rounded-lg font-semibold"
                                >
                                    {preset}%
                                </Button>
                            ))}
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setBulkWeightDialogOpen(false)}
                            className="rounded-xl text-xs font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApplyBulkWeight}
                            className="rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            Apply to Active Subjects
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Copy from Another Exam */}
            <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <Copy size={18} className="text-primary" />
                            Copy Configuration from Another Exam
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Select an exam to copy subject full marks and weightings into <span className="font-semibold text-foreground">{activeExam?.name}</span> for Class <span className="font-semibold text-foreground">{activeClass?.name}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Source Exam</Label>
                            <Select value={sourceExamId} onValueChange={setSourceExamId}>
                                <SelectTrigger className="h-10 rounded-xl bg-muted/60 border-border font-medium text-xs">
                                    <SelectValue placeholder="Select Source Exam" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border shadow-md">
                                    {exams
                                        .filter((e) => e.id !== selectedExamId)
                                        .map((e) => (
                                            <SelectItem key={e.id} value={e.id} className="text-xs">
                                                {e.name} {e.term ? `(Term ${e.term})` : "(Standalone)"}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setCopyDialogOpen(false)}
                            className="rounded-xl text-xs font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCopyFromExam}
                            disabled={copyingConfig || !sourceExamId}
                            className="rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {copyingConfig ? "Copying..." : "Copy Configuration"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation Dialog: Unsaved Navigation Protection */}
            <ConfirmDialog
                open={unsavedNavDialog.open}
                onOpenChange={(open) =>
                    setUnsavedNavDialog((prev) => ({ ...prev, open }))
                }
                title={unsavedNavDialog.title}
                description={unsavedNavDialog.description}
                confirmLabel="Discard & Proceed"
                variant="destructive"
                onConfirm={() => {
                    if (unsavedNavDialog.pendingAction) {
                        unsavedNavDialog.pendingAction();
                    }
                    setUnsavedNavDialog({ open: false, pendingAction: null, title: "", description: "" });
                }}
            />
        </div>
    );
}
