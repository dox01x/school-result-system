"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutGrid, GraduationCap, Users, Megaphone, BarChart2, Settings,
    Menu, X, ChevronsLeft, ChevronsRight, Building2, BookOpen,
    ClipboardList, PenLine, CalendarPlus, CalendarDays,
    CalendarCheck, ArrowUpCircle, Bell, User, Wallet, Receipt, Coins,
    CircleDollarSign, TrendingUp, ListChecks, Sun, FileText, Shield
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { isNavItemVisible, ROLE_LABELS_EN, ROLE_COLORS } from "@/lib/rbac";

type NavItem = { title: string; icon: LucideIcon; href: string; exact?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
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
        ],
    },
];

function isActive(href: string, pathname: string | null, exact?: boolean): boolean {
    if (!pathname) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const { role, fullName, email, loading } = useUserRole();

    const closeMobile = useCallback(() => setMobileOpen(false), []);

    useEffect(() => {
        if (!mobileOpen) return;
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeMobile(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [mobileOpen, closeMobile]);

    useEffect(() => {
        queueMicrotask(() => {
            closeMobile();
        });
    }, [pathname, closeMobile]);

    // Filter nav groups by role
    const filteredNavGroups = useMemo(() => {
        if (loading || !role) return navGroups; // show all while loading
        return navGroups
            .map(group => ({
                ...group,
                items: group.items.filter(item => isNavItemVisible(role, item.href)),
            }))
            .filter(group => group.items.length > 0);
    }, [role, loading]);

    const displayName = fullName || email?.split("@")[0] || "User";
    const roleLabel = role ? ROLE_LABELS_EN[role] : "User";
    const roleColor = role ? ROLE_COLORS[role] : "";

    const renderItem = (item: NavItem) => {
        const active = isActive(item.href, pathname, item.exact);
        const Icon = item.icon;
        return (
            <li key={item.href} className="relative">
                <Link
                    href={item.href}
                    onClick={closeMobile}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                        "group relative flex items-center gap-3 rounded-xl text-[13px] font-medium tracking-wide transition-all duration-200 btn-press",
                        collapsed ? "justify-center p-2.5 mx-1" : "px-3 py-2.5 mx-2",
                        active
                            ? "bg-muted/50 text-foreground font-semibold"
                            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                >
                    {/* Active indicator */}
                    <Icon size={20} strokeWidth={active ? 2.2 : 1.5} className={cn("shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                    {/* Tooltip for collapsed */}
                    {collapsed && (
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-popover text-popover-foreground border border-border text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none shadow-lg">
                            {item.title}
                        </div>
                    )}
                </Link>
            </li>
        );
    };

    const renderGroup = (group: NavGroup) => (
        <div key={group.label} className="mt-6 first:mt-0">
            {!collapsed && (
                <p className="px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground select-none">
                    {group.label}
                </p>
            )}
            {collapsed && <div className="mx-3 mb-2 border-t border-border" />}
            <ul className="space-y-0.5" role="list">
                {group.items.map(renderItem)}
            </ul>
        </div>
    );

    const sidebarBody = (
        <>
            {/* Logo */}
            <div className={cn(
                "flex items-center gap-3 shrink-0 border-b border-border transition-all",
                collapsed ? "justify-center px-2 h-16" : "px-5 h-16"
            )}>
                <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-[var(--shadow-sm)] shrink-0">
                    <GraduationCap size={20} strokeWidth={2} className="text-primary-foreground" />
                </div>
                {!collapsed && (
                    <div className="flex flex-col min-w-0">
                        <h1 className="font-bold text-base text-foreground tracking-tight leading-tight truncate font-heading">School Management System</h1>
                    </div>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 thin-scrollbar">
                {filteredNavGroups.map(renderGroup)}
            </nav>

            {/* Bottom — User Info */}
            <div className={cn("shrink-0 border-t border-border", collapsed ? "p-2" : "p-3")}>
                <button
                    type="button"
                    onClick={() => setCollapsed(!collapsed)}
                    className="hidden lg:flex items-center justify-center w-full gap-2 px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 text-xs btn-press"
                    title={collapsed ? "Expand" : "Collapse"}
                >
                    {collapsed ? <ChevronsRight size={16} strokeWidth={2.5} /> : <><ChevronsLeft size={16} strokeWidth={2.5} /><span className="font-medium">Collapse</span></>}
                </button>
                {!collapsed && (
                    <div className="flex items-center gap-3 mt-2 px-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary text-xs font-bold">
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
                            {role && (
                                <span className={cn("inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-0.5", roleColor)}>
                                    {roleLabel}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );

    return (
        <>
            {/* Mobile header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 bg-card border-b border-border shadow-[var(--shadow-sm)]">
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setMobileOpen(!mobileOpen)} className="p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl transition-colors btn-press" aria-expanded={mobileOpen} aria-label={mobileOpen ? "Close menu" : "Open menu"}>
                        {mobileOpen ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center"><GraduationCap size={16} strokeWidth={2} className="text-primary-foreground" /></div>
                        <span className="font-bold text-sm text-foreground tracking-tight">School Management System</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Link href="/dashboard/administration/notice" className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 btn-press" aria-label="Notifications">
                        <Bell size={20} strokeWidth={1.5} />
                    </Link>
                    <Link href="/dashboard/settings" className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary btn-press" aria-label="Account">
                        <User size={18} strokeWidth={2.5} />
                    </Link>
                </div>
            </header>

            {/* Mobile overlay */}
            {mobileOpen && <div className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={closeMobile} />}

            {/* Sidebar */}
            <aside
                role="navigation"
                className={cn(
                    "fixed top-0 left-0 z-40 h-screen bg-card border-r border-border transition-all duration-300 ease-in-out lg:sticky lg:z-auto flex flex-col",
                    collapsed ? "w-[60px]" : "w-[250px]",
                    mobileOpen ? "translate-x-0 w-[250px]" : "-translate-x-full lg:translate-x-0"
                )}
            >
                {sidebarBody}
            </aside>
        </>
    );
}
