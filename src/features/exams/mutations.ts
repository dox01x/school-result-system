import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ExamInput } from "./validation";

export async function createExam(input: ExamInput) {
  const supabase = await createServerSupabaseClient();
  const dbPayload = {
    name: input.name,
    exam_type: input.term || "general",
    term: 1,
  };

  const { data, error } = await (supabase as any)
    .from("exams")
    .insert([dbPayload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateExam(id: string, input: Partial<ExamInput>) {
  const supabase = await createServerSupabaseClient();
  const dbPayload: Record<string, any> = {};
  if (input.name) dbPayload.name = input.name;
  if (input.term) dbPayload.exam_type = input.term;

  const { data, error } = await (supabase as any)
    .from("exams")
    .update(dbPayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteExam(id: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("exams")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return true;
}
