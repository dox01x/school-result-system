import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/types/auth";

const ROLE_CONFIG: Record<UserRole, { label: string; className: string }> = {
  super_admin: { label: "Super Admin", className: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800" },
  admin: { label: "Admin", className: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800" },
  exam_controller: { label: "Exam Controller", className: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800" },
  class_teacher: { label: "Class Teacher", className: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800" },
  accountant: { label: "Accountant", className: "bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:border-cyan-800" },
  viewer: { label: "Viewer", className: "bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800" },
};

export function UserRoleBadge({ role }: { role: UserRole | string }) {
  const conf = ROLE_CONFIG[role as UserRole] || { label: role, className: "bg-secondary text-secondary-foreground" };
  return (
    <Badge variant="outline" className={`font-medium text-[11px] capitalize ${conf.className}`}>
      {conf.label}
    </Badge>
  );
}
