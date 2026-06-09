import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidRole } from "@/lib/rbac";

/** Helper: check caller is super_admin */
async function requireSuperAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    return { error: "Only super admin can manage users", status: 403 };
  }

  return { user, supabase };
}

/**
 * GET /api/users — list all users with profiles
 */
export async function GET() {
  const check = await requireSuperAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const admin = createAdminClient();

  // Get all auth users
  const { data: { users }, error: authError } = await admin.auth.admin.listUsers();
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  // Get all profiles
  const { data: profiles } = await admin.from("profiles").select("id, role, full_name, updated_at");
  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  // Get class teacher assignments (table may not exist yet until migration)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let assignmentMap = new Map<string, any[]>();
  try {
    const { data: assignments } = await (admin as any)
      .from("class_teacher_assignments")
      .select("user_id, class_id, section_id, classes ( name ), sections ( name )");

    (assignments || []).forEach((a: any) => {
      const uid = a.user_id as string;
      if (!assignmentMap.has(uid)) assignmentMap.set(uid, []);
      assignmentMap.get(uid)!.push(a);
    });
  } catch {
    // Table may not exist yet
  }

  const result = users.map(u => {
    const profile = profileMap.get(u.id);
    return {
      id: u.id,
      email: u.email,
      role: profile?.role || "admin",
      full_name: profile?.full_name || "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      assignments: (assignmentMap.get(u.id) || []).map((a: any) => ({
        class_id: a.class_id,
        section_id: a.section_id,
        class_name: a.classes?.name || "",
        section_name: a.sections?.name || "",
      })),
    };
  });

  return NextResponse.json(result);
}

/**
 * POST /api/users — create a new user
 * Body: { email, password, role, full_name, assignments?: [{class_id, section_id}] }
 */
export async function POST(request: Request) {
  const check = await requireSuperAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await request.json();
  const { email, password, role, full_name, assignments } = body;

  if (!email || !password || !role) {
    return NextResponse.json({ error: "email, password, and role are required" }, { status: 400 });
  }
  if (!isValidRole(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create auth user
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || "" },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  // Update profile role
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({
      id: newUser.user.id,
      role,
      full_name: full_name || "",
    });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // If class_teacher, create assignments
  if (role === "class_teacher" && assignments?.length) {
    const assignmentRows = assignments.map((a: { class_id: string; section_id: string }) => ({
      user_id: newUser.user.id,
      class_id: a.class_id,
      section_id: a.section_id,
    }));

    const { error: assignError } = await (admin as any)
      .from("class_teacher_assignments")
      .insert(assignmentRows);

    if (assignError) {
      return NextResponse.json({ error: `User created but assignment failed: ${assignError.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({
    id: newUser.user.id,
    email: newUser.user.email,
    role,
    full_name,
  }, { status: 201 });
}

/**
 * PATCH /api/users — update user role or name
 * Body: { user_id, role?, full_name?, assignments?: [{class_id, section_id}] }
 */
export async function PATCH(request: Request) {
  const check = await requireSuperAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await request.json();
  const { user_id, role, full_name, assignments } = body;

  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  // Prevent modifying own role
  if (user_id === check.user.id && role && role !== "super_admin") {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Update profile
  const updates: Record<string, string> = {};
  if (role) {
    if (!isValidRole(role)) return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
    updates.role = role;
  }
  if (full_name !== undefined) updates.full_name = full_name;

  if (Object.keys(updates).length > 0) {
    const { error } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", user_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update assignments if provided
  if (assignments !== undefined) {
    // Delete existing assignments
    await (admin as any)
      .from("class_teacher_assignments")
      .delete()
      .eq("user_id", user_id);

    // Insert new ones
    if (assignments.length > 0) {
      const assignmentRows = assignments.map((a: { class_id: string; section_id: string }) => ({
        user_id,
        class_id: a.class_id,
        section_id: a.section_id,
      }));

      const { error: assignError } = await (admin as any)
        .from("class_teacher_assignments")
        .insert(assignmentRows);

      if (assignError) {
        return NextResponse.json({ error: `Role updated but assignment failed: ${assignError.message}` }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/users — delete a user
 * Body: { user_id }
 */
export async function DELETE(request: Request) {
  const check = await requireSuperAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  // Prevent self-deletion
  if (user_id === check.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Delete auth user (cascade will handle profiles and assignments)
  const { error } = await admin.auth.admin.deleteUser(user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
