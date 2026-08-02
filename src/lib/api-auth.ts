import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Reusable authentication guard for API routes.
 * Returns the authenticated user and supabase client, or a 401 response.
 *
 * Usage:
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth;
 *   const { user, supabase } = auth;
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

  return { user: user!, supabase };
}

/**
 * Require a specific role (or array of roles).
 * Returns 403 if the user's role doesn't match.
 *
 * Usage:
 *   const auth = await requireRole(["super_admin", "admin", "accountant"]);
 *   if (auth instanceof NextResponse) return auth;
 *   const { user, supabase, role } = auth;
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

  const { data: profile } = await (supabase as SupabaseClient<Database>)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

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
