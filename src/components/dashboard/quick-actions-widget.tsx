"use client";

import Link from "next/link";
import {
  Receipt,
  CalendarCheck,
  BookOpen,
  UserPlus,
  Megaphone,
  CreditCard,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ActionItem {
  id: string;
  label: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  roles: string[];
}

const ALL_ACTIONS: ActionItem[] = [
  {
    id: "action-collect-fees",
    label: "Collect Fees",
    desc: "Record payment receipt",
    href: "/finance/tuition/collect",
    icon: Receipt,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    roles: ["super_admin", "admin", "accountant"],
  },
  {
    id: "action-take-attendance",
    label: "Take Attendance",
    desc: "Daily student presence",
    href: "/attendance",
    icon: CalendarCheck,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    roles: ["super_admin", "admin", "class_teacher"],
  },
  {
    id: "action-enter-marks",
    label: "Enter Marks",
    desc: "Exam marks entry",
    href: "/marks",
    icon: BookOpen,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
    roles: ["super_admin", "admin", "exam_controller", "class_teacher"],
  },
  {
    id: "action-add-student",
    label: "Add Student",
    desc: "New admission",
    href: "/students",
    icon: UserPlus,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    roles: ["super_admin", "admin"],
  },
  {
    id: "action-daily-closing",
    label: "Daily Closing",
    desc: "Reconcile daily cash",
    href: "/finance/daily-closing",
    icon: CreditCard,
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-500/10 border-teal-500/20",
    roles: ["super_admin", "admin", "accountant"],
  },
  {
    id: "action-view-dues",
    label: "Overdue Fees",
    desc: "Defaulter student list",
    href: "/finance/tuition/overdue",
    icon: AlertCircle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    roles: ["super_admin", "admin", "accountant"],
  },
  {
    id: "action-post-notice",
    label: "Post Notice",
    desc: "School circular",
    href: "/administration/notice",
    icon: Megaphone,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
    roles: ["super_admin", "admin"],
  },
  {
    id: "action-reports",
    label: "Reports",
    desc: "Analytics & export",
    href: "/reports",
    icon: FileSpreadsheet,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    roles: ["super_admin", "admin", "accountant", "exam_controller"],
  },
];

interface Props {
  role: string;
}

export function QuickActionsWidget({ role }: Props) {
  const visibleActions = ALL_ACTIONS.filter((a) => a.roles.includes(role));

  if (visibleActions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground tracking-tight">Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4">
        {visibleActions.map((action) => (
          <Link key={action.id} href={action.href} className="group block focus-visible:outline-none">
            <div className="bg-card rounded-2xl p-4 border border-border/80 hover:border-primary/40 hover:shadow-xs transition-all text-center h-full flex flex-col items-center justify-center active:scale-[0.98]">
              <div className={`h-11 w-11 rounded-xl ${action.bg} ${action.color} flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform`}>
                <action.icon size={20} strokeWidth={2} />
              </div>
              <h4 className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {action.label}
              </h4>
              <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate max-w-full">
                {action.desc}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
