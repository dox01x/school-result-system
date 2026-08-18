import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function setExamPublicationStatus(examId: string, isPublished: boolean) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("exams")
    .update({ is_published: isPublished } as any)
    .eq("id", examId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
