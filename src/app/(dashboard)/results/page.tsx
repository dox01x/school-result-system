"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
import { getCachedClasses, getCachedExams, getCachedGradingRules, getCachedSchoolInfo, getCachedExamConfigs, getCachedSections } from "@/lib/cache/master-data-cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart as ChartBar, Sparkles as Sparkle, Printer, Eye, AlertCircle as WarningCircle, Download as DownloadSimple, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import {
    calculateSubjectGrade,
    calculateStudentSemesterSummary,
    calculateStudentFinalSummary,
    sortAndRankStudentResults,
    getPositionSuffix,
    getGradeBadgeStyle,
    type StudentRankedResult,
    type StudentSubjectCalculation,
} from "@/lib/academic-calculator";
import { SEMESTER_WEIGHTS, ALL_DEFAULT_GRADING } from "@/lib/constants/exam-defaults";

const FINAL_RESULT_ID = "__final_result__";

export default function ResultsPage() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedExam, setSelectedExam] = useState("");
    const [results, setResults] = useState<StudentRankedResult[]>([]);
    const [gradingRules, setGradingRules] = useState<GradingRule[]>([]);
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
    const [examSubjectConfigs, setExamSubjectConfigs] = useState<ExamSubjectConfig[]>([]);
    const [processing, setProcessing] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [reportStudent, setReportStudent] = useState<StudentRankedResult | null>(null);
    const [currentClassSubjects, setCurrentClassSubjects] = useState<Subject[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedAcademicYear, setSelectedAcademicYear] = useState(new Date().getFullYear().toString());

    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [cData, eData, gData, sData, cfgData] = await Promise.all([
                getCachedClasses(),
                getCachedExams(),
                getCachedGradingRules(),
                getCachedSchoolInfo(),
                getCachedExamConfigs(),
            ]);
            if (cancelled) return;
            setClasses(cData);
            setExams(eData);
            setGradingRules(gData);
            if (sData) {
                setSchoolInfo(sData);
                if (sData.current_academic_year) {
                    setSelectedAcademicYear(sData.current_academic_year);
                }
            }
            setExamSubjectConfigs(cfgData);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!selectedClass) { setSections([]); setSelectedSection(""); return; }
        let cancelled = false;
        (async () => {
            const sData = await getCachedSections(selectedClass);
            if (cancelled) return;
            setSections(sData);
            setSelectedSection("");
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedClass]);

    const isFinal = selectedExam === FINAL_RESULT_ID;
    const selectedExamObj = exams.find((e) => e.id === selectedExam);
    const isMCT = selectedExamObj?.exam_type === "mct";
    const isSemester = selectedExamObj?.exam_type === "semester";
    const pairedMctExam = isSemester ? exams.find((e) => e.exam_type === "mct" && e.term === selectedExamObj?.term) : null;
    const showPosition = !isMCT;

    const academicYearOptions = useMemo(() => {
        const y = new Date().getFullYear();
        const options: string[] = [];
        for (let i = y - 2; i <= y + 1; i++) options.push(i.toString());
        return options;
    }, []);

    // ── Generate semester result for students ──
    const generateSemesterResult = useCallback(
        async (examId: string, students: Student[], subjects: Subject[]): Promise<StudentRankedResult[]> => {
            const exam = exams.find((e) => e.id === examId);
            if (!exam) return [];
            const pairedMct = exam.exam_type === "semester" ? exams.find((e) => e.exam_type === "mct" && e.term === exam.term) : null;
            const { data: directMarks } = await supabase.from("marks").select(MARK_COLUMNS).eq("exam_id", examId).in("student_id", students.map((s) => s.id));
            let mctMarks: Mark[] = [];
            if (pairedMct) {
                const { data } = await supabase.from("marks").select(MARK_COLUMNS).eq("exam_id", pairedMct.id).in("student_id", students.map((s) => s.id));
                mctMarks = data || [];
            }

            return students.map((student) => {
                const studentGroup = student.group_name || "None";
                const applicableSubjects = subjects.filter(
                    (s) => !s.group_name || s.group_name === "Common" || s.group_name === studentGroup
                );

                const subjectResults: StudentSubjectCalculation[] = applicableSubjects.map((subject) => {
                    let wO = 0;
                    const wF = subject.full_marks;
                    let mark: Mark | null = null;
                    let mctO: number | undefined = undefined;
                    let semO: number | undefined = undefined;

                    if (pairedMct) {
                        const mC = examSubjectConfigs.find((c) => c.exam_id === pairedMct.id && c.subject_id === subject.id);
                        const sC = examSubjectConfigs.find((c) => c.exam_id === examId && c.subject_id === subject.id);
                        const hasMctMarks = (mctMarks as any[]).some((m: any) => m.subject_id === subject.id);
                        const hasMctConfig = !!mC;

                        if (hasMctConfig || hasMctMarks) {
                            const mM = (mctMarks as any[]).find((m: any) => m.student_id === student.id && m.subject_id === subject.id);
                            const sM = ((directMarks || []) as any[]).find((m: any) => m.student_id === student.id && m.subject_id === subject.id);
                            mctO = mM?.total ?? 0;
                            semO = sM?.total ?? 0;
                            const mctW = mC?.weight_percent ?? 100;
                            const semW = sC?.weight_percent ?? 100;
                            wO = ((mctO ?? 0) * (mctW / 100)) + ((semO ?? 0) * (semW / 100));
                            mark = {
                                id: "",
                                student_id: student.id,
                                subject_id: subject.id,
                                exam_id: examId,
                                academic_year: selectedAcademicYear,
                                theory: null,
                                mcq: null,
                                practical: null,
                                total: wO,
                                created_at: "",
                            };
                        } else {
                            const sC = examSubjectConfigs.find((c) => c.exam_id === examId && c.subject_id === subject.id);
                            const semW = sC?.weight_percent ?? 100;
                            mark = ((directMarks || []) as any[]).find((m: any) => m.student_id === student.id && m.subject_id === subject.id) || null;
                            semO = mark?.total ?? 0;
                            wO = (semO ?? 0) * (semW / 100);
                        }
                    } else {
                        const sC = examSubjectConfigs.find((c) => c.exam_id === examId && c.subject_id === subject.id);
                        const semW = sC?.weight_percent ?? 100;
                        mark = ((directMarks || []) as any[]).find((m: any) => m.student_id === student.id && m.subject_id === subject.id) || null;
                        semO = mark?.total ?? 0;
                        wO = (semO ?? 0) * (semW / 100);
                    }

                    wO = Math.round(wO * 100 + 0.0001) / 100;
                    const gradeInfo = calculateSubjectGrade(wO, subject.full_marks, gradingRules);
                    return {
                        subject,
                        mark,
                        grade: gradeInfo.grade,
                        gradePoint: gradeInfo.gradePoint,
                        effectiveFullMarks: wF,
                        weightedObtained: wO,
                        weightedFull: wF,
                        mctObtained: mctO,
                        semesterObtained: semO,
                    };
                });

                return calculateStudentSemesterSummary(student, subjectResults, applicableSubjects);
            });
        },
        [exams, supabase, examSubjectConfigs, selectedAcademicYear, gradingRules]
    );

    // ── Generate Final (Annual) Result ──
    const generateFinalResult = useCallback(
        async (students: Student[], subjects: Subject[]): Promise<StudentRankedResult[]> => {
            const semExams = exams.filter((e) => e.exam_type === "semester");
            if (semExams.length === 0) {
                toast.error("No semester exams configured");
                return [];
            }

            const semResultsArr = await Promise.all(
                semExams.map((sem) => generateSemesterResult(sem.id, students, subjects))
            );

            const semResultsByTerm: Record<number, Record<string, StudentRankedResult>> = {};
            semExams.forEach((sem, i) => {
                const termNum = sem.term ?? 0;
                semResultsByTerm[termNum] = {};
                semResultsArr[i].forEach((r) => {
                    semResultsByTerm[termNum][r.student.id] = r;
                });
            });

            // Batch save semester results
            const ay = selectedAcademicYear || String(new Date().getFullYear());
            await Promise.all(
                semExams.map((sem, i) => {
                    const upserts = semResultsArr[i].map((r) => ({
                        student_id: r.student.id,
                        exam_id: sem.id,
                        academic_year: ay,
                        total_marks: r.totalMarks,
                        total_full_marks: r.totalFullMarks,
                        percentage: r.percentage,
                        gpa: r.gpa,
                        grade: r.grade,
                    }));
                    return supabase.from("results").upsert(upserts, { onConflict: "student_id,exam_id,academic_year" });
                })
            );

            return students.map((student) => {
                const studentGroup = student.group_name || "None";
                const applicableSubjects = subjects.filter(
                    (s) => !s.group_name || s.group_name === "Common" || s.group_name === studentGroup
                );
                const studentSemMap: Record<number, StudentRankedResult | undefined> = {
                    1: semResultsByTerm[1]?.[student.id],
                    2: semResultsByTerm[2]?.[student.id],
                    3: semResultsByTerm[3]?.[student.id],
                };
                return calculateStudentFinalSummary(student, applicableSubjects, studentSemMap, SEMESTER_WEIGHTS);
            });
        },
        [exams, generateSemesterResult, selectedAcademicYear, supabase]
    );

    const handleGenerate = async () => {
        if (!selectedClass || !selectedExam) return;
        setProcessing(true);

        try {
            const { data: subjectsData } = await supabase
                .from("subjects")
                .select(SUBJECT_COLUMNS)
                .eq("class_id", selectedClass)
                .order("name");
            const subjects = (subjectsData || []) as Subject[];
            if (!isFinal && !subjects.length) {
                toast.error("No subjects found for this class");
                setProcessing(false);
                return;
            }

            let studentQuery = supabase.from("students").select(STUDENT_COLUMNS).eq("class_id", selectedClass).order("roll");
            if (selectedSection && selectedSection !== "all") {
                studentQuery = studentQuery.eq("section_id", selectedSection);
            }
            const { data: students } = await studentQuery;
            let studentsToUse = ((students || []) as Student[]).sort((a, b) => {
                const na = parseInt(a.roll), nb = parseInt(b.roll);
                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                return (a.roll || "").localeCompare(b.roll || "");
            });

            // Historical fallback if no active students in current class
            if (!isFinal && studentsToUse.length === 0 && subjects.length > 0) {
                const subjectIds = subjects.map((s) => s.id);
                const { data: oldMarks } = await supabase
                    .from("marks")
                    .select("student_id")
                    .eq("exam_id", selectedExam)
                    .eq("academic_year", selectedAcademicYear || "")
                    .in("subject_id", subjectIds);

                const oldStudentIds = Array.from(new Set(((oldMarks || []) as any[]).map((m: any) => m.student_id).filter(Boolean)));
                if (oldStudentIds.length > 0) {
                    const { data: oldStudents } = await supabase
                        .from("students")
                        .select(STUDENT_COLUMNS)
                        .in("id", oldStudentIds)
                        .order("roll");
                    studentsToUse = ((oldStudents || []) as Student[]).sort((a, b) => {
                        const na = parseInt(a.roll), nb = parseInt(b.roll);
                        if (!isNaN(na) && !isNaN(nb)) return na - nb;
                        return (a.roll || "").localeCompare(b.roll || "");
                    });
                    if (studentsToUse.length > 0) {
                        toast.info("Using historical students from records for selected academic year");
                    }
                }
            }

            if (!studentsToUse.length) {
                toast.error("No students found");
                setProcessing(false);
                return;
            }
            setCurrentClassSubjects(subjects || []);

            // Attendance tie-breaker data
            const studentIds = studentsToUse.map((s) => s.id);
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

            let studentResults: StudentRankedResult[];
            const activeAcademicYear = selectedAcademicYear || schoolInfo?.current_academic_year || String(new Date().getFullYear());

            if (isFinal) {
                studentResults = await generateFinalResult(studentsToUse, subjects || []);
                studentResults.forEach((r) => {
                    r.attendanceCount = attendanceMap[r.student.id] || 0;
                });
                studentResults = sortAndRankStudentResults(studentResults, true);

                // Persist final results to final_results and final_result_details with accurate academic year
                const finalResultPayloads = studentResults.map((r) => ({
                    student_id: r.student.id,
                    class_id: selectedClass,
                    academic_year: activeAcademicYear,
                    total_marks: r.totalMarks,
                    total_full_marks: r.totalFullMarks,
                    percentage: r.percentage,
                    gpa: r.gpa,
                    grade: r.grade,
                    position: r.position ?? null,
                }));

                const { data: frRows } = await supabase
                    .from("final_results")
                    .upsert(finalResultPayloads, { onConflict: "student_id,class_id,academic_year" })
                    .select("id, student_id");

                if (frRows && frRows.length > 0) {
                    const frMap = new Map((frRows as any[]).map((fr: any) => [fr.student_id, fr.id]));
                    const allDetails: any[] = [];
                    for (const r of studentResults) {
                        const frId = frMap.get(r.student.id);
                        if (frId && r.semesterBreakdown) {
                            for (const b of r.semesterBreakdown) {
                                allDetails.push({
                                    final_result_id: frId,
                                    term: b.term,
                                    weight_percent: b.weight,
                                    marks_obtained: b.totalMarks,
                                    full_marks: b.totalFullMarks,
                                    percentage: b.percentage,
                                    gpa: b.gpa,
                                    grade: b.grade,
                                });
                            }
                        }
                    }
                    if (allDetails.length > 0) {
                        await supabase
                            .from("final_result_details")
                            .upsert(allDetails, { onConflict: "final_result_id,term" });
                    }
                }
            } else {
                studentResults = await generateSemesterResult(selectedExam, studentsToUse, subjects || []);
                const upserts = studentResults.map((r) => ({
                    student_id: r.student.id,
                    exam_id: selectedExam,
                    academic_year: activeAcademicYear,
                    total_marks: r.totalMarks,
                    total_full_marks: r.totalFullMarks,
                    percentage: r.percentage,
                    gpa: r.gpa,
                    grade: r.grade,
                }));
                await supabase.from("results").upsert(upserts, { onConflict: "student_id,exam_id,academic_year" });

                studentResults.forEach((r) => {
                    r.attendanceCount = attendanceMap[r.student.id] || 0;
                });

                if (showPosition) {
                    studentResults = sortAndRankStudentResults(studentResults, false);
                }
            }

            setResults(studentResults.sort((a, b) => parseInt(a.student.roll) - parseInt(b.student.roll)));
            setGenerated(true);
            toast.success(`Results computed successfully for ${studentResults.length} students`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to compute results");
        } finally {
            setProcessing(false);
        }
    };

    const filteredResults = results.filter((r) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return r.student.name.toLowerCase().includes(q) || r.student.roll.toLowerCase().includes(q);
    });

    const generateCardHtml = (r: StudentRankedResult) => {
        const cn = escapeHtml(classes.find((c) => c.id === selectedClass)?.name || "");
        const sn = escapeHtml(sections.find((s) => s.id === r.student.section_id)?.name || "");
        const en = escapeHtml(isFinal ? "Final Result" : selectedExamObj?.name || "");
        const studentName = escapeHtml(r.student.name);
        const studentRoll = escapeHtml(r.student.roll);
        const schoolName = escapeHtml(schoolInfo?.name || "EduPulse School");
        const schoolAddress = escapeHtml(schoolInfo?.address);
        const schoolPhone = escapeHtml(schoolInfo?.phone);
        const schoolEmail = escapeHtml(schoolInfo?.email);

        const grading100Map = new Map<string, GradingRule>();
        const sourceRules = gradingRules.length > 0 ? gradingRules : (ALL_DEFAULT_GRADING as unknown as GradingRule[]);
        sourceRules
            .filter((g) => g.marks_category === 100)
            .forEach((g) => {
                if (!grading100Map.has(g.grade)) {
                    grading100Map.set(g.grade, g);
                }
            });
        const grading100 = Array.from(grading100Map.values()).sort((a, b) => b.min_marks - a.min_marks);

        let gradingHtml = "";
        if (grading100.length > 0) {
            gradingHtml = `<div class="slabel">Grading Scale (100 Marks)</div><table class="gtbl"><tr>${grading100.map((g) => `<th>${g.grade}</th>`).join("")}</tr><tr>${grading100.map((g) => `<td>${g.min_marks}-${g.max_marks}%</td>`).join("")}</tr><tr>${grading100.map((g) => `<td>GP ${g.grade_point}</td>`).join("")}</tr></table>`;
        }

        let marksHtml = "";
        if (!isFinal && r.subjects.length > 0) {
            const allSubs = r.subjects;
            const hasMctCols = !!pairedMctExam;

            const rows = allSubs.map((s, i) => {
                const mctTd = hasMctCols
                    ? `<td style="text-align:center">${s.mctObtained !== undefined ? s.mctObtained : "-"}</td><td style="text-align:center">${s.semesterObtained !== undefined ? s.semesterObtained : "-"}</td>`
                    : "";
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
        const hasOptional = currentClassSubjects.some((s) => s.is_optional);
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
            breakdownHtml = `<table class="mtbl"><thead><tr><th style="text-align:center">Semester</th><th style="text-align:center">Percentage</th><th style="text-align:center">Raw Total</th>${hasOptional ? '<th style="text-align:center">Raw Base GPA</th>' : ""}<th style="text-align:center">${hasOptional ? "Raw Final GPA" : "Raw GPA"}</th><th style="text-align:center">Weighted Marks</th><th style="text-align:center">${hasOptional ? "Weighted Final GPA" : "Weighted GPA"}</th></tr></thead><tbody>${bRows}<tr class="tot"><td style="text-align:center">Final</td><td style="text-align:center">100.00%</td><td style="text-align:center">${Math.round(totalRaw * 100) / 100}</td>${hasOptional ? `<td style="text-align:center">${Math.round(totalRawBaseGpa * 100) / 100}</td>` : ""}<td style="text-align:center">${Math.round(totalRawGpa * 100) / 100}</td><td style="text-align:center">${Math.round(totalWm * 100) / 100}</td><td style="text-align:center">${Math.round(totalWg * 100) / 100}</td></tr></tbody></table>`;
        }

        const posHtml = (showPosition || isFinal)
            ? `<tr><td class="lb">Position</td><td class="vl" style="color:#1e3a5f;font-weight:700">${r.position ? getPositionSuffix(r.position) : "-"}</td><td class="lb">Total Students</td><td class="vl">${results.length}</td></tr>`
            : "";

        const css = `.rc-view *{margin:0;padding:0;box-sizing:border-box}
.rc-view,.rc-view .pg{font-family:'Poppins',ui-sans-serif,system-ui,sans-serif;color:#1e293b;font-size:13px;line-height:1.6}
.rc-view .pg{max-width:700px;margin:0 auto;padding:10mm 10mm}
.rc-view .tb{border-top:4px double #1e3a5f;border-bottom:2px solid #1e3a5f;height:4px;margin-bottom:8px}
.rc-view .bb{border-top:2px solid #1e3a5f;border-bottom:4px double #1e3a5f;height:4px;margin-top:10px}
.rc-view .hdr{text-align:center;margin-bottom:6px}.rc-view .hdr img{height:48px;margin-bottom:4px}
.rc-view .hdr h1{font-size:22px;font-weight:700;color:#1e3a5f;letter-spacing:1px}
.rc-view .hdr .ad{font-size:12px;color:#475569}.rc-view .hdr .ct{font-size:10px;color:#64748b}
.rc-view .tbar{border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;padding:5px 0;margin-top:8px;background:#f0f5ff;text-align:center}
.rc-view .tbar h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#1e3a5f}
.rc-view .tbar .en{font-size:12px;color:#475569;margin-top:1px}
.rc-view .itbl{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
.rc-view .itbl td{padding:4px 6px;border-bottom:1px solid #e2e8f0}
.rc-view .lb{color:#64748b;width:22%}.rc-view .vl{font-weight:600;width:28%;color:#1e293b}
.rc-view .mtbl{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:12px;border:1.5px solid #cbd5e1}
.rc-view .mtbl th{background:#1e3a5f;color:#fff;padding:5px 8px;border:1px solid #1e3a5f;text-align:center;font-size:12px}
.rc-view .mtbl td{padding:4px 8px;border:1px solid #cbd5e1;font-size:12px;color:#334155}
.rc-view .mtbl tr.e{background:#ffffff}.rc-view .mtbl tr.o{background:#f8fafc}
.rc-view .mtbl tr.tot{background:#e8edf5;font-weight:700;color:#1e293b}.rc-view .mtbl tr.tot td{border:1px solid #cbd5e1}
.rc-view .stbl{width:100%;border-collapse:collapse;border:1.5px solid #cbd5e1;margin-bottom:10px;font-size:12px}
.rc-view .stbl td{padding:6px;text-align:center}
.rc-view .sl{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px}
.rc-view .sv{font-size:16px;font-weight:800;color:#1e3a5f}
.rc-view .st td{background:#f0f5ff;border-right:1px solid #cbd5e1}.rc-view .st td:last-child{border-right:none}
.rc-view .slabel{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
.rc-view .gtbl{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px}
.rc-view .gtbl th{background:#e8edf5;padding:3px 5px;border:1px solid #cbd5e1;text-align:center;font-weight:600;color:#1e3a5f}
.rc-view .gtbl td{padding:3px 5px;border:1px solid #cbd5e1;text-align:center;color:#475569}
.rc-view .sigs{width:100%;table-layout:fixed;margin-top:30px;border-collapse:collapse}
.rc-view .sigs td{text-align:center;vertical-align:top}
.rc-view .sigb{width:160px;margin:0 auto;border-top:1.5px solid #334155;padding-top:4px;font-size:10px;color:#475569}`;

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
<td><div class="sigb">Principal</div></td>
<td><div class="sigb">Guardian</div></td>
</tr></table>
<div class="bb"></div></div>`;

        return { css, body };
    };

    const handlePrint = (r: StudentRankedResult) => {
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
        gradesList.forEach((g) => (gradeCounts[g] = 0));

        sorted.forEach((r) => {
            const g = r.grade;
            if (gradeCounts[g] !== undefined) gradeCounts[g]++;
        });

        const summaryHtml = `<div style="text-align:center;">
<div style="margin-top:24px;font-size:12px;font-weight:700;color:#1e3a5f;text-transform:uppercase;margin-bottom:8px;letter-spacing:1px;">Grade Summary</div>
<table style="width:100%;max-width:700px;border:1.5px solid #cbd5e1;border-collapse:collapse;margin:0 auto 20px auto;">
    <tr>
        <th style="background:#e8edf5 !important;color:#1e3a5f !important;padding:6px 8px;border:1px solid #cbd5e1;font-size:12px;text-align:center;font-weight:700;">Grade</th>
        ${gradesList.map((g) => `<th style="background:#e8edf5 !important;color:#1e3a5f !important;padding:6px 8px;border:1px solid #cbd5e1;font-size:12px;text-align:center;font-weight:700;">${g}</th>`).join("")}
        <th style="background:#e8edf5 !important;color:#1e3a5f !important;padding:6px 8px;border:1px solid #cbd5e1;font-size:12px;text-align:center;font-weight:700;">Total</th>
    </tr>
    <tr>
        <td style="background:#f8fafc !important;padding:6px 8px;border:1px solid #cbd5e1;font-size:12px;font-weight:700;text-align:center;color:#1e3a5f !important;">Students</td>
        ${gradesList.map((g) => `<td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:13px;font-weight:700;text-align:center;color:#334155 !important;">${gradeCounts[g]}</td>`).join("")}
        <td style="background:#f8fafc !important;padding:6px 8px;border:1px solid #cbd5e1;font-size:13px;font-weight:700;text-align:center;color:#334155 !important;">${sorted.length}</td>
    </tr>
</table>
</div>`;

        const rows = sorted.map((r, i) => {
            const secName = escapeHtml(sections.find((s) => s.id === r.student.section_id)?.name || "-");
            return `<tr class="${i % 2 === 0 ? "e" : "o"}">
                <td>${escapeHtml(r.student.roll)}</td>
                <td style="text-align:left !important">${escapeHtml(r.student.name)}</td>
                ${(!selectedSection || selectedSection === "all") ? `<td>${secName}</td>` : ""}
                <td style="font-weight:600">${r.totalMarks}</td>
                <td>${r.displayGpa.toFixed(2)}</td>
                <td style="font-weight:600;${r.grade === "F" ? "color:#dc2626 !important" : ""}">${r.grade}</td>
                ${(showPosition || isFinal) ? `<td>${r.position ? getPositionSuffix(r.position) : "-"}</td>` : ""}
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
table{width:100%;border-collapse:collapse;font-size:12px;border:1.5px solid #cbd5e1}
th{background:#1e3a5f !important;color:#fff !important;padding:7px 8px;border:1px solid #1e3a5f;text-align:center;white-space:nowrap;font-weight:700}
td{text-align:center;padding:5px 8px;border:1px solid #cbd5e1;color:#334155}
tr.e{background:#ffffff !important}
tr.o{background:#f8fafc !important}
</style></head><body><div class="pg">
<div class="tb"></div>
<div class="hdr">
${schoolInfo?.logo_url ? `<img src="${schoolInfo.logo_url}" alt="Logo" style="height:48px;margin:0 auto 4px;display:block">` : ""}
<h1>${schoolInfo?.name || "EduPulse School"}</h1>
${schoolInfo?.address ? `<div class="ad">${schoolInfo.address}</div>` : ""}
</div>
<div class="tbar"><h2>Result Sheet</h2><div class="en">${en} — ${cn}${sn ? " (" + sn + ")" : ""}</div><div class="en" style="font-size:11px;margin-top:2px">Active Academic Year: ${selectedAcademicYear}</div></div>
<div class="info">Total Students: ${sorted.length}</div>
<table>
<thead><tr>
<th style="width:50px">Roll</th><th style="text-align:left !important">Name</th>
${(!selectedSection || selectedSection === "all") ? "<th>Section</th>" : ""}
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
            r.totalMarks,
            r.totalFullMarks,
            r.percentage.toFixed(2),
            r.displayGpa.toFixed(2),
            r.grade,
            ...(showPosition || isFinal ? [r.position || "-"] : []),
        ].join(","));
        const csv = [header, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${cn}_${en}_Result.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                icon={ChartBar}
                iconBg="bg-primary/10"
                iconColor="text-primary"
                title="Results & Tabulation"
                subtitle="Compute, view, analyze, and publish exam and final results."
            />

            <div className="bg-card rounded-2xl border border-border/80 shadow-xs p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-bold">Class</Label>
                        <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setGenerated(false); }}>
                            <SelectTrigger className="w-full bg-background border-border text-xs sm:text-sm font-medium">
                                <SelectValue placeholder="Select Class" />
                            </SelectTrigger>
                            <SelectContent>
                                {classes.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-bold">Section</Label>
                        <Select value={selectedSection} onValueChange={(v) => { setSelectedSection(v); setGenerated(false); }}>
                            <SelectTrigger className="w-full bg-background border-border text-xs sm:text-sm font-medium">
                                <SelectValue placeholder="All Sections" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sections</SelectItem>
                                {sections.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-bold">Exam / Term</Label>
                        <Select value={selectedExam} onValueChange={(v) => { setSelectedExam(v); setGenerated(false); }}>
                            <SelectTrigger className="w-full bg-background border-border text-xs sm:text-sm font-medium">
                                <SelectValue placeholder="Select Exam" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={FINAL_RESULT_ID}>Final Result</SelectItem>
                                {exams.map((e) => (
                                    <SelectItem key={e.id} value={e.id}>
                                        {e.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-bold">Academic Year</Label>
                        <Select value={selectedAcademicYear} onValueChange={(v) => { setSelectedAcademicYear(v); setGenerated(false); }}>
                            <SelectTrigger className="w-full bg-background border-border text-xs sm:text-sm font-medium">
                                <SelectValue placeholder="Select Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {academicYearOptions.map((y) => (
                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between flex-wrap gap-3">
                    <p className="text-xs text-muted-foreground">
                        Select class and examination term to compute tabulation sheet and GPA.
                    </p>
                    <Button
                        onClick={handleGenerate}
                        disabled={!selectedClass || !selectedExam || processing}
                        className="gap-2 font-semibold shadow-xs w-full sm:w-auto"
                    >
                        <Sparkle size={16} strokeWidth={2} />
                        {processing ? "Computing Results..." : "Compute Results"}
                    </Button>
                </div>
            </div>

            {isFinal && (
                <Card className="border-0 bg-muted/50 shadow-none rounded-xl">
                    <CardContent className="py-4">
                        <p className="text-sm text-muted-foreground font-medium">
                            <strong>Annual Combined Result Weighting:</strong> 1st Semester (25%) + 2nd Semester (25%) + 3rd Semester (50%)
                        </p>
                    </CardContent>
                </Card>
            )}

            {gradingRules.length === 0 && (
                <Card className="border-0 bg-red-50 dark:bg-red-950/30 shadow-none rounded-xl">
                    <CardContent className="flex items-center gap-3 py-4">
                        <WarningCircle size={20} strokeWidth={1.5} className="text-red-500" />
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                            No grading rules configured. Go to Exams &gt; Grading System to seed defaults.
                        </p>
                    </CardContent>
                </Card>
            )}

            {!generated && (
                <div className="bg-transparent rounded-2xl border-2 border-dashed border-border p-12 text-center shadow-none">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 mx-auto text-muted-foreground/40">
                        <ChartBar size={32} strokeWidth={1.2} />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground mb-1">Generate Results</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        Choose a class, section, exam, and academic year to compute tabulated marks and report cards.
                    </p>
                </div>
            )}

            {generated && results.length > 0 && (
                <Card className="bg-card rounded-2xl border border-border shadow-none overflow-hidden">
                    <CardHeader className="pb-3 border-b border-border">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                                <span>{classes.find((c) => c.id === selectedClass)?.name}</span>
                                {selectedSection && selectedSection !== "all" && (
                                    <Badge variant="outline" className="bg-muted border-border text-muted-foreground rounded-md shadow-none">
                                        {sections.find((s) => s.id === selectedSection)?.name}
                                    </Badge>
                                )}
                                <span className="text-muted-foreground">•</span>
                                <span>{isFinal ? "Final Result" : selectedExamObj?.name}</span>
                                {isFinal && <Badge className="bg-primary/10 text-primary border-0 rounded-md shadow-none">Annual</Badge>}
                                {isSemester && <Badge variant="secondary" className="bg-muted text-foreground border-0 rounded-md shadow-none">Combined</Badge>}
                                <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 rounded-md font-medium shadow-none">
                                    {results.length} students
                                </Badge>
                            </CardTitle>

                            <div className="flex gap-2 flex-wrap items-center w-full sm:w-auto">
                                <Input
                                    placeholder="Search student or roll..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full sm:w-[200px] h-9 rounded-lg bg-muted border-0 focus-visible:ring-1 focus-visible:ring-ring/30 px-3 text-xs"
                                />
                                <Button variant="outline" size="sm" className="h-9 rounded-lg bg-muted border-0 hover:bg-muted/80 transition-colors text-foreground font-medium shadow-none text-xs" onClick={handleDownloadCSV}>
                                    <DownloadSimple size={14} strokeWidth={1.5} className="mr-1.5" />
                                    CSV
                                </Button>
                                <Button variant="outline" size="sm" className="h-9 rounded-lg bg-muted border-0 hover:bg-muted/80 transition-colors text-foreground font-medium shadow-none text-xs" onClick={handlePrintAll}>
                                    <Printer size={14} strokeWidth={1.5} className="mr-1.5" />
                                    Print Sheet
                                </Button>
                                <Button variant="outline" size="sm" className="h-9 rounded-lg bg-muted border-0 hover:bg-muted/80 transition-colors text-foreground font-medium shadow-none text-xs" onClick={handlePrintAllCards}>
                                    <Printer size={14} strokeWidth={1.5} className="mr-1.5" />
                                    Print Cards
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16 whitespace-nowrap">Roll</TableHead>
                                    <TableHead className="whitespace-nowrap">Student Name</TableHead>
                                    {(!selectedSection || selectedSection === "all") && (
                                        <TableHead className="whitespace-nowrap hidden sm:table-cell">Section</TableHead>
                                    )}
                                    <TableHead className="text-center whitespace-nowrap">Total Marks</TableHead>
                                    <TableHead className="text-center whitespace-nowrap">Percentage</TableHead>
                                    <TableHead className="text-center whitespace-nowrap">GPA</TableHead>
                                    <TableHead className="text-center whitespace-nowrap">Grade</TableHead>
                                    {(showPosition || isFinal) && (
                                        <TableHead className="text-center whitespace-nowrap hidden md:table-cell">Position</TableHead>
                                    )}
                                    <TableHead className="text-center whitespace-nowrap">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredResults.map((r) => {
                                    const style = getGradeBadgeStyle(r.grade);
                                    return (
                                        <TableRow key={r.student.id} className="hover:bg-muted/30 transition-colors border-b border-border/40">
                                            <TableCell className="font-mono font-medium">{r.student.roll}</TableCell>
                                            <TableCell className="font-medium whitespace-nowrap">{r.student.name}</TableCell>
                                            {(!selectedSection || selectedSection === "all") && (
                                                <TableCell className="text-muted-foreground hidden sm:table-cell">
                                                    {sections.find((s) => s.id === r.student.section_id)?.name || "—"}
                                                </TableCell>
                                            )}
                                            <TableCell className="text-center whitespace-nowrap font-medium">
                                                {r.totalMarks} / {r.totalFullMarks}
                                            </TableCell>
                                            <TableCell className="text-center font-mono whitespace-nowrap">{r.percentage.toFixed(2)}%</TableCell>
                                            <TableCell className="text-center font-mono font-semibold">{r.displayGpa.toFixed(2)}</TableCell>
                                            <TableCell className="text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${style.bg} ${style.text} ${style.border}`}>
                                                    {r.grade}
                                                </span>
                                            </TableCell>
                                            {(showPosition || isFinal) && (
                                                <TableCell className="text-center font-semibold hidden md:table-cell">
                                                    {r.position ? getPositionSuffix(r.position) : "—"}
                                                </TableCell>
                                            )}
                                            <TableCell className="text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="rounded-lg hover:bg-muted font-medium text-xs h-8"
                                                    onClick={() => setReportStudent(r)}
                                                >
                                                    <Eye size={14} strokeWidth={1.5} className="mr-1.5 hidden sm:inline" />
                                                    View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Report Card Preview Dialog */}
            <Dialog open={!!reportStudent} onOpenChange={(o) => (!o ? setReportStudent(null) : null)}>
                <DialogContent
                    className="w-full max-h-[95vh] overflow-y-auto p-0 bg-card outline-none rounded-xl border border-border shadow-xl [&::-webkit-scrollbar]:hidden [&>button]:hidden"
                    style={{ msOverflowStyle: "none", scrollbarWidth: "none", maxWidth: "780px", width: "100%" }}
                >
                    <div className="flex justify-between items-center px-6 py-4 sticky top-0 bg-card z-10 border-b border-border">
                        <DialogTitle className="text-base font-bold text-foreground">Report Card Preview</DialogTitle>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-lg bg-muted border-0 hover:bg-muted/80 transition-colors text-foreground font-medium shadow-none px-4"
                                onClick={() => reportStudent && handlePrint(reportStudent)}
                            >
                                <Printer size={16} strokeWidth={1.5} className="mr-2" />
                                Print
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
                                className="rc-view p-4"
                                dangerouslySetInnerHTML={{ __html: `<style>${css}</style>${body}` }}
                            />
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
