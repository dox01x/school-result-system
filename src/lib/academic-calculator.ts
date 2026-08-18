/**
 * ═══════════════════════════════════════════════════════════════════
 * Academic Calculation & Grading Engine (Single Source of Truth)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Grading Scale Standard:
 * - A+ : 5.00 (80% - 100%)
 * - A  : 4.00 (70% - 79%)
 * - A- : 3.50 (60% - 69%)
 * - B  : 3.00 (50% - 59%)
 * - C  : 2.00 (40% - 49%)
 * - D  : 1.00 (33% - 39%)
 * - F  : 0.00 (Below 33%)
 *
 * Special Rules:
 * 1. If a student receives 'F' in any mandatory subject, overall result is 'F' (GPA = 0.00).
 * 2. 4th Optional Subject: Points above 2.00 contribute to GPA ((GP - 2) added to mandatory total GP before dividing by mandatory subject count), capped at 5.00.
 * 3. 4-Tier Deterministic Ranking Priority:
 *    Priority 1: Pass/Fail status (Passing students rank above failing students)
 *    Priority 2: Final GPA (higher is better)
 *    Priority 3: Total Marks (higher is better)
 *    Priority 4: Attendance Count (higher is better), followed by numerical roll.
 *    For failing students: fewest failed subjects -> raw GPA -> total marks -> attendance.
 */

import type { GradingRule, Subject, Mark, Student } from "@/lib/database.types";
import { ALL_DEFAULT_GRADING, SEMESTER_WEIGHTS } from "@/lib/constants/exam-defaults";

export interface SubjectGradeResult {
    grade: string;
    gradePoint: number;
    isPass: boolean;
    percentage: number;
}

export interface StudentSubjectCalculation {
    subject: Subject;
    mark: Mark | null;
    grade: string;
    gradePoint: number;
    effectiveFullMarks: number;
    weightedObtained: number;
    weightedFull: number;
    mctObtained?: number;
    semesterObtained?: number;
}

export interface SemesterResultBreakdown {
    term: number;
    totalMarks: number;
    totalFullMarks: number;
    percentage: number;
    baseGpa: number;
    gpa: number;
    displayGpa: number;
    grade: string;
    weight: number;
}

export interface StudentRankedResult {
    student: Student;
    subjects: StudentSubjectCalculation[];
    totalMarks: number;
    totalFullMarks: number;
    percentage: number;
    baseGpa: number;
    gpa: number;
    displayGpa: number;
    grade: string;
    position?: number;
    attendanceCount?: number;
    semesterBreakdown?: SemesterResultBreakdown[];
    failedSubjectCount?: number;
}

/**
 * Standard GPA to Grade Reverse Lookup
 */
export function getGradeFromGpa(gpa: number): string {
    if (gpa >= 5.0) return "A+";
    if (gpa >= 4.0) return "A";
    if (gpa >= 3.5) return "A-";
    if (gpa >= 3.0) return "B";
    if (gpa >= 2.0) return "C";
    if (gpa >= 1.0) return "D";
    return "F";
}

/**
 * Calculate grade and grade point for obtained marks against full marks.
 * Properly scales 100, 75, 50, 25 or custom full marks.
 */
