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
import { Pencil, Printer, Trash2, MoveRight, TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, FileText } from "lucide-react";
import { printHtml } from "@/lib/print-utils";

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

type ExamCategory = "mct" | "semester" | "standalone" | "semesterAndStandalone";

type CategoryComparison = {
    category: ExamCategory;
    categoryLabel: string;
    fromExam: string;
    toExam: string;
    fromPercentage: number;
    toPercentage: number;
    changePercentage: number;
    fromTotalMarks: number;
    toTotalMarks: number;
    changeTotalMarks: number;
    direction: "up" | "down" | "same";
};

const getExamCategory = (exam?: Exam | null): ExamCategory => {
    if (!exam) return "standalone";
    if (exam.exam_type === "mct") return "mct";
    if (exam.exam_type === "semester") return "semester";
    if (exam.exam_type === "standalone") return "standalone";
    const nameLower = (exam.name || "").toLowerCase();
    if (nameLower.includes("mct") || nameLower.includes("monthly")) return "mct";
    if (nameLower.includes("semester")) return "semester";
    return "standalone";
};

export function StudentProfileSheet({
    open,
    onOpenChange,
    studentId,
    onStudentUpdated,
    onRequestEdit,
    onRequestTransfer,
    onRequestDelete,
}: Props) {
    const supabase = createClient();
    const [loading, setLoading] = useState(false);
    const [student, setStudent] = useState<Student | null>(null);
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [fees, setFees] = useState<{ receipt_number: string; amount_due: number; amount_paid: number; payment_date: string | null; fee_type: string }[]>([]);
    const [subjectMarks, setSubjectMarks] = useState<SubjectMark[]>([]);
    const [schoolInfo, setSchoolInfo] = useState<{ name?: string; address?: string; phone?: string; email?: string; logo_url?: string; principal_name?: string } | null>(null);
    const [selectedCategoryTab, setSelectedCategoryTab] = useState<ExamCategory | "all">("all");
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
            const [studentRes, classesRes, sectionsRes, examsRes, schoolRes] = await Promise.all([
                supabase.from("students").select("id,student_id,class_id,section_id,roll,name,gender,father_name,mother_name,date_of_birth,phone,address,blood_group,group_name,created_at").eq("id", studentId).maybeSingle(),
                supabase.from("classes").select("id,name,numeric_value,created_at").order("numeric_value"),
                supabase.from("sections").select("id,class_id,name,created_at").order("name"),
                supabase.from("exams").select("id,name,exam_type,term,created_at").order("term").order("exam_type"),
                supabase.from("school_info").select("*").limit(1).maybeSingle(),
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
            if (schoolRes.data) setSchoolInfo(schoolRes.data);

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
                supabase.from("marks")
                    .select("student_id,subject_id,exam_id,total,subjects(name,pass_marks,full_marks)")
                    .eq("student_id", studentId)
                    .order("created_at"),
            ]);

            if (cancelled) return;
            setResults(resultRes.data || []);
            setAttendance(attendanceRes.data || []);
            setFees(feeRes.data || []);

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
    }, [open, studentId]);

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

    const allExamResults = useMemo(() => {
        const list: {
            id: string;
            student_id: string;
            exam_id: string;
            percentage: number;
            total_marks: number;
            total_full_marks: number;
            created_at?: string;
        }[] = [];

        const processedExamIds = new Set<string>();

        const sortedExams = [...exams].sort((a, b) => {
            const termA = a.term ?? 99;
            const termB = b.term ?? 99;
            if (termA !== termB) return termA - termB;
            const typeWeight = (type?: string) => (type === "mct" ? 1 : type === "semester" ? 2 : 3);
            return typeWeight(a.exam_type) - typeWeight(b.exam_type);
        });

        for (const exam of sortedExams) {
            const existingRes = results.find((r) => r.exam_id === exam.id);
            if (existingRes) {
                list.push({
                    id: existingRes.id,
                    student_id: existingRes.student_id,
                    exam_id: existingRes.exam_id,
                    percentage: Number(existingRes.percentage || 0),
                    total_marks: Number(existingRes.total_marks || 0),
                    total_full_marks: Number(existingRes.total_full_marks || 0),
                    created_at: existingRes.created_at,
                });
                processedExamIds.add(exam.id);
            } else {
                const examMarks = subjectMarks.filter((m) => m.examId === exam.id);
                if (examMarks.length > 0) {
                    const total_marks = examMarks.reduce((s, m) => s + m.total, 0);
                    const total_full_marks = examMarks.reduce((s, m) => s + m.fullMark, 0);
                    const percentage = total_full_marks > 0 ? Number(((total_marks / total_full_marks) * 100).toFixed(2)) : 0;
                    list.push({
                        id: `marks-${exam.id}`,
                        student_id: studentId || "",
                        exam_id: exam.id,
                        percentage,
                        total_marks,
                        total_full_marks,
                    });
                    processedExamIds.add(exam.id);
                }
            }
        }

        for (const r of results) {
            if (!processedExamIds.has(r.exam_id)) {
                list.push({
                    id: r.id,
                    student_id: r.student_id,
                    exam_id: r.exam_id,
                    percentage: Number(r.percentage || 0),
                    total_marks: Number(r.total_marks || 0),
                    total_full_marks: Number(r.total_full_marks || 0),
                    created_at: r.created_at,
                });
                processedExamIds.add(r.exam_id);
            }
        }

        return list;
    }, [results, subjectMarks, exams, studentId]);

    const trendData: MarkTrend[] = useMemo(() => {
        const filteredResults = allExamResults.filter((r) => {
            if (selectedCategoryTab === "all") return true;
            const exam = exams.find((e) => e.id === r.exam_id);
            const cat = getExamCategory(exam);
            if (selectedCategoryTab === "semesterAndStandalone") {
                return cat === "semester" || cat === "standalone";
            }
            return cat === selectedCategoryTab;
        });

        return filteredResults.map((r) => ({
            exam: exams.find((e) => e.id === r.exam_id)?.name || r.exam_id.slice(0, 6),
            percentage: Number(r.percentage || 0),
        }));
    }, [allExamResults, exams, selectedCategoryTab]);

    // Categorized progress comparisons (MCT, Semester, Standalone, and Semester vs Standalone)
    const categorizedComparisons = useMemo(() => {
        const categories: { key: ExamCategory; label: string }[] = [
            { key: "mct", label: "MCT vs MCT Comparison" },
            { key: "semester", label: "Semester vs Semester Comparison" },
            { key: "standalone", label: "Standalone Exams Comparison" },
            { key: "semesterAndStandalone", label: "Semester & Standalone Comparison" },
        ];

        const res: Record<ExamCategory, CategoryComparison[]> = {
            mct: [],
            semester: [],
            standalone: [],
            semesterAndStandalone: [],
        };

        for (const cat of categories) {
            let catResults = allExamResults.filter((r) => {
                const exam = exams.find((e) => e.id === r.exam_id);
                const c = getExamCategory(exam);
                if (cat.key === "semesterAndStandalone") {
                    return c === "semester" || c === "standalone";
                }
                return c === cat.key;
            });

            if (catResults.length < 2) continue;

            for (let i = 1; i < catResults.length; i++) {
                const prev = catResults[i - 1];
                const curr = catResults[i];
                const prevPct = Number(prev.percentage || 0);
                const currPct = Number(curr.percentage || 0);
                const changePct = Number((currPct - prevPct).toFixed(2));

                const prevMarks = Number(prev.total_marks || 0);
                const currMarks = Number(curr.total_marks || 0);
                const changeMarks = Number((currMarks - prevMarks).toFixed(2));

                const prevExam = exams.find((e) => e.id === prev.exam_id);
                const currExam = exams.find((e) => e.id === curr.exam_id);

                res[cat.key].push({
                    category: cat.key,
                    categoryLabel: cat.label,
                    fromExam: prevExam?.name || prev.exam_id.slice(0, 6),
                    toExam: currExam?.name || curr.exam_id.slice(0, 6),
                    fromPercentage: prevPct,
                    toPercentage: currPct,
                    changePercentage: changePct,
                    fromTotalMarks: prevMarks,
                    toTotalMarks: currMarks,
                    changeTotalMarks: changeMarks,
                    direction: changePct > 0 ? "up" : changePct < 0 ? "down" : "same",
                });
            }
        }

        return res;
    }, [allExamResults, exams]);

    // Categorized Subject Trends
    const categorizedSubjectTrends = useMemo(() => {
        const categories: { key: ExamCategory; label: string }[] = [
            { key: "mct", label: "MCT Exams" },
            { key: "semester", label: "Semester Exams" },
            { key: "standalone", label: "Standalone Exams" },
            { key: "semesterAndStandalone", label: "Semester & Standalone Exams" },
        ];

        const trendMap: Record<ExamCategory, { orderedExams: { id: string; name: string }[]; rows: SubjectTrendRow[] }> = {
            mct: { orderedExams: [], rows: [] },
            semester: { orderedExams: [], rows: [] },
            standalone: { orderedExams: [], rows: [] },
            semesterAndStandalone: { orderedExams: [], rows: [] },
        };

        if (subjectMarks.length === 0) return trendMap;

        const subjectMap = new Map<string, string>();
        for (const m of subjectMarks) {
            if (!subjectMap.has(m.subjectId)) {
                subjectMap.set(m.subjectId, m.subjectName);
            }
        }

        for (const cat of categories) {
            const catExams = exams.filter((e) => {
                const c = getExamCategory(e);
                if (cat.key === "semesterAndStandalone") {
                    return c === "semester" || c === "standalone";
                }
                return c === cat.key;
            });
            const examIdsInMarks = [...new Set(subjectMarks.map((m) => m.examId))];
            const orderedExams = catExams
                .filter((e) => examIdsInMarks.includes(e.id))
                .map((e) => ({ id: e.id, name: e.name }));

            if (orderedExams.length === 0) continue;

            const rows: SubjectTrendRow[] = [];
            for (const [subjectId, subjectName] of subjectMap) {
                const marksByExam = orderedExams.map((exam, examIdx) => {
                    const mark = subjectMarks.find((m) => m.subjectId === subjectId && m.examId === exam.id);
                    const total = mark?.total ?? 0;
                    const passMark = mark?.passMark ?? 33;
                    const fullMark = mark?.fullMark ?? 100;
                    const passed = total >= passMark;

                    let change: number | null = null;
                    if (examIdx > 0) {
                        const prevExam = orderedExams[examIdx - 1];
                        const prevMark = subjectMarks.find((m) => m.subjectId === subjectId && m.examId === prevExam.id);
                        if (prevMark) {
                            change = Number((total - prevMark.total).toFixed(2));
                        }
                    }

                    return { examId: exam.id, total, passMark, fullMark, change, passed };
                });
                rows.push({ subjectName, subjectId, marksByExam });
            }

            trendMap[cat.key] = { orderedExams, rows };
        }

        return trendMap;
    }, [subjectMarks, exams]);

    // Global Subject Trend (All Exams)
    const subjectTrend = useMemo((): { orderedExams: { id: string; name: string }[]; rows: SubjectTrendRow[] } => {
        if (subjectMarks.length === 0) return { orderedExams: [], rows: [] };

        const examIdsInMarks = [...new Set(subjectMarks.map((m) => m.examId))];
        const orderedExams = exams
            .filter((e) => examIdsInMarks.includes(e.id))
            .map((e) => ({ id: e.id, name: e.name }));

        if (orderedExams.length === 0) return { orderedExams: [], rows: [] };

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

                let change: number | null = null;
                if (examIdx > 0) {
                    const prevExam = orderedExams[examIdx - 1];
                    const prevMark = subjectMarks.find((m) => m.subjectId === subjectId && m.examId === prevExam.id);
                    if (prevMark) {
                        change = Number((total - prevMark.total).toFixed(2));
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

    // Elevated Print Academic Performance Report Generator (Dynamic based on selected mode)
    const handlePrintReport = (mode?: ExamCategory | "all") => {
        if (!student) return;
        const printMode = mode || selectedCategoryTab;

        const schoolName = schoolInfo?.name || "School Result System";
        const schoolAddress = schoolInfo?.address || "";
        const schoolPhone = schoolInfo?.phone || "";

        let reportTitle = "STUDENT ACADEMIC PERFORMANCE REPORT";

        const renderComparisonTableHTML = (title: string, list: CategoryComparison[]) => {
            if (list.length === 0) return "";
            const rowsHTML = list
                .map((comp, i) => {
                    const pctSign = comp.changePercentage > 0 ? "+" : "";
                    const markSign = comp.changeTotalMarks > 0 ? "+" : "";
                    const badgeClass = comp.direction === "up" ? "badge-up" : comp.direction === "down" ? "badge-down" : "badge-same";
                    const arrow = comp.direction === "up" ? "▲" : comp.direction === "down" ? "▼" : "●";
                    const rowClass = i % 2 === 0 ? "e" : "o";

                    return `
                        <tr class="${rowClass}">
                            <td class="left"><strong>${comp.fromExam}</strong> → <strong>${comp.toExam}</strong></td>
                            <td>${comp.fromPercentage.toFixed(2)}%</td>
                            <td>${comp.toPercentage.toFixed(2)}%</td>
                            <td><span class="${badgeClass}">${arrow} ${pctSign}${comp.changePercentage.toFixed(2)}%</span></td>
                            <td><strong>${markSign}${comp.changeTotalMarks.toFixed(2)}</strong> Marks</td>
                        </tr>
                    `;
                })
                .join("");

            return `
                <div class="sec-hdr">${title}</div>
                <table class="mtbl">
                    <thead>
                        <tr>
                            <th class="left">Exam Transition</th>
                            <th>Previous %</th>
                            <th>Current %</th>
                            <th>Percentage Difference</th>
                            <th>Marks Difference</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML}
                    </tbody>
                </table>
            `;
        };

        const renderSubjectTrendHTML = (trendObj: { orderedExams: { id: string; name: string }[]; rows: SubjectTrendRow[] }) => {
            if (trendObj.orderedExams.length === 0 || trendObj.rows.length === 0) return "";

            const headerHTML = trendObj.orderedExams
                .map((e) => `<th>${e.name}</th>`)
                .join("");

            const rowsHTML = trendObj.rows
                .map((row, i) => {
                    const rowClass = i % 2 === 0 ? "e" : "o";
                    const cellsHTML = row.marksByExam
                        .map((m) => {
                            if (m.total <= 0) return `<td class="text-muted">—</td>`;
                            let changeBadge = "";
                            if (m.change !== null) {
                                const sign = m.change > 0 ? "+" : "";
                                const badgeClass = m.change > 0 ? "badge-up" : m.change < 0 ? "badge-down" : "badge-same";
                                const arrow = m.change > 0 ? "▲" : m.change < 0 ? "▼" : "●";
                                changeBadge = `<br/><span class="${badgeClass}">${arrow} ${sign}${m.change.toFixed(2)}</span>`;
                            }
                            return `<td><strong>${m.total}</strong>${changeBadge}</td>`;
                        })
                        .join("");

                    return `
                        <tr class="${rowClass}">
                            <td class="left"><strong>${row.subjectName}</strong></td>
                            ${cellsHTML}
                        </tr>
                    `;
                })
                .join("");

            return `
                <div class="sec-hdr">Subject-wise Marks & Mark Differences</div>
                <table class="mtbl">
                    <thead>
                        <tr>
                            <th class="left">Subject</th>
                            ${headerHTML}
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML}
                    </tbody>
                </table>
            `;
        };

        let comparisonHTML = "";
        if (printMode === "all") {
            comparisonHTML += renderComparisonTableHTML("Previous MCT Exams Performance Comparison", categorizedComparisons.mct);
            comparisonHTML += renderComparisonTableHTML("Previous Exam Performance Comparison", categorizedComparisons.semesterAndStandalone);
        } else if (printMode === "mct") {
            comparisonHTML += renderComparisonTableHTML("Previous MCT Exams Performance Comparison", categorizedComparisons.mct);
        } else if (printMode === "semesterAndStandalone") {
            comparisonHTML += renderComparisonTableHTML("Previous Exam Performance Comparison", categorizedComparisons.semesterAndStandalone);
        } else if (printMode === "semester") {
            comparisonHTML += renderComparisonTableHTML("Previous Semester Exams Performance Comparison", categorizedComparisons.semester);
        } else if (printMode === "standalone") {
            comparisonHTML += renderComparisonTableHTML("Previous Standalone Exams Performance Comparison", categorizedComparisons.standalone);
        }
        const activeTrend = printMode === "all" ? subjectTrend : categorizedSubjectTrends[printMode];
        const totalRowsCount = activeTrend.rows.length;
        const subjectHTML = renderSubjectTrendHTML(activeTrend);

        let tblFontSize = "12px";
        let tblCellPadding = "4px 6px";
        let sigsMarginTop = "20px";
        let secHdrMargin = "10px 0 5px 0";
        let stblPadding = "6px 5px";

        if (totalRowsCount <= 8) {
            tblFontSize = "12.5px";
            tblCellPadding = "6.5px 7px";
            sigsMarginTop = "32px";
            secHdrMargin = "12px 0 6px 0";
            stblPadding = "7.5px 6px";
        } else if (totalRowsCount <= 12) {
            tblFontSize = "12px";
            tblCellPadding = "4.5px 6px";
            sigsMarginTop = "24px";
            secHdrMargin = "10px 0 5px 0";
            stblPadding = "6px 5px";
        } else {
            // 13+ subjects (e.g. 14 subjects)
            tblFontSize = "11.5px";
            tblCellPadding = "3px 6px";
            sigsMarginTop = "16px";
            secHdrMargin = "8px 0 4px 0";
            stblPadding = "5px 4px";
        }

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Academic Report - ${student.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
@page { size: A4 portrait; margin: 3mm 5mm; }
body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-family: 'Poppins', sans-serif; color: #1e293b; font-size: 12px; background: #fff; margin: 0; padding: 0; }
.pg { max-width: 750px; margin: 0 auto; padding: 3mm 5mm; box-sizing: border-box; page-break-inside: avoid !important; break-inside: avoid !important; }
.tb { border-top: 3px double #1a365d; border-bottom: 1.5px solid #1a365d; height: 3px; margin-bottom: 5px; }
.bb { border-top: 1.5px solid #1a365d; border-bottom: 3px double #1a365d; height: 3px; margin-top: 10px; }

.hdr { text-align: center; margin-bottom: 5px; }
.hdr img { height: 38px; margin: 0 auto 2px; display: block; }
.hdr h1 { font-size: 19px; font-weight: 700; color: #1e3a5f; letter-spacing: 0.5px; margin: 0; }
.hdr .ad { font-size: 10px; color: #64748b; margin-top: 1px; }

.tbar { background: #f0f5ff !important; color: #1e3a5f !important; border: 1px solid #cbd5e1; text-align: center; padding: 4px 8px; margin: 5px 0 7px 0; border-radius: 6px; }
.tbar h2 { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin: 0; color: #1e3a5f !important; }
.tbar .sub { font-size: 9.5px; color: #64748b !important; margin-top: 1px; }

.itbl { width: 100%; border-collapse: collapse; margin-bottom: 7px; font-size: 11.5px; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; background: #f8fafc; }
.itbl td { padding: 3.5px 7px; border: 1px solid #cbd5e1; }
.itbl .lb { color: #64748b; font-weight: 600; width: 22%; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.5px; }
.itbl .vl { font-weight: 700; width: 28%; color: #0f172a; font-size: 11.5px; }

.stbl { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 7px; font-size: 11.5px; border-radius: 4px; overflow: hidden; }
.stbl td { padding: ${stblPadding}; text-align: center; background: #f0f5ff !important; border-right: 1px solid #cbd5e1; }
.stbl td:last-child { border-right: none; }
.stbl .sl { font-size: 9.5px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
.stbl .sv { font-size: 15px; font-weight: 800; color: #1e3a5f; margin-top: 1px; }

.sec-hdr { font-size: 11.5px; font-weight: 800; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.5px; margin: ${secHdrMargin}; border-left: 3px solid #2563eb; padding-left: 6px; }

.mtbl { width: 100%; border-collapse: collapse; margin-bottom: 7px; font-size: ${tblFontSize}; border: 1px solid #cbd5e1; page-break-inside: avoid !important; break-inside: avoid !important; }
.mtbl th { background: #e8edf5 !important; color: #1e3a5f !important; padding: ${tblCellPadding}; border: 1px solid #cbd5e1; text-align: center; font-weight: 700; font-size: ${tblFontSize}; text-transform: uppercase; }
.mtbl th.left { text-align: left; }
.mtbl td { padding: ${tblCellPadding}; border: 1px solid #cbd5e1; text-align: center; color: #334155; font-size: ${tblFontSize}; }
.mtbl td.left { text-align: left; }
.mtbl tr.e { background: #ffffff !important; }
.mtbl tr.o { background: #f8fafc !important; }
.mtbl .text-muted { color: #94a3b8; }

.badge-up { background: #dcfce7 !important; color: #15803d !important; font-weight: 700; padding: 1px 4px; border-radius: 3px; display: inline-block; font-size: 9px; }
.badge-down { background: #fee2e2 !important; color: #b91c1c !important; font-weight: 700; padding: 1px 4px; border-radius: 3px; display: inline-block; font-size: 9px; }
.badge-same { background: #f1f5f9 !important; color: #475569 !important; font-weight: 700; padding: 1px 4px; border-radius: 3px; display: inline-block; font-size: 9px; }

.sigs { width: 100%; table-layout: fixed; margin-top: ${sigsMarginTop}; border-collapse: collapse; page-break-inside: avoid !important; break-inside: avoid !important; }
.sigs td { text-align: center; vertical-align: top; }
.sigb { width: 140px; margin: 0 auto; border-top: 1.5px solid #334155; padding-top: 3px; font-size: 10.5px; font-weight: 700; color: #334155; text-transform: uppercase; }
</style></head><body><div class="pg">
<div class="tb"></div>
<div class="hdr">
${schoolInfo?.logo_url ? `<img src="${schoolInfo.logo_url}" alt="Logo">` : ""}
<h1>${schoolName}</h1>
${schoolAddress ? `<div class="ad">${schoolAddress} ${schoolPhone ? `| Phone: ${schoolPhone}` : ""}</div>` : ""}
</div>

<div class="tbar">
<h2>${reportTitle}</h2>
<div class="sub">Academic Year: ${new Date().getFullYear()} | Issued on: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</div>
</div>

<table class="itbl">
<tr><td class="lb">Student Name</td><td class="vl">${student.name}</td><td class="lb">Class / Sec</td><td class="vl">${currentClass?.name || "-"} (${currentSection?.name || "-"})</td></tr>
<tr><td class="lb">Roll Number</td><td class="vl">${student.roll}</td><td class="lb">Student ID</td><td class="vl">${student.student_id || "-"}</td></tr>
</table>

<table class="stbl">
<tr>
<td style="width:25%"><div class="sl">Current GPA</div><div class="sv">${currentGpa}</div></td>
<td style="width:25%"><div class="sl">Attendance Rate</div><div class="sv">${attendanceSummary.percentage}%</div></td>
<td style="width:25%"><div class="sl">Exams Evaluated</div><div class="sv">${results.length}</div></td>
<td style="width:25%"><div class="sl">Status</div><div class="sv" style="color:#16a34a">ACTIVE</div></td>
</tr>
</table>

${comparisonHTML}
${subjectHTML}

<table class="sigs">
<tr>
<td><div class="sigb">Class Teacher</div></td>
<td><div class="sigb">Exam Controller</div></td>
<td><div class="sigb">Principal</div></td>
</tr>
</table>
<div class="bb"></div></div></body></html>`;

        printHtml(html);
    };

    const formatDeltaBadge = (change: number, suffix: string = "%") => {
        const isUp = change > 0;
        const isDown = change < 0;
        const sign = isUp ? "+" : "";
        const formatted = `${sign}${change.toFixed(2)}${suffix}`;

        return (
            <Badge
                variant="secondary"
                className={`border-0 rounded-lg font-bold text-xs px-2.5 py-1 ${
                    isUp
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : isDown
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
            >
                {isUp ? "▲ " : isDown ? "▼ " : "● "}
                {formatted}
            </Badge>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[96vw] sm:max-w-[900px] p-0 gap-0 overflow-hidden bg-background">
                <DialogHeader className="border-b border-border/50 bg-muted/30 p-6">
                    <DialogTitle className="text-xl">Student Profile</DialogTitle>
                    <DialogDescription>Detailed profile, academics, progress analysis, attendance and actions.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[75vh]">
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
                                    <div className="flex gap-2 flex-wrap">
                                        <Button size="sm" variant="outline" className="border-0 bg-muted hover:bg-muted/80 text-foreground" onClick={() => handlePrintReport(selectedCategoryTab)}>
                                            <Printer className="h-4 w-4 mr-1" strokeWidth={1.2} />Print Academic Report
                                        </Button>
                                        <Button size="sm" variant="outline" className="border-0 bg-muted hover:bg-muted/80 text-foreground" onClick={() => onRequestTransfer?.(student)}>
                                            <MoveRight className="h-4 w-4 mr-1" strokeWidth={1.2} />Transfer
                                        </Button>
                                        <Button size="sm" onClick={() => onRequestEdit?.(student)}>
                                            <Pencil className="h-4 w-4 mr-1" strokeWidth={1.2} />Edit
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <Tabs defaultValue="overview" className="space-y-4">
                                <TabsList className="w-full justify-start overflow-x-auto bg-muted border-0 rounded-xl p-1">
                                    <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-none">Overview</TabsTrigger>
                                    <TabsTrigger value="academic" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-none">Academic</TabsTrigger>
                                    <TabsTrigger value="attendance" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-none">Attendance</TabsTrigger>
                                    <TabsTrigger value="fees" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-none">Fees</TabsTrigger>
                                    <TabsTrigger value="actions" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-none">Actions</TabsTrigger>
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
                                    {/* Action & Filter Bar for Academic Tab */}
                                    <div className="flex items-center justify-between flex-wrap gap-3 bg-muted/40 p-3.5 rounded-xl border border-border/40">
                                        <div className="flex items-center gap-1.5 bg-background p-1 rounded-lg border border-border/60 flex-wrap">
                                            <Button
                                                size="sm"
                                                variant={selectedCategoryTab === "all" ? "default" : "ghost"}
                                                className="h-8 text-xs font-semibold px-3 rounded-md"
                                                onClick={() => setSelectedCategoryTab("all")}
                                            >
                                                All Examinations
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={selectedCategoryTab === "mct" ? "default" : "ghost"}
                                                className="h-8 text-xs font-semibold px-3 rounded-md"
                                                onClick={() => setSelectedCategoryTab("mct")}
                                            >
                                                MCT vs MCT
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={selectedCategoryTab === "semesterAndStandalone" ? "default" : "ghost"}
                                                className="h-8 text-xs font-semibold px-3 rounded-md"
                                                onClick={() => setSelectedCategoryTab("semesterAndStandalone")}
                                            >
                                                Semester vs Semester vs Standalone
                                            </Button>
                                        </div>
                                        <Button size="sm" onClick={() => handlePrintReport(selectedCategoryTab)} className="gap-1.5 shadow-sm font-semibold">
                                            <Printer className="h-4 w-4" />
                                            Print
                                        </Button>
                                    </div>

                                    {/* Performance Trend Chart */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-sm">
                                                Performance Trend ({selectedCategoryTab === "all" ? "All Exams" : selectedCategoryTab === "mct" ? "MCT Exams" : "Semester & Standalone Exams"})
                                            </CardTitle>
                                        </CardHeader>
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
                                                        <Bar dataKey="percentage" fill="var(--primary)" radius={[6, 6, 0, 0]} barSize={40} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Categorized Exam Comparisons */}
                                    <Card>
                                        <CardHeader>
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    <TrendingUp size={16} strokeWidth={1.5} className="text-primary" />
                                                    Exam Performance Comparisons
                                                </CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {/* MCT vs MCT Comparison */}
                                            {(selectedCategoryTab === "all" || selectedCategoryTab === "mct") && categorizedComparisons.mct.length > 0 && (
                                                <div className="space-y-2">
                                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                                                        MCT vs MCT Comparison
                                                    </h4>
                                                    <div className="grid gap-2">
                                                        {categorizedComparisons.mct.map((comp, idx) => (
                                                            <div key={idx} className="rounded-xl border border-border/50 bg-muted/20 p-3.5 flex items-center justify-between flex-wrap gap-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="text-center min-w-[80px]">
                                                                        <p className="text-xs text-muted-foreground font-medium">{comp.fromExam}</p>
                                                                        <p className="text-base font-bold">{comp.fromPercentage.toFixed(2)}%</p>
                                                                        <p className="text-[10px] text-muted-foreground">({comp.fromTotalMarks} marks)</p>
                                                                    </div>
                                                                    <div className="flex items-center px-1">
                                                                        {comp.direction === "up" && <ArrowUp size={18} className="text-emerald-600" />}
                                                                        {comp.direction === "down" && <ArrowDown size={18} className="text-red-600" />}
                                                                        {comp.direction === "same" && <Minus size={18} className="text-gray-400" />}
                                                                    </div>
                                                                    <div className="text-center min-w-[80px]">
                                                                        <p className="text-xs text-muted-foreground font-medium">{comp.toExam}</p>
                                                                        <p className="text-base font-bold">{comp.toPercentage.toFixed(2)}%</p>
                                                                        <p className="text-[10px] text-muted-foreground">({comp.toTotalMarks} marks)</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {formatDeltaBadge(comp.changePercentage, "%")}
                                                                    <Badge variant="outline" className="font-semibold text-xs border-border">
                                                                        {comp.changeTotalMarks > 0 ? "+" : ""}{comp.changeTotalMarks.toFixed(2)} Marks
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Semester vs Semester vs Standalone Comparison */}
                                            {(selectedCategoryTab === "all" || selectedCategoryTab === "semesterAndStandalone") && categorizedComparisons.semesterAndStandalone.length > 0 && (
                                                <div className="space-y-2 pt-1">
                                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                                                        Semester vs Semester vs Standalone Comparison
                                                    </h4>
                                                    <div className="grid gap-2">
                                                        {categorizedComparisons.semesterAndStandalone.map((comp, idx) => (
                                                            <div key={idx} className="rounded-xl border border-border/50 bg-muted/20 p-3.5 flex items-center justify-between flex-wrap gap-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="text-center min-w-[80px]">
                                                                        <p className="text-xs text-muted-foreground font-medium">{comp.fromExam}</p>
                                                                        <p className="text-base font-bold">{comp.fromPercentage.toFixed(2)}%</p>
                                                                        <p className="text-[10px] text-muted-foreground">({comp.fromTotalMarks} marks)</p>
                                                                    </div>
                                                                    <div className="flex items-center px-1">
                                                                        {comp.direction === "up" && <ArrowUp size={18} className="text-emerald-600" />}
                                                                        {comp.direction === "down" && <ArrowDown size={18} className="text-red-600" />}
                                                                        {comp.direction === "same" && <Minus size={18} className="text-gray-400" />}
                                                                    </div>
                                                                    <div className="text-center min-w-[80px]">
                                                                        <p className="text-xs text-muted-foreground font-medium">{comp.toExam}</p>
                                                                        <p className="text-base font-bold">{comp.toPercentage.toFixed(2)}%</p>
                                                                        <p className="text-[10px] text-muted-foreground">({comp.toTotalMarks} marks)</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {formatDeltaBadge(comp.changePercentage, "%")}
                                                                    <Badge variant="outline" className="font-semibold text-xs border-border">
                                                                        {comp.changeTotalMarks > 0 ? "+" : ""}{comp.changeTotalMarks.toFixed(2)} Marks
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {categorizedComparisons.mct.length === 0 &&
                                                categorizedComparisons.semesterAndStandalone.length === 0 && (
                                                    <p className="text-sm text-muted-foreground">Insufficient exam records for comparative analysis (at least 2 exams needed).</p>
                                                )}
                                        </CardContent>
                                    </Card>

                                    {/* Subject-wise Trend Table with 2 Decimal Mark Change */}
                                    {subjectTrend.orderedExams.length > 0 && subjectTrend.rows.length > 0 && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-sm">Subject-wise Marks & Differences Across Exams</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                {(() => {
                                                    const activeTrend = selectedCategoryTab === "all" ? subjectTrend : categorizedSubjectTrends[selectedCategoryTab];
                                                    if (!activeTrend.orderedExams.length || !activeTrend.rows.length) {
                                                        return <p className="text-sm text-muted-foreground py-4 text-center">No subject mark records available for this exam category.</p>;
                                                    }

                                                    return (
                                                        <div className="overflow-x-auto">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead className="font-semibold min-w-[140px]">Subject</TableHead>
                                                                        {activeTrend.orderedExams.map((exam) => (
                                                                            <TableHead key={exam.id} className="text-center font-semibold min-w-[110px]">{exam.name}</TableHead>
                                                                        ))}
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {activeTrend.rows.map((row) => (
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
                                                                                                <span className={`text-[11px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                                                                                                    mark.change > 0
                                                                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                                                                        : mark.change < 0
                                                                                                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                                                                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                                                                                }`}>
                                                                                                    {mark.change > 0 ? (
                                                                                                        <><TrendingUp size={11} />+{mark.change.toFixed(2)}</>
                                                                                                    ) : mark.change < 0 ? (
                                                                                                        <><TrendingDown size={11} />{mark.change.toFixed(2)}</>
                                                                                                    ) : (
                                                                                                        <><Minus size={11} />0.00</>
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
                                                    );
                                                })()}
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
