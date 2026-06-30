"use client";
import { useEffect, useState, useMemo } from "react";
import { escapeHtml } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { printHtml } from "@/lib/print-utils";
import {
    CLASS_COLUMNS,
    EXAM_COLUMNS,
    EXAM_SUBJECT_CONFIG_COLUMNS,
    GRADING_RULE_COLUMNS,
    MARK_COLUMNS,
    SCHOOL_INFO_COLUMNS,
    SECTION_COLUMNS,
    STUDENT_COLUMNS,
    SUBJECT_COLUMNS,
} from "@/lib/supabase/select-columns";
import type { Class, Section, Exam, Student, Subject, Mark, GradingRule, SchoolInfo, ExamSubjectConfig } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart as ChartBar, Sparkles as Sparkle, Printer, Eye, AlertCircle as WarningCircle, Download as DownloadSimple, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

const FINAL_RESULT_ID = "__final_result__";
const SEMESTER_WEIGHTS: Record<number, number> = { 1: 0.25, 2: 0.25, 3: 0.50 };

type StudentResult = {
    student: Student;
    subjects: { subject: Subject; mark: Mark | null; grade: string; gradePoint: number; effectiveFullMarks: number; weightedObtained: number; weightedFull: number; mctObtained?: number; semesterObtained?: number; }[];
    totalMarks: number; totalFullMarks: number; percentage: number; baseGpa: number; gpa: number; displayGpa: number; grade: string; position?: number; attendanceCount?: number;
    // Final result extras
    semesterBreakdown?: { term: number; totalMarks: number; totalFullMarks: number; percentage: number; baseGpa: number; gpa: number; grade: string; weight: number; }[];
};



