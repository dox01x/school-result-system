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
import { ALL_DEFAULT_GRADING, DEFAULT_EXAMS } from "@/lib/constants/exam-defaults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Plus, ClipboardList as ClipboardText, Medal, SlidersHorizontal as Sliders, Save as FloppyDisk, Users, Briefcase, Building2, FileCheck, LayoutDashboard, Trash2 as Trash } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import { ExamTermsTab } from "./_components/ExamTermsTab";
import { GradingTab } from "./_components/GradingTab";
import { SeatPlanTab } from "./_components/SeatPlanTab";
import { ExamDutiesTab } from "./_components/ExamDutiesTab";
import { RoomsTab } from "./_components/RoomsTab";
import { PaperCheckingTab } from "./_components/PaperCheckingTab";
import { ExamDashboardTab } from "./_components/ExamDashboardTab";

export default function ExamsPage() {
    const [activeTab, setActiveTab] = useState("dashboard");
    const [exams, setExams] = useState<Exam[]>([]);
    const [gradingRules, setGradingRules] = useState<GradingRule[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [examConfigs, setExamConfigs] = useState<ExamSubjectConfig[]>([]);
    const [loading, setLoading] = useState(true);

    // Subject config state
    const [configExam, setConfigExam] = useState("");
    const [configClass, setConfigClass] = useState("");
    const [configEdits, setConfigEdits] = useState<Record<string, { full_marks: string; weight_percent: string }>>({});
    const [savingConfig, setSavingConfig] = useState(false);
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const supabase = useMemo(() => createClient(), []);

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
    }, [supabase]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Auto-seed grading rules if empty
    useEffect(() => {
        if (loading || gradingRules.length > 0) return;
        void (async () => {
            await supabase.from("grading_rules").insert(ALL_DEFAULT_GRADING);
            fetchAll();
        })();
    }, [loading, gradingRules.length, fetchAll, supabase]);

    // Auto-seed exams if empty
    useEffect(() => {
        if (loading || exams.length > 0) return;
        void (async () => {
            await supabase.from("exams").insert(DEFAULT_EXAMS);
            fetchAll();
        })();
    }, [loading, exams.length, fetchAll, supabase]);

    // Load subjects when class changes for config tab
    useEffect(() => {
        if (!configClass) { setSubjects([]); return; }
        void (async () => {
            const { data } = await supabase.from("subjects").select(SUBJECT_COLUMNS).eq("class_id", configClass).order("name");
            setSubjects(data || []);
        })();
    }, [configClass, supabase]);

    // Initialize config edits when exam/class/subjects/configs change
    useEffect(() => {
        if (!configExam || subjects.length === 0) { setConfigEdits({}); return; }
        const selectedExamObj = exams.find((e) => e.id === configExam);
        const ownConfigs = examConfigs.filter((c) => c.exam_id === configExam);
        const hasOwnConfig = ownConfigs.length > 0;

        const edits: Record<string, { full_marks: string; weight_percent: string }> = {};

        if (hasOwnConfig) {
            ownConfigs.forEach((cfg) => {
                const sub = subjects.find((s) => s.id === cfg.subject_id);
                if (sub) {
                    edits[sub.id] = { full_marks: cfg.full_marks.toString(), weight_percent: cfg.weight_percent.toString() };
                }
            });
        } else {
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

    const handleRemoveSubjectFromConfig = async (subjectId: string) => {
        if (!configExam) return;
        const existing = examConfigs.find((c) => c.exam_id === configExam && c.subject_id === subjectId);
        if (existing) {
            await supabase.from("exam_subject_config").delete().eq("id", existing.id);
            setExamConfigs((prev) => prev.filter((c) => c.id !== existing.id));
        }
        setConfigEdits((prev) => { const next = { ...prev }; delete next[subjectId]; return next; });
        toast.success("Subject removed from this exam");
    };

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
            const removedIds = subjects.filter((s) => !subjectIdsInEdits.includes(s.id)).map((s) => s.id);
            if (removedIds.length > 0) {
                await supabase.from("exam_subject_config").delete().eq("exam_id", configExam).in("subject_id", removedIds);
            }
            const { error } = await supabase.from("exam_subject_config").upsert(upserts, { onConflict: "exam_id,subject_id" });
            if (error) throw error;
            toast.success(isSilent ? "Configuration saved" : "Subject configuration saved");
            if (!isSilent) fetchAll();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save configuration");
        } finally {
            setSavingConfig(false);
        }
    };

    const handleSubjectConfigKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, subId: string, field: "full_marks" | "weight_percent") => {
        if (['e', 'E', '+', '-'].includes(e.key)) { e.preventDefault(); return; }
        const visibleSubjects = subjects.filter(s => configEdits[s.id]);
        const idx = visibleSubjects.findIndex(s => s.id === subId);
        if (e.key === "Enter") { e.preventDefault(); handleSaveSubjectConfig(true); return; }
        if (e.key === "ArrowDown") { e.preventDefault(); const next = visibleSubjects[idx + 1]; if (next) inputRefs.current[`${next.id}-${field}`]?.focus(); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); const prev = visibleSubjects[idx - 1]; if (prev) inputRefs.current[`${prev.id}-${field}`]?.focus(); return; }
    };

    const tabTriggerClass = "rounded-xl text-xs font-bold px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all gap-2";

    return (
        <div className="space-y-6">
            <PageHeader
                icon={ClipboardText}
                iconBg="bg-primary/10"
                iconColor="text-primary"
                title="Exam Configuration"
                subtitle="Manage exams, grading, and subject config."
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <div className="w-full overflow-x-auto pb-1">
                    <TabsList className="bg-muted rounded-xl p-1 h-auto flex w-max md:w-full md:flex-wrap border-0 shadow-none">
                        <TabsTrigger value="dashboard" className={tabTriggerClass}><LayoutDashboard className="h-3.5 w-3.5" />Dashboard</TabsTrigger>
                        <TabsTrigger value="exams" className={tabTriggerClass}><ClipboardText className="h-3.5 w-3.5" />Exam Terms</TabsTrigger>
                        <TabsTrigger value="subjectConfig" className={tabTriggerClass}><Sliders className="h-3.5 w-3.5" />Subject Config</TabsTrigger>
                        <TabsTrigger value="grading" className={tabTriggerClass}><Medal className="h-3.5 w-3.5" />Grading System</TabsTrigger>
                        <TabsTrigger value="rooms" className={tabTriggerClass}><Building2 className="h-3.5 w-3.5" />Rooms</TabsTrigger>
                        <TabsTrigger value="seatPlan" className={tabTriggerClass}><Users className="h-3.5 w-3.5" />Seat Plan</TabsTrigger>
                        <TabsTrigger value="examDuties" className={tabTriggerClass}><Briefcase className="h-3.5 w-3.5" />Duties</TabsTrigger>
                        <TabsTrigger value="paperChecking" className={tabTriggerClass}><FileCheck className="h-3.5 w-3.5" />Paper Checking</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="dashboard" className="space-y-4">
                    <ExamDashboardTab exams={exams} onSelectTab={(t) => setActiveTab(t)} />
                </TabsContent>

                <TabsContent value="exams" className="space-y-4">
                    <ExamTermsTab exams={exams} loading={loading} supabase={supabase} onRefresh={fetchAll} />
                </TabsContent>

                <TabsContent value="grading" className="space-y-4">
                    <GradingTab gradingRules={gradingRules} loading={loading} supabase={supabase} onRefresh={fetchAll} />
                </TabsContent>

                {/* ──── SUBJECT CONFIG TAB (inline — tightly coupled to parent state) ──── */}
                <TabsContent value="subjectConfig" className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Select value={configExam} onValueChange={setConfigExam}>
                            <SelectTrigger className="w-[200px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                                <SelectValue placeholder="Select Exam" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border shadow-md">
                                {exams.map((e) => (<SelectItem key={e.id} value={e.id} className="rounded-lg">{e.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        <Select value={configClass} onValueChange={setConfigClass}>
                            <SelectTrigger className="w-[200px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                                <SelectValue placeholder="Select Class" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border shadow-md">
                                {classes.map((c) => (<SelectItem key={c.id} value={c.id} className="rounded-lg">{c.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        {configExam && configClass && subjects.length > 0 && (
                            <Button onClick={() => handleSaveSubjectConfig(false)} disabled={savingConfig} className="ml-auto bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-semibold shadow-none transition-all duration-200 ">
                                <FloppyDisk size={16} strokeWidth={1.5} className="mr-2" />{savingConfig ? "Saving..." : "Save Config"}
                            </Button>
                        )}
                    </div>

                    {(!configExam || !configClass) && (
                        <Card className="bg-transparent rounded-2xl border-2 border-dashed border-border shadow-none">
                            <CardContent className="py-12 text-center">
                                <Sliders size={32} strokeWidth={1.2} className="text-muted-foreground/40 mb-3 mx-auto" />
                                <h3 className="font-semibold text-lg text-foreground mb-1">Select an exam and class</h3>
                                <p className="text-sm text-muted-foreground">Choose an exam and class above to configure subject-wise marks and weightage.</p>
                            </CardContent>
                        </Card>
                    )}

                    {configExam && configClass && subjects.length === 0 && (
                        <Card className="bg-transparent rounded-2xl border-2 border-dashed border-border shadow-none">
                            <CardContent className="py-12 text-center">
                                <Sliders size={32} strokeWidth={1.2} className="text-muted-foreground/40 mb-3 mx-auto" />
                                <h3 className="font-semibold text-lg text-foreground mb-1">No subjects in this class</h3>
                                <p className="text-sm text-muted-foreground">Add subjects to this class first.</p>
                            </CardContent>
                        </Card>
                    )}

                    {configExam && configClass && subjects.length > 0 && (
                        <Card className="bg-card rounded-2xl border-border shadow-none">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">
                                    {exams.find((e) => e.id === configExam)?.name} - {classes.find((c) => c.id === configClass)?.name}
                                    <Badge variant="outline" className="ml-2 bg-muted/50 border-border text-muted-foreground rounded-md">{subjects.length} subjects</Badge>
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
                                                                type="number" min={1} className="text-center h-9"
                                                                value={edit.full_marks}
                                                                onChange={(e) => setConfigEdits((prev) => ({ ...prev, [sub.id]: { ...prev[sub.id], full_marks: e.target.value } }))}
                                                                onKeyDown={(e) => handleSubjectConfigKeyDown(e, sub.id, "full_marks")}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <Input
                                                                ref={(el) => { inputRefs.current[`${sub.id}-weight_percent`] = el; }}
                                                                type="number" min={1} max={100} className="text-center h-9"
                                                                value={edit.weight_percent}
                                                                onChange={(e) => setConfigEdits((prev) => ({ ...prev, [sub.id]: { ...prev[sub.id], weight_percent: e.target.value } }))}
                                                                onKeyDown={(e) => handleSubjectConfigKeyDown(e, sub.id, "weight_percent")}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-2 text-center">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20" onClick={() => handleRemoveSubjectFromConfig(sub.id)} title="Remove from this exam">
                                                                <Trash size={14} strokeWidth={1.5} />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                                {(() => {
                                    const removedSubjects = subjects.filter((s) => !configEdits[s.id]);
                                    if (removedSubjects.length === 0) return null;
                                    return (
                                        <div className="px-4 py-3 border-t bg-muted/30">
                                            <p className="text-xs text-muted-foreground mb-2">Removed subjects (click to re-add):</p>
                                            <div className="flex flex-wrap gap-2">
                                                {removedSubjects.map((sub) => (
                                                    <Button key={sub.id} variant="outline" size="sm" className="h-8 text-xs gap-1 border-border text-foreground font-medium rounded-lg hover:bg-muted transition-all duration-200"
                                                        onClick={() => {
                                                            setConfigEdits((prev) => ({ ...prev, [sub.id]: { full_marks: sub.full_marks.toString(), weight_percent: "100" } }));
                                                            toast.success(`${sub.name} added back — click "Save Config" to persist`);
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
        </div>
    );
}
