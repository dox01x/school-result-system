import type { ExamSubjectConfig } from "./types";

export function validateExamSubjectConfig(config: ExamSubjectConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!config.exam_id) errors.push("Exam ID is required.");
  if (!config.subject_id) errors.push("Subject ID is required.");
  if (config.full_marks <= 0) errors.push("Full marks must be positive.");
  if (config.pass_marks > config.full_marks) errors.push("Pass marks cannot exceed full marks.");

  return { valid: errors.length === 0, errors };
}
