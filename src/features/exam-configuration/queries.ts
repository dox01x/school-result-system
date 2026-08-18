import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getExamConfigurations(examId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("exam_subject_configs")
    .select("*, subjects(name, code)")
    .eq("exam_id", examId);

  if (error) return [];
  return data || [];
}
