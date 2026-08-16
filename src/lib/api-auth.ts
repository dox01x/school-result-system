import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Reusable authentication guard for API routes.
 * Returns the authenticated user and supabase client, or a 401 response.
 */
export async function requireAuth(): Promise<
  | { user: { id: string; email?: string }; supabase: SupabaseClient<Database> }
  | NextResponse
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && process.env.AUTH_DISABLED !== "true") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effectiveUser = user || { id: "00000000-0000-0000-0000-000000000000", email: "admin@school.local" };
  return { user: effectiveUser, supabase };
}

/**
 * Require a specific role (or array of roles).
 * Returns 403 if the user's role doesn't match.
 */
export async function requireRole(
  allowedRoles: string | string[]
): Promise<
  | { user: { id: string; email?: string }; supabase: SupabaseClient<Database>; role: string }
  | NextResponse
> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { user, supabase } = auth;

  let role: string | undefined;

  try {
    const { data: profile } = await (supabase as SupabaseClient<Database>)
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    role = profile?.role;
  } catch {
    // profile table query error
  }

  // Fallback to user metadata
  if (!role) {
    const rawUser = user as { user_metadata?: { role?: string }; app_metadata?: { role?: string } };
    role = rawUser?.user_metadata?.role || rawUser?.app_metadata?.role;
  }

  // If in dev or auth disabled, default to admin
  if (!role && (process.env.AUTH_DISABLED === "true" || process.env.NODE_ENV === "development")) {
    role = "admin";
  }

  if (!role) {
    return NextResponse.json({ error: "Forbidden — no role assigned" }, { status: 403 });
  }
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  // super_admin and admin always pass
  if (role === "super_admin" || role === "admin") {
    return { user, supabase, role };
  }

  if (!roles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { user, supabase, role };
}
