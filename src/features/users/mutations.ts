import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/auth";

export async function updateUserRole(userId: string, role: UserRole) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role } as any)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
