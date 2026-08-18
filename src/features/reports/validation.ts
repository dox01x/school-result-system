import type { ReportFilter } from "./types";

export function validateReportFilter(filter: ReportFilter): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!filter.type) errors.push("Report type is required.");
  return { valid: errors.length === 0, errors };
}
