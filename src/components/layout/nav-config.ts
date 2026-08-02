import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid, GraduationCap, Users, Megaphone, BarChart2, Settings,
  Building2, BookOpen, ClipboardList, PenLine, CalendarPlus, CalendarDays,
  CalendarCheck, ArrowUpCircle, Wallet, Receipt, Coins,
  CircleDollarSign, TrendingUp, ListChecks, Sun, FileText, Shield, Briefcase
} from "lucide-react";

export type NavItem = {
  title: string;
  icon: LucideIcon;
  href: string;
  exact?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "MAIN MENU",
    items: [
      { title: "Dashboard", icon: LayoutGrid, href: "/dashboard" },
    ],
  },
  {
    label: "ACADEMIC",
    items: [
      { title: "Students", icon: GraduationCap, href: "/dashboard/students" },
      { title: "Teachers", icon: Users, href: "/dashboard/administration/teachers-rooms" },
      { title: "General Staff", icon: Briefcase, href: "/dashboard/administration/staff" },
      { title: "Classes", icon: Building2, href: "/dashboard/classes" },
      { title: "Subjects", icon: BookOpen, href: "/dashboard/subjects" },
      { title: "Routine", icon: CalendarDays, href: "/dashboard/administration/routine" },
    ],
  },
  {
    label: "EXAMINATION",
    items: [
      { title: "Exams", icon: ClipboardList, href: "/dashboard/exams" },
      { title: "Marks Entry", icon: PenLine, href: "/dashboard/marks" },
      { title: "Results", icon: BarChart2, href: "/dashboard/results" },
      { title: "Exam Schedule", icon: CalendarPlus, href: "/dashboard/administration/exam-schedule" },
    ],
  },
  {
    label: "FINANCE",
    items: [
      { title: "Finance Overview", icon: Wallet, href: "/dashboard/finance", exact: true },
      { title: "Tuition Collection", icon: Receipt, href: "/dashboard/finance/tuition/collect" },
      { title: "Overdue Tuition", icon: ListChecks, href: "/dashboard/finance/tuition/overdue" },
      { title: "Salary", icon: Coins, href: "/dashboard/finance/salary" },
      { title: "Expense", icon: TrendingUp, href: "/dashboard/finance/expense" },
      { title: "Income", icon: TrendingUp, href: "/dashboard/finance/income" },
      { title: "Daily Closing", icon: Sun, href: "/dashboard/finance/daily-closing" },
      { title: "Finance Report", icon: FileText, href: "/dashboard/finance/report" },
    ],
  },
  {
    label: "ADMINISTRATION",
    items: [
      { title: "Notice Board", icon: Megaphone, href: "/dashboard/administration/notice" },
      { title: "Attendance", icon: CalendarCheck, href: "/dashboard/attendance" },
      { title: "Promotion", icon: ArrowUpCircle, href: "/dashboard/promotion" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { title: "User Management", icon: Shield, href: "/dashboard/users" },
      { title: "Settings", icon: Settings, href: "/dashboard/settings" },
      { title: "Fee Structure", icon: CircleDollarSign, href: "/dashboard/finance/fee-structure" },
      { title: "Salary Config", icon: Settings, href: "/dashboard/finance/salary/config" },
      { title: "Staff Salary Config", icon: Briefcase, href: "/dashboard/finance/staff-salary/config" },
    ],
  },
];

export function isActive(href: string, pathname: string | null, exact?: boolean): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}
