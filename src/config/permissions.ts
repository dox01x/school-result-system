import type { UserRole } from "@/types/auth";

export interface PermissionRule {
  path: string;
  roles: UserRole[];
}

export const ROUTE_PERMISSIONS: PermissionRule[] = [
  // User Management
  { path: "/settings/users", roles: ["super_admin"] },
  { path: "/dashboard/users", roles: ["super_admin"] },

  // Settings & Permissions
  { path: "/settings", roles: ["super_admin", "admin"] },
  { path: "/settings/school", roles: ["super_admin", "admin"] },
  { path: "/settings/permissions", roles: ["super_admin"] },
  { path: "/dashboard/settings", roles: ["super_admin", "admin"] },

  // Finance
  { path: "/finance", roles: ["super_admin", "admin", "accountant"] },
  { path: "/finance/fees", roles: ["super_admin", "admin", "accountant"] },
  { path: "/finance/payments", roles: ["super_admin", "admin", "accountant"] },
  { path: "/finance/dues", roles: ["super_admin", "admin", "accountant"] },
  { path: "/finance/reports", roles: ["super_admin", "admin", "accountant"] },
  { path: "/dashboard/finance", roles: ["super_admin", "admin", "accountant"] },

  // Examination & Marks
  { path: "/marks", roles: ["super_admin", "admin", "exam_controller", "class_teacher"] },
  { path: "/marks/entry", roles: ["super_admin", "admin", "exam_controller", "class_teacher"] },
  { path: "/exams", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/results", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/results/publish", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/exam-configuration", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/dashboard/marks", roles: ["super_admin", "admin", "exam_controller", "class_teacher"] },
  { path: "/dashboard/exams", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/dashboard/results", roles: ["super_admin", "admin", "exam_controller"] },

  // Students & Academics
  { path: "/students", roles: ["super_admin", "admin", "class_teacher"] },
  { path: "/classes", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/subjects", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/reports", roles: ["super_admin", "admin", "exam_controller", "accountant"] },
  { path: "/dashboard/students", roles: ["super_admin", "admin", "class_teacher"] },
  { path: "/dashboard/classes", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/dashboard/subjects", roles: ["super_admin", "admin", "exam_controller"] },

  // Administration
  { path: "/dashboard/administration", roles: ["super_admin", "admin"] },
  { path: "/dashboard/attendance", roles: ["super_admin", "admin", "class_teacher"] },
  { path: "/dashboard/promotion", roles: ["super_admin", "admin"] },
];

export function hasPermission(role: UserRole | null | undefined, path: string): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;

  const rule = ROUTE_PERMISSIONS.find((r) => path === r.path || path.startsWith(r.path + "/"));
  if (!rule) return true; // Default allow if not restricted

  return rule.roles.includes(role);
}
