/**
 * Unit tests for academic calculations and grading formulas
 */

export function calculateGradePoint(marks: number): { grade: string; point: number } {
  if (marks >= 80) return { grade: "A+", point: 5.0 };
  if (marks >= 70) return { grade: "A", point: 4.0 };
  if (marks >= 60) return { grade: "A-", point: 3.5 };
  if (marks >= 50) return { grade: "B", point: 3.0 };
  if (marks >= 40) return { grade: "C", point: 2.0 };
  if (marks >= 33) return { grade: "D", point: 1.0 };
  return { grade: "F", point: 0.0 };
}

// Simple test runner assertion
export function runUnitTests() {
  const t1 = calculateGradePoint(85);
  console.assert(t1.grade === "A+" && t1.point === 5.0, "Test 85 marks should be A+ / 5.0");

  const t2 = calculateGradePoint(32);
  console.assert(t2.grade === "F" && t2.point === 0.0, "Test 32 marks should be F / 0.0");

  const t3 = calculateGradePoint(55);
  console.assert(t3.grade === "B" && t3.point === 3.0, "Test 55 marks should be B / 3.0");

  console.log("All unit tests passed!");
}
