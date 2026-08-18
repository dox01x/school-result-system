"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    LayoutDashboard,
    Calendar,
    Building2,
    Users,
    Briefcase,
    FileCheck,
    Clock,
    CheckCircle2,
    ArrowUpRight,
    ChevronRight,
    Sparkles,
    BookOpen,
    UserCheck,
    TrendingUp,
    Plus,
} from "lucide-react";
import type { Exam } from "@/lib/database.types";

interface ClassInfo {
    id: string;
    name: string;
    numeric_value: number | null;
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

interface ScheduleItem {
    id: string;
    exam_id: string;
    class_id: string;
    subject_id: string;
    exam_date: string;
    start_time: string;
    end_time: string;
}

interface DutyItem {
    id?: string;
    exam_id?: string | null;
    teacher_id: string;
    room_id: string;
    exam_date?: string;
    start_time?: string;
    end_time?: string;
}

interface DistributionItem {
    id: string;
    exam_id: string;
    class_id: string;
    section_id: string | null;
    subject_id: string;
    teacher_id: string;
    total_copies: number;
    date_given: string;
    date_returned: string | null;
    status: string;
}

interface RoomItem {
    id: string;
    name: string;
    capacity: number;
}

interface SeatPlanItem {
    id?: string;
    exam_id?: string;
    room_id: string;
    class_id: string;
    allocated_students: number;
}

export function ExamDashboardTab({
    exams,
    onSelectTab,
}: {
    exams: Exam[];
    onSelectTab?: (tab: string) => void;
}) {
    const [selectedExamId, setSelectedExamId] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    // Dashboard Data States
    const [classes, setClasses] = useState<ClassInfo[]>([]);
    const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
    const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
    const [rooms, setRooms] = useState<RoomItem[]>([]);
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [duties, setDuties] = useState<DutyItem[]>([]);
    const [distributions, setDistributions] = useState<DistributionItem[]>([]);
    const [seatPlans, setSeatPlans] = useState<SeatPlanItem[]>([]);

    const supabase = useMemo(() => createClient(), []);
    const activeExamId = selectedExamId || exams[0]?.id || "";

    // Load reference data (Classes, Subjects, Teachers, Rooms)
    useEffect(() => {
        const loadReferenceData = async () => {
            const [clsRes, subjRes, teachRes, rmRes] = await Promise.all([
                supabase.from("classes").select("id, name, numeric_value").order("numeric_value"),
                supabase.from("subjects").select("id, name, class_id"),
                supabase.from("teachers").select("id, name, designation, phone").order("name"),
                supabase.from("rooms").select("id, name, capacity"),
            ]);
            if (clsRes.data) setClasses(clsRes.data);
            if (subjRes.data) setSubjects(subjRes.data);
            if (teachRes.data) setTeachers(teachRes.data);
            if (rmRes.data) setRooms(rmRes.data);
        };
        loadReferenceData();
    }, [supabase]);

    // Load exam-specific data when exam selection changes
    useEffect(() => {
        if (!activeExamId) return;
        let cancelled = false;

        const loadData = async () => {
            setLoading(true);
            const [schedRes, dutyRes, distRes, seatRes] = await Promise.all([
                supabase.from("exam_schedules").select("id, exam_id, class_id, subject_id, exam_date, start_time, end_time").eq("exam_id", activeExamId).order("exam_date").order("start_time"),
                supabase.from("exam_duties").select("id, exam_id, teacher_id, room_id, exam_date, start_time, end_time").eq("exam_id", activeExamId),
                supabase.from("exam_paper_distributions").select("id, exam_id, class_id, section_id, subject_id, teacher_id, total_copies, date_given, date_returned, status").eq("exam_id", activeExamId),
                supabase.from("exam_seat_plans").select("id, exam_id, room_id, class_id, allocated_students").eq("exam_id", activeExamId),
            ]);

            if (cancelled) return;
            if (schedRes.data) setSchedules(schedRes.data);
            if (dutyRes.data) setDuties(dutyRes.data);
            if (distRes.data) setDistributions(distRes.data);
            if (seatRes.data) setSeatPlans(seatRes.data);
            setLoading(false);
        };

        void loadData();
        return () => { cancelled = true; };
    }, [activeExamId, supabase]);

    const activeExam = useMemo(() => {
        return exams.find(e => e.id === activeExamId);
    }, [exams, activeExamId]);

    // Calculations
    const metrics = useMemo(() => {
        const totalSchedules = schedules.length;
        const totalDuties = duties.length;
        const uniqueDutyTeachers = new Set(duties.map(d => d.teacher_id)).size;

        const totalCopies = distributions.reduce((sum, d) => sum + (d.total_copies || 0), 0);
        const returnedCopies = distributions.filter(d => d.status === "returned").reduce((sum, d) => sum + (d.total_copies || 0), 0);
        const pendingCopies = distributions.filter(d => d.status === "pending").reduce((sum, d) => sum + (d.total_copies || 0), 0);
        
        const evaluationRate = totalCopies > 0 ? Math.round((returnedCopies / totalCopies) * 100) : 0;
        
        const totalStudentsSeated = seatPlans.reduce((sum, sp) => sum + (Number(sp.allocated_students) || 0), 0);
        const allocatedRoomsCount = new Set(seatPlans.map(sp => sp.room_id)).size;

        return {
            totalSchedules,
            totalDuties,
            uniqueDutyTeachers,
            totalCopies,
            returnedCopies,
            pendingCopies,
            evaluationRate,
            totalStudentsSeated,
            allocatedRoomsCount,
        };
    }, [schedules, duties, distributions, seatPlans]);

    // Helper functions
    const getClassName = useCallback((id: string) => classes.find(c => c.id === id)?.name || "—", [classes]);
    const getSubjectName = useCallback((id: string) => subjects.find(s => s.id === id)?.name || "—", [subjects]);
    const getTeacherName = useCallback((id: string) => teachers.find(t => t.id === id)?.name || "Unassigned", [teachers]);
    const getRoomName = useCallback((id: string) => rooms.find(r => r.id === id)?.name || "Hall Room", [rooms]);

    const formatDate = (d: string) => {
        if (!d) return "—";
        const date = new Date(d + "T00:00:00");
        return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    };

    // Subject level paper checking breakdown
    const subjectBreakdown = useMemo(() => {
        const map: { [key: string]: { name: string; total: number; returned: number; pending: number } } = {};
        
        distributions.forEach(d => {
            const subjName = getSubjectName(d.subject_id);
            if (!map[d.subject_id]) {
                map[d.subject_id] = { name: subjName, total: 0, returned: 0, pending: 0 };
            }
            map[d.subject_id].total += d.total_copies || 0;
            if (d.status === "returned") {
                map[d.subject_id].returned += d.total_copies || 0;
            } else if (d.status === "pending") {
                map[d.subject_id].pending += d.total_copies || 0;
            }
        });

        return Object.values(map);
    }, [distributions, getSubjectName]);

    return (
        <div className="space-y-6">
            {/* Top Exam Header & Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-background to-card p-6 rounded-xl border border-primary/20 shadow-xs">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="rounded-lg bg-primary/10 text-primary border-primary/30 font-bold px-2.5 py-0.5 text-xs">
                            <Sparkles className="h-3 w-3 mr-1" /> Dynamic Overview
                        </Badge>
                        {activeExam?.exam_type && (
                            <Badge variant="secondary" className="rounded-lg uppercase text-[10px] font-bold tracking-wider">
                                {activeExam.exam_type}
                            </Badge>
                        )}
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                        {activeExam?.name || "Exam Management Dashboard"}
                    </h2>
                    <p className="text-xs text-muted-foreground font-medium">
                        Live analytics for exam schedules, seating allocations, invigilation duties, and paper checking status.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Select value={selectedExamId || activeExamId} onValueChange={setSelectedExamId}>
                        <SelectTrigger className="w-[220px] h-11 rounded-xl bg-card border-border/80 font-bold text-xs shadow-xs focus:ring-2 focus:ring-primary/20">
                            <SelectValue placeholder="Select Exam Term" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border shadow-md">
                            {exams.map(e => (
                                <SelectItem key={e.id} value={e.id} className="rounded-lg font-medium">
                                    {e.name} (Term {e.term})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Top Metric KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Metric 1: Scheduled Papers */}
                <Card className="rounded-2xl border-border shadow-none hover:border-primary/40 transition-all duration-200 bg-card">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Exam Papers</p>
                            <p className="text-2xl font-black text-foreground">{metrics.totalSchedules}</p>
                            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-primary" /> Scheduled Papers
                            </p>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <BookOpen className="h-5.5 w-5.5" />
                        </div>
                    </CardContent>
                </Card>

                {/* Metric 2: Seated Students & Halls */}
                <Card className="rounded-2xl border-border shadow-none hover:border-primary/40 transition-all duration-200 bg-card">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Seated Capacity</p>
                            <p className="text-2xl font-black text-foreground">{metrics.totalStudentsSeated}</p>
                            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-emerald-500" /> {metrics.allocatedRoomsCount} Rooms Allocated
                            </p>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <Users className="h-5.5 w-5.5" />
                        </div>
                    </CardContent>
                </Card>

                {/* Metric 3: Teacher Invigilation Duties */}
                <Card className="rounded-2xl border-border shadow-none hover:border-primary/40 transition-all duration-200 bg-card">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Duty Roster</p>
                            <p className="text-2xl font-black text-foreground">{metrics.totalDuties}</p>
                            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                                <UserCheck className="h-3 w-3 text-blue-500" /> {metrics.uniqueDutyTeachers} Teachers Assigned
                            </p>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Briefcase className="h-5.5 w-5.5" />
                        </div>
                    </CardContent>
                </Card>

                {/* Metric 4: Script Evaluation Rate */}
                <Card className="rounded-2xl border-border shadow-none hover:border-primary/40 transition-all duration-200 bg-card">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Evaluation Rate</p>
                            <p className="text-2xl font-black text-foreground">{metrics.evaluationRate}%</p>
                            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-amber-500" /> {metrics.returnedCopies} / {metrics.totalCopies} Copies
                            </p>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <FileCheck className="h-5.5 w-5.5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions Bar */}
            <div className="bg-card p-4 rounded-2xl border border-border flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-2 flex items-center gap-1.5">
                    <LayoutDashboard className="h-4 w-4 text-primary" /> Module Navigation:
                </span>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectTab?.("seatPlan")}
                    className="h-9 rounded-xl font-semibold text-xs border-border/60 hover:bg-muted gap-1.5"
                >
                    <Users className="h-3.5 w-3.5 text-primary" /> Seat Planning
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectTab?.("examDuties")}
                    className="h-9 rounded-xl font-semibold text-xs border-border/60 hover:bg-muted gap-1.5"
                >
                    <Briefcase className="h-3.5 w-3.5 text-blue-500" /> Invigilation Duties
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectTab?.("paperChecking")}
                    className="h-9 rounded-xl font-semibold text-xs border-border/60 hover:bg-muted gap-1.5"
                >
                    <FileCheck className="h-3.5 w-3.5 text-amber-500" /> Paper Checking Status
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectTab?.("rooms")}
                    className="h-9 rounded-xl font-semibold text-xs border-border/60 hover:bg-muted gap-1.5"
                >
                    <Building2 className="h-3.5 w-3.5 text-emerald-500" /> Hall Rooms Setup
                </Button>
            </div>

            {/* Grid layout for Schedule Timeline & Evaluation Progress */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Upcoming Exam Schedules Timeline (Spans 2 cols) */}
                <Card className="lg:col-span-2 rounded-2xl border-border shadow-none bg-card">
                    <CardHeader className="py-4 border-b border-border flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            <CardTitle className="text-base font-bold">Exam Schedule Timeline</CardTitle>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                            {schedules.length} Papers Scheduled
                        </Badge>
                    </CardHeader>
                    <CardContent className="p-4">
                        {loading ? (
                            <div className="py-12 text-center text-xs text-muted-foreground font-medium">Loading schedule timeline...</div>
                        ) : schedules.length === 0 ? (
                            <div className="py-12 text-center space-y-3">
                                <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                                <p className="text-xs text-muted-foreground font-medium">No exam schedules found for this exam term.</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onSelectTab?.("exams")}
                                    className="h-8 text-xs rounded-xl font-semibold"
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Exam Schedule
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {schedules.slice(0, 6).map((sched, idx) => (
                                    <div
                                        key={sched.id || idx}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border/40 hover:bg-muted/40 transition-colors gap-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary font-bold text-xs flex flex-col items-center justify-center leading-none">
                                                <span>#{idx + 1}</span>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-foreground">
                                                    {getSubjectName(sched.subject_id)}
                                                </h4>
                                                <p className="text-xs text-muted-foreground font-medium">
                                                    Class: <span className="text-foreground font-semibold">{getClassName(sched.class_id)}</span>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 text-xs">
                                            <div className="text-right sm:text-right">
                                                <div className="font-semibold text-foreground flex items-center gap-1">
                                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                                    {formatDate(sched.exam_date)}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground font-mono">
                                                    {sched.start_time} - {sched.end_time}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {schedules.length > 6 && (
                                    <p className="text-center text-xs text-muted-foreground font-medium pt-1">
                                        + {schedules.length - 6} more papers scheduled in this exam term.
                                    </p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Paper Checking & Evaluation Progress (1 col) */}
                <Card className="rounded-2xl border-border shadow-none bg-card">
                    <CardHeader className="py-4 border-b border-border flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-amber-500" />
                            <CardTitle className="text-base font-bold">Paper Evaluation Progress</CardTitle>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold text-amber-600 border-amber-500/30">
                            {metrics.evaluationRate}% Returned
                        </Badge>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        {/* Global Progress Bar */}
                        <div className="space-y-1.5 bg-muted/30 p-3.5 rounded-xl border border-border/40">
                            <div className="flex justify-between text-xs font-bold">
                                <span>Overall Completion</span>
                                <span className="text-amber-600">{metrics.returnedCopies} / {metrics.totalCopies} Copies</span>
                            </div>
                            <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, metrics.evaluationRate)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground font-medium pt-1">
                                <span>Pending: {metrics.pendingCopies} scripts</span>
                                <span>Returned: {metrics.returnedCopies} scripts</span>
                            </div>
                        </div>

                        {/* Subject Breakdown List */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject Wise Breakdown</h4>
                            {subjectBreakdown.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">No paper distributions recorded yet.</p>
                            ) : (
                                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                                    {subjectBreakdown.map((sb, idx) => {
                                        const rate = sb.total > 0 ? Math.round((sb.returned / sb.total) * 100) : 0;
                                        return (
                                            <div key={idx} className="p-2.5 rounded-xl bg-card border border-border/40 space-y-1 text-xs">
                                                <div className="flex justify-between font-semibold">
                                                    <span className="truncate">{sb.name}</span>
                                                    <span className="font-mono text-[11px]">{sb.returned}/{sb.total}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${rate === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                        style={{ width: `${rate}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <Button
                            variant="ghost"
                            onClick={() => onSelectTab?.("paperChecking")}
                            className="w-full h-9 text-xs rounded-xl font-semibold text-primary hover:bg-primary/10 gap-1"
                        >
                            Manage Paper Distributions <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                    </CardContent>
                </Card>

            </div>

            {/* Bottom Row: Invigilation Duties Overview */}
            <Card className="rounded-2xl border-border shadow-none bg-card">
                <CardHeader className="py-4 border-b border-border flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-blue-500" />
                        <CardTitle className="text-base font-bold">Invigilation Duty Summary</CardTitle>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelectTab?.("examDuties")}
                        className="h-8 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-xl"
                    >
                        View Full Duty Roster <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                </CardHeader>
                <CardContent className="p-4">
                    {duties.length === 0 ? (
                        <div className="py-8 text-center space-y-2">
                            <Briefcase className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                            <p className="text-xs text-muted-foreground font-medium">No invigilation duties assigned for this exam yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {duties.slice(0, 8).map((duty, idx) => (
                                <div key={duty.id || idx} className="p-3 rounded-xl border border-border/40 bg-muted/20 space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between">
                                        <Badge variant="outline" className="text-[10px] rounded-md font-bold border-blue-500/30 text-blue-600 dark:text-blue-400">
                                            {getRoomName(duty.room_id)}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground font-mono">{duty.exam_date ? formatDate(duty.exam_date) : "—"}</span>
                                    </div>
                                    <h5 className="font-bold text-foreground truncate">{getTeacherName(duty.teacher_id)}</h5>
                                    <p className="text-[11px] text-muted-foreground font-mono">Shift: {duty.start_time || "—"} - {duty.end_time || "—"}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
