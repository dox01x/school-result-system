export interface ExamInput {
  name: string;
  term?: string | null;
  academic_year: string;
  start_date?: string | null;
  end_date?: string | null;
  is_published?: boolean;
}

export function validateExamInput(input: Partial<ExamInput>): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length < 2) {
    errors.name = "Exam title is required.";
  }
  if (!input.academic_year) {
    errors.academic_year = "Academic year is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
