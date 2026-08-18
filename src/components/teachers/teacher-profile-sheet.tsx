"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Teacher, Exam } from "@/lib/database.types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Shield, Trash2, BarChart3, TrendingUp, Users, BookOpen, Loader2, Printer } from "lucide-react";
import { printHtml } from "@/lib/print-utils";

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

interface CachedTeacherProfile {
    teacher: Teacher;
    routineRows: any[];
    leaveRows: any[];
    proxyRows: any[];
    salaryConfig: any;
    salaryPayments: any[];
    timestamp: number;
}

export const teacherProfileCache = new Map<string, CachedTeacherProfile>();

let teacherMasterDataCache: { schoolInfo: any; exams: Exam[]; timestamp: number } | null = null;
const MASTER_TTL = 5 * 60 * 1000;

async function getTeacherMasterData(supabase: any) {
    const now = Date.now();
    if (teacherMasterDataCache && (now - teacherMasterDataCache.timestamp) < MASTER_TTL) {
        return teacherMasterDataCache;
    }
    const [schoolRes, examsRes] = await Promise.all([
        supabase.from("school_info").select("name,address,phone,email,logo_url,principal_name,current_academic_year").limit(1).maybeSingle(),
        supabase.from("exams").select("id,name,exam_type,term,created_at").order("term").order("exam_type"),
    ]);
    teacherMasterDataCache = {
        schoolInfo: schoolRes.data || null,
        exams: examsRes.data || [],
        timestamp: now,
    };
    return teacherMasterDataCache;
}

export async function prefetchTeacherProfile(teacherId: string) {
    if (!teacherId) return;
    const cached = teacherProfileCache.get(teacherId);
    if (cached && (Date.now() - cached.timestamp) < 120000) return;

    try {
        const supabase = createClient();
        const [teacherRes, routineRes, leaveRes, proxyRes, configRes, salaryRes] = await Promise.all([
            supabase
                .from("teachers")
                .select("id,name,phone,email,subject_specialty,designation,employee_type,proxy_count,created_at")
                .eq("id", teacherId)
                .maybeSingle(),
            supabase
                .from("class_routines")
                .select("id,day_of_week,start_time,end_time,class_id,section_id,subject_id,classes(name),sections(name),subjects(name,pass_marks,full_marks),rooms(name)")
                .eq("teacher_id", teacherId)
                .order("day_of_week")
                .order("start_time"),
            supabase
                .from("leave_requests")
                .select("id,start_date,end_date,reason,status,created_at")
                .eq("teacher_id", teacherId)
                .order("created_at", { ascending: false }),
            supabase
                .from("proxy_assignments")
                .select("id,assignment_date,routine_id,original_teacher_id,proxy_teacher_id,created_at")
                .or(`original_teacher_id.eq.${teacherId},proxy_teacher_id.eq.${teacherId}`)
                .order("assignment_date", { ascending: false }),
            supabase
                .from("staff_salary_config")
                .select("id,basic_salary,allowances,deductions,effective_from,is_active")
                .eq("staff_id", teacherId)
                .eq("is_active", true)
                .maybeSingle(),
            supabase
                .from("salary_payments")
                .select("id,slip_number,month,year,net_salary,payment_date,payment_method")
                .eq("staff_id", teacherId)
                .order("payment_date", { ascending: false })
                .limit(12),
        ]);

        if (teacherRes.data) {
            teacherProfileCache.set(teacherId, {
                teacher: teacherRes.data,
                routineRows: routineRes.data || [],
                leaveRows: leaveRes.data || [],
                proxyRows: proxyRes.data || [],
                salaryConfig: configRes.data || null,
                salaryPayments: salaryRes.data || [],
                timestamp: Date.now(),
            });
        }
    } catch {
        // Ignore background prefetch errors
    }
}

