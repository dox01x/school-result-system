/**
 * Comprehensive Unit Test Suite for Academic Calculations, Grading, Ranking & Tie-Breaking
 */
import {
  getGradeFromGpa,
  calculateSubjectGrade,
  calculateStudentSemesterSummary,
  calculateStudentFinalSummary,
  sortAndRankStudentResults,
  type StudentSubjectCalculation,
  type StudentRankedResult,
} from "../../src/lib/academic-calculator";
import type { Student, Subject, Mark } from "../../src/lib/database.types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

const mockStudent = (id: string, name: string, roll: string): Student => ({
  id,
  name,
  roll,
  student_id: `ID-${roll}`,
  class_id: "class-1",
  section_id: "sec-1",
  gender: "male",
  father_name: "Father",
  mother_name: "Mother",
  date_of_birth: "2010-01-01",
  phone: "01700000000",
  address: "Dhaka",
  blood_group: "A+",
  group_name: null,
  created_at: new Date().toISOString(),
});

const mockSubject = (id: string, name: string, fullMarks = 100, isOptional = false): Subject => ({
  id,
  name,
  class_id: "class-1",
  full_marks: fullMarks,
  pass_marks: Math.round(fullMarks * 0.33),
  has_theory: true,
  has_mcq: false,
  has_practical: false,
  theory_marks: fullMarks,
  mcq_marks: 0,
  practical_marks: 0,
  is_optional: isOptional,
  group_name: null,
  created_at: new Date().toISOString(),
});

