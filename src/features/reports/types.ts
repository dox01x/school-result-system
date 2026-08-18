export interface ReportFilter {
  type: "results" | "finance" | "students";
  academic_year?: string;
  class_id?: string;
  exam_id?: string;
  month?: string;
  year?: number;
}

export interface SummaryStat {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
}
