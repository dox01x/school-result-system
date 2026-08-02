/** Default grading rule sets used for auto-seeding and reset */

export interface GradingRuleDefault {
  marks_category: number;
  min_marks: number;
  max_marks: number;
  grade: string;
  grade_point: number;
}

export const DEFAULT_GRADING_100: GradingRuleDefault[] = [
  { marks_category: 100, min_marks: 80, max_marks: 100, grade: "A+", grade_point: 5 },
  { marks_category: 100, min_marks: 70, max_marks: 79, grade: "A", grade_point: 4 },
  { marks_category: 100, min_marks: 60, max_marks: 69, grade: "A-", grade_point: 3.5 },
  { marks_category: 100, min_marks: 50, max_marks: 59, grade: "B", grade_point: 3 },
  { marks_category: 100, min_marks: 40, max_marks: 49, grade: "C", grade_point: 2 },
  { marks_category: 100, min_marks: 33, max_marks: 39, grade: "D", grade_point: 1 },
  { marks_category: 100, min_marks: 0, max_marks: 32, grade: "F", grade_point: 0 },
];

export const DEFAULT_GRADING_50: GradingRuleDefault[] = [
  { marks_category: 50, min_marks: 40, max_marks: 50, grade: "A+", grade_point: 5 },
  { marks_category: 50, min_marks: 35, max_marks: 39, grade: "A", grade_point: 4 },
  { marks_category: 50, min_marks: 30, max_marks: 34, grade: "A-", grade_point: 3.5 },
  { marks_category: 50, min_marks: 25, max_marks: 29, grade: "B", grade_point: 3 },
  { marks_category: 50, min_marks: 20, max_marks: 24, grade: "C", grade_point: 2 },
  { marks_category: 50, min_marks: 17, max_marks: 19, grade: "D", grade_point: 1 },
  { marks_category: 50, min_marks: 0, max_marks: 16, grade: "F", grade_point: 0 },
];

export const DEFAULT_GRADING_75: GradingRuleDefault[] = [
  { marks_category: 75, min_marks: 60, max_marks: 75, grade: "A+", grade_point: 5 },
  { marks_category: 75, min_marks: 53, max_marks: 59, grade: "A", grade_point: 4 },
  { marks_category: 75, min_marks: 45, max_marks: 52, grade: "A-", grade_point: 3.5 },
  { marks_category: 75, min_marks: 38, max_marks: 44, grade: "B", grade_point: 3 },
  { marks_category: 75, min_marks: 30, max_marks: 37, grade: "C", grade_point: 2 },
  { marks_category: 75, min_marks: 25, max_marks: 29, grade: "D", grade_point: 1 },
  { marks_category: 75, min_marks: 0, max_marks: 24, grade: "F", grade_point: 0 },
];

export const DEFAULT_GRADING_25: GradingRuleDefault[] = [
  { marks_category: 25, min_marks: 20, max_marks: 25, grade: "A+", grade_point: 5 },
  { marks_category: 25, min_marks: 18, max_marks: 19, grade: "A", grade_point: 4 },
  { marks_category: 25, min_marks: 15, max_marks: 17, grade: "A-", grade_point: 3.5 },
  { marks_category: 25, min_marks: 13, max_marks: 14, grade: "B", grade_point: 3 },
  { marks_category: 25, min_marks: 10, max_marks: 12, grade: "C", grade_point: 2 },
  { marks_category: 25, min_marks: 8, max_marks: 9, grade: "D", grade_point: 1 },
  { marks_category: 25, min_marks: 0, max_marks: 7, grade: "F", grade_point: 0 },
];

export const ALL_DEFAULT_GRADING = [
  ...DEFAULT_GRADING_100,
  ...DEFAULT_GRADING_75,
  ...DEFAULT_GRADING_50,
  ...DEFAULT_GRADING_25,
];

export const DEFAULT_EXAMS = [
  { name: "1st MCT", exam_type: "mct", term: 1 },
  { name: "1st Semester", exam_type: "semester", term: 1 },
  { name: "2nd MCT", exam_type: "mct", term: 2 },
  { name: "2nd Semester", exam_type: "semester", term: 2 },
  { name: "3rd MCT", exam_type: "mct", term: 3 },
  { name: "3rd Semester", exam_type: "semester", term: 3 },
];

export const SEMESTER_WEIGHTS: Record<number, number> = {
  1: 0.25,
  2: 0.25,
  3: 0.50,
};
