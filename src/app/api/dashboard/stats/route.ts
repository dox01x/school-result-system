import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  calculateDateRangeBounds,
  getStudentMetrics,
  getStaffMetrics,
  getAttendanceMetrics,
  getFinanceMetrics,
  getAcademicMetrics,
  getActivityFeed,
  getAttentionAlerts,
  type DateRangePreset,
  type DashboardFilters,
  type UserRoleContext,
} from "@/lib/dashboard/dashboard-service";
import type { UserRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    // Determine user role and class teacher assignments
    let role: UserRole = "admin";
    let assignments: { class_id: string; section_id: string; class_name?: string; section_name?: string }[] = [];

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role) {
      role = profile.role as UserRole;
    }

    if (role === "class_teacher") {
      const { data: assignmentData } = await (supabase as any)
        .from("class_teacher_assignments")
        .select("class_id, section_id, classes(name), sections(name)")
        .eq("user_id", user.id);

      if (assignmentData) {
        assignments = assignmentData.map((a: any) => ({
          class_id: a.class_id,
          section_id: a.section_id,
          class_name: a.classes?.name,
          section_name: a.sections?.name,
        }));
      }
    }

    const roleContext: UserRoleContext = {
      role,
      userId: user.id,
      assignedClasses: assignments,
    };

    // Extract and sanitize query parameters
    const VALID_PRESETS = new Set<DateRangePreset>([
      "today",
      "yesterday",
      "7d",
      "30d",
      "this_week",
      "this_month",
      "prev_month",
      "this_year",
      "custom",
    ]);

    const { searchParams } = new URL(request.url);
    const rawRange = searchParams.get("range") || "30d";
    const range: DateRangePreset = VALID_PRESETS.has(rawRange as DateRangePreset)
      ? (rawRange as DateRangePreset)
      : "30d";

    const rawStartDate = searchParams.get("startDate");
    const rawEndDate = searchParams.get("endDate");
    const startDate = rawStartDate && /^\d{4}-\d{2}-\d{2}$/.test(rawStartDate) ? rawStartDate : undefined;
    const endDate = rawEndDate && /^\d{4}-\d{2}-\d{2}$/.test(rawEndDate) ? rawEndDate : undefined;
    const academicYear = searchParams.get("academicYear") || undefined;
    const classId = searchParams.get("classId") || undefined;
    const sectionId = searchParams.get("sectionId") || undefined;
    const paymentMethod = searchParams.get("paymentMethod") || undefined;

    const filters: DashboardFilters = {
      range,
      startDate,
      endDate,
      academicYear,
      classId,
      sectionId,
      paymentMethod,
    };

    const bounds = calculateDateRangeBounds(range, startDate, endDate);

    // Concurrently aggregate domain data
    const [
      schoolInfoRes,
      classesRes,
      studentMetrics,
      staffMetrics,
      attendanceMetrics,
      financeMetrics,
      academicMetrics,
      activityFeed,
    ] = await Promise.all([
      supabase
        .from("school_info")
        .select("name, address, phone, email, logo_url, current_academic_year, established_year")
        .limit(1)
        .maybeSingle(),
      supabase.from("classes").select("id, name, numeric_value").order("numeric_value"),
      getStudentMetrics(supabase, filters, roleContext),
      getStaffMetrics(supabase),
      getAttendanceMetrics(supabase, bounds, filters, roleContext),
      getFinanceMetrics(supabase, bounds, filters, roleContext),
      getAcademicMetrics(supabase, bounds, roleContext),
      getActivityFeed(supabase, roleContext, 8),
    ]);

    const attentionAlerts = await getAttentionAlerts(
      supabase,
      financeMetrics,
      attendanceMetrics,
      academicMetrics,
      roleContext
    );

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        roleContext: {
          role: roleContext.role,
          assignedClasses: roleContext.assignedClasses || [],
        },
        school: schoolInfoRes.data,
        classes: classesRes.data || [],
        dateBounds: {
          preset: range,
          startDate: bounds.current.startDateStr,
          endDate: bounds.current.endDateStr,
        },
        students: studentMetrics,
        staff: staffMetrics,
        attendance: attendanceMetrics,
        finance: financeMetrics,
        academic: academicMetrics,
        activity: activityFeed,
        alerts: attentionAlerts,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
