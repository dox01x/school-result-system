export * from "@/types/result";

export interface BatchMarksSavePayload {
  exam_id: string;
  subject_id: string;
  marks: Array<{
    student_id: string;
    theory_marks?: number | null;
    practical_marks?: number | null;
    total_marks?: number | null;
    is_absent?: boolean;
    remarks?: string | null;
  }>;
}
