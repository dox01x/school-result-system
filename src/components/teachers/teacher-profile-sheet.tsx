"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Teacher } from "@/lib/database.types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Shield, Trash2, BarChart3, TrendingUp, TrendingDown, Users, BookOpen } from "lucide-react";

type TeacherProfileProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teacherId: string | null;
    onTeacherUpdated?: () => void;
    onRequestEdit?: (teacher: Teacher) => void;
    onRequestDelete?: (teacher: Teacher) => void;
};

type SubjectPerformance = {
    className: string;
    sectionName: string;
    subjectName: string;
    subjectId: string;
    classId: string;
    sectionId: string;
    totalStudents: number;
    passedCount: number;
    failedCount: number;
    averageMarks: number;
    highestMarks: number;
    passPercentage: number;
};

const days = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu"];

export function TeacherProfileSheet({
    open,
    onOpenChange,
    teacherId,
    onTeacherUpdated,
    onRequestEdit,
    onRequestDelete,
}: TeacherProfileProps) {
    const supabase = useMemo(() => createClient() as any, []);
    const [loading, setLoading] = useState(false);
    const [teacher, setTeacher] = useState<Teacher | null>(null);
    const [routineRows, setRoutineRows] = useState<any[]>([]);
    const [leaveRows, setLeaveRows] = useState<any[]>([]);
    const [proxyRows, setProxyRows] = useState<any[]>([]);
    const [salaryConfig, setSalaryConfig] = useState<any>(null);
    const [salaryPayments, setSalaryPayments] = useState<any[]>([]);
    const [actionForm, setActionForm] = useState({
        name: "",
        phone: "",
        email: "",
        subject_specialty: "",
        designation: "",
    });
    const [saving, setSaving] = useState(false);

    // Student Performance state
    const [perfLoading, setPerfLoading] = useState(false);
    const [subjectPerformance, setSubjectPerformance] = useState<SubjectPerformance[]>([]);
    const [availableExams, setAvailableExams] = useState<{ id: string; name: string }[]>([]);
    const [selectedExamId, setSelectedExamId] = useState<string>("all");
    const [academicYear, setAcademicYear] = useState<string>("");

    useEffect(() => {
        if (!open || !teacherId) return;
        let cancelled = false;
        setLoading(true);
        void (async () => {
            const { data: teacherData, error } = await supabase
                .from("teachers")
                .select("id,name,phone,email,subject_specialty,designation,employee_type,proxy_count,created_at")
                .eq("id", teacherId)
                .maybeSingle();
            if (cancelled) return;
            if (error || !teacherData) {
                setLoading(false);
                return;
            }
            setTeacher(teacherData);
            setActionForm({
                name: teacherData.name || "",
                phone: teacherData.phone || "",
                email: teacherData.email || "",
                subject_specialty: teacherData.subject_specialty || "",
                designation: teacherData.designation || "",
            });

            const [routineRes, leaveRes, proxyRes, configRes, salaryRes] = await Promise.all([
                supabase
                    .from("class_routines")
                    .select("id,day_of_week,start_time,end_time,classes(name),sections(name),subjects(name),rooms(name)")
                    .eq("teacher_id", teacherId)
                    .order("day_of_week")
                    .order("start_time"),
                supabase.from("leave_requests").select("id,start_date,end_date,reason,status,created_at").eq("teacher_id", teacherId).order("created_at", { ascending: false }),
                supabase.from("proxy_assignments").select("id,assignment_date,routine_id,original_teacher_id,proxy_teacher_id,created_at").or(`original_teacher_id.eq.${teacherId},proxy_teacher_id.eq.${teacherId}`).order("assignment_date", { ascending: false }),
                supabase.from("staff_salary_config").select("id,basic_salary,allowances,deductions,effective_from,is_active").eq("staff_id", teacherId).eq("is_active", true).maybeSingle(),
                supabase.from("salary_payments").select("id,slip_number,month,year,net_salary,payment_date,payment_method").eq("staff_id", teacherId).order("payment_date", { ascending: false }).limit(12),
            ]);

            if (cancelled) return;
            setRoutineRows(routineRes.data || []);
            setLeaveRows(leaveRes.data || []);
            setProxyRows(proxyRes.data || []);
            setSalaryConfig(configRes.data || null);
            setSalaryPayments(salaryRes.data || []);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [open, teacherId, supabase]);

    // Load student performance data
    useEffect(() => {
        if (!open || !teacherId) return;
        let cancelled = false;
        setPerfLoading(true);
        void (async () => {
            // 1. Get school academic year
            const { data: schoolInfo } = await supabase
                .from("school_info")
                .select("current_academic_year")
                .limit(1)
                .maybeSingle();
            const year = schoolInfo?.current_academic_year || new Date().getFullYear().toString();
            if (cancelled) return;
            setAcademicYear(year);

            // 2. Get all exams
            const { data: examsData } = await supabase
                .from("exams")
                .select("id,name")
                .order("term")
                .order("exam_type");
            if (cancelled) return;
            setAvailableExams(examsData || []);

            // 3. Get class_routines for this teacher (unique class/section/subject combos)
            const { data: routines } = await supabase
                .from("class_routines")
                .select("class_id,section_id,subject_id,classes(name),sections(name),subjects(name,pass_marks,full_marks)")
                .eq("teacher_id", teacherId);
            if (cancelled) return;
            if (!routines || routines.length === 0) {
                setSubjectPerformance([]);
                setPerfLoading(false);
                return;
            }

            // Deduplicate class/section/subject combos
            const uniqueAssignments = new Map<string, any>();
            for (const r of routines) {
                const key = `${r.class_id}-${r.section_id}-${r.subject_id}`;
                if (!uniqueAssignments.has(key)) {
                    uniqueAssignments.set(key, r);
                }
            }

            // 4. For each assignment, calculate pass/fail stats
            const perfResults: SubjectPerformance[] = [];
            for (const [, r] of uniqueAssignments) {
                // Get students in this class/section
                const { data: students } = await supabase
                    .from("students")
                    .select("id")
                    .eq("class_id", r.class_id)
                    .eq("section_id", r.section_id);
                if (cancelled) return;
                if (!students || students.length === 0) continue;

                const studentIds = students.map((s: any) => s.id);

                // Get marks for these students in this subject
                let marksQuery = supabase
                    .from("marks")
                    .select("student_id,total")
                    .eq("subject_id", r.subject_id)
                    .eq("academic_year", year)
                    .in("student_id", studentIds);

                if (selectedExamId !== "all") {
                    marksQuery = marksQuery.eq("exam_id", selectedExamId);
                }

                const { data: marks } = await marksQuery;
                if (cancelled) return;
                if (!marks || marks.length === 0) continue;

                const passMark = (r.subjects as any)?.pass_marks || 33;
                const totalStudents = marks.length;
                const passedCount = marks.filter((m: any) => Number(m.total) >= passMark).length;
                const failedCount = totalStudents - passedCount;
                const totals = marks.map((m: any) => Number(m.total));
                const averageMarks = totals.reduce((a: number, b: number) => a + b, 0) / totalStudents;
                const highestMarks = Math.max(...totals);

                perfResults.push({
                    className: (r.classes as any)?.name || "-",
                    sectionName: (r.sections as any)?.name || "-",
                    subjectName: (r.subjects as any)?.name || "-",
                    subjectId: r.subject_id,
                    classId: r.class_id,
                    sectionId: r.section_id,
                    totalStudents,
                    passedCount,
                    failedCount,
                    averageMarks: Math.round(averageMarks * 100) / 100,
                    highestMarks,
                    passPercentage: Math.round((passedCount / totalStudents) * 100),
                });
            }

            if (cancelled) return;
            setSubjectPerformance(perfResults);
            setPerfLoading(false);
        })();
        return () => { cancelled = true; };
    }, [open, teacherId, supabase, selectedExamId]);

    const timetable = useMemo(() => {
        const table: Record<string, any[]> = {};
        for (const d of days) table[d] = [];
        for (const row of routineRows) {
            const key = days[row.day_of_week] || "Sat";
            table[key].push(row);
        }
        return table;
    }, [routineRows]);

    const salaryNumbers = useMemo(() => {
        if (!salaryConfig) return { basic: 0, allowances: 0, deductions: 0, net: 0 };
        const allowances = Object.values((salaryConfig.allowances || {}) as Record<string, unknown>).reduce(
            (sum: number, value: unknown) => sum + Number(value),
            0
        );
        const deductions = Object.values((salaryConfig.deductions || {}) as Record<string, unknown>).reduce(
            (sum: number, value: unknown) => sum + Number(value),
            0
        );
        const basic = Number(salaryConfig.basic_salary || 0);
        return { basic, allowances, deductions, net: basic + allowances - deductions };
    }, [salaryConfig]);

    // Performance summary
    const perfSummary = useMemo(() => {
        if (subjectPerformance.length === 0) return { totalStudents: 0, overallPassRate: 0, avgScore: 0 };
        const totalStudents = subjectPerformance.reduce((s, p) => s + p.totalStudents, 0);
        const totalPassed = subjectPerformance.reduce((s, p) => s + p.passedCount, 0);
        const weightedAvg = subjectPerformance.reduce((s, p) => s + p.averageMarks * p.totalStudents, 0) / (totalStudents || 1);
        return {
            totalStudents,
            overallPassRate: totalStudents ? Math.round((totalPassed / totalStudents) * 100) : 0,
            avgScore: Math.round(weightedAvg * 100) / 100,
        };
    }, [subjectPerformance]);

    const handleSaveInline = async () => {
        if (!teacher) return;
        setSaving(true);
        const { data, error } = await supabase
            .from("teachers")
            .update({
                name: actionForm.name.trim(),
                phone: actionForm.phone.trim(),
                email: actionForm.email.trim(),
                subject_specialty: actionForm.subject_specialty.trim(),
                designation: actionForm.designation.trim(),
            })
            .eq("id", teacher.id)
            .select("id,name,phone,email,subject_specialty,designation,employee_type,proxy_count,created_at")
            .single();
        setSaving(false);
        if (error) {
            toast.error(error.message);
            return;
        }
        setTeacher(data);
        onTeacherUpdated?.();
        toast.success("Teacher profile updated");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[96vw] sm:max-w-[900px] p-0 gap-0 overflow-hidden bg-background">
                <DialogHeader className="border-b border-border/50 bg-muted/30 p-6">
                    <DialogTitle className="text-xl">Teacher Profile</DialogTitle>
                    <DialogDescription>
                        Detailed profile, routine, student performance, payroll and actions.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[80vh] h-[800px]">
                    {loading || !teacher ? (
                        <div className="p-6 text-sm text-muted-foreground">Loading profile...</div>
                    ) : (
                        <div className="p-6 space-y-6">
                            {/* Header Card */}
                            <div className="rounded-2xl border-0 bg-muted/50 p-5">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-4">
                                        <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                            {teacher.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-semibold text-foreground">{teacher.name}</h3>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-lg font-medium">{teacher.designation || "Teacher"}</Badge>
                                                <Badge variant="secondary" className="border-0 rounded-lg font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                    TEACHER
                                                </Badge>
                                                {teacher.subject_specialty && <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-lg font-medium">{teacher.subject_specialty}</Badge>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => onRequestEdit?.(teacher)}>
                                            <Pencil className="h-4 w-4 mr-1" strokeWidth={1.2} />Edit
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <Tabs defaultValue="overview" className="space-y-4">
                                <TabsList className="w-full justify-start overflow-x-auto bg-muted border-0 rounded-xl p-1">
                                    <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Overview</TabsTrigger>
                                    <TabsTrigger value="routine" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Class Routine</TabsTrigger>
                                    <TabsTrigger value="attendance" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Attendance & Proxy</TabsTrigger>
                                    <TabsTrigger value="performance" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Student Performance</TabsTrigger>
                                    <TabsTrigger value="payroll" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Payroll</TabsTrigger>
                                    <TabsTrigger value="actions" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Actions</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Contact & Responsibilities</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
                                            <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Phone</p><p className="font-medium">{teacher.phone || "-"}</p></div>
                                            <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Email</p><p className="font-medium">{teacher.email || "-"}</p></div>
                                            <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Designation</p><p className="font-medium">{teacher.designation || "-"}</p></div>
                                            <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Subject Specialty</p><p className="font-medium">{teacher.subject_specialty || "-"}</p></div>
                                            <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Proxy Classes Taken</p><p className="font-medium">{teacher.proxy_count || 0}</p></div>
                                            <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Routine Entries</p><p className="font-medium">{routineRows.length}</p></div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="routine" className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Weekly Timetable</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-4">
                                            {days.map((day) => (
                                                <div key={day} className="rounded-xl border border-border/50 bg-muted/30 p-4">
                                                    <p className="font-semibold text-foreground mb-3">{day}</p>
                                                    {timetable[day]?.length ? timetable[day].map((r: any) => (
                                                        <div key={r.id} className="rounded-lg border-0 bg-white shadow-sm p-3 mb-2 text-sm flex flex-col gap-1">
                                                            <p className="font-semibold text-foreground">{r.start_time} - {r.end_time}</p>
                                                            <div className="flex justify-between items-center text-xs">
                                                                <span className="text-muted-foreground font-medium">{r.classes?.name} / {r.sections?.name}</span>
                                                                <span className="bg-muted text-foreground px-2 py-0.5 rounded-md font-medium">{r.subjects?.name}</span>
                                                            </div>
                                                            {r.rooms?.name && <p className="text-[10px] uppercase text-muted-foreground/80 mt-1">Room {r.rooms.name}</p>}
                                                        </div>
                                                    )) : <p className="text-sm text-muted-foreground font-medium">No classes.</p>}
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="attendance" className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Leave Records</CardTitle></CardHeader>
                                        <CardContent className="space-y-2">
                                            {leaveRows.length === 0 && <p className="text-sm text-muted-foreground font-medium">No leave records.</p>}
                                            {leaveRows.map((l: any) => (
                                                <div key={l.id} className="flex items-center justify-between border-b border-border/40 pb-3 last:border-0 last:pb-0">
                                                    <div className="flex flex-col gap-1">
                                                        <p className="text-sm font-semibold text-foreground">{l.start_date} to {l.end_date}</p>
                                                        <p className="text-xs text-muted-foreground font-medium">{l.reason || "-"}</p>
                                                    </div>
                                                    <Badge variant="secondary" className="bg-muted text-foreground border-0 rounded-md">{l.status}</Badge>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Proxy Class Log</CardTitle></CardHeader>
                                        <CardContent className="space-y-2">
                                            {proxyRows.length === 0 && <p className="text-sm text-muted-foreground font-medium">No proxy assignments.</p>}
                                            {proxyRows.map((p: any) => (
                                                <div key={p.id} className="flex items-center justify-between border-b border-border/40 pb-3 text-sm last:border-0 last:pb-0">
                                                    <span className="font-semibold text-foreground">{p.assignment_date}</span>
                                                    <span className="bg-muted text-muted-foreground px-2 py-1 rounded-md text-xs font-mono font-medium">Routine: {p.routine_id.slice(0, 8)}</span>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Student Performance Tab */}
                                <TabsContent value="performance" className="space-y-4">
                                    {/* Exam Filter */}
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Filter by Exam:</Label>
                                            <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                                                <SelectTrigger className="w-[200px] h-9">
                                                    <SelectValue placeholder="All Exams" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Exams</SelectItem>
                                                    {availableExams.map((e) => (
                                                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {academicYear && (
                                            <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-lg font-medium">
                                                Year: {academicYear}
                                            </Badge>
                                        )}
                                    </div>

                                    {perfLoading ? (
                                        <div className="p-8 text-center text-sm text-muted-foreground">Loading student performance data...</div>
                                    ) : subjectPerformance.length === 0 ? (
                                        <Card className="border-dashed border-2 border-border/50 bg-transparent shadow-none">
                                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                                <BarChart3 size={48} strokeWidth={1.2} className="text-muted-foreground/40 mb-4" />
                                                <h3 className="font-semibold text-lg mb-1">No Performance Data</h3>
                                                <p className="text-sm text-muted-foreground max-w-sm">
                                                    This teacher has no class routine assignments or no marks have been entered yet for the current academic year.
                                                </p>
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        <>
                                            {/* Summary Cards */}
                                            <div className="grid grid-cols-3 gap-3">
                                                <Card>
                                                    <CardContent className="p-4 flex flex-col items-center justify-center">
                                                        <Users size={20} strokeWidth={1.5} className="text-muted-foreground mb-2" />
                                                        <p className="text-xs font-medium text-muted-foreground mb-1">Total Students</p>
                                                        <p className="text-2xl font-bold text-foreground">{perfSummary.totalStudents}</p>
                                                    </CardContent>
                                                </Card>
                                                <Card>
                                                    <CardContent className="p-4 flex flex-col items-center justify-center">
                                                        <TrendingUp size={20} strokeWidth={1.5} className="text-emerald-600 mb-2" />
                                                        <p className="text-xs font-medium text-muted-foreground mb-1">Pass Rate</p>
                                                        <p className={`text-2xl font-bold ${perfSummary.overallPassRate >= 60 ? 'text-emerald-600' : perfSummary.overallPassRate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                                            {perfSummary.overallPassRate}%
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                                <Card>
                                                    <CardContent className="p-4 flex flex-col items-center justify-center">
                                                        <BookOpen size={20} strokeWidth={1.5} className="text-muted-foreground mb-2" />
                                                        <p className="text-xs font-medium text-muted-foreground mb-1">Avg Score</p>
                                                        <p className="text-2xl font-bold text-foreground">{perfSummary.avgScore}</p>
                                                    </CardContent>
                                                </Card>
                                            </div>

                                            {/* Per-Subject Breakdown */}
                                            <Card>
                                                <CardHeader>
                                                    <CardTitle className="text-sm flex items-center gap-2">
                                                        <BarChart3 size={16} strokeWidth={1.5} className="text-muted-foreground" />
                                                        Subject-wise Performance
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    {subjectPerformance.map((perf, idx) => (
                                                        <div key={idx} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <div>
                                                                    <p className="font-semibold text-foreground">{perf.subjectName}</p>
                                                                    <p className="text-xs text-muted-foreground font-medium">{perf.className} / {perf.sectionName}</p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-md text-xs">
                                                                        {perf.totalStudents} students
                                                                    </Badge>
                                                                </div>
                                                            </div>

                                                            {/* Pass/Fail Bar */}
                                                            <div className="h-3 rounded-full overflow-hidden bg-red-200 dark:bg-red-900/30 flex mb-3">
                                                                <div
                                                                    className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-l-full transition-all duration-500"
                                                                    style={{ width: `${perf.passPercentage}%` }}
                                                                />
                                                            </div>

                                                            <div className="grid grid-cols-4 gap-3 text-center text-sm">
                                                                <div>
                                                                    <p className="text-xs text-muted-foreground font-medium">Passed</p>
                                                                    <p className="font-bold text-emerald-600 dark:text-emerald-400">{perf.passedCount}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-muted-foreground font-medium">Failed</p>
                                                                    <p className="font-bold text-red-600 dark:text-red-400">{perf.failedCount}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-muted-foreground font-medium">Average</p>
                                                                    <p className="font-bold text-foreground">{perf.averageMarks}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-muted-foreground font-medium">Highest</p>
                                                                    <p className="font-bold text-foreground">{perf.highestMarks}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </CardContent>
                                            </Card>
                                        </>
                                    )}
                                </TabsContent>

                                <TabsContent value="payroll" className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Current Salary Structure</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-4">
                                            <div className="rounded-xl border-0 bg-muted p-5">
                                                <p className="text-sm font-medium text-muted-foreground mb-1">Basic Salary</p>
                                                <p className="text-3xl font-bold text-foreground">{salaryNumbers.basic.toFixed(2)}</p>
                                            </div>
                                            <div className="rounded-xl border-0 bg-muted p-5">
                                                <p className="text-sm font-medium text-muted-foreground mb-1">Estimated Net</p>
                                                <p className="text-3xl font-bold text-foreground">{salaryNumbers.net.toFixed(2)}</p>
                                            </div>
                                            <div className="rounded-xl border-0 bg-muted p-5">
                                                <p className="text-sm font-medium text-muted-foreground mb-1">Allowances</p>
                                                <p className="text-3xl font-bold text-foreground">{salaryNumbers.allowances.toFixed(2)}</p>
                                            </div>
                                            <div className="rounded-xl border-0 bg-muted p-5">
                                                <p className="text-sm font-medium text-muted-foreground mb-1">Deductions</p>
                                                <p className="text-3xl font-bold text-foreground">{salaryNumbers.deductions.toFixed(2)}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Recent Payments</CardTitle></CardHeader>
                                        <CardContent className="space-y-3">
                                            {salaryPayments.length === 0 && <p className="text-sm text-muted-foreground font-medium">No salary history.</p>}
                                            {salaryPayments.map((s: any) => (
                                                <div key={s.id} className="flex items-center justify-between border-b border-border/40 pb-3 last:border-0 last:pb-0 text-sm">
                                                    <div className="flex flex-col gap-1">
                                                        <p className="font-semibold text-foreground">{s.month}/{s.year}</p>
                                                        <p className="text-xs font-mono text-muted-foreground">{s.slip_number}</p>
                                                    </div>
                                                    <div className="text-right flex flex-col gap-1">
                                                        <p className="font-semibold text-foreground">{Number(s.net_salary || 0).toFixed(2)}</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase">{s.payment_date || "-"}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="actions" className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Update Profile</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-4">
                                            <div className="space-y-1"><Label>Name</Label><Input value={actionForm.name} onChange={(e) => setActionForm((p) => ({ ...p, name: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Phone</Label><Input value={actionForm.phone} onChange={(e) => setActionForm((p) => ({ ...p, phone: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Email</Label><Input value={actionForm.email} onChange={(e) => setActionForm((p) => ({ ...p, email: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Designation</Label><Input value={actionForm.designation} onChange={(e) => setActionForm((p) => ({ ...p, designation: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Subject Specialty</Label><Input value={actionForm.subject_specialty} onChange={(e) => setActionForm((p) => ({ ...p, subject_specialty: e.target.value }))} /></div>
                                            <div className="md:col-span-2 mt-2">
                                                <Button onClick={handleSaveInline} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">System Access</CardTitle></CardHeader>
                                        <CardContent className="flex gap-2">
                                            <Button variant="outline"><Shield className="h-4 w-4 mr-2" strokeWidth={1.5} />Manage Access Controls</Button>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-red-200 bg-red-50/30">
                                        <CardHeader><CardTitle className="text-sm text-red-600">Danger Zone</CardTitle></CardHeader>
                                        <CardContent className="flex gap-2">
                                            <Button variant="destructive" onClick={() => onRequestDelete?.(teacher)}><Trash2 className="h-4 w-4 mr-2" strokeWidth={1.5} />Delete Teacher</Button>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