export function runComprehensiveTests() {
  console.log("Starting Academic Calculator Test Suite...\n");

  // 1. Test getGradeFromGpa
  console.log("1. Testing GPA to Letter Grade conversions...");
  assert(getGradeFromGpa(5.0) === "A+", "5.0 GPA must be A+");
  assert(getGradeFromGpa(4.5) === "A", "4.5 GPA must be A");
  assert(getGradeFromGpa(3.8) === "A-", "3.8 GPA must be A-");
  assert(getGradeFromGpa(3.2) === "B", "3.2 GPA must be B");
  assert(getGradeFromGpa(2.5) === "C", "2.5 GPA must be C");
  assert(getGradeFromGpa(1.0) === "D", "1.0 GPA must be D");
  assert(getGradeFromGpa(0.0) === "F", "0.0 GPA must be F");
  console.log("✓ GPA to Letter Grade tests passed.");

  // 2. Test calculateSubjectGrade
  console.log("\n2. Testing calculateSubjectGrade...");
  const res100 = calculateSubjectGrade(85, 100);
  assert(res100.gradePoint === 5.0 && res100.grade === "A+" && res100.isPass, "85/100 should be A+ / 5.0 / Passed");

  const res50 = calculateSubjectGrade(42, 50); // 84%
  assert(res50.gradePoint === 5.0 && res50.grade === "A+" && res50.isPass, "42/50 (84%) should be A+ / 5.0 / Passed");

  const resFail = calculateSubjectGrade(25, 100);
  assert(!resFail.isPass && resFail.grade === "F" && resFail.gradePoint === 0, "25/100 should be F / 0.0");
  console.log("✓ calculateSubjectGrade tests passed.");

  // 3. Test calculateStudentSemesterSummary
  console.log("\n3. Testing calculateStudentSemesterSummary...");
  const s1 = mockSubject("sub-1", "Bangla", 100, false);
  const s2 = mockSubject("sub-2", "English", 100, false);
  const s3 = mockSubject("sub-3", "Math", 100, false);
  const s4Opt = mockSubject("sub-4", "Higher Math", 100, true);

  const subjectResults1: StudentSubjectCalculation[] = [
    { subject: s1, mark: null, grade: "A+", gradePoint: 5.0, effectiveFullMarks: 100, weightedObtained: 80, weightedFull: 100 },
    { subject: s2, mark: null, grade: "A", gradePoint: 4.0, effectiveFullMarks: 100, weightedObtained: 70, weightedFull: 100 },
    { subject: s3, mark: null, grade: "A-", gradePoint: 3.5, effectiveFullMarks: 100, weightedObtained: 60, weightedFull: 100 },
  ];
  const summary1 = calculateStudentSemesterSummary(mockStudent("std-1", "Student One", "1"), subjectResults1, [s1, s2, s3]);
  assert(summary1.grade === "A" && summary1.gpa === 4.17 && summary1.displayGpa === 4.17, `GPA expected 4.17, got ${summary1.gpa}`);

  // Test with 4th Optional Subject: GP 4.0 contributes (4.0 - 2.0) = 2.0 extra points
  // Base GPA without optional: (4+4+4)/3 = 4.00. With optional: (12 + 2) / 3 = 4.67
  const subjectResultsWithOpt: StudentSubjectCalculation[] = [
    { subject: s1, mark: null, grade: "A", gradePoint: 4.0, effectiveFullMarks: 100, weightedObtained: 75, weightedFull: 100 },
    { subject: s2, mark: null, grade: "A", gradePoint: 4.0, effectiveFullMarks: 100, weightedObtained: 75, weightedFull: 100 },
    { subject: s3, mark: null, grade: "A", gradePoint: 4.0, effectiveFullMarks: 100, weightedObtained: 75, weightedFull: 100 },
    { subject: s4Opt, mark: null, grade: "A", gradePoint: 4.0, effectiveFullMarks: 100, weightedObtained: 75, weightedFull: 100 },
  ];
  const summaryOptional = calculateStudentSemesterSummary(mockStudent("std-2", "Student Two", "2"), subjectResultsWithOpt, [s1, s2, s3, s4Opt]);
  assert(summaryOptional.gpa === 4.67, `Expected GPA 4.67 with optional, got ${summaryOptional.gpa}`);

  // Test fail in one mandatory subject -> display GPA becomes 0.00 / F
  const subjectResultsWithFail: StudentSubjectCalculation[] = [
    { subject: s1, mark: null, grade: "A+", gradePoint: 5.0, effectiveFullMarks: 100, weightedObtained: 85, weightedFull: 100 },
    { subject: s2, mark: null, grade: "F", gradePoint: 0.0, effectiveFullMarks: 100, weightedObtained: 20, weightedFull: 100 },
    { subject: s3, mark: null, grade: "A+", gradePoint: 5.0, effectiveFullMarks: 100, weightedObtained: 85, weightedFull: 100 },
  ];
  const summaryFail = calculateStudentSemesterSummary(mockStudent("std-3", "Student Three", "3"), subjectResultsWithFail, [s1, s2, s3]);
  assert(summaryFail.displayGpa === 0.0 && summaryFail.grade === "F" && (summaryFail.failedSubjectCount || 0) > 0, "Failing mandatory subject must result in displayGpa 0.00 and F");
  console.log("✓ calculateStudentSemesterSummary tests passed.");

  // 4. Test calculateStudentFinalSummary (Multi-term weighted)
  console.log("\n4. Testing calculateStudentFinalSummary...");
  const finalSummary = calculateStudentFinalSummary(
    mockStudent("std-1", "Student One", "1"),
    [s1, s2, s3],
    {
      1: { ...summary1, gpa: 4.0, displayGpa: 4.0, totalMarks: 400 },
      2: { ...summary1, gpa: 5.0, displayGpa: 5.0, totalMarks: 450 },
    },
    { 1: 0.5, 2: 0.5 }
  );
  assert(finalSummary.displayGpa === 4.5, `Expected weighted displayGpa 4.50, got ${finalSummary.displayGpa}`);
  console.log("✓ calculateStudentFinalSummary tests passed.");

  // 5. Test sortAndRankStudentResults (4-Tier Tie-Breaking)
  console.log("\n5. Testing sortAndRankStudentResults 4-tier ranking...");
  const unranked: StudentRankedResult[] = [
    { ...summary1, student: mockStudent("s1", "Student 1", "03"), gpa: 4.5, displayGpa: 4.5, totalMarks: 450, grade: "A", failedSubjectCount: 0 },
    { ...summary1, student: mockStudent("s2", "Student 2", "01"), gpa: 4.5, displayGpa: 4.5, totalMarks: 450, grade: "A", failedSubjectCount: 0 }, // equal GPA & marks, lower roll (01 vs 03) -> rank 3 vs 4
    { ...summary1, student: mockStudent("s3", "Student 3", "02"), gpa: 4.5, displayGpa: 4.5, totalMarks: 460, grade: "A", failedSubjectCount: 0 }, // equal GPA, higher marks (460) -> rank 2
    { ...summary1, student: mockStudent("s4", "Student 4", "04"), gpa: 0.0, displayGpa: 0.0, totalMarks: 200, grade: "F", failedSubjectCount: 1 }, // failed -> ranked bottom
    { ...summary1, student: mockStudent("s5", "Student 5", "05"), gpa: 5.0, displayGpa: 5.0, totalMarks: 490, grade: "A+", failedSubjectCount: 0 }, // highest GPA -> rank 1
  ];

  const ranked = sortAndRankStudentResults(unranked);
  console.log("Ranked output:", ranked.map(r => ({ id: r.student.id, gpa: r.gpa, displayGpa: r.displayGpa, totalMarks: r.totalMarks, grade: r.grade, pos: r.position })));
  assert(ranked[0].student.id === "s5" && ranked[0].position === 1, "Rank 1 must be s5 (GPA 5.0)");
  assert(ranked[1].student.id === "s3" && ranked[1].position === 2, "Rank 2 must be s3 (GPA 4.5, 460 marks)");
  assert(ranked[2].student.id === "s2" && ranked[2].position === 3, "Rank 3 must be s2 (GPA 4.5, 450 marks, roll 01)");
  assert(ranked[3].student.id === "s1" && ranked[3].position === 3, "Rank 3 (tied) must be s1 (GPA 4.5, 450 marks, roll 03)");
  assert(ranked[4].student.id === "s4", "Failed student must be placed last");
  console.log("✓ sortAndRankStudentResults 4-tier tie-breaking passed.");

  console.log("\n==========================================");
  console.log("ALL ACADEMIC CALCULATOR TESTS PASSED 100%!");
  console.log("==========================================\n");
}

runComprehensiveTests();
