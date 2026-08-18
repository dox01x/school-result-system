"use client";

import { use, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { createClient } from "@/lib/supabase/client";
import {
  CLASS_COLUMNS,
  EXAM_COLUMNS,
  EXAM_SUBJECT_CONFIG_COLUMNS,
  GRADING_RULE_COLUMNS,
} from "@/lib/supabase/select-columns";
import type { Exam, GradingRule, Class, ExamSubjectConfig } from "@/lib/database.types";

// Import tabs
import { ExamDashboardTab } from "../_components/ExamDashboardTab";
import { ExamTermsTab } from "../_components/ExamTermsTab";
import { ExamDutiesTab } from "../_components/ExamDutiesTab";
import { RoomsTab } from "../_components/RoomsTab";
import { SeatPlanTab } from "../_components/SeatPlanTab";
import { GradingTab } from "../_components/GradingTab";
import { SubjectConfigTab } from "../_components/SubjectConfigTab";

export default function ExamDetailPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [exams, setExams] = useState<Exam[]>([]);
  const [gradingRules, setGradingRules] = useState<GradingRule[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [examConfigs, setExamConfigs] = useState<ExamSubjectConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const currentExam = exams.find((e) => e.id === examId) || exams[0];

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Examinations", href: "/exams" },
          { label: currentExam?.name || "Exam Details" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {currentExam?.name || "Examination"}
              </h1>
              <Badge variant="outline" className="capitalize">
                {currentExam?.exam_type || "General"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Term: {currentExam?.term || "1"} • Manage configuration, duties, rooms & grading rules
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/exams">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> All Exams
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:flex lg:flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="dashboard">Overview</TabsTrigger>
          <TabsTrigger value="exams">Terms & Weight</TabsTrigger>
          <TabsTrigger value="subjectConfig">Subject Config</TabsTrigger>
          <TabsTrigger value="grading">Grading Rules</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="seatPlan">Seat Plan</TabsTrigger>
          <TabsTrigger value="examDuties">Duties</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <ExamDashboardTab exams={exams} onSelectTab={(t) => setActiveTab(t)} />
        </TabsContent>
        <TabsContent value="exams" className="space-y-4">
          <ExamTermsTab exams={exams} loading={loading} supabase={supabase} onRefresh={fetchAll} />
        </TabsContent>
        <TabsContent value="subjectConfig" className="space-y-4">
          <SubjectConfigTab
            exams={exams}
            classes={classes}
            examConfigs={examConfigs}
            supabase={supabase}
            onRefresh={fetchAll}
          />
        </TabsContent>
        <TabsContent value="grading" className="space-y-4">
          <GradingTab
            gradingRules={gradingRules}
            loading={loading}
            supabase={supabase}
            onRefresh={fetchAll}
          />
        </TabsContent>
        <TabsContent value="rooms" className="space-y-4">
          <RoomsTab />
        </TabsContent>
        <TabsContent value="seatPlan" className="space-y-4">
          <SeatPlanTab exams={exams} />
        </TabsContent>
        <TabsContent value="examDuties" className="space-y-4">
          <ExamDutiesTab exams={exams} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
