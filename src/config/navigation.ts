import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  GraduationCap,
  Users,
  Building2,
  BookOpen,
  ClipboardList,
  PenLine,
  BarChart2,
  CalendarDays,
  CalendarCheck,
  CalendarPlus,
  ArrowUpCircle,
  Wallet,
  Receipt,
  Coins,
  Banknote,
  TrendingDown,
  TrendingUp,
  Sun,
  CircleDollarSign,
  SlidersHorizontal,
  FileText,
  Shield,
  Briefcase,
  Settings,
  UserCog,
  Sliders,
  CheckSquare,
  Megaphone,
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
      { title: "Students", icon: GraduationCap, href: "/students" },
      { title: "Classes & Sections", icon: Building2, href: "/classes" },
      { title: "Subjects", icon: BookOpen, href: "/subjects" },
      { title: "Teachers", icon: Users, href: "/administration/teachers-rooms" },
      { title: "General Staff", icon: Briefcase, href: "/administration/staff" },
      { title: "Class Routine", icon: CalendarDays, href: "/administration/routine" },
    ],
  },
  {
    id: "examination",
    label: "EXAMINATION",
    icon: ClipboardList,
    collapsible: true,
    items: [
      { title: "Examinations", icon: ClipboardList, href: "/exams" },
      { title: "Marks Entry", icon: PenLine, href: "/marks" },
      { title: "Results & Marksheet", icon: BarChart2, href: "/results" },
      { title: "Exam Configuration", icon: Sliders, href: "/exam-configuration" },
      { title: "Exam Schedule", icon: CalendarPlus, href: "/administration/exam-schedule" },
    ],
  },
  {
    id: "finance",
    label: "FINANCE",
    icon: Wallet,
    collapsible: true,
    items: [
      { title: "Finance Overview", icon: Wallet, href: "/finance", exact: true },
      { title: "Fee Structures", icon: CircleDollarSign, href: "/finance/fee-structure" },
      { title: "Payment Collection", icon: Receipt, href: "/finance/tuition/collect" },
      { title: "Overdue & Dues", icon: CheckSquare, href: "/finance/tuition/overdue" },
      { title: "Teacher Salary", icon: Coins, href: "/finance/salary" },
      { title: "Staff Salary", icon: Banknote, href: "/finance/staff-salary" },
      { title: "Expense Tracker", icon: TrendingDown, href: "/finance/expense" },
      { title: "Income Records", icon: TrendingUp, href: "/finance/income" },
      { title: "Daily Closing", icon: Sun, href: "/finance/daily-closing" },
      { title: "Finance Reports", icon: FileText, href: "/finance/report" },
    ],
  },
  {
    id: "reports",
    label: "REPORTS & ANALYTICS",
    icon: FileText,
    collapsible: true,
    items: [
      { title: "All Reports", icon: FileText, href: "/reports", exact: true },
      { title: "Result Analytics", icon: BarChart2, href: "/reports/results" },
      { title: "Financial Summary", icon: Wallet, href: "/reports/finance" },
      { title: "Student Reports", icon: GraduationCap, href: "/reports/students" },
    ],
  },
  {
    id: "administration",
    label: "ADMINISTRATION",
    icon: Shield,
    collapsible: true,
    items: [
      { title: "Daily Attendance", icon: CalendarCheck, href: "/attendance" },
      { title: "Notice Board", icon: Megaphone, href: "/administration/notice" },
      { title: "Teacher Shifts & Duty", icon: UserCog, href: "/administration/teacher-shift" },
      { title: "Student Promotion", icon: ArrowUpCircle, href: "/promotion" },
    ],
  },
  {
    id: "settings",
    label: "SETTINGS",
    icon: Settings,
    collapsible: true,
    items: [
      { title: "Settings Hub", icon: Settings, href: "/settings", exact: true },
      { title: "School Settings", icon: Building2, href: "/settings/school" },
      { title: "User Management", icon: Shield, href: "/settings/users" },
      { title: "Permissions Matrix", icon: SlidersHorizontal, href: "/settings/permissions" },
    ],
  },
];

export function isActive(href: string, pathname: string | null, exact?: boolean): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  if (exact) return pathname === href;
  if (pathname === href) return true;
  return pathname.startsWith(href + "/") || pathname.startsWith("/dashboard" + href + "/");
}
