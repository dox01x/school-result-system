import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Exam } from "@/types/exam";

export async function getExams() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("exams")
    .select("id, name, term, academic_year, is_published, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as Exam[]) || [];
}

export async function getExamById(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("exams")
    .select("id, name, term, academic_year, is_published, created_at")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as unknown as Exam;
}
