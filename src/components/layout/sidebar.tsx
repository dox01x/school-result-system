"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Menu,
    X,
    ChevronsLeft,
    ChevronsRight,
    GraduationCap,
    Search,
    Settings,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { isNavItemVisible, ROLE_LABELS_EN } from "@/lib/rbac";
import { NAV_GROUPS, isActive, type NavItem, type NavGroup } from "./nav-config";
import { NotificationPopover, UserDropdown } from "./header";
import { MobileSearch } from "./mobile-search";

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
                    "group relative flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150",
                    collapsed ? "justify-center p-2.5 mx-1" : "px-3 py-2 mx-1.5",
                    active
                        ? "bg-primary/10 text-primary font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-[0.98]"
                )}
            >
                {active && !collapsed && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r-full" />
                )}
                <Icon
                    size={17}
                    strokeWidth={active ? 2.2 : 1.6}
                    className={cn(
                        "shrink-0 transition-colors",
                        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                    aria-hidden="true"
                />
                {!collapsed && (
                    <div className="flex items-center justify-between flex-1 min-w-0">
                        <span className="truncate">{item.title}</span>
                        {item.badge && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-semibold bg-primary/15 text-primary">
                                {item.badge}
                            </span>
                        )}
                    </div>
                )}
                {collapsed && (
                    <div
                        className="absolute left-full ml-2 px-2.5 py-1 bg-foreground text-background text-[11px] font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 pointer-events-none shadow-md"
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
    isExpanded,
    onToggleExpand,
    onNavigate,
}: {
    group: NavGroup;
    pathname: string | null;
    collapsed: boolean;
    isExpanded: boolean;
    onToggleExpand: (groupId: string) => void;
    onNavigate: () => void;
}) {
    const hasActiveChild = useMemo(
        () => group.items.some((item) => isActive(item.href, pathname, item.exact)),
        [group.items, pathname]
    );

    // If an item is active inside this section, keep it open
    const open = isExpanded || hasActiveChild;
    const GroupIcon = group.icon;
    const isMain = group.id === "main";

    if (collapsed) {
        return (
            <div className="mt-3 first:mt-1">
                <div className="mx-2 mb-2 border-t border-border/60" />
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

    return (
        <div className="mt-4 first:mt-1">
            {!isMain ? (
                <button
                    type="button"
                    onClick={() => onToggleExpand(group.id)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/75 hover:text-foreground hover:bg-muted/40 rounded-lg transition-colors select-none group/header"
                    aria-expanded={open}
                >
                    <div className="flex items-center gap-1.5 min-w-0">
                        {GroupIcon && (
                            <GroupIcon
                                size={13}
                                className={cn(
                                    "shrink-0 transition-colors",
                                    hasActiveChild ? "text-primary" : "text-muted-foreground/70 group-hover/header:text-foreground"
                                )}
                            />
                        )}
                        <span className={cn(
                            "truncate tracking-wider",
                            hasActiveChild ? "text-foreground font-extrabold" : ""
                        )}>
                            {group.label}
                        </span>
                    </div>

                    <div className="flex items-center shrink-0">
                        {open ? (
                            <ChevronDown size={13} className="text-muted-foreground/60 group-hover/header:text-foreground transition-transform" />
                        ) : (
                            <ChevronRight size={13} className="text-muted-foreground/60 group-hover/header:text-foreground transition-transform" />
                        )}
                    </div>
                </button>
            ) : (
                <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 select-none">
                    {group.label}
                </div>
            )}

            {(open || isMain) && (
                <ul
                    className={cn(
                        "space-y-0.5 mt-0.5",
                        !isMain && "pl-1.5 border-l border-border/40 ml-3.5 my-1"
                    )}
                    role="list"
                >
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
            )}
        </div>
    );
}

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        try {
            return localStorage.getItem("sidebar-collapsed") === "true";
        } catch {
            return false;
        }
    });
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
        if (typeof window === "undefined") return {};
        try {
            const stored = localStorage.getItem("sidebar-groups-collapsed");
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    });
    const { role, fullName, email, loading } = useUserRole();

    const toggleGroupExpand = useCallback((groupId: string) => {
        setCollapsedGroups((prev) => {
            const isCurrentlyCollapsed = !!prev[groupId];
            const next = { ...prev, [groupId]: !isCurrentlyCollapsed };
            try {
                localStorage.setItem("sidebar-groups-collapsed", JSON.stringify(next));
            } catch {
                // Ignore storage errors
            }
            return next;
        });
    }, []);

    const closeMobile = useCallback(() => setMobileOpen(false), []);
    const openMobile = useCallback(() => setMobileOpen(true), []);

    // Listen for custom event from MobileBottomNav
    useEffect(() => {
        const handler = () => openMobile();
        window.addEventListener("open-mobile-sidebar", handler);
        return () => window.removeEventListener("open-mobile-sidebar", handler);
    }, [openMobile]);

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
            {/* Mobile Header Bar */}
            <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-14 px-3.5 bg-card/95 backdrop-blur-md border-b border-border shadow-xs">
                <div className="flex items-center gap-2 min-w-0">
                    <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-xs">
                            <GraduationCap size={16} strokeWidth={2.2} className="text-primary-foreground" />
                        </div>
                        <span className="font-semibold text-sm text-foreground truncate">EduPulse</span>
                    </Link>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <MobileSearch />
                    <NotificationPopover />
                    <UserDropdown />
                </div>
            </header>

            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-200"
                    onClick={closeMobile}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar Navigation */}
            <nav
                id="mobile-sidebar"
                aria-label="Main navigation"
                className={cn(
                    "fixed top-0 left-0 z-50 h-screen bg-card border-r border-border transition-all duration-200 ease-out lg:sticky lg:z-auto flex flex-col shadow-xl lg:shadow-none",
                    collapsed ? "w-[68px]" : "w-[252px]",
                    mobileOpen ? "translate-x-0 w-[265px]" : "-translate-x-full lg:translate-x-0"
                )}
            >
                {/* Logo & Brand Header */}
                <div className={cn(
                    "flex items-center gap-2.5 shrink-0 border-b border-border h-14 transition-all",
                    collapsed ? "justify-center px-2" : "px-4.5"
                )}>
                    <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-xs">
                            <GraduationCap size={18} strokeWidth={2.2} className="text-primary-foreground" />
                        </div>
                        {!collapsed && (
                            <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-[14px] text-foreground leading-tight truncate tracking-tight">
                                    EduPulse Pro
                                </span>
                                <span className="text-[10px] font-medium text-muted-foreground leading-tight">
                                    School Management
                                </span>
                            </div>
                        )}
                    </Link>
                    {/* Mobile close button inside drawer */}
                    <button
                        type="button"
                        onClick={closeMobile}
                        className="lg:hidden ml-auto p-1.5 text-muted-foreground hover:text-foreground rounded-lg"
                        aria-label="Close sidebar"
                    >
                        <X size={18} strokeWidth={1.8} />
                    </button>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto px-1.5 py-2 thin-scrollbar" role="navigation">
                    {filteredNavGroups.map((group) => {
                        // By default, group is open unless explicitly marked collapsed in state
                        const isExpanded = !collapsedGroups[group.id];
                        return (
                            <SidebarNavGroup
                                key={group.id}
                                group={group}
                                pathname={pathname}
                                collapsed={collapsed}
                                isExpanded={isExpanded}
                                onToggleExpand={toggleGroupExpand}
                                onNavigate={closeMobile}
                            />
                        );
                    })}
                </div>

                {/* Bottom User / Toggle Bar */}
                <div className={cn("shrink-0 border-t border-border bg-card/60", collapsed ? "p-2" : "p-3")}>
                    {!collapsed && (
                        <div className="flex items-center gap-2.5 mb-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors">
                            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary text-xs font-semibold">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-medium text-foreground truncate">{displayName}</p>
                                <p className="text-[10.5px] font-medium text-muted-foreground truncate">{roleLabel}</p>
                            </div>
                            <Link
                                href="/dashboard/settings"
                                className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                                title="Settings"
                            >
                                <Settings size={15} strokeWidth={1.6} />
                            </Link>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        className="hidden lg:flex items-center justify-center w-full gap-2 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-medium"
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        aria-expanded={!collapsed}
                    >
                        {collapsed ? (
                            <ChevronsRight size={16} strokeWidth={1.8} />
                        ) : (
                            <>
                                <ChevronsLeft size={16} strokeWidth={1.8} />
                                <span>Collapse Sidebar</span>
                            </>
                        )}
                    </button>
                </div>
            </nav>
        </>
    );
}
