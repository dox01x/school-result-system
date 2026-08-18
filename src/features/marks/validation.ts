import type { BatchMarksSavePayload } from "./types";

export function validateMarksPayload(payload: BatchMarksSavePayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!payload.exam_id) errors.push("Exam ID is required.");
  if (!payload.subject_id) errors.push("Subject ID is required.");
  if (!Array.isArray(payload.marks)) errors.push("Marks must be an array.");

  return {
    valid: errors.length === 0,
    errors,
  };
}
