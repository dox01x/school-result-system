"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AttendanceRecord, Class, Exam, Result, Section, Student } from "@/lib/database.types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import dynamic from "next/dynamic";
const BarChart = dynamic(() => import("recharts").then((mod) => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false });
import { toast } from "sonner";
import { Pencil, Printer, Trash2, MoveRight, TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from "lucide-react";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studentId: string | null;
    onStudentUpdated?: () => void;
    onRequestEdit?: (student: Student) => void;
    onRequestTransfer?: (student: Student) => void;
    onRequestDelete?: (student: Student) => void;
};

type MarkTrend = { exam: string; percentage: number };

type SubjectMark = {
    subjectId: string;
    subjectName: string;
    examId: string;
    total: number;
    passMark: number;
    fullMark: number;
};

type SubjectTrendRow = {
    subjectName: string;
    subjectId: string;
    marksByExam: { examId: string; total: number; passMark: number; fullMark: number; change: number | null; passed: boolean }[];
};

const dayLabels = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu"];

export function StudentProfileSheet({
    open,
    onOpenChange,
    studentId,
    onStudentUpdated,
    onRequestEdit,
    onRequestTransfer,
    onRequestDelete,
}: Props) {
    const supabase = useMemo(() => createClient() as any, []);
    const [loading, setLoading] = useState(false);
    const [student, setStudent] = useState<Student | null>(null);
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [fees, setFees] = useState<{ receipt_number: string; amount_due: number; amount_paid: number; payment_date: string | null; fee_type: string }[]>([]);
    const [subjectMarks, setSubjectMarks] = useState<SubjectMark[]>([]);
    const [actionForm, setActionForm] = useState({
        name: "",
        phone: "",
        address: "",
        father_name: "",
        mother_name: "",
        blood_group: "",
        transferClassId: "",
        transferSectionId: "",
        transferRoll: "",
    });
    const [saving, setSaving] = useState(false);
    const [transferSections, setTransferSections] = useState<Section[]>([]);

    useEffect(() => {
        if (!open || !studentId) return;
        let cancelled = false;
        setLoading(true);
        void (async () => {
            const [studentRes, classesRes, sectionsRes, examsRes] = await Promise.all([
                supabase.from("students").select("id,student_id,class_id,section_id,roll,name,gender,father_name,mother_name,date_of_birth,phone,address,blood_group,group_name,created_at").eq("id", studentId).maybeSingle(),
                supabase.from("classes").select("id,name,numeric_value,created_at").order("numeric_value"),
                supabase.from("sections").select("id,class_id,name,created_at").order("name"),
                supabase.from("exams").select("id,name,exam_type,term,created_at").order("term").order("exam_type"),
            ]);

            if (cancelled) return;
            if (studentRes.error || !studentRes.data) {
                setLoading(false);
                return;
            }

            const fetchedStudent = studentRes.data;
            setStudent(fetchedStudent);
            setClasses(classesRes.data || []);
            setSections(sectionsRes.data || []);
            setExams(examsRes.data || []);
            setActionForm((prev) => ({
                ...prev,
                name: fetchedStudent.name || "",
                phone: fetchedStudent.phone || "",
                address: fetchedStudent.address || "",
                father_name: fetchedStudent.father_name || "",
                mother_name: fetchedStudent.mother_name || "",
                blood_group: fetchedStudent.blood_group || "",
                transferClassId: fetchedStudent.class_id || "",
                transferSectionId: fetchedStudent.section_id || "",
                transferRoll: fetchedStudent.roll || "",
            }));

            const [resultRes, attendanceRes, feeRes, marksRes] = await Promise.all([
                supabase.from("results").select("id,student_id,exam_id,academic_year,total_marks,total_full_marks,percentage,gpa,grade,created_at").eq("student_id", studentId).order("created_at"),
                supabase.from("attendance_records").select("id,student_id,class_id,section_id,att_date,status,source,created_at,updated_at").eq("student_id", studentId).order("att_date", { ascending: false }),
                supabase.from("tuition_payments").select("receipt_number,amount_due,amount_paid,payment_date,fee_type").eq("student_id", studentId).order("payment_date", { ascending: false }).limit(12),
                // Fetch per-subject marks with subject details
                supabase.from("marks")
                    .select("student_id,subject_id,exam_id,total,subjects(name,pass_marks,full_marks)")
                    .eq("student_id", studentId)
                    .order("created_at"),
            ]);

            if (cancelled) return;
            setResults(resultRes.data || []);
            setAttendance(attendanceRes.data || []);
            setFees(feeRes.data || []);

            // Process marks into SubjectMark array
            const processedMarks: SubjectMark[] = (marksRes.data || []).map((m: any) => ({
                subjectId: m.subject_id,
                subjectName: (m.subjects as any)?.name || "-",
                examId: m.exam_id,
                total: Number(m.total || 0),
                passMark: Number((m.subjects as any)?.pass_marks || 33),
                fullMark: Number((m.subjects as any)?.full_marks || 100),
            }));
            setSubjectMarks(processedMarks);
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [open, studentId, supabase]);

    useEffect(() => {
        if (!actionForm.transferClassId) return;
        setTransferSections(sections.filter((s) => s.class_id === actionForm.transferClassId));
    }, [actionForm.transferClassId, sections]);

    const currentClass = classes.find((c) => c.id === student?.class_id);
    const currentSection = sections.find((s) => s.id === student?.section_id);

    const attendanceSummary = useMemo(() => {
        let present = 0;
        let absent = 0;
        const monthly: Record<string, { present: number; absent: number }> = {};
        for (const row of attendance) {
            if (row.status === "P") present += 1;
            if (row.status === "A") absent += 1;
            const month = row.att_date.slice(0, 7);
            if (!monthly[month]) monthly[month] = { present: 0, absent: 0 };
            if (row.status === "P") monthly[month].present += 1;
            if (row.status === "A") monthly[month].absent += 1;
        }
        const total = present + absent;
        return {
            present,
            absent,
            percentage: total ? Math.round((present / total) * 100) : 0,
            monthly,
        };
    }, [attendance]);

    const currentGpa = useMemo(() => {
        if (!results.length) return "0.00";
        return Math.max(...results.map((r) => r.gpa || 0)).toFixed(2);
    }, [results]);

    const trendData: MarkTrend[] = useMemo(() => {
        return results.map((r) => ({
            exam: exams.find((e) => e.id === r.exam_id)?.name || r.exam_id.slice(0, 6),
            percentage: Number(r.percentage || 0),
        }));
    }, [results, exams]);

    // Semester-over-semester progress comparison
    const progressComparison = useMemo(() => {
        if (results.length < 2) return [];
        const comparisons: { fromExam: string; toExam: string; fromPercentage: number; toPercentage: number; change: number; direction: 'up' | 'down' | 'same' }[] = [];
        for (let i = 1; i < results.length; i++) {
            const prev = results[i - 1];
            const curr = results[i];
            const prevPct = Number(prev.percentage || 0);
            const currPct = Number(curr.percentage || 0);
            const change = Math.round((currPct - prevPct) * 100) / 100;
            comparisons.push({
                fromExam: exams.find((e) => e.id === prev.exam_id)?.name || prev.exam_id.slice(0, 6),
                toExam: exams.find((e) => e.id === curr.exam_id)?.name || curr.exam_id.slice(0, 6),
                fromPercentage: prevPct,
                toPercentage: currPct,
                change,
                direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same',
            });
        }
        return comparisons;
    }, [results, exams]);

    // Subject-wise trend table data
    const subjectTrend = useMemo((): { orderedExams: { id: string; name: string }[]; rows: SubjectTrendRow[] } => {
        if (subjectMarks.length === 0) return { orderedExams: [], rows: [] };

        // Get ordered unique exams that have marks
        const examIdsInMarks = [...new Set(subjectMarks.map((m) => m.examId))];
        const orderedExams = exams
            .filter((e) => examIdsInMarks.includes(e.id))
            .map((e) => ({ id: e.id, name: e.name }));

        if (orderedExams.length === 0) return { orderedExams: [], rows: [] };

        // Get unique subjects
        const subjectMap = new Map<string, string>();
        for (const m of subjectMarks) {
            if (!subjectMap.has(m.subjectId)) {
                subjectMap.set(m.subjectId, m.subjectName);
            }
        }

        const rows: SubjectTrendRow[] = [];
        for (const [subjectId, subjectName] of subjectMap) {
            const marksByExam = orderedExams.map((exam, examIdx) => {
                const mark = subjectMarks.find((m) => m.subjectId === subjectId && m.examId === exam.id);
                const total = mark?.total ?? 0;
                const passMark = mark?.passMark ?? 33;
                const fullMark = mark?.fullMark ?? 100;
                const passed = total >= passMark;

                // Calculate change from previous exam
                let change: number | null = null;
                if (examIdx > 0) {
                    const prevExam = orderedExams[examIdx - 1];
                    const prevMark = subjectMarks.find((m) => m.subjectId === subjectId && m.examId === prevExam.id);
                    if (prevMark) {
                        change = total - prevMark.total;
                    }
                }

                return { examId: exam.id, total, passMark, fullMark, change, passed };
            });
            rows.push({ subjectName, subjectId, marksByExam });
        }

        return { orderedExams, rows };
    }, [subjectMarks, exams]);

    const pendingDue = useMemo(() => fees.reduce((sum, f) => sum + (Number(f.amount_due) - Number(f.amount_paid)), 0), [fees]);

    const handleUpdateBasic = async () => {
        if (!student) return;
        setSaving(true);
        const { error, data } = await supabase
            .from("students")
            .update({
                name: actionForm.name.trim(),
                phone: actionForm.phone.trim(),
                address: actionForm.address.trim(),
                father_name: actionForm.father_name.trim(),
                mother_name: actionForm.mother_name.trim(),
                blood_group: actionForm.blood_group.trim(),
            })
            .eq("id", student.id)
            .select("id,student_id,class_id,section_id,roll,name,gender,father_name,mother_name,date_of_birth,phone,address,blood_group,group_name,created_at")
            .single();

        if (error) {
            toast.error(error.message);
            setSaving(false);
            return;
        }

        setStudent(data);
        setSaving(false);
        onStudentUpdated?.();
        toast.success("Student profile updated");
    };

    const handleTransferInline = async () => {
        if (!student) return;
        if (!actionForm.transferClassId || !actionForm.transferSectionId || !actionForm.transferRoll.trim()) {
            toast.error("Select class, section and roll");
            return;
        }
        setSaving(true);
        const { error } = await supabase
            .from("students")
            .update({
                class_id: actionForm.transferClassId,
                section_id: actionForm.transferSectionId,
                roll: actionForm.transferRoll.trim(),
            })
            .eq("id", student.id);
        setSaving(false);
        if (error) {
            toast.error(error.message);
            return;
        }
        toast.success("Student transferred");
        onStudentUpdated?.();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[96vw] sm:max-w-[900px] p-0 gap-0 overflow-hidden bg-background">
                <DialogHeader className="border-b border-border/50 bg-muted/30 p-6">
                    <DialogTitle className="text-xl">Student Profile</DialogTitle>
                    <DialogDescription>Detailed profile, academics, progress analysis, attendance and actions.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[80vh] h-[800px]">
                    {loading || !student ? (
                        <div className="p-6 text-sm text-muted-foreground">Loading profile...</div>
                    ) : (
                        <div className="p-6 space-y-6">
                            <div className="rounded-2xl border-0 bg-muted/50 p-5">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-4">
                                        <div className="h-16 w-16 rounded-2xl bg-muted text-foreground flex items-center justify-center text-2xl font-bold">
                                            {student.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-semibold text-foreground">{student.name}</h3>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-lg font-medium">Roll {student.roll}</Badge>
                                                <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-lg font-medium">{currentClass?.name || "-"}</Badge>
                                                <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-lg font-medium">{currentSection?.name || "-"}</Badge>
                                                {student.student_id && <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-lg font-medium">{student.student_id}</Badge>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" className="border-0 bg-muted hover:bg-muted/80 text-foreground"><Printer className="h-4 w-4 mr-1" strokeWidth={1.2} />Print ID</Button>
                                        <Button size="sm" variant="outline" className="border-0 bg-muted hover:bg-muted/80 text-foreground" onClick={() => onRequestTransfer?.(student)}><MoveRight className="h-4 w-4 mr-1" strokeWidth={1.2} />Transfer</Button>
                                        <Button size="sm" onClick={() => onRequestEdit?.(student)}><Pencil className="h-4 w-4 mr-1" strokeWidth={1.2} />Edit</Button>
                                    </div>
                                </div>
                            </div>

                            <Tabs defaultValue="overview" className="space-y-4">
                                <TabsList className="w-full justify-start overflow-x-auto bg-muted border-0 rounded-xl p-1">
                                    <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Overview</TabsTrigger>
                                    <TabsTrigger value="academic" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Academic</TabsTrigger>
                                    <TabsTrigger value="attendance" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Attendance</TabsTrigger>
                                    <TabsTrigger value="fees" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Fees</TabsTrigger>
                                    <TabsTrigger value="actions" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Actions</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Card>
                                            <CardHeader><CardTitle className="text-sm">Personal & Parent Info</CardTitle></CardHeader>
                                            <CardContent className="grid grid-cols-2 gap-4 text-sm">
                                                <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Gender</p><p className="font-medium">{student.gender || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">DOB</p><p className="font-medium">{student.date_of_birth || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Father</p><p className="font-medium">{student.father_name || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Mother</p><p className="font-medium">{student.mother_name || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Phone</p><p className="font-medium">{student.phone || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Blood Group</p><p className="font-medium">{student.blood_group || "-"}</p></div>
                                                <div className="col-span-2"><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Address</p><p className="font-medium">{student.address || "-"}</p></div>
                                            </CardContent>
                                        </Card>
                                        <div className="grid gap-4">
                                            <Card><CardContent className="p-5 flex flex-col justify-center h-full"><p className="text-sm font-medium text-muted-foreground mb-2">Attendance %</p><p className="text-4xl font-bold text-foreground">{attendanceSummary.percentage}%</p></CardContent></Card>
                                            <Card><CardContent className="p-5 flex flex-col justify-center h-full"><p className="text-sm font-medium text-muted-foreground mb-2">Current GPA</p><p className="text-4xl font-bold text-foreground">{currentGpa}</p></CardContent></Card>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="academic" className="space-y-4">
                                    {/* Performance Trend Chart */}
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Performance Trend</CardTitle></CardHeader>
                                        <CardContent className="h-64">
                                            {trendData.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">No results found.</p>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={trendData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                        <XAxis dataKey="exam" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                                                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                                                        <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                                        <Bar dataKey="percentage" fill="#18181b" radius={[6, 6, 0, 0]} barSize={40} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Semester Progress Comparison */}
                                    {progressComparison.length > 0 && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    <TrendingUp size={16} strokeWidth={1.5} className="text-muted-foreground" />
                                                    Semester Progress Comparison
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                {progressComparison.map((comp, idx) => (
                                                    <div key={idx} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-center">
                                                                    <p className="text-xs text-muted-foreground font-medium mb-1">{comp.fromExam}</p>
                                                                    <p className="text-lg font-bold text-foreground">{comp.fromPercentage.toFixed(1)}%</p>
                                                                </div>
                                                                <div className="flex items-center gap-1 px-3">
                                                                    {comp.direction === 'up' && <ArrowUp size={20} className="text-emerald-600" />}
                                                                    {comp.direction === 'down' && <ArrowDown size={20} className="text-red-600" />}
                                                                    {comp.direction === 'same' && <Minus size={20} className="text-gray-400" />}
                                                                </div>
                                                                <div className="text-center">
                                                                    <p className="text-xs text-muted-foreground font-medium mb-1">{comp.toExam}</p>
                                                                    <p className="text-lg font-bold text-foreground">{comp.toPercentage.toFixed(1)}%</p>
                                                                </div>
                                                            </div>
                                                            <Badge
                                                                variant="secondary"
                                                                className={`border-0 rounded-lg font-bold text-sm px-3 py-1.5 ${
                                                                    comp.direction === 'up'
                                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                                        : comp.direction === 'down'
                                                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                                                }`}
                                                            >
                                                                {comp.direction === 'up' ? '▲' : comp.direction === 'down' ? '▼' : '●'}{' '}
                                                                {comp.change > 0 ? '+' : ''}{comp.change.toFixed(1)}%
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                ))}
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Subject-wise Trend Table */}
                                    {subjectTrend.orderedExams.length > 0 && subjectTrend.rows.length > 0 && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-sm">Subject-wise Marks Across Exams</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="font-semibold min-w-[120px]">Subject</TableHead>
                                                                {subjectTrend.orderedExams.map((exam) => (
                                                                    <TableHead key={exam.id} className="text-center font-semibold min-w-[100px]">{exam.name}</TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {subjectTrend.rows.map((row) => (
                                                                <TableRow key={row.subjectId}>
                                                                    <TableCell className="font-medium text-foreground">{row.subjectName}</TableCell>
                                                                    {row.marksByExam.map((mark, idx) => (
                                                                        <TableCell key={`${row.subjectId}-${idx}`} className="text-center">
                                                                            {mark.total > 0 ? (
                                                                                <div className="flex flex-col items-center gap-0.5">
                                                                                    <span className={`font-bold text-sm ${mark.passed ? 'text-foreground' : 'text-red-600 dark:text-red-400'}`}>
                                                                                        {mark.total}
                                                                                    </span>
                                                                                    {mark.change !== null && (
                                                                                        <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${
                                                                                            mark.change > 0
                                                                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                                                                : mark.change < 0
                                                                                                ? 'text-red-600 dark:text-red-400'
                                                                                                : 'text-gray-400'
                                                                                        }`}>
                                                                                            {mark.change > 0 ? (
                                                                                                <><TrendingUp size={10} />+{mark.change}</>
                                                                                            ) : mark.change < 0 ? (
                                                                                                <><TrendingDown size={10} />{mark.change}</>
                                                                                            ) : (
                                                                                                <><Minus size={10} />0</>
                                                                                            )}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-muted-foreground text-xs">—</span>
                                                                            )}
                                                                        </TableCell>
                                                                    ))}
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Exam History */}
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Exam History</CardTitle></CardHeader>
                                        <CardContent className="space-y-3">
                                            {results.length === 0 && <p className="text-sm text-muted-foreground">No exam records.</p>}
                                            {results.map((r) => (
                                                <div key={r.id} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                                                    <div>
                                                        <p className="font-semibold text-foreground">{exams.find((e) => e.id === r.exam_id)?.name || r.exam_id}</p>
                                                        <p className="text-xs text-muted-foreground font-medium">Year {r.academic_year}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-base font-bold text-foreground">{Number(r.percentage).toFixed(2)}%</p>
                                                        <p className="text-xs text-muted-foreground font-medium">GPA {Number(r.gpa).toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="attendance" className="space-y-4">
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <Card><CardContent className="p-5"><p className="text-sm font-medium text-muted-foreground mb-2">Present</p><p className="text-3xl font-bold text-foreground">{attendanceSummary.present}</p></CardContent></Card>
                                        <Card><CardContent className="p-5"><p className="text-sm font-medium text-muted-foreground mb-2">Absent</p><p className="text-3xl font-bold text-foreground">{attendanceSummary.absent}</p></CardContent></Card>
                                        <Card><CardContent className="p-5"><p className="text-sm font-medium text-muted-foreground mb-2">Rate</p><p className="text-3xl font-bold text-foreground">{attendanceSummary.percentage}%</p></CardContent></Card>
                                    </div>
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Monthly Breakdown</CardTitle></CardHeader>
                                        <CardContent className="space-y-3">
                                            {Object.entries(attendanceSummary.monthly).sort((a, b) => b[0].localeCompare(a[0])).map(([month, v]) => (
                                                <div key={month} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                                                    <span className="font-medium text-foreground">{month}</span>
                                                    <span className="text-sm font-medium"><span className="text-muted-foreground">P: {v.present}</span> <span className="text-muted-foreground/40 mx-1">|</span> <span className="text-muted-foreground">A: {v.absent}</span></span>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="fees" className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Financial Snapshot</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-4">
                                            <div className="rounded-xl border-0 bg-muted p-5">
                                                <p className="text-sm font-medium text-muted-foreground mb-1">Pending Dues</p>
                                                <p className="text-3xl font-bold text-foreground">{pendingDue.toFixed(2)}</p>
                                            </div>
                                            <div className="rounded-xl border-0 bg-muted p-5">
                                                <p className="text-sm font-medium text-muted-foreground mb-1">Recent Payments</p>
                                                <p className="text-3xl font-bold text-foreground">{fees.length}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Fee Payment History</CardTitle></CardHeader>
                                        <CardContent className="space-y-3">
                                            {fees.length === 0 && <p className="text-sm text-muted-foreground">No fee history.</p>}
                                            {fees.map((f) => (
                                                <div key={f.receipt_number} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                                                    <div>
                                                        <p className="text-base font-semibold text-foreground">{f.fee_type}</p>
                                                        <p className="text-xs text-muted-foreground font-medium mt-0.5">{f.receipt_number}</p>
                                                    </div>
                                                    <div className="text-right text-sm">
                                                        <p className="font-bold text-foreground">Paid: {Number(f.amount_paid).toFixed(2)}</p>
                                                        <p className="text-xs text-muted-foreground font-medium mt-0.5">{f.payment_date || "-"}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="actions" className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Inline Update</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-4">
                                            <div className="space-y-1"><Label>Name</Label><Input value={actionForm.name} onChange={(e) => setActionForm((p) => ({ ...p, name: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Phone</Label><Input value={actionForm.phone} onChange={(e) => setActionForm((p) => ({ ...p, phone: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Father Name</Label><Input value={actionForm.father_name} onChange={(e) => setActionForm((p) => ({ ...p, father_name: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Mother Name</Label><Input value={actionForm.mother_name} onChange={(e) => setActionForm((p) => ({ ...p, mother_name: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Blood Group</Label><Input value={actionForm.blood_group} onChange={(e) => setActionForm((p) => ({ ...p, blood_group: e.target.value }))} /></div>
                                            <div className="md:col-span-2 space-y-1"><Label>Address</Label><Input value={actionForm.address} onChange={(e) => setActionForm((p) => ({ ...p, address: e.target.value }))} /></div>
                                            <div className="md:col-span-2 mt-2"><Button onClick={handleUpdateBasic} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button></div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Section Transfer Workflow</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-3 gap-4">
                                            <div className="space-y-1">
                                                <Label>Class</Label>
                                                <Select value={actionForm.transferClassId} onValueChange={(v) => setActionForm((p) => ({ ...p, transferClassId: v, transferSectionId: "" }))}>
                                                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                                                    <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label>Section</Label>
                                                <Select value={actionForm.transferSectionId} onValueChange={(v) => setActionForm((p) => ({ ...p, transferSectionId: v }))}>
                                                    <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                                                    <SelectContent>{transferSections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label>New Roll</Label>
                                                <Input value={actionForm.transferRoll} onChange={(e) => setActionForm((p) => ({ ...p, transferRoll: e.target.value }))} />
                                            </div>
                                            <div className="md:col-span-3 mt-2"><Button variant="outline" onClick={handleTransferInline} disabled={saving}>{saving ? "Processing..." : "Transfer Student"}</Button></div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-red-200 bg-red-50/30">
                                        <CardHeader><CardTitle className="text-sm text-red-600">Danger Zone</CardTitle></CardHeader>
                                        <CardContent className="flex gap-2">
                                            <Button variant="destructive" onClick={() => onRequestDelete?.(student)}><Trash2 className="h-4 w-4 mr-1" strokeWidth={1.2} />Delete Student</Button>
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
