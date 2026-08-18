import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Student } from "@/types/student";

export async function getStudents(params?: { class_id?: string; section_id?: string; search?: string }) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("students")
    .select(`
      id,
      student_id,
      name,
      roll,
      class_id,
      section_id,
      father_name,
      mother_name,
      phone,
      gender,
      date_of_birth,
      blood_group,
      address,
      group_name,
      classes ( id, name ),
      sections ( id, name )
    `)
    .order("roll", { ascending: true });

  if (params?.class_id) {
    query = query.eq("class_id", params.class_id);
  }
  if (params?.section_id) {
    query = query.eq("section_id", params.section_id);
  }
  if (params?.search) {
    query = query.ilike("name", `%${params.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  const mapped = ((data || []) as unknown as Student[]).map((s) => ({
    ...s,
    roll_number: s.roll,
    guardian_name: s.father_name || s.mother_name || "",
    guardian_phone: s.phone || "",
  }));

  return mapped;
}

export async function getStudentById(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("students")
    .select(`
      id,
      student_id,
      name,
      roll,
      class_id,
      section_id,
      father_name,
      mother_name,
      phone,
      gender,
      date_of_birth,
      blood_group,
      address,
      group_name,
      classes ( id, name ),
      sections ( id, name )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const s = data as unknown as Student;
  return {
    ...s,
    roll_number: s.roll,
    guardian_name: s.father_name || s.mother_name || "",
    guardian_phone: s.phone || "",
  };
}
