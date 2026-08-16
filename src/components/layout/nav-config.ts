import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  GraduationCap,
  Users,
  Megaphone,
  BarChart2,
  Settings,
  Building2,
  BookOpen,
  ClipboardList,
  PenLine,
  CalendarPlus,
  CalendarDays,
  CalendarCheck,
  ArrowUpCircle,
  Wallet,
  Receipt,
  Coins,
  Banknote,
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  ListChecks,
  Sun,
  FileText,
  Shield,
  Briefcase,
  SlidersHorizontal,
  UserCog,
} from "lucide-react";

export type NavItem = {
  title: string;
  icon: LucideIcon;
  href: string;
  exact?: boolean;
  badge?: string;
};

export type NavGroup = {
  id: string;
  label: string;
  icon?: LucideIcon;
  collapsible?: boolean;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    label: "MAIN",
    items: [
      { title: "Dashboard", icon: LayoutGrid, href: "/dashboard", exact: true },
    ],
  },
  {
    id: "academic",
    label: "ACADEMIC",
    icon: GraduationCap,
    collapsible: true,
    items: [
      { title: "Students", icon: GraduationCap, href: "/dashboard/students" },
      { title: "Teachers", icon: Users, href: "/dashboard/administration/teachers-rooms" },
      { title: "General Staff", icon: Briefcase, href: "/dashboard/administration/staff" },
      { title: "Classes & Sections", icon: Building2, href: "/dashboard/classes" },
      { title: "Subjects", icon: BookOpen, href: "/dashboard/subjects" },
      { title: "Class Routine", icon: CalendarDays, href: "/dashboard/administration/routine" },
    ],
  },
  {
    id: "examination",
    label: "EXAMINATION",
    icon: ClipboardList,
    collapsible: true,
    items: [
      { title: "Examinations", icon: ClipboardList, href: "/dashboard/exams" },
      { title: "Marks Entry", icon: PenLine, href: "/dashboard/marks" },
      { title: "Results & Marksheet", icon: BarChart2, href: "/dashboard/results" },
      { title: "Exam Schedule", icon: CalendarPlus, href: "/dashboard/administration/exam-schedule" },
    ],
  },
  {
    id: "finance",
    label: "FINANCE",
    icon: Wallet,
    collapsible: true,
    items: [
      { title: "Finance Overview", icon: Wallet, href: "/dashboard/finance", exact: true },
      { title: "Tuition Collection", icon: Receipt, href: "/dashboard/finance/tuition/collect" },
      { title: "Overdue Tuition", icon: ListChecks, href: "/dashboard/finance/tuition/overdue" },
      { title: "Teacher Salary", icon: Coins, href: "/dashboard/finance/salary" },
      { title: "Staff Salary", icon: Banknote, href: "/dashboard/finance/staff-salary" },
      { title: "Expense Tracker", icon: TrendingDown, href: "/dashboard/finance/expense" },
      { title: "Income Records", icon: TrendingUp, href: "/dashboard/finance/income" },
      { title: "Daily Closing", icon: Sun, href: "/dashboard/finance/daily-closing" },
      { title: "Fee Structure", icon: CircleDollarSign, href: "/dashboard/finance/fee-structure" },
      { title: "Salary Config", icon: SlidersHorizontal, href: "/dashboard/finance/salary/config" },
      { title: "Staff Salary Config", icon: Briefcase, href: "/dashboard/finance/staff-salary/config" },
      { title: "Finance Reports", icon: FileText, href: "/dashboard/finance/report" },
    ],
  },
  {
    id: "administration",
    label: "ADMINISTRATION",
    icon: Shield,
    collapsible: true,
    items: [
      { title: "Daily Attendance", icon: CalendarCheck, href: "/dashboard/attendance" },
      { title: "Teacher Shifts & Duty", icon: UserCog, href: "/dashboard/administration/teacher-shift" },
      { title: "Student Promotion", icon: ArrowUpCircle, href: "/dashboard/promotion" },
      { title: "Notice Board", icon: Megaphone, href: "/dashboard/administration/notice" },
    ],
  },
  {
    id: "system",
    label: "SYSTEM & SETTINGS",
    icon: Settings,
    collapsible: true,
    items: [
      { title: "User Management", icon: Shield, href: "/dashboard/users" },
      { title: "School Settings", icon: Settings, href: "/dashboard/settings" },
    ],
  },
];

export function isActive(href: string, pathname: string | null, exact?: boolean): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  if (exact) return pathname === href;
  if (pathname === href) return true;

  // Prevent parent matching when a more specific sub-route is configured separately
  if (href === "/dashboard/finance/salary" && pathname.startsWith("/dashboard/finance/salary/config")) {
    return false;
  }
  if (href === "/dashboard/finance/staff-salary" && pathname.startsWith("/dashboard/finance/staff-salary/config")) {
    return false;
  }

  return pathname.startsWith(href + "/");
}