export default function ResultsPage() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedExam, setSelectedExam] = useState("");
    const [results, setResults] = useState<StudentResult[]>([]);
    const [gradingRules, setGradingRules] = useState<GradingRule[]>([]);
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
    const [examSubjectConfigs, setExamSubjectConfigs] = useState<ExamSubjectConfig[]>([]);
    const [processing, setProcessing] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [reportStudent, setReportStudent] = useState<StudentResult | null>(null);
    const [currentClassSubjects, setCurrentClassSubjects] = useState<Subject[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedAcademicYear, setSelectedAcademicYear] = useState(new Date().getFullYear().toString());

    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        (async () => {
            const [cRes, eRes, gRes, sRes, cfgRes] = await Promise.all([
                supabase.from("classes").select(CLASS_COLUMNS).order("numeric_value"),
                supabase.from("exams").select(EXAM_COLUMNS).order("term").order("exam_type"),
                supabase.from("grading_rules").select(GRADING_RULE_COLUMNS).order("min_marks", { ascending: false }),
                supabase.from("school_info").select(SCHOOL_INFO_COLUMNS).limit(1).maybeSingle(),
                supabase.from("exam_subject_config").select(EXAM_SUBJECT_CONFIG_COLUMNS),
            ]);
            setClasses(cRes.data || []); setExams(eRes.data || []);
            setGradingRules(gRes.data || []); if (sRes.data) setSchoolInfo(sRes.data);
            setExamSubjectConfigs(cfgRes.data || []);
        })();
    }, [supabase]);

    useEffect(() => {
        if (!selectedClass) { setSections([]); setSelectedSection(""); return; }
        (async () => {
            const { data } = await supabase.from("sections").select(SECTION_COLUMNS).eq("class_id", selectedClass).order("name");
            setSections(data || []); setSelectedSection("");
        })();
    }, [selectedClass, supabase]);

    const getGrade = (pct: number, fullMarks: number = 100) => {
        const cat = fullMarks <= 50 ? 50 : 100;
        const filtered = gradingRules.filter((r) => r.marks_category === cat);
        const rules = filtered.length > 0 ? filtered : gradingRules;
        if (rules.length === 0) return { grade: "F", gradePoint: 0 };

        // Check if rules use raw marks (for 50-mark, max <= 50) or percentage
        const usesRawMarks = cat === 50 && rules.every((r) => r.max_marks <= 50);

        // For raw marks comparison: use (pct/100)*fullMarks = raw obtained
        // For percentage: use pct directly, rounded to avoid gaps like 69.1 missing 60-69
        const compareVal = usesRawMarks ? Math.round((pct / 100) * fullMarks * 100) / 100 : Math.round(pct * 100) / 100;

        // Sort descending by min_marks, find first rule where value >= min
        const sorted = [...rules].sort((a, b) => b.min_marks - a.min_marks);
        for (const r of sorted) {
            if (compareVal >= r.min_marks && compareVal <= r.max_marks) return { grade: r.grade, gradePoint: r.grade_point };
        }
        // Fallback: try finding rule where value >= min_marks (in case of decimal gaps)
        for (const r of sorted) {
            if (compareVal >= r.min_marks) return { grade: r.grade, gradePoint: r.grade_point };
        }
        return { grade: "F", gradePoint: 0 };
    };
    const posSuffix = (p: number) => { if (p % 100 >= 11 && p % 100 <= 13) return "th"; if (p % 10 === 1) return "st"; if (p % 10 === 2) return "nd"; if (p % 10 === 3) return "rd"; return "th"; };

    /** Reverse-lookup: get letter grade from a GPA value using the 100-mark grading rules. */
    const getGradeByGpa = (gpa: number): string => {
        const rules100 = gradingRules.filter((r) => r.marks_category === 100);
        if (rules100.length === 0) return "F";
        const sorted = [...rules100].sort((a, b) => b.grade_point - a.grade_point);
        for (const r of sorted) {
            if (gpa >= r.grade_point) return r.grade;
        }
        return "F";
    };

    const isFinal = selectedExam === FINAL_RESULT_ID;
    const selectedExamObj = exams.find((e) => e.id === selectedExam);
    const isMCT = selectedExamObj?.exam_type === "mct";
    const isSemester = selectedExamObj?.exam_type === "semester";
    const pairedMctExam = isSemester ? exams.find((e) => e.exam_type === "mct" && e.term === selectedExamObj?.term) : null;
    const showPosition = !isMCT; // Position for semester and final only

    // Generate academic year options (current year ± 2)
    const academicYearOptions = useMemo(() => {
        const y = new Date().getFullYear();
        const options: string[] = [];
        for (let i = y - 2; i <= y + 1; i++) options.push(i.toString());
        return options;
    }, []);

    const assignPositions = (studentResults: StudentResult[]) => {
        // Count failed subjects per student, ignoring optional subjects
        const failCount = (r: StudentResult) => r.subjects.filter((s) => s.grade === "F" && !s.subject.is_optional).length;
        const isFailed = (r: StudentResult) => r.subjects.some((s) => s.grade === "F" && !s.subject.is_optional);

        const getRawGpa = (r: StudentResult) => {
            const vGP = r.subjects.filter((s) => s.mark !== null);
            return r.subjects.length > 0 ? Math.round((vGP.reduce((acc, curr) => acc + curr.gradePoint, 0) / r.subjects.length) * 100 + 0.0001) / 100 : 0;
        };

        const sorted = [...studentResults].sort((a, b) => {
            const aFail = isFinal ? a.grade === "F" : isFailed(a);
            const bFail = isFinal ? b.grade === "F" : isFailed(b);
            const aFailCount = isFinal ? 0 : failCount(a);
            const bFailCount = isFinal ? 0 : failCount(b);

            // Passing students always come before failed students
            if (!aFail && bFail) return -1;
            if (aFail && !bFail) return 1;

            // Both passed: sort by GPA -> total marks -> attendanceCount
            if (!aFail && !bFail) {
                if (b.gpa !== a.gpa) return b.gpa - a.gpa;
                if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
                return (b.attendanceCount || 0) - (a.attendanceCount || 0);
            }

            // Both failed: fewer failed subjects = better position (only applies to semester results)
            if (!isFinal) {
                const fc = aFailCount - bFailCount;
                if (fc !== 0) return fc;
            }

            // Check Raw GPA internally for failed students instead of explicit 0 GPA
            const aRaw = a.gpa > 0 ? a.gpa : getRawGpa(a);
            const bRaw = b.gpa > 0 ? b.gpa : getRawGpa(b);
            if (bRaw !== aRaw) return bRaw - aRaw;

            // Same GPA: higher Total Marks first, then attendanceCount
            if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
            return (b.attendanceCount || 0) - (a.attendanceCount || 0);
        });

        let cur = 1;
        sorted.forEach((r, i) => {
            if (i > 0) {
                const p = sorted[i - 1];
                const aFail = isFinal ? r.grade === "F" : isFailed(r);
                const bFail = isFinal ? p.grade === "F" : isFailed(p);
                const aFailCount = isFinal ? 0 : failCount(r);
                const bFailCount = isFinal ? 0 : failCount(p);

                let sameRank = false;

                if (!aFail && !bFail) {
                    sameRank = r.gpa === p.gpa && r.totalMarks === p.totalMarks && r.attendanceCount === p.attendanceCount;
                } else if (aFail && bFail) {
                    const rRaw = r.gpa > 0 ? r.gpa : getRawGpa(r);
                    const pRaw = p.gpa > 0 ? p.gpa : getRawGpa(p);
                    sameRank = aFailCount === bFailCount && rRaw === pRaw && r.totalMarks === p.totalMarks && r.attendanceCount === p.attendanceCount;
                }

                if (sameRank) r.position = p.position;
                else { cur = i + 1; r.position = cur; }
            } else r.position = 1;
        });
        studentResults.forEach((r) => { r.position = sorted.find((s) => s.student.id === r.student.id)?.position; });
    };

    // ── Generate semester result (existing logic) ──
    const generateSemesterResult = async (examId: string, students: Student[], subjects: Subject[]): Promise<StudentResult[]> => {
        const exam = exams.find((e) => e.id === examId)!;
        const pairedMct = exam.exam_type === "semester" ? exams.find((e) => e.exam_type === "mct" && e.term === exam.term) : null;
        const { data: directMarks } = await supabase.from("marks").select(MARK_COLUMNS).eq("exam_id", examId).in("student_id", students.map((s) => s.id));
        let mctMarks: Mark[] = [];
        if (pairedMct) { const { data } = await supabase.from("marks").select(MARK_COLUMNS).eq("exam_id", pairedMct.id).in("student_id", students.map((s) => s.id)); mctMarks = data || []; }

        return students.map((student) => {
            const studentGroup = student.group_name || "None";
            const applicableSubjects = subjects.filter(
                (s) => !s.group_name || s.group_name === "Common" || s.group_name === studentGroup
            );

            const subjectResults = applicableSubjects.map((subject) => {
                let wO = 0;
                let wF = subject.full_marks; 
                let mark: Mark | null = null;
                
                let mctO: number | undefined = undefined;
                let semO: number | undefined = undefined;

                if (pairedMct) {
                    const mC = examSubjectConfigs.find((c) => c.exam_id === pairedMct.id && c.subject_id === subject.id);
                    const sC = examSubjectConfigs.find((c) => c.exam_id === examId && c.subject_id === subject.id);
                    const hasMctMarks = mctMarks.some((m) => m.subject_id === subject.id);
                    const hasMctConfig = !!mC;

                    if (hasMctConfig || hasMctMarks) {
                        const mM = mctMarks.find((m) => m.student_id === student.id && m.subject_id === subject.id);
                        const sM = (directMarks || []).find((m) => m.student_id === student.id && m.subject_id === subject.id);
                        
                        mctO = mM?.total ?? 0;
                        semO = sM?.total ?? 0;
                        const mctW = mC?.weight_percent ?? 100;
                        const semW = sC?.weight_percent ?? 100;
                        
                        wO = (mctO * (mctW / 100)) + (semO * (semW / 100));
                        wF = subject.full_marks;
                        
                        mark = { id: "", student_id: student.id, subject_id: subject.id, exam_id: examId, academic_year: "", theory: null, mcq: null, practical: null, total: wO, created_at: "" };
                    } else {
                        const sC = examSubjectConfigs.find((c) => c.exam_id === examId && c.subject_id === subject.id);
                        const semW = sC?.weight_percent ?? 100;
                        mark = (directMarks || []).find((m) => m.student_id === student.id && m.subject_id === subject.id) || null;
                        semO = mark?.total ?? 0;
                        wO = semO * (semW / 100);
                        wF = subject.full_marks;
                    }
                } else {
                    const sC = examSubjectConfigs.find((c) => c.exam_id === examId && c.subject_id === subject.id);
                    const semW = sC?.weight_percent ?? 100;
                    mark = (directMarks || []).find((m) => m.student_id === student.id && m.subject_id === subject.id) || null;
                    semO = mark?.total ?? 0;
                    wO = semO * (semW / 100);
                    wF = subject.full_marks;
                }
                
                wO = Math.round(wO * 100 + 0.0001) / 100;
                const pct = wF > 0 ? (wO / wF) * 100 : 0; 
                const { grade, gradePoint } = getGrade(pct, subject.full_marks);
                return { subject, mark, grade, gradePoint, effectiveFullMarks: wF, weightedObtained: wO, weightedFull: wF, mctObtained: mctO, semesterObtained: semO };
            });
            const tM = subjectResults.reduce((s, r) => s + r.weightedObtained, 0);
            
             // Fix total full marks to the sum of base subject full_marks, ensuring consistency across terms
            const tF = applicableSubjects.reduce((s, subj) => s + subj.full_marks, 0);

            const pct = tF > 0 ? (tM / tF) * 100 : 0; const rP = Math.round(pct * 100 + 0.0001) / 100;
            const mandatorySubjects = subjectResults.filter((r) => r.mark !== null && !r.subject.is_optional);
            const optionalSubjects = subjectResults.filter((r) => r.mark !== null && r.subject.is_optional);
            
            const totalMandatoryCount = subjectResults.filter((r) => !r.subject.is_optional).length;
            const hasFailedMandatory = mandatorySubjects.some((r) => r.grade === "F");
            
            let baseGpa = 0;
            let gpa = 0;
            if (totalMandatoryCount > 0) {
                let totalGp = mandatorySubjects.reduce((s, r) => s + r.gradePoint, 0);
                
                // Calculate base GPA (before optional)
                baseGpa = totalGp / totalMandatoryCount;
                if (baseGpa > 5) baseGpa = 5.00;
                baseGpa = Math.round(baseGpa * 100 + 0.0001) / 100;

                let extraPoints = 0;
                optionalSubjects.forEach(opt => {
                    if (opt.gradePoint > 2) {
                        extraPoints += (opt.gradePoint - 2);
                    }
                });
                
                totalGp += extraPoints;
                gpa = totalGp / totalMandatoryCount;
                if (gpa > 5) gpa = 5.00;
                gpa = Math.round(gpa * 100 + 0.0001) / 100;
            }
            
            
            return { student, subjects: subjectResults, totalMarks: Math.round(tM * 100 + 0.0001) / 100, totalFullMarks: Math.round(tF * 100 + 0.0001) / 100, percentage: rP, baseGpa, gpa, displayGpa: hasFailedMandatory ? 0.00 : gpa, grade: hasFailedMandatory ? "F" : getGradeByGpa(gpa) };
        });
    };

    // ── Generate Final Result ──
    const generateFinalResult = async (students: Student[], subjects: Subject[]): Promise<StudentResult[]> => {
        const semExams = exams.filter((e) => e.exam_type === "semester");
        if (semExams.length === 0) { toast.error("No semester exams found"); return []; }

        // Generate all semester results in parallel (not sequential)
        const semResults: Record<number, StudentResult[]> = {};
        const semResultsArr = await Promise.all(
            semExams.map((sem) => generateSemesterResult(sem.id, students, subjects))
        );
        semExams.forEach((sem, i) => { semResults[sem.term ?? 0] = semResultsArr[i]; });

        // Batch-save all semester results to DB in parallel
        const ay = selectedAcademicYear || '';
        await Promise.all(
            semExams.map((sem, i) => {
                const upserts = semResultsArr[i].map((r: StudentResult) => ({ student_id: r.student.id, exam_id: sem.id, academic_year: ay, total_marks: r.totalMarks, total_full_marks: r.totalFullMarks, percentage: r.percentage, gpa: r.gpa, grade: r.grade }));
                return supabase.from("results").upsert(upserts, { onConflict: "student_id,exam_id,academic_year" });
            })
        );

        // Combine with weights
        return students.map((student) => {
            let finalTotalMarks = 0, finalTotalFull = 0, weightedGpaSum = 0, weightedBaseGpaSum = 0, actualWeightSum = 0;
            const breakdown: StudentResult["semesterBreakdown"] = [];
            for (const term of [1, 2, 3]) {
                const w = SEMESTER_WEIGHTS[term];
                const sr = semResults[term]?.find((r) => r.student.id === student.id);
                if (sr) {
                    const wm = Math.round(sr.totalMarks * w * 100 + 0.0001) / 100;
                    const wg = Math.round(sr.gpa * w * 100 + 0.0001) / 100;
                    const wbg = Math.round(sr.baseGpa * w * 100 + 0.0001) / 100;

                    finalTotalMarks += wm;
                    finalTotalFull += sr.totalFullMarks * w;
                    weightedGpaSum += wg;
                    weightedBaseGpaSum += wbg;
                    actualWeightSum += w;

                    breakdown.push({ term, totalMarks: sr.totalMarks, totalFullMarks: sr.totalFullMarks, percentage: sr.percentage, baseGpa: sr.baseGpa, gpa: sr.gpa, grade: sr.grade, weight: w * 100 });
                }
            }
            finalTotalMarks = Math.round(finalTotalMarks * 100 + 0.0001) / 100;
            
            // Fix total full marks to the sum of base subject full_marks
            const studentGroup = student.group_name || "None";
            const applicableSubjects = subjects.filter(
                (s) => !s.group_name || s.group_name === "Common" || s.group_name === studentGroup
            );
            finalTotalFull = applicableSubjects.reduce((s, subj) => s + subj.full_marks, 0);

            const pct = finalTotalFull > 0 ? Math.round((finalTotalMarks / finalTotalFull) * 10000 + 0.0001) / 100 : 0;
            // Normalize GPA: divide by actual weight sum so missing semesters don't deflate
            const normalizedGpa = actualWeightSum > 0 ? Math.round((weightedGpaSum / actualWeightSum) * 100 + 0.0001) / 100 : 0;
            const normalizedBaseGpa = actualWeightSum > 0 ? Math.round((weightedBaseGpaSum / actualWeightSum) * 100 + 0.0001) / 100 : 0;

            // Grade is based on final GPA (reverse lookup from grading rules)
            const finalGpa = normalizedGpa;
            const finalBaseGpa = normalizedBaseGpa;
            const finalGrade = finalGpa > 0 ? getGradeByGpa(finalGpa) : "F";
            const hasAnyFailed = breakdown.some((b) => b.grade === "F");

            return { student, subjects: [], totalMarks: finalTotalMarks, totalFullMarks: finalTotalFull, percentage: pct, baseGpa: finalBaseGpa, gpa: finalGpa, displayGpa: hasAnyFailed ? 0.00 : finalGpa, grade: hasAnyFailed ? "F" : finalGrade, semesterBreakdown: breakdown };
        });
    };

    const handleGenerate = async () => {
        if (!selectedClass || !selectedExam) return;
        setProcessing(true);

        try {
            const { data: subjects } = await supabase.from("subjects").select(SUBJECT_COLUMNS).eq("class_id", selectedClass).order("name");
            if (!isFinal && !subjects?.length) { toast.error("No subjects found"); setProcessing(false); return; }

            let studentQuery = supabase.from("students").select(STUDENT_COLUMNS).eq("class_id", selectedClass).order("roll");
            if (selectedSection && selectedSection !== "all") studentQuery = studentQuery.eq("section_id", selectedSection);
            const { data: students } = await studentQuery;
            let studentsToUse = (students || []).sort((a: any, b: any) => {
                const na = parseInt(a.roll), nb = parseInt(b.roll);
                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                return (a.roll || '').localeCompare(b.roll || '');
            });
            const activeStudents = studentsToUse.length;
            let historicalMarkStudents = 0;
            let usedHistoricalFallback = false;

            // Historical fallback:
            // after yearly promotion, a previous class may have no active students,
            // but result generation should still work from that class's marks.
            if (!isFinal && studentsToUse.length === 0 && subjects && subjects.length > 0) {
                const subjectIds = subjects.map((s) => s.id);
                const { data: oldMarks } = await supabase
                    .from("marks")
                    .select("student_id")
                    .eq("exam_id", selectedExam)
                    .eq("academic_year", selectedAcademicYear || "")
                    .in("subject_id", subjectIds);

                const oldStudentIds = Array.from(new Set((oldMarks || []).map((m) => m.student_id).filter(Boolean)));
                historicalMarkStudents = oldStudentIds.length;
                if (oldStudentIds.length > 0) {
                    const { data: oldStudents } = await supabase
                        .from("students")
                        .select(STUDENT_COLUMNS)
                        .in("id", oldStudentIds)
                        .order("roll");
                    studentsToUse = (oldStudents || []).sort((a: any, b: any) => {
                        const na = parseInt(a.roll), nb = parseInt(b.roll);
                        if (!isNaN(na) && !isNaN(nb)) return na - nb;
                        return (a.roll || '').localeCompare(b.roll || '');
                    });
                    if (studentsToUse.length > 0) {
                        usedHistoricalFallback = true;
                        toast.info("Using historical students from marks for selected academic year");
                    }
                }
            }


            if (!studentsToUse.length) { toast.error("No students found"); setProcessing(false); return; }
            setCurrentClassSubjects(subjects || []);

            // Fetch attendance data for sorting ties
            const studentIds = studentsToUse.map(s => s.id);
            const { data: attendanceData } = await supabase
                .from("attendance_records")
                .select("student_id, status")
                .in("student_id", studentIds)
                .eq("status", "P");
            
            const attendanceMap: Record<string, number> = {};
            if (attendanceData) {
                for (const att of attendanceData) {
                    attendanceMap[att.student_id] = (attendanceMap[att.student_id] || 0) + 1;
                }
            }

            let studentResults: StudentResult[];
            if (isFinal) {
                studentResults = await generateFinalResult(studentsToUse, subjects || []);
                // Assign positions before persisting
                assignPositions(studentResults);

                // ── Persist to final_results & final_result_details (batch) ──
                const now = new Date();
                const academicYear = `${now.getFullYear() - 1}-${now.getFullYear()}`;
                // Batch upsert all final results at once
                const finalResultPayloads = studentResults.map((r) => ({
                    student_id: r.student.id,
                    class_id: selectedClass,
                    academic_year: academicYear,
                    total_marks: r.totalMarks,
                    total_full_marks: r.totalFullMarks,
                    percentage: r.percentage,
                    gpa: r.gpa,
                    grade: r.grade,
                    position: r.position ?? null,
                }));
                const { data: frRows } = await supabase.from("final_results").upsert(
                    finalResultPayloads,
                    { onConflict: "student_id,class_id,academic_year" }
                ).select("id, student_id");

                // Batch upsert all semester detail rows
                if (frRows && frRows.length > 0) {
                    const frMap = new Map(frRows.map((fr) => [fr.student_id, fr.id]));
                    const allDetails: any[] = [];
                    for (const r of studentResults) {
                        const frId = frMap.get(r.student.id);
                        if (frId && r.semesterBreakdown) {
                            for (const b of r.semesterBreakdown) {
                                allDetails.push({
                                    final_result_id: frId,
                                    term: b.term,
                                    percentage: b.percentage,
                                    raw_marks: b.totalMarks,
                                    raw_full_marks: b.totalFullMarks,
                                    raw_gpa: b.gpa,
                                    weighted_marks: Math.round(b.totalMarks * (b.weight / 100) * 100) / 100,
                                    weighted_gpa: Math.round(b.gpa * (b.weight / 100) * 100) / 100,
                                    grade: b.grade,
                                });
                            }
                        }
                    }
                    if (allDetails.length > 0) {
                        await supabase.from("final_result_details").upsert(allDetails, { onConflict: "final_result_id,term" });
                    }
                }
            } else {
                studentResults = await generateSemesterResult(selectedExam, studentsToUse, subjects || []);
                const ay2 = selectedAcademicYear || '';
                const upserts = studentResults.map((r) => ({ student_id: r.student.id, exam_id: selectedExam, academic_year: ay2, total_marks: r.totalMarks, total_full_marks: r.totalFullMarks, percentage: r.percentage, gpa: r.gpa, grade: r.grade }));
                await supabase.from("results").upsert(upserts, { onConflict: "student_id,exam_id,academic_year" });
            }

            // Inject attendance count
            studentResults.forEach(r => {
                r.attendanceCount = attendanceMap[r.student.id] || 0;
            });

            // Assign positions (not for MCT) — skip if already assigned in final result path
            if (!isFinal && showPosition) assignPositions(studentResults);

            setResults(studentResults.sort((a, b) => parseInt(a.student.roll) - parseInt(b.student.roll))); setGenerated(true);
            toast.success(`Results generated for ${studentResults.length} students`);
        } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to generate results"); }
        finally { setProcessing(false); }
    };

    const getGradeColor = (g: string) => {
        if (g === "F" || g === "N/A") return "bg-red-50 text-red-600 border border-red-200/50 rounded-md shadow-none font-semibold";
        return "bg-muted/50 border border-border/50 text-foreground rounded-md shadow-none font-semibold";
    };

    const filteredResults = results.filter((r) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return r.student.name.toLowerCase().includes(q) || r.student.roll.toLowerCase().includes(q);
    });

    const generateCardHtml = (r: StudentResult) => {
        const cn = escapeHtml(classes.find((c) => c.id === selectedClass)?.name || "");
        const sn = escapeHtml(sections.find((s) => s.id === r.student.section_id)?.name || "");
        const en = escapeHtml(isFinal ? "Final Result" : selectedExamObj?.name || "");
        const studentName = escapeHtml(r.student.name);
        const studentRoll = escapeHtml(r.student.roll);
        const schoolName = escapeHtml(schoolInfo?.name || "School Name");
        const schoolAddress = escapeHtml(schoolInfo?.address);
        const schoolPhone = escapeHtml(schoolInfo?.phone);
        const schoolEmail = escapeHtml(schoolInfo?.email);
        const principalName = escapeHtml(schoolInfo?.principal_name || "Principal");

        const grading100 = gradingRules.filter((g) => g.marks_category === 100);
        let gradingHtml = "";
        if (grading100.length > 0) {
            gradingHtml = `<div class="slabel">Grading Scale (100 Marks)</div><table class="gtbl"><tr>${grading100.map((g) => `<th>${g.grade}</th>`).join("")}</tr><tr>${grading100.map((g) => `<td>${g.min_marks}-${g.max_marks}%</td>`).join("")}</tr><tr>${grading100.map((g) => `<td>GP ${g.grade_point}</td>`).join("")}</tr></table>`;
        }

        let marksHtml = "";
        if (!isFinal && r.subjects.length > 0) {
            const allSubs = r.subjects;
            const hasMctCols = !!pairedMctExam;

            const rows = allSubs.map((s, i) => {
                const mctTd = hasMctCols ? `<td style="text-align:center">${s.mctObtained !== undefined ? s.mctObtained : "-"}</td><td style="text-align:center">${s.semesterObtained !== undefined ? s.semesterObtained : "-"}</td>` : "";
                return `<tr class="${i % 2 === 0 ? "e" : "o"}"><td style="text-align:center;color:#888">${i + 1}</td><td style="text-align:left !important">${s.subject.name}${s.subject.is_optional ? ' <span style="color:#718096;font-size:11px">(Optional)</span>' : ""}</td><td style="text-align:center">${s.weightedFull}</td>${mctTd}<td style="text-align:center;font-weight:700">${s.weightedObtained}</td><td style="text-align:center;font-weight:600;${s.grade === "F" ? "color:#dc2626 !important" : ""}">${s.grade}</td><td style="text-align:center;font-family:monospace">${s.gradePoint.toFixed(2)}</td></tr>`;
            }).join("");
            
            const tObt = allSubs.reduce((sum, s) => sum + s.weightedObtained, 0);
            const tFull = allSubs.reduce((sum, s) => sum + s.weightedFull, 0);
            const tGp = allSubs.reduce((sum, s) => sum + s.gradePoint, 0);
            const tMct = allSubs.reduce((sum, s) => sum + (s.mctObtained || 0), 0);
            const tSem = allSubs.reduce((sum, s) => sum + (s.semesterObtained || 0), 0);

            const mctTh = hasMctCols ? `<th style="text-align:center;width:50px">MCT</th><th style="text-align:center;width:60px">Semester</th>` : "";
            const mctTotTd = hasMctCols ? `<td style="text-align:center">${Math.round(tMct * 100) / 100}</td><td style="text-align:center">${Math.round(tSem * 100) / 100}</td>` : "";

            marksHtml = `<div class="slabel">Subject Results</div><table class="mtbl"><thead><tr><th style="text-align:center;width:30px">SL</th><th style="text-align:left !important">Subject</th><th style="text-align:center;width:50px">Full</th>${mctTh}<th style="text-align:center;width:60px">Total</th><th style="text-align:center;width:50px">Grade</th><th style="text-align:center;width:45px">GP</th></tr></thead><tbody>${rows}<tr class="tot"><td colspan="2" style="text-align:left !important">Total</td><td style="text-align:center">${tFull}</td>${mctTotTd}<td style="text-align:center">${Math.round(tObt * 100) / 100}</td><td style="text-align:center">-</td><td style="text-align:center;font-family:monospace">${tGp.toFixed(2)}</td></tr></tbody></table>`;
        }

        let breakdownHtml = "";
        const hasOptional = currentClassSubjects.some(s => s.is_optional) || false;
        if (isFinal && r.semesterBreakdown) {
            const semLabels: Record<number, string> = { 1: "1st Semester", 2: "2nd Semester", 3: "3rd Semester" };
            const bRows = r.semesterBreakdown.map((b, i) => {
                const wm = Math.round(b.totalMarks * (b.weight / 100) * 100 + 0.0001) / 100;
                const wg = Math.round(b.gpa * (b.weight / 100) * 100 + 0.0001) / 100;
                return `<tr class="${i % 2 === 0 ? "e" : "o"}"><td style="text-align:center">${semLabels[b.term] || b.term}</td><td style="text-align:center">${b.weight.toFixed(2)}%</td><td style="text-align:center">${b.totalMarks}</td>${hasOptional ? `<td style="text-align:center">${b.baseGpa.toFixed(2)}</td>` : ""}<td style="text-align:center">${b.gpa.toFixed(2)}</td><td style="text-align:center">${wm}</td><td style="text-align:center">${wg.toFixed(2)}</td></tr>`;
            }).join("");
            const totalRaw = r.semesterBreakdown.reduce((s, b) => s + b.totalMarks, 0);
            const totalRawBaseGpa = r.semesterBreakdown.reduce((s, b) => s + b.baseGpa, 0);
            const totalRawGpa = r.semesterBreakdown.reduce((s, b) => s + b.gpa, 0);
            const totalWm = r.semesterBreakdown.reduce((s, b) => s + Math.round(b.totalMarks * (b.weight / 100) * 100 + 0.0001) / 100, 0);
            const totalWg = r.semesterBreakdown.reduce((s, b) => s + Math.round(b.gpa * (b.weight / 100) * 100 + 0.0001) / 100, 0);
            breakdownHtml = `<table class="mtbl"><thead><tr><th style="text-align:center">Semester</th><th style="text-align:center">Percentage</th><th style="text-align:center">Raw Number</th>${hasOptional ? '<th style="text-align:center">Raw Base GPA</th>' : ""}<th style="text-align:center">${hasOptional ? "Raw Final GPA" : "Raw GPA"}</th><th style="text-align:center">Weighted Marks</th><th style="text-align:center">${hasOptional ? "Weighted Final GPA" : "Weighted GPA"}</th></tr></thead><tbody>${bRows}<tr class="tot"><td style="text-align:center">Final</td><td style="text-align:center">100.00%</td><td style="text-align:center">${Math.round(totalRaw * 100) / 100}</td>${hasOptional ? `<td style="text-align:center">${Math.round(totalRawBaseGpa * 100) / 100}</td>` : ""}<td style="text-align:center">${Math.round(totalRawGpa * 100) / 100}</td><td style="text-align:center">${Math.round(totalWm * 100) / 100}</td><td style="text-align:center">${Math.round(totalWg * 100) / 100}</td></tr></tbody></table>`;
        }

        const posHtml = (showPosition || isFinal) ? `<tr><td class="lb">Position</td><td class="vl" style="color:#1a365d;font-weight:700">${r.position}${r.position ? posSuffix(r.position) : "-"}</td><td class="lb">Total Students</td><td class="vl">${results.length}</td></tr>` : "";

        const css = `.rc-view *{margin:0;padding:0;box-sizing:border-box}
.rc-view,.rc-view .pg{font-family:'Poppins',ui-sans-serif,system-ui,sans-serif;color:#1a202c;font-size:13px;line-height:1.6}
.rc-view .pg{max-width:700px;margin:0 auto;padding:10mm 10mm}
.rc-view .tb{border-top:4px double #1a365d;border-bottom:2px solid #1a365d;height:4px;margin-bottom:8px}
.rc-view .bb{border-top:2px solid #1a365d;border-bottom:4px double #1a365d;height:4px;margin-top:10px}
.rc-view .hdr{text-align:center;margin-bottom:6px}.rc-view .hdr img{height:48px;margin-bottom:4px}
.rc-view .hdr h1{font-size:22px;font-weight:700;color:#1a365d;letter-spacing:1px}
.rc-view .hdr .ad{font-size:12px;color:#555}.rc-view .hdr .ct{font-size:10px;color:#777}
.rc-view .tbar{border-top:1px solid #ccc;border-bottom:1px solid #ccc;padding:5px 0;margin-top:8px;background:#f0f4ff;text-align:center}
.rc-view .tbar h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#2d3748}
.rc-view .tbar .en{font-size:12px;color:#4a5568;margin-top:1px}
.rc-view .itbl{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
.rc-view .itbl td{padding:4px 6px;border-bottom:1px solid #e2e8f0}
.rc-view .lb{color:#718096;width:22%}.rc-view .vl{font-weight:600;width:28%}
.rc-view .mtbl{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:12px;border:2px solid #2d3748}
.rc-view .mtbl th{background:#1a365d;color:#fff;padding:5px 8px;border:1px solid #2d3748;text-align:center;font-size:12px}
.rc-view .mtbl td{padding:4px 8px;border:1px solid #2d3748;font-size:12px}
.rc-view .mtbl tr.e{background:#fff}.rc-view .mtbl tr.o{background:#f8fafc}
.rc-view .mtbl tr.tot{background:#edf2f7;font-weight:700}.rc-view .mtbl tr.tot td{border:1px solid #2d3748}
.rc-view .stbl{width:100%;border-collapse:collapse;border:2px solid #2d3748;margin-bottom:10px;font-size:12px}
.rc-view .stbl td{padding:6px;text-align:center}
.rc-view .sl{font-size:9px;color:#718096;text-transform:uppercase;letter-spacing:1px}
.rc-view .sv{font-size:16px;font-weight:800;color:#1a365d}
.rc-view .st td{background:#f0f4ff;border-right:1px solid #2d3748}.rc-view .st td:last-child{border-right:none}
.rc-view .slabel{font-size:9px;color:#718096;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
.rc-view .gtbl{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px}
.rc-view .gtbl th{background:#edf2f7;padding:3px 5px;border:1px solid #cbd5e0;text-align:center;font-weight:600}
.rc-view .gtbl td{padding:3px 5px;border:1px solid #cbd5e0;text-align:center;color:#4a5568}
.rc-view .sigs{width:100%;table-layout:fixed;margin-top:30px;border-collapse:collapse}
.rc-view .sigs td{text-align:center;vertical-align:top}
.rc-view .sigb{width:160px;margin:0 auto;border-top:1.5px solid #2d3748;padding-top:4px;font-size:10px;color:#4a5568}
/* High contrast B&W theme for preview and print */
.rc-view, .rc-view * { color: #000 !important; border-color: #000 !important; }
.rc-view .mtbl th, .rc-view .mtbl th * { color: #fff !important; background-color: #000 !important; }
.rc-view .tbar { background: transparent !important; border-top: 2px solid #000 !important; border-bottom: 2px solid #000 !important; }
.rc-view .st td, .rc-view .mtbl tr.e, .rc-view .mtbl tr.o { background: transparent !important; }
.rc-view .gtbl th, .rc-view .mtbl tr.tot { background: #e2e8f0 !important; }`;

        const body = `<div class="pg">
<div class="tb"></div>
<div class="hdr">
${schoolInfo?.logo_url ? `<img src="${escapeHtml(schoolInfo.logo_url)}" alt="Logo">` : ""}
<h1>${schoolName}</h1>
${schoolAddress ? `<div class="ad">${schoolAddress}</div>` : ""}
${(schoolPhone || schoolEmail) ? `<div class="ct">${[schoolPhone ? "Phone: " + schoolPhone : "", schoolEmail ? "Email: " + schoolEmail : ""].filter(Boolean).join("  |  ")}</div>` : ""}
<div class="tbar"><h2>${isFinal ? "Final Academic Result" : "Academic Report Card"}</h2><div class="en">${en}</div><div class="en" style="font-size:11px;margin-top:2px">Active Academic Year: ${escapeHtml(selectedAcademicYear)}</div></div>
</div>
<table class="itbl"><tr><td class="lb">Student Name</td><td class="vl">${studentName}</td><td class="lb">Class</td><td class="vl">${cn}</td></tr>
<tr><td class="lb">Roll No.</td><td class="vl">${studentRoll}</td><td class="lb">Section</td><td class="vl">${sn || "-"}</td></tr>
${posHtml}</table>
${marksHtml}${breakdownHtml}
<table class="stbl"><tr class="st"><td style="width:${hasOptional ? '20%' : '25%'}"><div class="sl">Total Marks</div><div class="sv">${r.totalMarks}/${r.totalFullMarks}</div></td>
<td style="width:${hasOptional ? '20%' : '25%'}"><div class="sl">Percentage</div><div class="sv">${r.percentage.toFixed(2)}%</div></td>
${hasOptional ? `<td style="width:20%"><div class="sl">Base GPA</div><div class="sv">${r.baseGpa.toFixed(2)}</div></td>` : ""}
<td style="width:${hasOptional ? '20%' : '25%'}"><div class="sl">${hasOptional ? "Final GPA" : "GPA"}</div><div class="sv">${r.displayGpa.toFixed(2)}</div></td>
<td style="width:${hasOptional ? '20%' : '25%'}"><div class="sl">Grade</div><div class="sv" ${r.grade === "F" ? 'style="color:#dc2626"' : ""}>${r.grade}</div></td></tr></table>
${gradingHtml}
<table class="sigs"><tr>
<td><div class="sigb">Class Teacher</div></td>
<td><div class="sigb">${principalName}</div></td>
<td><div class="sigb">Guardian</div></td>
</tr></table>
<div class="bb"></div></div>`;

        return { css, body };
    };

    const handlePrint = (r: StudentResult) => {
        const { css, body } = generateCardHtml(r);
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report Card - ${r.student.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
@page{size:A4 portrait;margin:0}
${css}
body{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}
</style></head><body><div class="rc-view">${body}</div></body></html>`;

        printHtml(html);
    };

    const handlePrintAll = () => {
        const cn = escapeHtml(classes.find((c) => c.id === selectedClass)?.name || "");
        const sn = escapeHtml(selectedSection && selectedSection !== "all" ? sections.find((s) => s.id === selectedSection)?.name : "All Sections");
        const en = escapeHtml(isFinal ? "Final Result" : selectedExamObj?.name || "");

        const sorted = [...filteredResults].sort((a, b) => parseInt(a.student.roll) - parseInt(b.student.roll));

        const gradesList = ["A+", "A", "A-", "B", "C", "D", "F"];
        const gradeCounts: Record<string, number> = {};
        gradesList.forEach(g => gradeCounts[g] = 0);
        
        sorted.forEach(r => {
            const g = r.grade;
            if (gradeCounts[g] !== undefined) gradeCounts[g]++;
        });

        const summaryHtml = `<div style="text-align:center;">
<div style="margin-top:24px;font-size:12px;font-weight:700;color:#1a365d;text-transform:uppercase;margin-bottom:8px;letter-spacing:1px;">Grade Summary</div>
<table style="width:100%;max-width:700px;border:2px solid #2d3748;border-collapse:collapse;margin:0 auto 20px auto;">
    <tr>
        <th style="background:#edf2f7 !important;color:#1a365d !important;padding:6px 8px;border:1px solid #2d3748;font-size:12px;text-align:center;font-weight:700;">Grade</th>
        ${gradesList.map((g) => `<th style="background:#edf2f7 !important;color:#1a365d !important;padding:6px 8px;border:1px solid #2d3748;font-size:12px;text-align:center;font-weight:700;">${g}</th>`).join('')}
        <th style="background:#edf2f7 !important;color:#1a365d !important;padding:6px 8px;border:1px solid #2d3748;font-size:12px;text-align:center;font-weight:700;">Total</th>
    </tr>
    <tr>
        <td style="background:#f8fafc !important;padding:6px 8px;border:1px solid #2d3748;font-size:12px;font-weight:700;text-align:center;color:#1a365d !important;">Students</td>
        ${gradesList.map((g) => `<td style="padding:6px 8px;border:1px solid #2d3748;font-size:13px;font-weight:700;text-align:center;color:#1a202c !important;">${gradeCounts[g]}</td>`).join('')}
        <td style="background:#f8fafc !important;padding:6px 8px;border:1px solid #2d3748;font-size:13px;font-weight:700;text-align:center;color:#1a202c !important;">${sorted.length}</td>
    </tr>
</table>
</div>`;

        const rows = sorted.map((r, i) => {
            const secName = escapeHtml(sections.find((s) => s.id === r.student.section_id)?.name || "-");
            return `<tr class="${i % 2 === 0 ? 'e' : 'o'}">
                <td>${escapeHtml(r.student.roll)}</td>
                <td style="text-align:left !important">${escapeHtml(r.student.name)}</td>
                ${(!selectedSection || selectedSection === "all") ? `<td>${secName}</td>` : ""}
                <td style="font-weight:600">${r.totalMarks}</td>
                <td>${r.displayGpa.toFixed(2)}</td>
                <td style="font-weight:600;${r.grade === "F" ? "color:#dc2626 !important" : ""}">${r.grade}</td>
                ${(showPosition || isFinal) ? `<td>${r.position || "-"}</td>` : ""}
            </tr>`;
        }).join("");

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Result - ${cn} - ${en}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>@page{size:A4 portrait;margin:0}*{margin:0;padding:0;box-sizing:border-box}
body{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important;font-family:'Poppins',sans-serif;color:#1a202c;font-size:13px}
.pg{max-width:750px;margin:0 auto;padding:12mm 10mm}
.tb{border-top:4px double #1a365d;border-bottom:2px solid #1a365d;height:4px;margin-bottom:8px}
.bb{border-top:2px solid #1a365d;border-bottom:4px double #1a365d;height:4px;margin-top:10px}
.hdr{text-align:center;margin-bottom:12px}
.hdr h1{font-size:22px;font-weight:700;color:#1a365d;letter-spacing:1px}
.hdr .ad{font-size:11px;color:#555}.hdr .ct{font-size:9px;color:#777}
.tbar{border-top:1px solid #ccc;border-bottom:1px solid #ccc;padding:4px 0;margin:8px 0;background:#f0f4ff !important;text-align:center}
.tbar h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#2d3748}
.tbar .en{font-size:12px;color:#4a5568;margin-top:1px}
.info{font-size:12px;color:#4a5568;margin-bottom:8px}
table{width:100%;border-collapse:collapse;font-size:12px;border:2px solid #2d3748}
th{background:#1a365d !important;color:#fff !important;padding:7px 8px;border:1px solid #2d3748;text-align:center;white-space:nowrap;font-weight:700}
td{text-align:center;padding:5px 8px;border:1px solid #2d3748}
tr.e{background:#fff !important}
tr.o{background:#f8fafc !important}
/* High contrast B&W theme for preview and print */
*, body { color: #000 !important; border-color: #000 !important; }
th, th * { color: #fff !important; background-color: #000 !important; }
.tbar { background: transparent !important; border-top: 2px solid #000 !important; border-bottom: 2px solid #000 !important; }
tr.e, tr.o { background: transparent !important; }
</style></head><body><div class="pg">
<div class="tb"></div>
<div class="hdr">
${schoolInfo?.logo_url ? `<img src="${schoolInfo.logo_url}" alt="Logo" style="height:48px;margin:0 auto 4px;display:block">` : ""}
<h1>${schoolInfo?.name || "School Name"}</h1>
${schoolInfo?.address ? `<div class="ad">${schoolInfo.address}</div>` : ""}
</div>
<div class="tbar"><h2>Result Sheet</h2><div class="en">${en} — ${cn}${sn ? " (" + sn + ")" : ""}</div><div class="en" style="font-size:11px;margin-top:2px">Active Academic Year: ${selectedAcademicYear}</div></div>
<div class="info">Total Students: ${sorted.length}</div>
<table>
<thead><tr>
<th style="width:50px">Roll</th><th style="text-align:left !important">Name</th>
${(!selectedSection || selectedSection === "all") ? '<th>Section</th>' : ""}
<th style="width:65px">Total Marks</th>
<th style="width:50px">GPA</th>
<th style="width:50px">Grade</th>
${(showPosition || isFinal) ? '<th style="width:55px">Position</th>' : ""}
</tr></thead>
<tbody>${rows}</tbody>
</table>
${summaryHtml}
<div class="bb"></div>
</div></body></html>`;

        printHtml(html);
    };

    const handlePrintAllCards = () => {
        const sorted = [...filteredResults].sort((a, b) => parseInt(a.student.roll) - parseInt(b.student.roll));
        if (sorted.length === 0) return;

        const { css } = generateCardHtml(sorted[0]);
        const pages = sorted.map((r) => generateCardHtml(r).body).join("");

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report Cards</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
@page{size:A4 portrait;margin:0}
@media print{.pg{page-break-after:always}.pg:last-child{page-break-after:auto}}
${css}
body{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}
</style></head><body><div class="rc-view">${pages}</div></body></html>`;

        printHtml(html);
    };

    const handleDownloadCSV = () => {
        const cn = classes.find((c) => c.id === selectedClass)?.name || "Class";
        const en = isFinal ? "Final_Result" : selectedExamObj?.name?.replace(/\s+/g, "_") || "Exam";
        const hasSection = !selectedSection || selectedSection === "all";
        const header = ["Roll", "Name", ...(hasSection ? ["Section"] : []), "Total", "Full", "Percentage", "GPA", "Grade", ...(showPosition || isFinal ? ["Position"] : [])].join(",");
        const rows = results.map((r) => [
            r.student.roll,
            `"${r.student.name}"`,
            ...(hasSection ? [sections.find((s) => s.id === r.student.section_id)?.name || "-"] : []),
            r.totalMarks, r.totalFullMarks, r.percentage.toFixed(2), r.displayGpa.toFixed(2), r.grade,
            ...(showPosition || isFinal ? [r.position || "-"] : []),
        ].join(","));
        const csv = [header, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${cn}_${en}_Result.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                icon={ChartBar}
                iconBg="bg-primary/10"
                iconColor="text-primary"
                title="Results"
                subtitle="Generate and view exam results."
            />

            <div className="bg-card rounded-2xl border border-border/50 shadow-none p-5">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[140px]">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Class</p>
                        <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setGenerated(false); }}>
                            <SelectTrigger className="w-full h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30"><SelectValue placeholder="Select Class" /></SelectTrigger>
                            <SelectContent className="rounded-xl border-border/50 shadow-md">{classes.map((c) => (<SelectItem key={c.id} value={c.id} className="rounded-lg">{c.name}</SelectItem>))}</SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Section</p>
                        <Select value={selectedSection} onValueChange={(v) => { setSelectedSection(v); setGenerated(false); }}>
                            <SelectTrigger className="w-full h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30"><SelectValue placeholder="All Sections" /></SelectTrigger>
                            <SelectContent className="rounded-xl border-border/50 shadow-md"><SelectItem value="all" className="rounded-lg">All Sections</SelectItem>{sections.map((s) => (<SelectItem key={s.id} value={s.id} className="rounded-lg">{s.name}</SelectItem>))}</SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Exam</p>
                        <Select value={selectedExam} onValueChange={(v) => { setSelectedExam(v); setGenerated(false); }}>
                            <SelectTrigger className="w-full h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30"><SelectValue placeholder="Select Exam" /></SelectTrigger>
                            <SelectContent className="rounded-xl border-border/50 shadow-md">
                                <SelectItem value={FINAL_RESULT_ID} className="rounded-lg">Final Result (Annual)</SelectItem>
                                {exams.map((e) => (<SelectItem key={e.id} value={e.id} className="rounded-lg">{e.name}{e.exam_type === "semester" && " (Combined)"}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Year</p>
                        <Select value={selectedAcademicYear} onValueChange={(v) => { setSelectedAcademicYear(v); setGenerated(false); }}>
                            <SelectTrigger className="w-full h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30"><SelectValue placeholder="Active Academic Year" /></SelectTrigger>
                            <SelectContent className="rounded-xl border-border/50 shadow-md">
                                {academicYearOptions.map((y) => (<SelectItem key={y} value={y} className="rounded-lg">{y}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="mt-5 flex justify-end">
                    <Button onClick={handleGenerate} disabled={!selectedClass || !selectedExam || processing} className="bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 shadow-none font-semibold transition-all duration-200 btn-press h-11 px-6 w-full sm:w-auto">
                        <Sparkle size={16} strokeWidth={1.5} className="mr-2" />{processing ? "Generating..." : "Generate Result"}
                    </Button>
                </div>
            </div>

            {isFinal && (<Card className="border-0 bg-muted/50 shadow-none rounded-2xl"><CardContent className="py-4"><p className="text-sm text-muted-foreground font-medium"><strong>Final Result:</strong> 1st Semester (25%) + 2nd Semester (25%) + 3rd Semester (50%)</p></CardContent></Card>)}

            {gradingRules.length === 0 && (<Card className="border-0 bg-red-50 shadow-none rounded-2xl"><CardContent className="flex items-center gap-3 py-4"><WarningCircle size={20} strokeWidth={1.5} className="text-red-500" /><p className="text-sm text-red-600 font-medium">No grading rules. Go to Exams &gt; Grading System.</p></CardContent></Card>)}

            {!generated && (<div className="bg-transparent rounded-2xl border-2 border-dashed border-border/50 p-12 text-center shadow-none"><div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 mx-auto text-muted-foreground/40"><ChartBar size={32} strokeWidth={1.2} /></div><h3 className="font-semibold text-lg text-foreground mb-1">Generate Results</h3><p className="text-sm text-muted-foreground max-w-sm mx-auto">Select class, section, and exam type.</p></div>)}

            {generated && results.length > 0 && (
                <Card className="bg-card rounded-2xl border-border/50 shadow-none overflow-hidden">
                    <CardHeader className="pb-3 bg-white">
                        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                            {classes.find((c) => c.id === selectedClass)?.name}
                            {selectedSection && selectedSection !== "all" && <Badge variant="outline" className="bg-muted/50 border-border/50 text-muted-foreground rounded-md shadow-none">{sections.find((s) => s.id === selectedSection)?.name}</Badge>}
                            <span className="text-muted-foreground">-</span>
                            {isFinal ? "Final Result" : selectedExamObj?.name}
                            {isFinal && <Badge className="bg-muted text-foreground border-0 rounded-md shadow-none hover:bg-muted/80">Annual</Badge>}
                            {isSemester && <Badge variant="secondary" className="bg-muted text-foreground border-0 rounded-md shadow-none hover:bg-muted/80">Combined</Badge>}
                            <Badge variant="secondary" className="ml-auto bg-muted text-muted-foreground border-0 rounded-md font-medium shadow-none hover:bg-muted/80">{results.length} students</Badge>
                        </CardTitle>
                        <div className="flex gap-2 mt-2 flex-wrap">
                            <Input
                                placeholder="Search by name or roll..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-[220px] h-9 rounded-lg bg-muted border-0 focus-visible:ring-1 focus-visible:ring-ring/30 px-3"
                            />
                            <Button variant="outline" size="sm" className="h-9 rounded-lg bg-muted border-0 hover:bg-muted/80 transition-colors text-foreground font-medium shadow-none" onClick={handleDownloadCSV}>
                                <DownloadSimple size={14} strokeWidth={1.5} className="mr-1.5" />Download CSV
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 rounded-lg bg-muted border-0 hover:bg-muted/80 transition-colors text-foreground font-medium shadow-none" onClick={handlePrintAll}>
                                <Printer size={14} strokeWidth={1.5} className="mr-1.5" />Print Summary
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 rounded-lg bg-muted border-0 hover:bg-muted/80 transition-colors text-foreground font-medium shadow-none" onClick={handlePrintAllCards}>
                                <Printer size={14} strokeWidth={1.5} className="mr-1.5" />Print All Cards
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader><TableRow>
                                <TableHead className="w-14 whitespace-nowrap">Roll</TableHead><TableHead className="whitespace-nowrap">Name</TableHead>
                                {(!selectedSection || selectedSection === "all") && <TableHead className="whitespace-nowrap hidden sm:table-cell">Section</TableHead>}
                                <TableHead className="text-center whitespace-nowrap">Total</TableHead><TableHead className="text-center whitespace-nowrap">%</TableHead>
                                <TableHead className="text-center whitespace-nowrap">GPA</TableHead><TableHead className="text-center whitespace-nowrap">Grade</TableHead>
                                {(showPosition || isFinal) && <TableHead className="text-center whitespace-nowrap hidden md:table-cell">Position</TableHead>}
                                <TableHead className="text-center whitespace-nowrap">Report</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {filteredResults.map((r) => (
                                    <TableRow key={r.student.id} className="hover:bg-muted/30 transition-colors border-b-border/50">
                                        <TableCell className="font-mono">{r.student.roll}</TableCell>
                                        <TableCell className="font-medium whitespace-nowrap">{r.student.name}</TableCell>
                                        {(!selectedSection || selectedSection === "all") && <TableCell className="text-muted-foreground hidden sm:table-cell">{sections.find((s) => s.id === r.student.section_id)?.name || "-"}</TableCell>}
                                        <TableCell className="text-center whitespace-nowrap">{r.totalMarks}/{r.totalFullMarks}</TableCell>
                                        <TableCell className="text-center font-mono whitespace-nowrap">{r.percentage.toFixed(2)}%</TableCell>
                                        <TableCell className="text-center font-mono">{r.displayGpa.toFixed(2)}</TableCell>
                                        <TableCell className="text-center"><Badge className={getGradeColor(r.grade)}>{r.grade}</Badge></TableCell>
                                        {(showPosition || isFinal) && <TableCell className="text-center font-semibold hidden md:table-cell">{r.position}{r.position ? posSuffix(r.position) : "-"}</TableCell>}
                                        <TableCell className="text-center"><Button variant="ghost" size="sm" className="rounded-lg hover:bg-muted font-medium" onClick={() => setReportStudent(r)}><Eye size={14} strokeWidth={1.5} className="mr-1.5 hidden sm:inline" />View</Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Preview Dialog */}
            <Dialog open={!!reportStudent} onOpenChange={(o) => (!o ? setReportStudent(null) : null)}>
                <DialogContent className="w-full max-h-[95vh] overflow-y-auto p-0 bg-card outline-none rounded-3xl border-border/50 shadow-2xl [&::-webkit-scrollbar]:hidden [&>button]:hidden" style={{ msOverflowStyle: "none", scrollbarWidth: "none", maxWidth: "780px", width: "100%" }}>
                    <div className="flex justify-between items-center px-6 py-4 sticky top-0 bg-card z-10 border-b border-border/50">
                        <DialogTitle className="text-lg font-bold text-foreground">Report Card Preview</DialogTitle>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="sm" className="h-9 rounded-lg bg-muted border-0 hover:bg-muted/80 transition-colors text-foreground font-medium shadow-none px-4" onClick={() => reportStudent && handlePrint(reportStudent)}>
                                <Printer size={16} strokeWidth={1.5} className="mr-2" />Print
                            </Button>
                            <DialogClose asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0 hover:bg-muted bg-muted/50 text-muted-foreground">
                                    <X size={18} strokeWidth={1.5} />
                                </Button>
                            </DialogClose>
                        </div>
                    </div>
                    {reportStudent && (() => {
                        const { css, body } = generateCardHtml(reportStudent);
                        return (
                            <div
                                className="rc-view"
                                dangerouslySetInnerHTML={{ __html: `<style>${css}</style>${body}` }}
                            />
                        );
                    })()}
                </DialogContent>
            </Dialog>

        </div>
    );
}
