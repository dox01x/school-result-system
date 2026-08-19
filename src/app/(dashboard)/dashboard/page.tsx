import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AccessDeniedToast } from "./_components/access-denied-toast";
import { PromotionBanner } from "./_components/promotion-banner";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import {
  calculateDateRangeBounds,
  getStudentMetrics,
  getStaffMetrics,
  getAttendanceMetrics,
  getFinanceMetrics,
  getAcademicMetrics,
  getActivityFeed,
  getAttentionAlerts,
  type DashboardFilters,
  type UserRoleContext,
} from "@/lib/dashboard/dashboard-service";
import type { UserRole } from "@/lib/rbac";

export const revalidate = 0; // Dynamic real-time server rendering

export default async function DashboardPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createServerSupabaseClient();

  // 1. Resolve User & Role
  let role: UserRole = "admin";
  let userId = "";
  let userName = "Administrator";
  let assignments: { class_id: string; section_id: string; class_name?: string; section_name?: string }[] = [];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    userId = user.id;
    userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role) {
      role = profile.role as UserRole;
    }
    if (profile?.full_name) {
      userName = profile.full_name;
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
  }

  const roleContext: UserRoleContext = {
    role,
    userId,
    assignedClasses: assignments,
  };

  const range = (typeof searchParams.range === "string" ? searchParams.range : "30d") as any;
  const classId = typeof searchParams.classId === "string" ? searchParams.classId : undefined;
  const filters: DashboardFilters = { range, classId };
  const bounds = calculateDateRangeBounds(range);

  // 2. Fetch Initial Server Data
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

  const initialData = {
    timestamp: new Date().toISOString(),
    roleContext: {
      role: roleContext.role,
      assignedClasses: roleContext.assignedClasses || [],
    },
    school: schoolInfoRes.data,
    classes: (classesRes.data || []) as any[],
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
  };

  return (
    <div className="space-y-6">
      <AccessDeniedToast />
      <PromotionBanner academicYear={schoolInfoRes.data?.current_academic_year} />
      <DashboardView
        initialData={initialData}
        role={role}
        userName={userName}
      />
    </div>
  );
}