export function calculateSubjectGrade(
    obtainedMarks: number,
    fullMarks: number = 100,
    customRules?: GradingRule[]
): SubjectGradeResult {
    const validFullMarks = fullMarks > 0 ? fullMarks : 100;
    const percentage = Math.round((Math.max(0, obtainedMarks) / validFullMarks) * 10000) / 100;

    // Use custom database rules if available, matching category
    const category = fullMarks <= 25 ? 25 : fullMarks <= 50 ? 50 : fullMarks <= 75 ? 75 : 100;
    const rulesToUse = (customRules && customRules.length > 0)
        ? (customRules.filter((r) => r.marks_category === category).length > 0
            ? customRules.filter((r) => r.marks_category === category)
            : customRules.filter((r) => r.marks_category === 100))
        : ALL_DEFAULT_GRADING.filter((r) => r.marks_category === category);

    if (rulesToUse.length > 0) {
        const sorted = [...rulesToUse].sort((a, b) => b.min_marks - a.min_marks);
        const usesRaw = category <= 50 && sorted.every((r) => r.max_marks <= category);
        const compareVal = usesRaw ? obtainedMarks : percentage;

        for (const r of sorted) {
            if (compareVal >= r.min_marks && compareVal <= r.max_marks) {
                return {
                    grade: r.grade,
                    gradePoint: r.grade_point,
                    isPass: r.grade !== "F" && r.grade_point > 0,
                    percentage,
                };
            }
        }

        for (const r of sorted) {
            if (compareVal >= r.min_marks) {
                return {
                    grade: r.grade,
                    gradePoint: r.grade_point,
                    isPass: r.grade !== "F" && r.grade_point > 0,
                    percentage,
                };
            }
        }
    }

    // Default 100-scale fallback
    if (percentage >= 80) return { grade: "A+", gradePoint: 5.0, isPass: true, percentage };
    if (percentage >= 70) return { grade: "A", gradePoint: 4.0, isPass: true, percentage };
    if (percentage >= 60) return { grade: "A-", gradePoint: 3.5, isPass: true, percentage };
    if (percentage >= 50) return { grade: "B", gradePoint: 3.0, isPass: true, percentage };
    if (percentage >= 40) return { grade: "C", gradePoint: 2.0, isPass: true, percentage };
    if (percentage >= 33) return { grade: "D", gradePoint: 1.0, isPass: true, percentage };
    return { grade: "F", gradePoint: 0.0, isPass: false, percentage };
}

/**
 * Calculate student semester result from calculated subject rows.
 */
export function calculateStudentSemesterSummary(
    student: Student,
    subjectResults: StudentSubjectCalculation[],
    applicableSubjects: Subject[]
): StudentRankedResult {
    const totalObtained = subjectResults.reduce((sum, r) => sum + r.weightedObtained, 0);
    const totalFull = applicableSubjects.reduce((sum, s) => sum + s.full_marks, 0);
    const percentage = totalFull > 0 ? Math.round((totalObtained / totalFull) * 10000 + 0.0001) / 100 : 0;

    const mandatorySubjects = subjectResults.filter((r) => !r.subject.is_optional);
    const optionalSubjects = subjectResults.filter((r) => r.subject.is_optional);
    const totalMandatoryCount = mandatorySubjects.length;

    // Check if any mandatory subject failed
    const failedMandatory = mandatorySubjects.filter((r) => r.grade === "F" || r.gradePoint === 0);
    const hasFailed = failedMandatory.length > 0;

    let baseGpa = 0;
    let gpa = 0;

    if (totalMandatoryCount > 0) {
        const mandatoryGpSum = mandatorySubjects.reduce((sum, r) => sum + r.gradePoint, 0);
        baseGpa = Math.min(5.0, Math.round((mandatoryGpSum / totalMandatoryCount) * 100 + 0.0001) / 100);

        // 4th optional subject extra point contribution (points above 2.00)
        let extraPoints = 0;
        optionalSubjects.forEach((opt) => {
            if (opt.gradePoint > 2.0) {
                extraPoints += opt.gradePoint - 2.0;
            }
        });

        const totalGpWithOptional = mandatoryGpSum + extraPoints;
        gpa = Math.min(5.0, Math.round((totalGpWithOptional / totalMandatoryCount) * 100 + 0.0001) / 100);
    }

    const displayGpa = hasFailed ? 0.0 : gpa;
    const finalGrade = hasFailed ? "F" : getGradeFromGpa(gpa);

    return {
        student,
        subjects: subjectResults,
        totalMarks: Math.round(totalObtained * 100 + 0.0001) / 100,
        totalFullMarks: totalFull,
        percentage,
        baseGpa,
        gpa,
        displayGpa,
        grade: finalGrade,
        failedSubjectCount: failedMandatory.length,
    };
}

