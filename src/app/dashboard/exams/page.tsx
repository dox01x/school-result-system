"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    CLASS_COLUMNS,
    EXAM_COLUMNS,
    EXAM_SUBJECT_CONFIG_COLUMNS,
    GRADING_RULE_COLUMNS,
    SUBJECT_COLUMNS,
} from "@/lib/supabase/select-columns";
import type { Exam, GradingRule, Class, Subject, ExamSubjectConfig } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 as Trash, ClipboardList as ClipboardText, Medal, SlidersHorizontal as Sliders, Save as FloppyDisk, RotateCcw as ArrowCounterClockwise, Users, Briefcase, Building2, FileCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SeatPlanTab } from "./_components/SeatPlanTab";
import { ExamDutiesTab } from "./_components/ExamDutiesTab";
import { RoomsTab } from "./_components/RoomsTab";
import { PaperCheckingTab } from "./_components/PaperCheckingTab";

const DEFAULT_GRADING_100 = [
    { marks_category: 100, min_marks: 80, max_marks: 100, grade: "A+", grade_point: 5 },
    { marks_category: 100, min_marks: 70, max_marks: 79, grade: "A", grade_point: 4 },
    { marks_category: 100, min_marks: 60, max_marks: 69, grade: "A-", grade_point: 3.5 },
    { marks_category: 100, min_marks: 50, max_marks: 59, grade: "B", grade_point: 3 },
    { marks_category: 100, min_marks: 40, max_marks: 49, grade: "C", grade_point: 2 },
    { marks_category: 100, min_marks: 33, max_marks: 39, grade: "D", grade_point: 1 },
    { marks_category: 100, min_marks: 0, max_marks: 32, grade: "F", grade_point: 0 },
];
const DEFAULT_GRADING_50 = [
    { marks_category: 50, min_marks: 40, max_marks: 50, grade: "A+", grade_point: 5 },
    { marks_category: 50, min_marks: 35, max_marks: 39, grade: "A", grade_point: 4 },
    { marks_category: 50, min_marks: 30, max_marks: 34, grade: "A-", grade_point: 3.5 },
    { marks_category: 50, min_marks: 25, max_marks: 29, grade: "B", grade_point: 3 },
    { marks_category: 50, min_marks: 20, max_marks: 24, grade: "C", grade_point: 2 },
    { marks_category: 50, min_marks: 17, max_marks: 19, grade: "D", grade_point: 1 },
    { marks_category: 50, min_marks: 0, max_marks: 16, grade: "F", grade_point: 0 },
];
const DEFAULT_GRADING_75 = [
    { marks_category: 75, min_marks: 60, max_marks: 75, grade: "A+", grade_point: 5 },
    { marks_category: 75, min_marks: 53, max_marks: 59, grade: "A", grade_point: 4 },
    { marks_category: 75, min_marks: 45, max_marks: 52, grade: "A-", grade_point: 3.5 },
    { marks_category: 75, min_marks: 38, max_marks: 44, grade: "B", grade_point: 3 },
    { marks_category: 75, min_marks: 30, max_marks: 37, grade: "C", grade_point: 2 },
    { marks_category: 75, min_marks: 25, max_marks: 29, grade: "D", grade_point: 1 },
    { marks_category: 75, min_marks: 0, max_marks: 24, grade: "F", grade_point: 0 },
];
const DEFAULT_GRADING_25 = [
    { marks_category: 25, min_marks: 20, max_marks: 25, grade: "A+", grade_point: 5 },
    { marks_category: 25, min_marks: 18, max_marks: 19, grade: "A", grade_point: 4 },
    { marks_category: 25, min_marks: 15, max_marks: 17, grade: "A-", grade_point: 3.5 },
    { marks_category: 25, min_marks: 13, max_marks: 14, grade: "B", grade_point: 3 },
    { marks_category: 25, min_marks: 10, max_marks: 12, grade: "C", grade_point: 2 },
    { marks_category: 25, min_marks: 8, max_marks: 9, grade: "D", grade_point: 1 },
    { marks_category: 25, min_marks: 0, max_marks: 7, grade: "F", grade_point: 0 },
];
const DEFAULT_EXAMS = [
    { name: "1st MCT", exam_type: "mct", term: 1 },
    { name: "1st Semester", exam_type: "semester", term: 1 },
    { name: "2nd MCT", exam_type: "mct", term: 2 },
    { name: "2nd Semester", exam_type: "semester", term: 2 },
    { name: "3rd MCT", exam_type: "mct", term: 3 },
    { name: "3rd Semester", exam_type: "semester", term: 3 },
];

