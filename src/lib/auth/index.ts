import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserProfile, UserRole } from "@/types/auth";

export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

    return {
      id: user.id,
      email: user.email ?? null,
      full_name: profile?.full_name ?? null,
      role: (profile?.role as UserRole) || "viewer",
    };
  } catch {
    return null;
  }
}

export * from "@/lib/api-auth";
