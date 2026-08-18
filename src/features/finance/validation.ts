import type { FeeCollectionPayload } from "./types";

export function validateFeeCollection(payload: FeeCollectionPayload): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!payload.student_id) errors.student_id = "Student selection is required.";
  if (!payload.month) errors.month = "Month is required.";
  if (!payload.year) errors.year = "Year is required.";
  if (payload.amount_paid <= 0) errors.amount_paid = "Amount paid must be greater than 0.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
