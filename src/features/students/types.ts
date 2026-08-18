export * from "@/types/student";

export interface StudentFilter {
  class_id?: string;
  section_id?: string;
  search?: string;
  status?: string;
}
