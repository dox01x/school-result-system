import type { UserRole } from "@/types/auth";

export const USER_ROLES: Array<{ value: UserRole; label: string; description: string }> = [
  { value: "super_admin", label: "Super Admin", description: "Full system access & settings control" },
  { value: "admin", label: "Admin", description: "Manage academics, staff, students & routine" },
  { value: "exam_controller", label: "Exam Controller", description: "Exam management, marks & result publication" },
  { value: "class_teacher", label: "Class Teacher", description: "Student records, attendance & class marks" },
  { value: "accountant", label: "Accountant", description: "Fee collection, expenses & financial reports" },
  { value: "viewer", label: "Viewer", description: "Read-only access to published reports" },
];
