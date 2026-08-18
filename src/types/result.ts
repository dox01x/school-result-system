export interface MarkRecord {
  id?: string;
  student_id: string;
  exam_id: string;
  subject_id: string;
  academic_year?: string;
  theory?: number | null;
  mcq?: number | null;
  practical?: number | null;
  total?: number | null;
  marks_obtained?: number | null;
  theory_marks?: number | null;
  practical_marks?: number | null;
  mcq_marks?: number | null;
  assignment_marks?: number | null;
  total_marks?: number | null;
  grade?: string | null;
  grade_point?: number | null;
  is_absent?: boolean;
  remarks?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StudentResultSummary {
  student_id: string;
  student_name: string;
  roll?: string | number;
  roll_number?: number | string;
  class_name: string;
  section_name: string;
  exam_name: string;
  academic_year: string;
  total_obtained: number;
  total_max: number;
  percentage: number;
  gpa: number;
  letter_grade: string;
  position?: number | null;
  passed: boolean;
  subject_results: Array<{
    subject_name: string;
    subject_code?: string;
    obtained: number;
    max: number;
    grade: string;
    point: number;
    passed: boolean;
  }>;
}
