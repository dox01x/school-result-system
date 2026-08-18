export interface ExamSubjectConfig {
  id?: string;
  exam_id: string;
  subject_id: string;
  full_marks: number;
  pass_marks: number;
  theory_full_marks?: number;
  theory_pass_marks?: number;
  practical_full_marks?: number;
  practical_pass_marks?: number;
}

export interface GradingScaleConfig {
  grade: string;
  min_percentage: number;
  max_percentage: number;
  grade_point: number;
  remarks: string;
}
