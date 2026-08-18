import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getFeeStructures() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("fee_structure")
    .select("*, classes(name)")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getRecentTuitionPayments(limit = 20) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("tuition_payments")
    .select("*, students(name, roll, classes(name), sections(name))")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
