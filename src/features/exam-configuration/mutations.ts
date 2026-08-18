import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ExamSubjectConfig } from "./types";

export async function saveExamSubjectConfig(config: ExamSubjectConfig) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("exam_subject_configs")
    .upsert([config], { onConflict: "exam_id,subject_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}
