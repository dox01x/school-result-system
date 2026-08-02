"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, X, ChevronsLeft, ChevronsRight, GraduationCap } from "lucide-react";
import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { isNavItemVisible, ROLE_LABELS_EN } from "@/lib/rbac";
import { NAV_GROUPS, isActive, type NavItem, type NavGroup } from "./nav-config";

const SidebarNavItem = memo(function SidebarNavItem({
    item,
    pathname,
    collapsed,
    onNavigate,
}: {
    item: NavItem;
    pathname: string | null;
    collapsed: boolean;
    onNavigate: () => void;
}) {
    const active = isActive(item.href, pathname, item.exact);
    const Icon = item.icon;

    return (
        <li>
            <Link
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.title : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150",
                    collapsed ? "justify-center p-2 mx-1" : "px-3 py-[7px] mx-2",
                    active
                        ? "bg-primary/8 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
            >
                {active && !collapsed && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-primary rounded-r-full" />
                )}
                <Icon
                    size={17}
                    strokeWidth={active ? 2 : 1.5}
                    className={cn(
                        "shrink-0",
                        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                    aria-hidden="true"
                />
                {!collapsed && <span className="truncate">{item.title}</span>}
                {collapsed && (
                    <div
                        className="absolute left-full ml-2 px-2.5 py-1 bg-foreground text-background text-[11px] font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 whitespace-nowrap z-50 pointer-events-none"
                        role="tooltip"
                    >
                        {item.title}
                    </div>
                )}
            </Link>
        </li>
    );
});

function SidebarNavGroup({
    group,
    pathname,
    collapsed,
    onNavigate,
}: {
    group: NavGroup;
    pathname: string | null;
    collapsed: boolean;
    onNavigate: () => void;
}) {
    return (
        <div className="mt-6 first:mt-2">
            {!collapsed && (
                <p className="px-4 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50 select-none">
                    {group.label}
                </p>
            )}
            {collapsed && <div className="mx-2 mb-2 border-t border-border" />}
            <ul className="space-y-0.5" role="list">
                {group.items.map((item) => (
                    <SidebarNavItem
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        collapsed={collapsed}
                        onNavigate={onNavigate}
                    />
                ))}
            </ul>
        </div>
    );
}

export function Sidebar() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const { role, fullName, email, loading } = useUserRole();

    useEffect(() => {
        const stored = localStorage.getItem("sidebar-collapsed");
        if (stored === "true") setCollapsed(true);
    }, []);

    const closeMobile = useCallback(() => setMobileOpen(false), []);

    const toggleCollapsed = useCallback(() => {
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem("sidebar-collapsed", String(next));
            return next;
        });
    }, []);

    useEffect(() => {
        if (!mobileOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeMobile();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [mobileOpen, closeMobile]);

    useEffect(() => {
        document.body.style.overflow = mobileOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [mobileOpen]);

    useEffect(() => {
        queueMicrotask(closeMobile);
    }, [pathname, closeMobile]);

    const filteredNavGroups = useMemo(() => {
        if (loading || !role) return NAV_GROUPS;
        return NAV_GROUPS
            .map((group) => ({
                ...group,
                items: group.items.filter((item) => isNavItemVisible(role, item.href)),
            }))
            .filter((group) => group.items.length > 0);
    }, [role, loading]);

    const displayName = fullName || email?.split("@")[0] || "User";
    const roleLabel = role ? ROLE_LABELS_EN[role] : "User";

    return (
        <>
            {/* Mobile header bar */}
            <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 bg-card border-b border-border">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-sidebar"
                        aria-label={mobileOpen ? "Close menu" : "Open menu"}
                    >
                        {mobileOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                            <GraduationCap size={15} strokeWidth={2} className="text-primary-foreground" />
                        </div>
                        <span className="font-semibold text-sm text-foreground">EduPulse</span>
                    </div>
                </div>
                <Link
                    href="/dashboard/settings"
                    className="h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-medium"
                    aria-label="Account"
                >
                    {displayName.charAt(0).toUpperCase()}
                </Link>
            </header>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 z-40 bg-black/30 transition-opacity"
                    onClick={closeMobile}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <nav
                id="mobile-sidebar"
                aria-label="Main navigation"
                className={cn(
                    "fixed top-0 left-0 z-40 h-screen bg-card border-r border-border transition-all duration-200 ease-out lg:sticky lg:z-auto flex flex-col",
                    collapsed ? "w-[60px]" : "w-[240px]",
                    mobileOpen ? "translate-x-0 w-[240px]" : "-translate-x-full lg:translate-x-0"
                )}
            >
                {/* Logo */}
                <div className={cn(
                    "flex items-center gap-2.5 shrink-0 border-b border-border h-14 transition-all",
                    collapsed ? "justify-center px-2" : "px-4"
                )}>
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                        <GraduationCap size={17} strokeWidth={2} className="text-primary-foreground" />
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-sm text-foreground leading-tight truncate">
                                EduPulse Pro
                            </span>
                            <span className="text-[10px] text-muted-foreground leading-tight">
                                School Management
                            </span>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto py-2 thin-scrollbar" role="navigation">
                    {filteredNavGroups.map((group) => (
                        <SidebarNavGroup
                            key={group.label}
                            group={group}
                            pathname={pathname}
                            collapsed={collapsed}
                            onNavigate={closeMobile}
                        />
                    ))}
                </div>

                {/* Bottom */}
                <div className={cn("shrink-0 border-t border-border", collapsed ? "p-1.5" : "p-3")}>
                    {!collapsed && (
                        <div className="flex items-center gap-2.5 mb-2 px-2 py-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground text-xs font-medium">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-medium text-foreground truncate">{displayName}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{roleLabel}</p>
                            </div>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        className="hidden lg:flex items-center justify-center w-full gap-2 px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-medium"
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        aria-expanded={!collapsed}
                    >
                        {collapsed ? (
                            <ChevronsRight size={16} strokeWidth={1.5} />
                        ) : (
                            <>
                                <ChevronsLeft size={16} strokeWidth={1.5} />
                                <span>Collapse</span>
                            </>
                        )}
                    </button>
                </div>
            </nav>
        </>
    );
}
