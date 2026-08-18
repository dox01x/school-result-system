export const GRADING_SCALE = [
  { grade: "A+", min: 80, max: 100, point: 5.0, remarks: "Outstanding" },
  { grade: "A", min: 70, max: 79, point: 4.0, remarks: "Excellent" },
  { grade: "A-", min: 60, max: 69, point: 3.5, remarks: "Very Good" },
  { grade: "B", min: 50, max: 59, point: 3.0, remarks: "Good" },
  { grade: "C", min: 40, max: 49, point: 2.0, remarks: "Satisfactory" },
  { grade: "D", min: 33, max: 39, point: 1.0, remarks: "Pass" },
  { grade: "F", min: 0, max: 32, point: 0.0, remarks: "Fail" },
] as const;