/**
 * Calculate final combined result across semesters (Terms 1, 2, 3)
 */
export function calculateStudentFinalSummary(
    student: Student,
    applicableSubjects: Subject[],
    semesterResultsMap: Record<number, StudentRankedResult | undefined>,
    weights: Record<number, number> = SEMESTER_WEIGHTS
): StudentRankedResult {
    let finalTotalMarks = 0;
    let weightedGpaSum = 0;
    let weightedBaseGpaSum = 0;
    let actualWeightSum = 0;
    const breakdown: SemesterResultBreakdown[] = [];

    for (const term of [1, 2, 3]) {
        const w = weights[term] ?? (term === 3 ? 0.5 : 0.25);
        const sr = semesterResultsMap[term];
        if (sr) {
            const wm = Math.round(sr.totalMarks * w * 100 + 0.0001) / 100;
            const wg = Math.round(sr.gpa * w * 100 + 0.0001) / 100;
            const wbg = Math.round(sr.baseGpa * w * 100 + 0.0001) / 100;

            finalTotalMarks += wm;
            weightedGpaSum += wg;
            weightedBaseGpaSum += wbg;
            actualWeightSum += w;

            breakdown.push({
                term,
                totalMarks: sr.totalMarks,
                totalFullMarks: sr.totalFullMarks,
                percentage: sr.percentage,
                baseGpa: sr.baseGpa,
                gpa: sr.gpa,
                displayGpa: sr.displayGpa,
                grade: sr.grade,
                weight: Math.round(w * 100),
            });
        }
    }

    finalTotalMarks = Math.round(finalTotalMarks * 100 + 0.0001) / 100;
    const finalTotalFull = applicableSubjects.reduce((sum, s) => sum + s.full_marks, 0);
    const finalPercentage = finalTotalFull > 0
        ? Math.round((finalTotalMarks / finalTotalFull) * 10000 + 0.0001) / 100
        : 0;

    const normalizedGpa = actualWeightSum > 0
        ? Math.round((weightedGpaSum / actualWeightSum) * 100 + 0.0001) / 100
        : 0;
    const normalizedBaseGpa = actualWeightSum > 0
        ? Math.round((weightedBaseGpaSum / actualWeightSum) * 100 + 0.0001) / 100
        : 0;

    const hasAnyFailedSemester = breakdown.some((b) => b.grade === "F");
    const finalGrade = hasAnyFailedSemester ? "F" : (normalizedGpa > 0 ? getGradeFromGpa(normalizedGpa) : "F");

    return {
        student,
        subjects: [],
        totalMarks: finalTotalMarks,
        totalFullMarks: finalTotalFull,
        percentage: finalPercentage,
        baseGpa: normalizedBaseGpa,
        gpa: normalizedGpa,
        displayGpa: hasAnyFailedSemester ? 0.0 : normalizedGpa,
        grade: finalGrade,
        semesterBreakdown: breakdown,
        failedSubjectCount: hasAnyFailedSemester ? breakdown.filter((b) => b.grade === "F").length : 0,
    };
}

/**
 * Deterministic 4-Tier Student Ranking Algorithm
 */
