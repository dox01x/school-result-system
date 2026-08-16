// ═══════════════════════════════════════════
// Role-Based Access Control (RBAC) Configuration
// ═══════════════════════════════════════════

export type UserRole = "super_admin" | "admin" | "exam_controller" | "accountant" | "class_teacher";

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  exam_controller: "Exam Controller",
  accountant: "Accountant",
  class_teacher: "Class Teacher",
};

export const ROLE_LABELS_EN: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  exam_controller: "Exam Controller",
  accountant: "Accountant",
  class_teacher: "Class Teacher",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
  admin: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  exam_controller: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  accountant: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  class_teacher: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
};

/**
 * Route access configuration.
 * Each route prefix maps to the roles that can access it.
 * More specific routes are checked first (longest match wins).
 */
const ROUTE_ACCESS: { path: string; roles: UserRole[] }[] = [
  // User management — super_admin only
  { path: "/dashboard/users", roles: ["super_admin"] },

  // Settings — admin+
  { path: "/dashboard/settings", roles: ["super_admin", "admin"] },

  // Finance — admin + accountant
  { path: "/dashboard/finance", roles: ["super_admin", "admin", "accountant"] },

  // Examination section — admin + exam_controller + class_teacher (marks only)
  { path: "/dashboard/marks", roles: ["super_admin", "admin", "exam_controller", "class_teacher"] },
  { path: "/dashboard/exams", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/dashboard/results", roles: ["super_admin", "admin", "exam_controller"] },

  // Academic
  { path: "/dashboard/students", roles: ["super_admin", "admin", "class_teacher"] },
  { path: "/dashboard/classes", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/dashboard/subjects", roles: ["super_admin", "admin", "exam_controller"] },

  // Administration
  { path: "/dashboard/administration/teachers-rooms", roles: ["super_admin", "admin"] },
  { path: "/dashboard/administration/staff", roles: ["super_admin", "admin"] },
  { path: "/dashboard/administration/routine", roles: ["super_admin", "admin"] },
  { path: "/dashboard/administration/exam-schedule", roles: ["super_admin", "admin", "exam_controller"] },
  { path: "/dashboard/administration/notice", roles: ["super_admin", "admin"] },
  { path: "/dashboard/administration/teacher-shift", roles: ["super_admin", "admin"] },
  { path: "/dashboard/attendance", roles: ["super_admin", "admin", "class_teacher"] },
  { path: "/dashboard/promotion", roles: ["super_admin", "admin"] },
  { path: "/dashboard/archive", roles: ["super_admin", "admin"] },

  // Dashboard — everyone
  { path: "/dashboard", roles: ["super_admin", "admin", "exam_controller", "accountant", "class_teacher"] },
];

/**
 * Check if a role can access a given pathname.
 */
// Pre-sorted by path length descending for longest-prefix matching
const SORTED_ROUTE_ACCESS = [...ROUTE_ACCESS].sort((a, b) => b.path.length - a.path.length);

export function canAccessRoute(role: UserRole | null | undefined, pathname: string): boolean {
  if (!role) return false;
  if (role === "super_admin" || role === "admin") return true;

  for (const entry of SORTED_ROUTE_ACCESS) {
    if (pathname === entry.path || pathname.startsWith(entry.path + "/")) {
      return entry.roles.includes(role);
    }
  }

  // Unlisted dashboard routes are restricted to admin roles
  if (pathname.startsWith("/dashboard")) return false;

  return true;
}

/**
 * Check if a role is an admin-level role (full access).
 */
export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === "super_admin" || role === "admin";
}

/**
 * Check if a role is super_admin.
 */
export function isSuperAdmin(role: UserRole | null | undefined): boolean {
  return role === "super_admin";
}

/**
 * Nav group visibility per role. Returns which sidebar groups & items should be visible.
 */
export type NavItemAccess = {
  title: string;
  href: string;
  visible: boolean;
};

/**
 * Check if a sidebar nav item should be visible for the given role.
 */
export function isNavItemVisible(role: UserRole | null | undefined, href: string): boolean {
  if (!role) return false;
  return canAccessRoute(role, href);
}

/**
 * All valid roles for validation
 */
export const ALL_ROLES: UserRole[] = ["super_admin", "admin", "exam_controller", "accountant", "class_teacher"];

export function isValidRole(role: string): role is UserRole {
  return ALL_ROLES.includes(role as UserRole);
}
