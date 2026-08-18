import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidRole } from "@/lib/rbac";

interface UserProfileRow {
  id: string;
  role: string;
  full_name: string | null;
  updated_at: string;
}

interface ClassTeacherAssignmentRow {
  user_id: string;
  class_id: string;
  section_id: string;
  classes?: { name: string } | null;
  sections?: { name: string } | null;
}

/** Helper: check caller is super_admin (or allow if AUTH_DISABLED) */
async function requireSuperAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && process.env.AUTH_DISABLED !== "true") {
    return { error: "Unauthorized", status: 401 };
  }

  if (user && process.env.AUTH_DISABLED !== "true") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "super_admin") {
      return { error: "Only super admin can manage users", status: 403 };
    }
  }

  return { user: user || { id: "dev_user" }, supabase };
}

/**
 * GET /api/users — list all users with profiles
 */
export async function GET() {
  const check = await requireSuperAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const admin = createAdminClient();

  // Get all auth users (page 1, perPage 1000 to prevent truncation)
  const { data: { users }, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  // Get all profiles
  const { data: rawProfiles } = await admin.from("profiles").select("id, role, full_name, updated_at");
  const profiles = (rawProfiles || []) as unknown as UserProfileRow[];
  const profileMap = new Map<string, UserProfileRow>(profiles.map((p) => [p.id, p]));

  // Get class teacher assignments
  const assignmentMap = new Map<string, ClassTeacherAssignmentRow[]>();
  try {
    const { data: rawAssignments } = await (admin as any)
      .from("class_teacher_assignments")
      .select("user_id, class_id, section_id, classes ( name ), sections ( name )");

    const assignments = (rawAssignments || []) as unknown as ClassTeacherAssignmentRow[];
    assignments.forEach((a) => {
      const uid = a.user_id;
      if (!assignmentMap.has(uid)) assignmentMap.set(uid, []);
      assignmentMap.get(uid)!.push(a);
    });
  } catch {
    // Table may not exist yet
  }

  const result = users.map((u) => {
    const profile = profileMap.get(u.id);
    return {
      id: u.id,
      email: u.email,
      role: profile?.role || "unassigned",
      full_name: profile?.full_name || "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      assignments: (assignmentMap.get(u.id) || []).map((a) => ({
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
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
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