export default function ExamsPage() {
    const [exams, setExams] = useState<Exam[]>([]);
    const [gradingRules, setGradingRules] = useState<GradingRule[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [examConfigs, setExamConfigs] = useState<ExamSubjectConfig[]>([]);
    const [loading, setLoading] = useState(true);

    // Exam form
    const [examDialogOpen, setExamDialogOpen] = useState(false);
    const [editingExam, setEditingExam] = useState<Exam | null>(null);
    const [examForm, setExamForm] = useState({ name: "", exam_type: "mct" as string, term: 1 });

    // Grading form
    const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
    const [editingGrade, setEditingGrade] = useState<GradingRule | null>(null);
    const [gradeForm, setGradeForm] = useState({ marks_category: 100, min_marks: 0, max_marks: 100, grade: "", grade_point: 0 });

    // Confirm dialog state
    const [confirmState, setConfirmState] = useState<{
        open: boolean;
        title: string;
        description: string;
        onConfirm: () => void;
    }>({ open: false, title: "", description: "", onConfirm: () => {} });

    // Subject config
    const [configExam, setConfigExam] = useState("");
    const [configClass, setConfigClass] = useState("");
    const [configEdits, setConfigEdits] = useState<Record<string, { full_marks: string; weight_percent: string }>>({}); 
    const [savingConfig, setSavingConfig] = useState(false);
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const supabase = useMemo(() => createClient() as any, []);

    const fetchAll = useCallback(async () => {
        try {
            const [examRes, gradeRes, classRes, configRes] = await Promise.all([
                supabase.from("exams").select(EXAM_COLUMNS).order("term").order("exam_type"),
                supabase.from("grading_rules").select(GRADING_RULE_COLUMNS).order("min_marks", { ascending: false }),
                supabase.from("classes").select(CLASS_COLUMNS).order("numeric_value"),
                supabase.from("exam_subject_config").select(EXAM_SUBJECT_CONFIG_COLUMNS),
            ]);
            setExams(examRes.data || []);
            setGradingRules(gradeRes.data || []);
            setClasses(classRes.data || []);
            setExamConfigs(configRes.data || []);
        } catch {
            toast.error("Failed to load exam configuration");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Auto-seed grading rules if empty
    useEffect(() => {
        if (loading || gradingRules.length > 0) return;
        (async () => {
            const allDefaults = [...DEFAULT_GRADING_100, ...DEFAULT_GRADING_75, ...DEFAULT_GRADING_50, ...DEFAULT_GRADING_25];
            await supabase.from("grading_rules").insert(allDefaults);
            fetchAll();
        })();
    }, [loading, gradingRules.length]);

    // Auto-seed exams if empty
    useEffect(() => {
        if (loading || exams.length > 0) return;
        (async () => {
            await supabase.from("exams").insert(DEFAULT_EXAMS);
            fetchAll();
        })();
    }, [loading, exams.length]);

    // Load subjects when class changes for config tab
    useEffect(() => {
        if (!configClass) { setSubjects([]); return; }
        (async () => {
            const { data } = await supabase.from("subjects").select(SUBJECT_COLUMNS).eq("class_id", configClass).order("name");
            setSubjects(data || []);
        })();
    }, [configClass]);

    // When exam/class/subjects/configs change, initiate config edits
    // If exam already has saved configs â†’ only show those subjects (respect deletions)
    // If exam has NO configs yet â†’ inherit from same-type exam, or show all with defaults
    useEffect(() => {
        if (!configExam || subjects.length === 0) { setConfigEdits({}); return; }
        const selectedExamObj = exams.find((e) => e.id === configExam);
        const ownConfigs = examConfigs.filter((c) => c.exam_id === configExam);
        const hasOwnConfig = ownConfigs.length > 0;

        const edits: Record<string, { full_marks: string; weight_percent: string }> = {};

        if (hasOwnConfig) {
            // Exam has saved configs â†’ only show subjects that have a config entry
            ownConfigs.forEach((cfg) => {
                const sub = subjects.find((s) => s.id === cfg.subject_id);
                if (sub) {
                    edits[sub.id] = { full_marks: cfg.full_marks.toString(), weight_percent: cfg.weight_percent.toString() };
                }
            });
        } else {
            // No configs for this exam â†’ try fallback or show all with defaults
            let fallbackExamId: string | null = null;
            if (selectedExamObj) {
                const sameTypeExams = exams.filter((e) => e.exam_type === selectedExamObj.exam_type && e.id !== configExam).sort((a, b) => (a.term ?? 0) - (b.term ?? 0));
                for (const ex of sameTypeExams) {
                    if (examConfigs.some((c) => c.exam_id === ex.id)) { fallbackExamId = ex.id; break; }
                }
            }
            subjects.forEach((sub) => {
                if (fallbackExamId) {
                    const fallback = examConfigs.find((c) => c.exam_id === fallbackExamId && c.subject_id === sub.id);
                    if (fallback) {
                        edits[sub.id] = { full_marks: fallback.full_marks.toString(), weight_percent: fallback.weight_percent.toString() };
                    } else {
                        edits[sub.id] = { full_marks: sub.full_marks.toString(), weight_percent: "100" };
                    }
                } else {
                    edits[sub.id] = { full_marks: sub.full_marks.toString(), weight_percent: "100" };
                }
            });
        }
        setConfigEdits(edits);
    }, [configExam, subjects, examConfigs, exams]);

    const handleSaveExam = async () => {
        if (!examForm.name.trim()) return;
        try {
            const isStandalone = examForm.exam_type === "standalone";
            const payload = {
                name: examForm.name.trim(),
                exam_type: examForm.exam_type,
                term: isStandalone ? null : examForm.term,
            };
            if (editingExam) {
                const { error } = await supabase.from("exams").update(payload).eq("id", editingExam.id);
                if (error) throw error;
                toast.success("Exam updated");
            } else {
                const { error } = await supabase.from("exams").insert(payload);
                if (error) throw error;
                toast.success(`Exam "${examForm.name.trim()}" created`);
            }
            setExamForm({ name: "", exam_type: "mct", term: 1 });
            setEditingExam(null);
            setExamDialogOpen(false);
            fetchAll();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save exam");
        }
    };

    const handleDeleteExam = (exam: Exam) => {
        setConfirmState({
            open: true,
            title: `Delete "${exam.name}"?`,
            description: "All linked marks will be permanently removed. This action cannot be undone.",
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from("exams").delete().eq("id", exam.id);
                    if (error) throw error;
                    toast.success(`Exam "${exam.name}" deleted`);
                    fetchAll();
                } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Failed to delete exam");
                }
                setConfirmState(prev => ({ ...prev, open: false }));
            },
        });
    };

    // â”€â”€ Grading CRUD â”€â”€
    const handleSaveGrade = async () => {
        if (!gradeForm.grade.trim()) return;
        try {
            const payload = {
                marks_category: gradeForm.marks_category,
                min_marks: gradeForm.min_marks,
                max_marks: gradeForm.max_marks,
                grade: gradeForm.grade.trim(),
                grade_point: gradeForm.grade_point,
            };
            if (editingGrade) {
                const { error } = await supabase.from("grading_rules").update(payload).eq("id", editingGrade.id);
                if (error) throw error;
                toast.success("Grading rule updated");
            } else {
                const { error } = await supabase.from("grading_rules").insert(payload);
                if (error) throw error;
                toast.success("Grading rule added");
            }
            setGradeForm({ marks_category: 100, min_marks: 0, max_marks: 100, grade: "", grade_point: 0 });
            setEditingGrade(null);
            setGradeDialogOpen(false);
            fetchAll();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save grading rule");
        }
    };

    const handleDeleteGrade = async (rule: GradingRule) => {
        try {
            const { error } = await supabase.from("grading_rules").delete().eq("id", rule.id);
            if (error) throw error;
            toast.success("Grading rule deleted");
            fetchAll();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to delete");
        }
    };

    const handleResetGrading = () => {
        setConfirmState({
            open: true,
            title: "Reset grading rules?",
            description: "All current grading rules will be replaced with Bangladesh standard defaults. This cannot be undone.",
            onConfirm: async () => {
                try {
                    await supabase.from("grading_rules").delete().neq("id", "00000000-0000-0000-0000-000000000000");
                    const allDefaults = [...DEFAULT_GRADING_100, ...DEFAULT_GRADING_75, ...DEFAULT_GRADING_50, ...DEFAULT_GRADING_25];
                    await supabase.from("grading_rules").insert(allDefaults);
                    toast.success("Grading rules reset to defaults");
                    fetchAll();
                } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Failed to reset");
                }
                setConfirmState(prev => ({ ...prev, open: false }));
            },
        });
    };

    // â”€â”€ Remove subject from exam config â”€â”€
    const handleRemoveSubjectFromConfig = async (subjectId: string) => {
        if (!configExam) return;
        // Delete config from DB for THIS exam only
        const existing = examConfigs.find((c) => c.exam_id === configExam && c.subject_id === subjectId);
        if (existing) {
            await supabase.from("exam_subject_config").delete().eq("id", existing.id);
            // Update local state instead of fetchAll() to prevent re-population
            setExamConfigs((prev) => prev.filter((c) => c.id !== existing.id));
        }
        // Remove from local edits immediately
        setConfigEdits((prev) => {
            const next = { ...prev };
            delete next[subjectId];
            return next;
        });
        toast.success("Subject removed from this exam");
    };

    // â”€â”€ Subject Config FloppyDisk â€” only saves subjects currently in configEdits â”€â”€
    const handleSaveSubjectConfig = async (isSilent = false) => {
        if (!configExam || !configClass) return;
        setSavingConfig(true);
        try {
            const subjectIdsInEdits = Object.keys(configEdits);
            const upserts = subjectIdsInEdits.map((subId) => {
                const edit = configEdits[subId];
                const sub = subjects.find((s) => s.id === subId);
                return {
                    exam_id: configExam,
                    subject_id: subId,
                    full_marks: parseInt(edit?.full_marks || sub?.full_marks.toString() || "100") || 100,
                    weight_percent: parseFloat(edit?.weight_percent || "100") || 100,
                };
            });

            // Also delete any configs for subjects that were removed from configEdits
            const removedIds = subjects
                .filter((s) => !subjectIdsInEdits.includes(s.id))
                .map((s) => s.id);
            if (removedIds.length > 0) {
                await supabase.from("exam_subject_config")
                    .delete()
                    .eq("exam_id", configExam)
                    .in("subject_id", removedIds);
            }

            const { error } = await supabase
                .from("exam_subject_config")
                .upsert(upserts, { onConflict: "exam_id,subject_id" });
            if (error) throw error;
            
            if (!isSilent) toast.success("Subject configuration saved");
            else toast.success("Configuration saved");
            
            if (!isSilent) {
                fetchAll();
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save configuration");
        } finally {
            setSavingConfig(false);
        }
    };

    const handleSubjectConfigKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, subId: string, field: "full_marks" | "weight_percent") => {
        if (['e', 'E', '+', '-'].includes(e.key)) {
            e.preventDefault();
            return;
        }

        const visibleSubjects = subjects.filter(s => configEdits[s.id]);
        const idx = visibleSubjects.findIndex(s => s.id === subId);

        if (e.key === "Enter") {
            e.preventDefault();
            handleSaveSubjectConfig(true);
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            const nextSub = visibleSubjects[idx + 1];
            if (nextSub) {
                inputRefs.current[`${nextSub.id}-${field}`]?.focus();
            }
            return;
        }

        if (e.key === "ArrowUp") {
            e.preventDefault();
            const prevSub = visibleSubjects[idx - 1];
            if (prevSub) {
                inputRefs.current[`${prevSub.id}-${field}`]?.focus();
            }
            return;
        }
    };


    // Group exams by term
    const termGroups = [1, 2, 3].map((term) => ({
        term,
        mct: exams.find((e) => e.exam_type === "mct" && e.term === term),
        semester: exams.find((e) => e.exam_type === "semester" && e.term === term),
    })).filter((g) => g.mct || g.semester);
    const standaloneExams = exams.filter((e) => e.exam_type === "standalone");

    const getTypeLabel = (type: string) => type === "mct" ? "MCT" : type === "standalone" ? "Standalone" : "Semester";
    const getTypeColor = (type: string) => "bg-muted text-muted-foreground border-0 rounded-md font-medium uppercase tracking-wider text-[10px]";

    return (
        <div className="space-y-6">
            <PageHeader
                icon={ClipboardText}
                iconBg="bg-primary/10"
                iconColor="text-primary"
                title="Exam Configuration"
                subtitle="Manage exams, grading, and subject config."
            />

            <Tabs defaultValue="exams" className="space-y-4">
                <div className="w-full overflow-x-auto pb-1">
                    <TabsList className="bg-muted rounded-2xl p-1 h-auto flex w-max md:w-full md:flex-wrap border-0 shadow-none">
                        <TabsTrigger value="exams" className="rounded-xl text-xs font-bold px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all gap-2">
                            <ClipboardText className="h-3.5 w-3.5" />
                            Exam Terms
                        </TabsTrigger>
                        <TabsTrigger value="subjectConfig" className="rounded-xl text-xs font-bold px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all gap-2">
                            <Sliders className="h-3.5 w-3.5" />
                            Subject Config
                        </TabsTrigger>
                        <TabsTrigger value="grading" className="rounded-xl text-xs font-bold px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all gap-2">
                            <Medal className="h-3.5 w-3.5" />
                            Grading System
                        </TabsTrigger>
                        <TabsTrigger value="rooms" className="rounded-xl text-xs font-bold px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all gap-2">
                            <Building2 className="h-3.5 w-3.5" />
                            Rooms
                        </TabsTrigger>
                        <TabsTrigger value="seatPlan" className="rounded-xl text-xs font-bold px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all gap-2">
                            <Users className="h-3.5 w-3.5" />
                            Seat Plan
                        </TabsTrigger>
                        <TabsTrigger value="examDuties" className="rounded-xl text-xs font-bold px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all gap-2">
                            <Briefcase className="h-3.5 w-3.5" />
                            Duties
                        </TabsTrigger>
                        <TabsTrigger value="paperChecking" className="rounded-xl text-xs font-bold px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all gap-2">
                            <FileCheck className="h-3.5 w-3.5" />
                            Paper Checking
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* ──── EXAM TERMS TAB ──── */}
                <TabsContent value="exams" className="space-y-4">

                    <div className="flex justify-end">
                        <Button className="bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-semibold shadow-none transition-all duration-200 btn-press"
                            onClick={() => { setExamForm({ name: "", exam_type: "mct", term: 1 }); setEditingExam(null); setExamDialogOpen(true); }}
                        >
                            <Plus size={16} strokeWidth={1.5} className="mr-2" />Add Exam
                        </Button>
                    </div>

                    <Dialog open={examDialogOpen} onOpenChange={(o) => { setExamDialogOpen(o); if (!o) setEditingExam(null); if (o) setTimeout(() => document.getElementById("exam-name-input")?.focus(), 100); }}>
                        <DialogContent>
                            <DialogHeader><DialogTitle>{editingExam ? "PencilSimple Exam" : "Create Exam"}</DialogTitle></DialogHeader>
                            <form onSubmit={(e) => { e.preventDefault(); handleSaveExam(); }} className="space-y-6 py-6">
                                <div className="space-y-2">
                                    <Label>Exam Name</Label>
                                    <Input
                                        id="exam-name-input"
                                        placeholder='e.g., "1st MCT", "1st Semester"'
                                        value={examForm.name}
                                        onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Type</Label>
                                        <Select value={examForm.exam_type} onValueChange={(v) => setExamForm({ ...examForm, exam_type: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="mct">MCT</SelectItem>
                                                <SelectItem value="semester">Semester</SelectItem>
                                                <SelectItem value="standalone">Standalone</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {examForm.exam_type !== "standalone" && (
                                        <div className="space-y-2">
                                            <Label>Term</Label>
                                            <Select value={(examForm.term || 1).toString()} onValueChange={(v) => setExamForm({ ...examForm, term: parseInt(v) })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1">1st Term</SelectItem>
                                                    <SelectItem value="2">2nd Term</SelectItem>
                                                    <SelectItem value="3">3rd Term</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild><Button type="button" variant="outline" className="border-border/50 text-foreground font-semibold rounded-xl hover:bg-muted transition-all duration-200">Cancel</Button></DialogClose>
                                    <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-none transition-all duration-200">{editingExam ? "Update" : "Create"}</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {exams.length === 0 && !loading ? (
                        <div className="bg-transparent rounded-2xl border-2 border-dashed border-border/50 p-12 text-center shadow-none">
                            <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 mx-auto text-muted-foreground/40">
                                <ClipboardText size={32} strokeWidth={1.2} />
                            </div>
                            <h3 className="font-semibold text-lg text-foreground mb-4">No exams configured</h3>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {termGroups.map(({ term, mct, semester }) => (
                                <Card key={term} className="bg-card rounded-2xl border-border/50 shadow-none">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Term {term}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {[mct, semester].filter(Boolean).map((exam) => exam && (
                                                <div key={exam.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-card p-3 group hover:bg-muted/50 transition-colors duration-200">
                                                <div className="flex items-center gap-3">
                                                    <Badge className={getTypeColor(exam.exam_type)}>
                                                        {getTypeLabel(exam.exam_type)}
                                                    </Badge>
                                                    <span className="font-medium text-foreground">{exam.name}</span>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                                        setEditingExam(exam);
                                                        setExamForm({ name: exam.name, exam_type: exam.exam_type, term: exam.term ?? 1 });
                                                        setExamDialogOpen(true);
                                                    }}>
                                                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20" onClick={() => handleDeleteExam(exam)}>
                                                        <Trash size={14} strokeWidth={1.5} />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                        {!mct && (
                                            <p className="text-xs text-muted-foreground italic pl-2">No MCT exam for this term</p>
                                        )}
                                        {!semester && (
                                            <p className="text-xs text-muted-foreground italic pl-2">No Semester exam for this term</p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                            {termGroups.length === 0 && exams.length > 0 && (
                                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                    {exams.map((exam) => (
                                        <Card key={exam.id} className="group bg-card border-border/50 rounded-2xl shadow-none transition-colors hover:bg-muted/50">
                                            <CardContent className="flex items-center justify-between py-4">
                                                <div className="flex items-center gap-3">
                                                    <Badge className={getTypeColor(exam.exam_type)}>{getTypeLabel(exam.exam_type)}</Badge>
                                                    <span className="font-medium text-foreground">{exam.name}</span>
                                                    <Badge variant="outline" className="border-border/50 text-muted-foreground rounded-md bg-muted/50 text-[10px] uppercase tracking-wider font-medium">Term {exam.term}</Badge>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                                        setEditingExam(exam);
                                                        setExamForm({ name: exam.name, exam_type: exam.exam_type, term: exam.term ?? 1 });
                                                        setExamDialogOpen(true);
                                                    }}>
                                                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20" onClick={() => handleDeleteExam(exam)}>
                                                        <Trash size={14} strokeWidth={1.5} />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                            {standaloneExams.length > 0 && (
                                <Card className="bg-card rounded-2xl border-border/50 shadow-none">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Standalone Exams</CardTitle></CardHeader>
                                    <CardContent className="space-y-2">
                                        {standaloneExams.map((exam) => (
                                            <div key={exam.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-card p-3 group hover:bg-muted/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <Badge className={getTypeColor(exam.exam_type)}>{getTypeLabel(exam.exam_type)}</Badge>
                                                    <span className="font-medium text-foreground">{exam.name}</span>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                                        setEditingExam(exam);
                                                        setExamForm({ name: exam.name, exam_type: exam.exam_type, term: exam.term ?? 1 });
                                                        setExamDialogOpen(true);
                                                    }}><Pencil className="h-3.5 w-3.5" strokeWidth={1.5} /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20" onClick={() => handleDeleteExam(exam)}><Trash size={14} strokeWidth={1.5} /></Button>
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </TabsContent>

                {/* â”€â”€â”€â”€ GRADING TAB â”€â”€â”€â”€ */}
                <TabsContent value="grading" className="space-y-4">
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" className="border-border/50 text-foreground font-semibold rounded-xl hover:bg-muted transition-all duration-200" onClick={handleResetGrading}>
                            <ArrowCounterClockwise size={16} strokeWidth={1.5} className="mr-2" />Reset Defaults
                        </Button>
                        <Button
                            className="bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-semibold shadow-none transition-all duration-200 btn-press"
                            onClick={() => { setGradeForm({ marks_category: 100, min_marks: 0, max_marks: 100, grade: "", grade_point: 0 }); setEditingGrade(null); setGradeDialogOpen(true); }}
                            
                        >
                            <Plus size={16} strokeWidth={1.5} className="mr-2" />Add Rule
                        </Button>
                    </div>

                    <Dialog open={gradeDialogOpen} onOpenChange={(o) => { setGradeDialogOpen(o); if (!o) setEditingGrade(null); if (o) setTimeout(() => document.getElementById("grade-input")?.focus(), 100); }}>
                        <DialogContent>
                            <DialogHeader><DialogTitle>{editingGrade ? "PencilSimple Grading Rule" : "Add Grading Rule"}</DialogTitle></DialogHeader>
                            <form onSubmit={(e) => { e.preventDefault(); handleSaveGrade(); }} className="space-y-6 py-6">
                                <div className="space-y-2">
                                    <Label>Full Marks Category</Label>
                                    <Select value={String(gradeForm.marks_category)} onValueChange={(v) => setGradeForm({ ...gradeForm, marks_category: parseInt(v) })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="100">100 Marks</SelectItem>
                                            <SelectItem value="75">75 Marks</SelectItem>
                                            <SelectItem value="50">50 Marks</SelectItem>
                                            <SelectItem value="25">25 Marks</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Min %</Label>
                                        <Input type="number" value={gradeForm.min_marks} onChange={(e) => setGradeForm({ ...gradeForm, min_marks: parseFloat(e.target.value) || 0 })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Max %</Label>
                                        <Input type="number" value={gradeForm.max_marks} onChange={(e) => setGradeForm({ ...gradeForm, max_marks: parseFloat(e.target.value) || 0 })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Grade</Label>
                                        <Input placeholder="A+, A, B, ..." value={gradeForm.grade} onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Grade Point</Label>
                                        <Input type="number" step="0.25" value={gradeForm.grade_point} onChange={(e) => setGradeForm({ ...gradeForm, grade_point: parseFloat(e.target.value) || 0 })} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild><Button type="button" variant="outline" className="border-border/50 text-foreground font-semibold rounded-xl hover:bg-muted transition-all duration-200">Cancel</Button></DialogClose>
                                    <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-none transition-all duration-200">{editingGrade ? "Update" : "Add"}</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {gradingRules.length === 0 && !loading ? (
                        <Card className="bg-transparent rounded-2xl border-2 border-dashed border-border/50 shadow-none">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <Medal size={32} strokeWidth={1.2} className="text-muted-foreground/40 mb-3" />
                                <h3 className="font-semibold text-lg text-foreground mb-1">No grading rules</h3>
                                <p className="text-sm text-muted-foreground">Define grade ranges like 80-100 = A+ (5.0).</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {[100, 75, 50, 25].filter((cat) => gradingRules.some((r) => r.marks_category === cat)).map((cat) => (
                                <Card key={cat} className="bg-card rounded-2xl border-border/50 shadow-none">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{cat} Marks Subjects</CardTitle></CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="whitespace-nowrap">Range (%)</TableHead>
                                                    <TableHead className="whitespace-nowrap">Grade</TableHead>
                                                    <TableHead className="whitespace-nowrap">Grade Point</TableHead>
                                                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {gradingRules.filter((r) => r.marks_category === cat).map((rule) => (
                                                    <TableRow key={rule.id}>
                                                        <TableCell>{rule.min_marks} - {rule.max_marks}</TableCell>
                                                        <TableCell><Badge variant="secondary" className="bg-muted text-muted-foreground border-0 rounded-md font-medium">{rule.grade}</Badge></TableCell>
                                                        <TableCell className="font-mono">{rule.grade_point}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-1">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingGrade(rule); setGradeForm({ marks_category: rule.marks_category, min_marks: rule.min_marks, max_marks: rule.max_marks, grade: rule.grade, grade_point: rule.grade_point }); setGradeDialogOpen(true); }}>
                                                                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20" onClick={() => handleDeleteGrade(rule)}>
                                                                    <Trash size={14} strokeWidth={1.5} />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* â”€â”€â”€â”€ SUBJECT CONFIG TAB â”€â”€â”€â”€ */}
                <TabsContent value="subjectConfig" className="space-y-4">

                    <div className="flex items-center gap-3 flex-wrap">
                        <Select value={configExam} onValueChange={setConfigExam}>
                            <SelectTrigger className="w-[200px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                                <SelectValue placeholder="Select Exam" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/50 shadow-md">
                                {exams.map((e) => (<SelectItem key={e.id} value={e.id} className="rounded-lg">{e.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        <Select value={configClass} onValueChange={setConfigClass}>
                            <SelectTrigger className="w-[200px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                                <SelectValue placeholder="Select Class" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/50 shadow-md">
                                {classes.map((c) => (<SelectItem key={c.id} value={c.id} className="rounded-lg">{c.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        {configExam && configClass && subjects.length > 0 && (
                            <Button
                                onClick={() => handleSaveSubjectConfig(false)}
                                disabled={savingConfig}
                                className="ml-auto bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-semibold shadow-none transition-all duration-200 btn-press"
                            >
                                <FloppyDisk size={16} strokeWidth={1.5} className="mr-2" />
                                {savingConfig ? "Saving..." : "Save Config"}
                            </Button>
                        )}
                    </div>

                    {(!configExam || !configClass) && (
                        <Card className="bg-transparent rounded-2xl border-2 border-dashed border-border/50 shadow-none">
                            <CardContent className="py-12 text-center">
                                <Sliders size={32} strokeWidth={1.2} className="text-muted-foreground/40 mb-3 mx-auto" />
                                <h3 className="font-semibold text-lg text-foreground mb-1">Select an exam and class</h3>
                                <p className="text-sm text-muted-foreground">Choose an exam and class above to configure subject-wise marks and weightage.</p>
                            </CardContent>
                        </Card>
                    )}

                    {configExam && configClass && subjects.length === 0 && (
                        <Card className="bg-transparent rounded-2xl border-2 border-dashed border-border/50 shadow-none">
                            <CardContent className="py-12 text-center">
                                <Sliders size={32} strokeWidth={1.2} className="text-muted-foreground/40 mb-3 mx-auto" />
                                <h3 className="font-semibold text-lg text-foreground mb-1">No subjects in this class</h3>
                                <p className="text-sm text-muted-foreground">Add subjects to this class first.</p>
                            </CardContent>
                        </Card>
                    )}

                    {configExam && configClass && subjects.length > 0 && (
                        <Card className="bg-card rounded-2xl border-border/50 shadow-none">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">
                                    {exams.find((e) => e.id === configExam)?.name} - {classes.find((c) => c.id === configClass)?.name}
                                    <Badge variant="outline" className="ml-2 bg-muted/50 border-border/50 text-muted-foreground rounded-md">{subjects.length} subjects</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="whitespace-nowrap">Subject</TableHead>
                                            <TableHead className="text-center whitespace-nowrap">Default Full Marks</TableHead>
                                            <TableHead className="text-center w-36 whitespace-nowrap">
                                                Full Marks
                                                <span className="block text-[10px] text-muted-foreground font-normal whitespace-normal">(for this exam)</span>
                                            </TableHead>
                                            <TableHead className="text-center w-36 whitespace-nowrap">
                                                Weight %
                                                <span className="block text-[10px] text-muted-foreground font-normal whitespace-normal">(contribution to result)</span>
                                            </TableHead>
                                            <TableHead className="w-12 whitespace-nowrap"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {subjects.map((sub) => {
                                            const edit = configEdits[sub.id];
                                            if (!edit) return null;
                                            return (
                                                <TableRow key={sub.id}>
                                                    <TableCell className="font-medium">{sub.name}</TableCell>
                                                    <TableCell className="text-center text-muted-foreground">{sub.full_marks}</TableCell>
                                                    <TableCell className="p-2">
                                                        <Input
                                                            ref={(el) => { inputRefs.current[`${sub.id}-full_marks`] = el; }}
                                                            type="number"
                                                            min={1}
                                                            className="text-center h-9"
                                                            value={edit.full_marks}
                                                            onChange={(e) => setConfigEdits((prev) => ({
                                                                ...prev,
                                                                [sub.id]: { ...prev[sub.id], full_marks: e.target.value },
                                                            }))}
                                                            onKeyDown={(e) => handleSubjectConfigKeyDown(e, sub.id, "full_marks")}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2">
                                                        <Input
                                                            ref={(el) => { inputRefs.current[`${sub.id}-weight_percent`] = el; }}
                                                            type="number"
                                                            min={1}
                                                            max={100}
                                                            className="text-center h-9"
                                                            value={edit.weight_percent}
                                                            onChange={(e) => setConfigEdits((prev) => ({
                                                                ...prev,
                                                                [sub.id]: { ...prev[sub.id], weight_percent: e.target.value },
                                                            }))}
                                                            onKeyDown={(e) => handleSubjectConfigKeyDown(e, sub.id, "weight_percent")}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2 text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20"
                                                            onClick={() => handleRemoveSubjectFromConfig(sub.id)}
                                                            title="Remove from this exam"
                                                        >
                                                            <Trash size={14} strokeWidth={1.5} />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                                </div>
                                {/* Show removed subjects that can be re-added */}
                                {(() => {
                                    const removedSubjects = subjects.filter((s) => !configEdits[s.id]);
                                    if (removedSubjects.length === 0) return null;
                                    return (
                                        <div className="px-4 py-3 border-t bg-muted/30">
                                            <p className="text-xs text-muted-foreground mb-2">Removed subjects (click to re-add):</p>
                                            <div className="flex flex-wrap gap-2">
                                                {removedSubjects.map((sub) => (
                                                    <Button
                                                        key={sub.id}
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-xs gap-1 border-border/50 text-foreground font-medium rounded-lg hover:bg-muted transition-all duration-200"
                                                        onClick={() => {
                                                            setConfigEdits((prev) => ({
                                                                ...prev,
                                                                [sub.id]: { full_marks: sub.full_marks.toString(), weight_percent: "100" },
                                                            }));
                                                            toast.success(`${sub.name} added back â€” click "Save Config" to persist`);
                                                        }}
                                                    >
                                                        <Plus size={12} strokeWidth={1.5} />{sub.name}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="examDuties" className="space-y-4">
                    <ExamDutiesTab exams={exams} />
                </TabsContent>

                <TabsContent value="seatPlan" className="space-y-4">
                    <SeatPlanTab exams={exams} />
                </TabsContent>

                <TabsContent value="paperChecking" className="space-y-4">
                    <PaperCheckingTab exams={exams} />
                </TabsContent>

                <TabsContent value="rooms" className="space-y-4">
                    <RoomsTab />
                </TabsContent>
            </Tabs>

            <ConfirmDialog
                open={confirmState.open}
                onOpenChange={(open) => setConfirmState(prev => ({ ...prev, open }))}
                title={confirmState.title}
                description={confirmState.description}
                confirmLabel="Delete"
                variant="destructive"
                onConfirm={confirmState.onConfirm}
            />
        </div>
    );
}