export function TeacherProfileSheet({
    open,
    onOpenChange,
    teacherId,
    onTeacherUpdated,
    onRequestEdit,
    onRequestDelete,
}: TeacherProfileProps) {
    const supabase = useMemo(() => createClient(), []);
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
    const [availableExams, setAvailableExams] = useState<Exam[]>([]);
    const [selectedExamId, setSelectedExamId] = useState<string>("");
    const [academicYear, setAcademicYear] = useState<string>("");
    const [schoolInfo, setSchoolInfo] = useState<any>(null);

    useEffect(() => {
        if (!open || !teacherId) return;
        let cancelled = false;

        void (async () => {
            // Check in-memory cache for instant rendering
            const cached = teacherProfileCache.get(teacherId);
            if (cached) {
                setTeacher(cached.teacher);
                setRoutineRows(cached.routineRows);
                setLeaveRows(cached.leaveRows);
                setProxyRows(cached.proxyRows);
                setSalaryConfig(cached.salaryConfig);
                setSalaryPayments(cached.salaryPayments);
                setActionForm({
                    name: cached.teacher.name || "",
                    phone: cached.teacher.phone || "",
                    email: cached.teacher.email || "",
                    subject_specialty: cached.teacher.subject_specialty || "",
                    designation: cached.teacher.designation || "",
                });
                setLoading(false);
            } else {
                setLoading(true);
            }

            const [teacherRes, routineRes, leaveRes, proxyRes, configRes, salaryRes] = await Promise.all([
                supabase
                    .from("teachers")
                    .select("id,name,phone,email,subject_specialty,designation,employee_type,proxy_count,created_at")
                    .eq("id", teacherId)
                    .maybeSingle(),
                supabase
                    .from("class_routines")
                    .select("id,day_of_week,start_time,end_time,class_id,section_id,subject_id,classes(name),sections(name),subjects(name,pass_marks,full_marks),rooms(name)")
                    .eq("teacher_id", teacherId)
                    .order("day_of_week")
                    .order("start_time"),
                supabase
                    .from("leave_requests")
                    .select("id,start_date,end_date,reason,status,created_at")
                    .eq("teacher_id", teacherId)
                    .order("created_at", { ascending: false }),
                supabase
                    .from("proxy_assignments")
                    .select("id,assignment_date,routine_id,original_teacher_id,proxy_teacher_id,created_at")
                    .or(`original_teacher_id.eq.${teacherId},proxy_teacher_id.eq.${teacherId}`)
                    .order("assignment_date", { ascending: false }),
                supabase
                    .from("staff_salary_config")
                    .select("id,basic_salary,allowances,deductions,effective_from,is_active")
                    .eq("staff_id", teacherId)
                    .eq("is_active", true)
                    .maybeSingle(),
                supabase
                    .from("salary_payments")
                    .select("id,slip_number,month,year,net_salary,payment_date,payment_method")
                    .eq("staff_id", teacherId)
                    .order("payment_date", { ascending: false })
                    .limit(12),
            ]);

            if (cancelled) return;
            if (teacherRes.error || !teacherRes.data) {
                setLoading(false);
                return;
            }

            const fetchedTeacher = teacherRes.data;
            const fetchedRoutines = routineRes.data || [];
            const fetchedLeaves = leaveRes.data || [];
            const fetchedProxies = proxyRes.data || [];
            const fetchedConfig = configRes.data || null;
            const fetchedSalary = salaryRes.data || [];

            teacherProfileCache.set(teacherId, {
                teacher: fetchedTeacher,
                routineRows: fetchedRoutines,
                leaveRows: fetchedLeaves,
                proxyRows: fetchedProxies,
                salaryConfig: fetchedConfig,
                salaryPayments: fetchedSalary,
                timestamp: Date.now(),
            });

            setTeacher(fetchedTeacher);
            setRoutineRows(fetchedRoutines);
            setLeaveRows(fetchedLeaves);
            setProxyRows(fetchedProxies);
            setSalaryConfig(fetchedConfig);
            setSalaryPayments(fetchedSalary);
            setActionForm({
                name: fetchedTeacher.name || "",
                phone: fetchedTeacher.phone || "",
                email: fetchedTeacher.email || "",
                subject_specialty: fetchedTeacher.subject_specialty || "",
                designation: fetchedTeacher.designation || "",
            });
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [open, teacherId, supabase]);

    // Student performance calculation supporting Semester + Standalone exams
    useEffect(() => {
        if (!open || !teacherId) return;
        let cancelled = false;

        void (async () => {
            setPerfLoading(true);
            // 1. Get cached master data
            const master = await getTeacherMasterData(supabase);
            if (cancelled) return;
            const year = master.schoolInfo?.current_academic_year || new Date().getFullYear().toString();
            setAcademicYear(year);
            setSchoolInfo(master.schoolInfo);

            // Filter out standalone MCT exams so only Semester and Standalone main exams appear
            const validExams = (master.exams || []).filter((e: any) => e.exam_type !== "mct");
            setAvailableExams(validExams);

            // Default to first semester exam or first available exam
            const activeExamId = selectedExamId && selectedExamId !== "all" ? selectedExamId : (validExams[0]?.id || "all");
            if (selectedExamId !== activeExamId && (!selectedExamId || selectedExamId === "all")) {
                setSelectedExamId(activeExamId);
            }

            // 2. Extract assignments from routine rows or fetch if not ready
            let routines = routineRows;
            if (!routines || routines.length === 0) {
                const { data } = await supabase
                    .from("class_routines")
                    .select("class_id,section_id,subject_id,classes(name),sections(name),subjects(name,pass_marks,full_marks)")
                    .eq("teacher_id", teacherId);
                if (cancelled) return;
                routines = data || [];
            }

            if (!routines || routines.length === 0) {
                setSubjectPerformance([]);
                setPerfLoading(false);
                return;
            }

            // Deduplicate assignments
            const uniqueAssignmentsMap = new Map<string, any>();
            for (const r of routines) {
                if (!r.class_id || !r.section_id || !r.subject_id) continue;
                const key = `${r.class_id}-${r.section_id}-${r.subject_id}`;
                if (!uniqueAssignmentsMap.has(key)) {
                    uniqueAssignmentsMap.set(key, r);
                }
            }

            const uniqueAssignments = Array.from(uniqueAssignmentsMap.values());
            if (uniqueAssignments.length === 0) {
                setSubjectPerformance([]);
                setPerfLoading(false);
                return;
            }

            const classIds = [...new Set(uniqueAssignments.map((u) => u.class_id).filter(Boolean))];
            const sectionIds = [...new Set(uniqueAssignments.map((u) => u.section_id).filter(Boolean))];
            const subjectIds = [...new Set(uniqueAssignments.map((u) => u.subject_id).filter(Boolean))];

            // 3. Batch fetch all students in these classes & sections in 1 single query
            const { data: studentsData } = await supabase
                .from("students")
                .select("id, class_id, section_id")
                .in("class_id", classIds)
                .in("section_id", sectionIds);

            if (cancelled) return;
            if (!studentsData || studentsData.length === 0) {
                setSubjectPerformance([]);
                setPerfLoading(false);
                return;
            }

            const allStudentIds = studentsData.map((s) => s.id);

            // 4. Check if selected exam has a paired MCT exam (for semester exams)
            const currentExamId = activeExamId;
            const selectedExam = (master.exams || []).find((e: any) => e.id === currentExamId);
            const pairedMct =
                selectedExam && selectedExam.exam_type === "semester" && selectedExam.term
                    ? (master.exams || []).find((e: any) => e.exam_type === "mct" && e.term === selectedExam.term)
                    : null;

            const examIdsToFetch: string[] = [];
            if (currentExamId !== "all") {
                examIdsToFetch.push(currentExamId);
                if (pairedMct) {
                    examIdsToFetch.push(pairedMct.id);
                }
            }

            // 5. Batch fetch all marks and configs for these students & subjects
            let marksQuery = supabase
                .from("marks")
                .select("student_id, subject_id, exam_id, total")
                .in("subject_id", subjectIds)
                .eq("academic_year", year)
                .in("student_id", allStudentIds);

            if (examIdsToFetch.length > 0) {
                marksQuery = marksQuery.in("exam_id", examIdsToFetch);
            }

            const [marksRes, configsRes] = await Promise.all([
                marksQuery,
                supabase
                    .from("exam_subject_config")
                    .select("exam_id, subject_id, full_marks, weight_percent")
                    .in("subject_id", subjectIds)
                    .in("exam_id", examIdsToFetch.length > 0 ? examIdsToFetch : (master.exams || []).map((e: any) => e.id)),
            ]);

            if (cancelled) return;
            const marks = marksRes.data || [];
            const configs = configsRes.data || [];

            // 6. In-memory JavaScript calculation matching official term and standalone results
            const perfResults: SubjectPerformance[] = [];
            for (const r of uniqueAssignments) {
                const classSectionStudents = studentsData.filter(
                    (s) => s.class_id === r.class_id && s.section_id === r.section_id
                );

                const studentCalculations: { total: number; passed: boolean }[] = [];
                const passMark = (r.subjects as any)?.pass_marks || 33;

                for (const st of classSectionStudents) {
                    if (selectedExam && pairedMct) {
                        // Semester Exam with MCT Pairing (1st Semester, 2nd Semester, etc.)
                        const sM = marks.find(
                            (m) => m.student_id === st.id && m.subject_id === r.subject_id && m.exam_id === currentExamId
                        );
                        const mM = marks.find(
                            (m) => m.student_id === st.id && m.subject_id === r.subject_id && m.exam_id === pairedMct.id
                        );

                        if (!sM && !mM) continue;

                        const mC = configs.find(
                            (c) => c.exam_id === pairedMct.id && c.subject_id === r.subject_id
                        );
                        const sC = configs.find(
                            (c) => c.exam_id === currentExamId && c.subject_id === r.subject_id
                        );
                        const mctW = mC?.weight_percent ?? 100;
                        const semW = sC?.weight_percent ?? 100;
                        const mctO = Number(mM?.total || 0);
                        const semO = Number(sM?.total || 0);
                        const combined = Math.round(((mctO * (mctW / 100)) + (semO * (semW / 100))) * 100) / 100;

                        studentCalculations.push({
                            total: combined,
                            passed: combined >= passMark,
                        });
                    } else if (currentExamId !== "all") {
                        // Standalone Exam (e.g. Pre-Test, Test, Model Test) or Non-paired Exam
                        const sM = marks.find(
                            (m) => m.student_id === st.id && m.subject_id === r.subject_id && m.exam_id === currentExamId
                        );
                        if (!sM) continue;

                        const sC = configs.find(
                            (c) => c.exam_id === currentExamId && c.subject_id === r.subject_id
                        );
                        const semW = sC?.weight_percent ?? 100;
                        const semO = Number(sM.total || 0);
                        const weighted = Math.round((semO * (semW / 100)) * 100) / 100;

                        studentCalculations.push({
                            total: weighted,
                            passed: weighted >= passMark,
                        });
                    } else {
                        // "All Exams" - Evaluates all semester terms and standalone exams
                        const termScores: number[] = [];
                        for (const examItem of validExams) {
                            const pMct = examItem.exam_type === "semester" && examItem.term
                                ? (master.exams || []).find((e: any) => e.exam_type === "mct" && e.term === examItem.term)
                                : null;
                            const sM = marks.find(
                                (m) => m.student_id === st.id && m.subject_id === r.subject_id && m.exam_id === examItem.id
                            );
                            const mM = pMct ? marks.find(
                                (m) => m.student_id === st.id && m.subject_id === r.subject_id && m.exam_id === pMct.id
                            ) : null;

                            if (!sM && !mM) continue;

                            const mC = pMct ? configs.find(
                                (c) => c.exam_id === pMct.id && c.subject_id === r.subject_id
                            ) : null;
                            const sC = configs.find(
                                (c) => c.exam_id === examItem.id && c.subject_id === r.subject_id
                            );
                            const mctW = mC?.weight_percent ?? 100;
                            const semW = sC?.weight_percent ?? 100;
                            const mctO = Number(mM?.total || 0);
                            const semO = Number(sM?.total || 0);
                            const combined = Math.round(((mctO * (mctW / 100)) + (semO * (semW / 100))) * 100) / 100;
                            termScores.push(combined);
                        }

                        if (termScores.length === 0) continue;
                        const avgTermScore = termScores.reduce((a, b) => a + b, 0) / termScores.length;
                        studentCalculations.push({
                            total: Math.round(avgTermScore * 100) / 100,
                            passed: avgTermScore >= passMark,
                        });
                    }
                }

                if (studentCalculations.length === 0) continue;

                const totalStudents = studentCalculations.length;
                const passedCount = studentCalculations.filter((c) => c.passed).length;
                const failedCount = totalStudents - passedCount;
                const totals = studentCalculations.map((c) => c.total);
                const averageMarks = totals.reduce((a, b) => a + b, 0) / totalStudents;
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

        return () => {
            cancelled = true;
        };
    }, [open, teacherId, selectedExamId, routineRows, supabase]);

    const timetable = useMemo(() => {
        const table: Record<string, any[]> = {};
        for (const d of days) table[d] = [];
        for (const row of routineRows) {
            const key = days[row.day_of_week] || "Sat";
            if (!table[key]) table[key] = [];
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
        const weightedAvg =
            subjectPerformance.reduce((s, p) => s + p.averageMarks * p.totalStudents, 0) / (totalStudents || 1);
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
        if (data) {
            const cached = teacherProfileCache.get(teacher.id);
            if (cached) {
                teacherProfileCache.set(teacher.id, { ...cached, teacher: data, timestamp: Date.now() });
            }
        }
        onTeacherUpdated?.();
        toast.success("Teacher profile updated");
    };

    // Print Performance Report Function
    const handlePrintPerformanceReport = () => {
        if (!teacher || subjectPerformance.length === 0) return;

        const schoolName = schoolInfo?.name || "School Result System";
        const schoolAddress = schoolInfo?.address || "";
        const schoolPhone = schoolInfo?.phone || "";

        const selectedExamObj = availableExams.find((e) => e.id === selectedExamId);
        const examLabel = selectedExamId === "all" ? "All Evaluated Exams" : selectedExamObj?.name || selectedExamId;

        const reportTitle = "TEACHER'S STUDENT PERFORMANCE REPORT";

        const rowsHTML = subjectPerformance
            .map((perf, idx) => {
                const rowClass = idx % 2 === 0 ? "e" : "o";
                return `
                    <tr class="${rowClass}">
                        <td class="left"><strong>${perf.subjectName}</strong></td>
                        <td>${perf.className} / ${perf.sectionName}</td>
                        <td><strong>${perf.totalStudents}</strong></td>
                        <td style="color: #15803d; font-weight: 700;">${perf.passedCount}</td>
                        <td style="color: #b91c1c; font-weight: 700;">${perf.failedCount}</td>
                        <td><span class="${perf.passPercentage >= 60 ? "badge-up" : perf.passPercentage >= 40 ? "badge-mid" : "badge-down"}">${perf.passPercentage}%</span></td>
                        <td><strong>${perf.averageMarks}</strong></td>
                        <td><strong>${perf.highestMarks}</strong></td>
                    </tr>
                `;
            })
            .join("");

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Performance Report - ${teacher.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
@page { size: A4 portrait; margin: 5mm 8mm; }
body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-family: 'Poppins', sans-serif; color: #1e293b; font-size: 12px; background: #fff; margin: 0; padding: 0; }
.pg { max-width: 780px; margin: 0 auto; padding: 5mm 8mm; box-sizing: border-box; }
.tb { border-top: 3px double #1a365d; border-bottom: 1.5px solid #1a365d; height: 3px; margin-bottom: 6px; }
.bb { border-top: 1.5px solid #1a365d; border-bottom: 3px double #1a365d; height: 3px; margin-top: 15px; }

.hdr { text-align: center; margin-bottom: 6px; }
.hdr img { height: 42px; margin: 0 auto 3px; display: block; }
.hdr h1 { font-size: 20px; font-weight: 700; color: #1e3a5f; letter-spacing: 0.5px; margin: 0; }
.hdr .ad { font-size: 10.5px; color: #64748b; margin-top: 2px; }

.tbar { background: #f0f5ff !important; color: #1e3a5f !important; border: 1px solid #cbd5e1; text-align: center; padding: 6px 10px; margin: 6px 0 10px 0; border-radius: 6px; }
.tbar h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin: 0; color: #1e3a5f !important; }
.tbar .sub { font-size: 10px; color: #64748b !important; margin-top: 2px; }

.itbl { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11.5px; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; background: #f8fafc; }
.itbl td { padding: 4.5px 8px; border: 1px solid #cbd5e1; }
.itbl .lb { color: #64748b; font-weight: 600; width: 20%; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.5px; }
.itbl .vl { font-weight: 700; width: 30%; color: #0f172a; font-size: 11.5px; }

.stbl { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 12px; font-size: 11.5px; border-radius: 6px; overflow: hidden; }
.stbl td { padding: 8px 6px; text-align: center; background: #f0f5ff !important; border-right: 1px solid #cbd5e1; }
.stbl td:last-child { border-right: none; }
.stbl .sl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
.stbl .sv { font-size: 17px; font-weight: 800; color: #1e3a5f; margin-top: 2px; }

.sec-hdr { font-size: 12px; font-weight: 800; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.5px; margin: 12px 0 6px 0; border-left: 3px solid #2563eb; padding-left: 6px; }

.mtbl { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11.5px; border: 1px solid #cbd5e1; }
.mtbl th { background: #e8edf5 !important; color: #1e3a5f !important; padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700; font-size: 11px; text-transform: uppercase; }
.mtbl th.left { text-align: left; }
.mtbl td { padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; color: #334155; }
.mtbl td.left { text-align: left; }
.mtbl tr.e { background: #ffffff !important; }
.mtbl tr.o { background: #f8fafc !important; }

.badge-up { background: #dcfce7 !important; color: #15803d !important; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-block; font-size: 10px; }
.badge-mid { background: #fef3c7 !important; color: #b45309 !important; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-block; font-size: 10px; }
.badge-down { background: #fee2e2 !important; color: #b91c1c !important; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-block; font-size: 10px; }

.sigs { width: 100%; table-layout: fixed; margin-top: 35px; border-collapse: collapse; }
.sigs td { text-align: center; vertical-align: top; }
.sigb { width: 150px; margin: 0 auto; border-top: 1.5px solid #334155; padding-top: 4px; font-size: 11px; font-weight: 700; color: #334155; text-transform: uppercase; }
</style></head><body><div class="pg">
<div class="tb"></div>
<div class="hdr">
${schoolInfo?.logo_url ? `<img src="${schoolInfo.logo_url}" alt="Logo">` : ""}
<h1>${schoolName}</h1>
${schoolAddress ? `<div class="ad">${schoolAddress} ${schoolPhone ? `| Phone: ${schoolPhone}` : ""}</div>` : ""}
</div>

<div class="tbar">
<h2>${reportTitle}</h2>
<div class="sub">Evaluation Scope: <strong>${examLabel}</strong> | Academic Year: <strong>${academicYear}</strong> | Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</div>
</div>

<table class="itbl">
<tr><td class="lb">Teacher Name</td><td class="vl">${teacher.name}</td><td class="lb">Designation</td><td class="vl">${teacher.designation || "Teacher"}</td></tr>
<tr><td class="lb">Subject Specialty</td><td class="vl">${teacher.subject_specialty || "-"}</td><td class="lb">Phone</td><td class="vl">${teacher.phone || "-"}</td></tr>
</table>

<table class="stbl">
<tr>
<td style="width:25%"><div class="sl">Total Students Evaluated</div><div class="sv">${perfSummary.totalStudents}</div></td>
<td style="width:25%"><div class="sl">Overall Pass Rate</div><div class="sv" style="color: ${perfSummary.overallPassRate >= 60 ? "#15803d" : perfSummary.overallPassRate >= 40 ? "#b45309" : "#b91c1c"}">${perfSummary.overallPassRate}%</div></td>
<td style="width:25%"><div class="sl">Overall Average Score</div><div class="sv">${perfSummary.avgScore}</div></td>
<td style="width:25%"><div class="sl">Total Subjects Taught</div><div class="sv">${subjectPerformance.length}</div></td>
</tr>
</table>

<div class="sec-hdr">Subject-wise Student Performance Details</div>
<table class="mtbl">
<thead>
<tr>
<th class="left">Subject</th>
<th>Class / Section</th>
<th>Students</th>
<th>Passed</th>
<th>Failed</th>
<th>Pass Rate</th>
<th>Average Mark</th>
<th>Highest Mark</th>
</tr>
</thead>
<tbody>
${rowsHTML}
</tbody>
</table>

<table class="sigs">
<tr>
<td><div class="sigb">Subject Teacher</div></td>
<td><div class="sigb">Exam Controller</div></td>
<td><div class="sigb">Head of Institution</div></td>
</tr>
</table>
<div class="bb"></div></div></body></html>`;

        printHtml(html);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[96vw] sm:w-[92vw] md:max-w-[920px] h-[85vh] max-h-[820px] min-h-[580px] p-0 gap-0 overflow-hidden flex flex-col bg-background rounded-2xl border border-border shadow-2xl">
                <DialogHeader className="border-b border-border/50 bg-muted/30 px-5 py-4 sm:px-6 sm:py-4 shrink-0">
                    <DialogTitle className="text-lg sm:text-xl font-bold">Teacher Profile</DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                        Teacher profile, class routine, student performance, leave & proxy history.
                    </DialogDescription>
                </DialogHeader>
                {loading && !teacher ? (
                    <div className="flex-1 min-h-0 flex items-center justify-center p-8 text-sm text-muted-foreground">
                        <Loader2 className="animate-spin mr-2.5 h-5 w-5 text-primary" />
                        <span>Loading profile…</span>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-6 thin-scrollbar">
                        {/* Header Card */}
                        <div className="rounded-2xl border-0 bg-muted/50 p-5">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                        {teacher?.name?.charAt(0)?.toUpperCase() || "T"}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-semibold text-foreground">{teacher?.name}</h3>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-lg font-medium">
                                                {teacher?.designation || "Teacher"}
                                            </Badge>
                                            <Badge variant="secondary" className="border-0 rounded-lg font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                TEACHER
                                            </Badge>
                                            {teacher?.subject_specialty && (
                                                <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-lg font-medium">
                                                    {teacher.subject_specialty}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => teacher && onRequestEdit?.(teacher)}>
                                        <Pencil className="h-4 w-4 mr-1" strokeWidth={1.2} />Edit
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <Tabs defaultValue="overview" className="space-y-4">
                            <TabsList className="w-full justify-start overflow-x-auto bg-muted border-0 rounded-xl p-1">
                                <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-none">Overview</TabsTrigger>
                                <TabsTrigger value="routine" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-none">Class Routine</TabsTrigger>
                                <TabsTrigger value="attendance" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-none">Attendance & Proxy</TabsTrigger>
                                <TabsTrigger value="performance" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-none">Student Performance</TabsTrigger>
                                <TabsTrigger value="payroll" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-none">Payroll</TabsTrigger>
                                <TabsTrigger value="actions" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-none">Actions</TabsTrigger>
                            </TabsList>

                            <TabsContent value="overview" className="space-y-4">
                                <Card>
                                    <CardHeader><CardTitle className="text-sm">Contact & Responsibilities</CardTitle></CardHeader>
                                    <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
                                        <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Phone</p><p className="font-medium">{teacher?.phone || "-"}</p></div>
                                        <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Email</p><p className="font-medium">{teacher?.email || "-"}</p></div>
                                        <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Designation</p><p className="font-medium">{teacher?.designation || "-"}</p></div>
                                        <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Subject Specialty</p><p className="font-medium">{teacher?.subject_specialty || "-"}</p></div>
                                        <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Proxy Classes Taken</p><p className="font-medium">{teacher?.proxy_count || 0}</p></div>
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
                                                    <div key={r.id} className="rounded-lg border-0 bg-background shadow-xs p-3 mb-2 text-sm flex flex-col gap-1">
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
                                                <span className="bg-muted text-muted-foreground px-2 py-1 rounded-md text-xs font-mono font-medium">
                                                    Routine: {p.routine_id ? p.routine_id.slice(0, 8) : "-"}
                                                </span>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Student Performance Tab */}
                            <TabsContent value="performance" className="space-y-4">
                                {/* Exam Filter & Print Action */}
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Filter by Exam:</Label>
                                            <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                                                <SelectTrigger className="w-[200px] h-9">
                                                    <SelectValue placeholder="Choose Exam" />
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
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handlePrintPerformanceReport}
                                        disabled={subjectPerformance.length === 0}
                                        className="gap-1.5 font-medium"
                                    >
                                        <Printer className="h-4 w-4" strokeWidth={1.5} />
                                        Print Report
                                    </Button>
                                </div>

                                {perfLoading ? (
                                    <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                                        <Loader2 className="animate-spin h-6 w-6 text-primary" />
                                        <span>Calculating student performance…</span>
                                    </div>
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
                                                    <p className={`text-2xl font-bold ${perfSummary.overallPassRate >= 60 ? "text-emerald-600" : perfSummary.overallPassRate >= 40 ? "text-amber-600" : "text-red-600"}`}>
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
                                        <Button variant="destructive" onClick={() => teacher && onRequestDelete?.(teacher)}><Trash2 className="h-4 w-4 mr-2" strokeWidth={1.5} />Delete Teacher</Button>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
