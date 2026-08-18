export interface StudentInput {
  name: string;
  roll?: string | number;
  roll_number?: string | number;
  class_id: string;
  section_id: string;
  student_id?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  guardian_name?: string | null;
  phone?: string | null;
  guardian_phone?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  blood_group?: string | null;
  address?: string | null;
  group_name?: string | null;
  status?: string | null;
}

export function validateStudentInput(input: Partial<StudentInput>): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length < 1) {
    errors.name = "Student name is required.";
  }
  const effectiveRoll = input.roll !== undefined ? String(input.roll).trim() : (input.roll_number !== undefined ? String(input.roll_number).trim() : "");
  if (!effectiveRoll) {
    errors.roll_number = "Valid roll number is required.";
    errors.roll = "Valid roll number is required.";
  }
  if (!input.class_id) {
    errors.class_id = "Class selection is required.";
  }
  if (!input.section_id) {
    errors.section_id = "Section selection is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