export function sortAndRankStudentResults(
    results: StudentRankedResult[],
    isFinalExam: boolean = false
): StudentRankedResult[] {
    const isFailed = (r: StudentRankedResult) => r.grade === "F" || r.displayGpa === 0;

    const getRawInternalGpa = (r: StudentRankedResult) => {
        if (r.gpa > 0) return r.gpa;
        if (r.subjects && r.subjects.length > 0) {
            const sumGp = r.subjects.reduce((sum, s) => sum + s.gradePoint, 0);
            return Math.round((sumGp / r.subjects.length) * 100 + 0.0001) / 100;
        }
        return 0;
    };

    const sorted = [...results].sort((a, b) => {
        const aFail = isFailed(a);
        const bFail = isFailed(b);

        // Priority 1: Passing students rank before failing students
        if (!aFail && bFail) return -1;
        if (aFail && !bFail) return 1;

        // Both passed: sort by GPA -> Total Marks -> Attendance -> Roll
        if (!aFail && !bFail) {
            if (b.gpa !== a.gpa) return b.gpa - a.gpa;
            if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
            const attDiff = (b.attendanceCount || 0) - (a.attendanceCount || 0);
            if (attDiff !== 0) return attDiff;
            const aRoll = parseInt(a.student.roll) || 0;
            const bRoll = parseInt(b.student.roll) || 0;
            return aRoll - bRoll;
        }

        // Both failed: fewer failed subjects comes first
        if (!isFinalExam) {
            const aFailCount = a.failedSubjectCount || 0;
            const bFailCount = b.failedSubjectCount || 0;
            if (aFailCount !== bFailCount) return aFailCount - bFailCount;
        }

        // Internal raw GPA comparison for failed students
        const aRaw = getRawInternalGpa(a);
        const bRaw = getRawInternalGpa(b);
        if (bRaw !== aRaw) return bRaw - aRaw;

        // Total marks comparison
        if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;

        // Attendance tie-breaker
        const attDiff = (b.attendanceCount || 0) - (a.attendanceCount || 0);
        if (attDiff !== 0) return attDiff;

        const aRoll = parseInt(a.student.roll) || 0;
        const bRoll = parseInt(b.student.roll) || 0;
        return aRoll - bRoll;
    });

    // Assign rank positions with tie preservation
    let currentRank = 1;
    sorted.forEach((r, i) => {
        if (i === 0) {
            r.position = 1;
        } else {
            const prev = sorted[i - 1];
            const aFail = isFailed(r);
            const bFail = isFailed(prev);

            let isSameRank = false;
            if (!aFail && !bFail) {
                isSameRank =
                    r.gpa === prev.gpa &&
                    r.totalMarks === prev.totalMarks &&
                    (r.attendanceCount || 0) === (prev.attendanceCount || 0);
            } else if (aFail && bFail) {
                const rRaw = getRawInternalGpa(r);
                const pRaw = getRawInternalGpa(prev);
                isSameRank =
                    (r.failedSubjectCount || 0) === (prev.failedSubjectCount || 0) &&
                    rRaw === pRaw &&
                    r.totalMarks === prev.totalMarks &&
                    (r.attendanceCount || 0) === (prev.attendanceCount || 0);
            }

            if (isSameRank) {
                r.position = prev.position;
            } else {
                currentRank = i + 1;
                r.position = currentRank;
            }
        }
    });

    return sorted;
}

/**
 * Format ordinal position suffix (1st, 2nd, 3rd, 4th, etc.)
 */
export function getPositionSuffix(position?: number): string {
    if (!position || position <= 0) return "-";
    const mod100 = position % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${position}th`;
    const mod10 = position % 10;
    if (mod10 === 1) return `${position}st`;
    if (mod10 === 2) return `${position}nd`;
    if (mod10 === 3) return `${position}rd`;
    return `${position}th`;
}

/**
 * Grade Badge Styling Helper
 */
export function getGradeBadgeStyle(grade: string): { bg: string; text: string; border: string } {
    switch (grade.toUpperCase()) {
        case "A+":
            return { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-400 font-bold", border: "border-emerald-500/30" };
        case "A":
            return { bg: "bg-green-500/15", text: "text-green-700 dark:text-green-400 font-bold", border: "border-green-500/30" };
        case "A-":
            return { bg: "bg-teal-500/15", text: "text-teal-700 dark:text-teal-400 font-bold", border: "border-teal-500/30" };
        case "B":
            return { bg: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-400 font-bold", border: "border-blue-500/30" };
        case "C":
            return { bg: "bg-purple-500/15", text: "text-purple-700 dark:text-purple-400 font-bold", border: "border-purple-500/30" };
        case "D":
            return { bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-400 font-bold", border: "border-amber-500/30" };
        case "F":
        default:
            return { bg: "bg-rose-500/15", text: "text-rose-700 dark:text-rose-400 font-bold", border: "border-rose-500/30" };
    }
}
