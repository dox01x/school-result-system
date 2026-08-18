import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/types/auth";

export async function getUsersList() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, phone_number, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as UserProfile[]) || [];
}
