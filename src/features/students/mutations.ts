import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { StudentInput } from "./validation";

export async function createStudent(input: StudentInput) {
  const supabase = await createServerSupabaseClient();
  const dbPayload = {
    name: input.name,
    roll: String(input.roll_number),
    class_id: input.class_id,
    section_id: input.section_id,
    gender: input.gender || undefined,
    father_name: input.guardian_name || undefined,
    phone: input.guardian_phone || undefined,
    date_of_birth: input.date_of_birth || undefined,
    blood_group: input.blood_group || undefined,
    address: input.address || undefined,
  };

  const { data, error } = await (supabase as any)
    .from("students")
    .insert([dbPayload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateStudent(id: string, input: Partial<StudentInput>) {
  const supabase = await createServerSupabaseClient();
  const dbPayload: Record<string, any> = {};
  if (input.name !== undefined) dbPayload.name = input.name;
  if (input.roll_number !== undefined) dbPayload.roll = String(input.roll_number);
  if (input.class_id !== undefined) dbPayload.class_id = input.class_id;
  if (input.section_id !== undefined) dbPayload.section_id = input.section_id;
  if (input.guardian_name !== undefined) dbPayload.father_name = input.guardian_name;
  if (input.guardian_phone !== undefined) dbPayload.phone = input.guardian_phone;
  if (input.gender !== undefined) dbPayload.gender = input.gender;
  if (input.date_of_birth !== undefined) dbPayload.date_of_birth = input.date_of_birth;
  if (input.blood_group !== undefined) dbPayload.blood_group = input.blood_group;
  if (input.address !== undefined) dbPayload.address = input.address;

  const { data, error } = await (supabase as any)
    .from("students")
    .update(dbPayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteStudent(id: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return true;
}
