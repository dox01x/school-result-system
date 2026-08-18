import type { PublishResultPayload } from "./types";

export function validatePublishPayload(payload: PublishResultPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!payload.exam_id) errors.push("Exam ID is required.");
  return { valid: errors.length === 0, errors };
}
