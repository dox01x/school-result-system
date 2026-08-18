import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { BatchMarksSavePayload } from "./types";

export async function upsertBatchMarks(payload: BatchMarksSavePayload) {
  const supabase = await createServerSupabaseClient();
  const records = payload.marks.map((m) => ({
    exam_id: payload.exam_id,
    subject_id: payload.subject_id,
    student_id: m.student_id,
    theory_marks: m.theory_marks,
    practical_marks: m.practical_marks,
    total_marks: m.total_marks,
  }));

  const { data, error } = await supabase
    .from("marks")
    .upsert(records as any, { onConflict: "exam_id,student_id,subject_id" })
    .select();

  if (error) throw error;
  return data;
}
