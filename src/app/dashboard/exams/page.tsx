"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    CLASS_COLUMNS,
    EXAM_COLUMNS,
    EXAM_SUBJECT_CONFIG_COLUMNS,
    GRADING_RULE_COLUMNS,
} from "@/lib/supabase/select-columns";
import type { Exam, GradingRule, Class, ExamSubjectConfig } from "@/lib/database.types";
import { ALL_DEFAULT_GRADING, DEFAULT_EXAMS } from "@/lib/constants/exam-defaults";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ClipboardList as ClipboardText,
    Medal,
    SlidersHorizontal as Sliders,
    Users,
    Briefcase,
    Building2,
    FileCheck,
    LayoutDashboard,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import { ExamTermsTab } from "./_components/ExamTermsTab";
import { SubjectConfigTab } from "./_components/SubjectConfigTab";
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
    const [examConfigs, setExamConfigs] = useState<ExamSubjectConfig[]>([]);
    const [loading, setLoading] = useState(true);

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

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

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

    const tabTriggerClass =
        "rounded-xl text-xs font-bold px-3.5 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all gap-2 flex items-center";

    return (
        <div className="space-y-6">
            <PageHeader
                icon={ClipboardText}
                iconBg="bg-primary/10"
                iconColor="text-primary"
                title="Exam Configuration"
                subtitle="Manage exam terms, subject marks, grading scales, schedules, and hall allocations."
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <div className="w-full overflow-x-auto pb-1">
                    <TabsList className="bg-muted rounded-xl p-1 h-auto flex w-max md:w-full md:flex-wrap border-0 shadow-none gap-0.5">
                        <TabsTrigger value="dashboard" className={tabTriggerClass}>
                            <LayoutDashboard className="h-3.5 w-3.5" />
                            Dashboard
                        </TabsTrigger>
                        <TabsTrigger value="exams" className={tabTriggerClass}>
                            <ClipboardText className="h-3.5 w-3.5" />
                            Exam Terms
                            {exams.length > 0 && (
                                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-muted-foreground/15 font-mono">
                                    {exams.length}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="subjectConfig" className={tabTriggerClass}>
                            <Sliders className="h-3.5 w-3.5" />
                            Subject Config
                        </TabsTrigger>
                        <TabsTrigger value="grading" className={tabTriggerClass}>
                            <Medal className="h-3.5 w-3.5" />
                            Grading System
                            {gradingRules.length > 0 && (
                                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-muted-foreground/15 font-mono">
                                    {gradingRules.length}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="rooms" className={tabTriggerClass}>
                            <Building2 className="h-3.5 w-3.5" />
                            Rooms
                        </TabsTrigger>
                        <TabsTrigger value="seatPlan" className={tabTriggerClass}>
                            <Users className="h-3.5 w-3.5" />
                            Seat Plan
                        </TabsTrigger>
                        <TabsTrigger value="examDuties" className={tabTriggerClass}>
                            <Briefcase className="h-3.5 w-3.5" />
                            Duties
                        </TabsTrigger>
                        <TabsTrigger value="paperChecking" className={tabTriggerClass}>
                            <FileCheck className="h-3.5 w-3.5" />
                            Paper Checking
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="dashboard" className="space-y-4">
                    {activeTab === "dashboard" && <ExamDashboardTab exams={exams} onSelectTab={(t) => setActiveTab(t)} />}
                </TabsContent>

                <TabsContent value="exams" className="space-y-4">
                    {activeTab === "exams" && <ExamTermsTab exams={exams} loading={loading} supabase={supabase} onRefresh={fetchAll} />}
                </TabsContent>

                <TabsContent value="subjectConfig" className="space-y-4">
                    {activeTab === "subjectConfig" && (
                        <SubjectConfigTab
                            exams={exams}
                            classes={classes}
                            examConfigs={examConfigs}
                            supabase={supabase}
                            onRefresh={fetchAll}
                        />
                    )}
                </TabsContent>

                <TabsContent value="grading" className="space-y-4">
                    {activeTab === "grading" && <GradingTab gradingRules={gradingRules} loading={loading} supabase={supabase} onRefresh={fetchAll} />}
                </TabsContent>

                <TabsContent value="rooms" className="space-y-4">
                    {activeTab === "rooms" && <RoomsTab />}
                </TabsContent>

                <TabsContent value="seatPlan" className="space-y-4">
                    {activeTab === "seatPlan" && <SeatPlanTab exams={exams} />}
                </TabsContent>

                <TabsContent value="examDuties" className="space-y-4">
                    {activeTab === "examDuties" && <ExamDutiesTab exams={exams} />}
                </TabsContent>

                <TabsContent value="paperChecking" className="space-y-4">
                    {activeTab === "paperChecking" && <PaperCheckingTab exams={exams} />}
                </TabsContent>
            </Tabs>
        </div>
    );
}
