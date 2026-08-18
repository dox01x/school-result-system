"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, User, Settings, ShieldCheck, Sun, Moon } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { GlobalSearch } from "@/components/layout/global-search";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { ROLE_LABELS_EN } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

const ROUTE_TITLES: Record<string, { title: string; category?: string }> = {
    "/dashboard": { title: "Dashboard", category: "Overview" },
    "/dashboard/students": { title: "Students Directory", category: "Academic" },
    "/dashboard/administration/teachers-rooms": { title: "Teachers", category: "Academic" },
    "/dashboard/administration/staff": { title: "General Staff", category: "Academic" },
    "/dashboard/administration/notice": { title: "Notice Board", category: "Administration" },
    "/dashboard/results": { title: "Student Results", category: "Examination" },
    "/dashboard/settings": { title: "School Settings", category: "System" },
    "/dashboard/classes": { title: "Classes & Sections", category: "Academic" },
    "/dashboard/subjects": { title: "Subject Management", category: "Academic" },
    "/dashboard/exams": { title: "Examinations", category: "Examination" },
    "/dashboard/marks": { title: "Marks Entry", category: "Examination" },
    "/dashboard/attendance": { title: "Attendance Tracking", category: "Administration" },
    "/dashboard/attendance/report": { title: "Attendance Report", category: "Administration" },
    "/dashboard/administration/exam-schedule": { title: "Exam Schedule", category: "Examination" },
    "/dashboard/administration/routine": { title: "Class Routine", category: "Academic" },
    "/dashboard/administration/teacher-shift": { title: "Teacher Shifts", category: "Academic" },
    "/dashboard/promotion": { title: "Student Promotion", category: "Administration" },
    "/dashboard/users": { title: "User & Role Management", category: "System" },
    "/dashboard/finance": { title: "Finance Overview", category: "Finance" },
    "/dashboard/finance/tuition/collect": { title: "Tuition Collection", category: "Finance" },
    "/dashboard/finance/tuition/overdue": { title: "Overdue Tuition", category: "Finance" },
    "/dashboard/finance/fee-structure": { title: "Fee Structure", category: "Finance" },
    "/dashboard/finance/salary": { title: "Salary Management", category: "Finance" },
    "/dashboard/finance/salary/config": { title: "Salary Configuration", category: "Finance" },
    "/dashboard/finance/salary/pay": { title: "Disburse Salary", category: "Finance" },
    "/dashboard/finance/staff-salary": { title: "Staff Salary", category: "Finance" },
    "/dashboard/finance/staff-salary/config": { title: "Staff Salary Config", category: "Finance" },
    "/dashboard/finance/staff-salary/pay": { title: "Staff Salary Disbursement", category: "Finance" },
    "/dashboard/finance/expense": { title: "Expense Tracker", category: "Finance" },
    "/dashboard/finance/income": { title: "Income Records", category: "Finance" },
    "/dashboard/finance/daily-closing": { title: "Daily Closing", category: "Finance" },
    "/dashboard/finance/report": { title: "Finance Reports", category: "Finance" },
    "/dashboard/finance/report/monthly": { title: "Monthly Financial Report", category: "Finance" },
    "/dashboard/finance/report/yearly": { title: "Yearly Financial Report", category: "Finance" },
};

function getPageMeta(pathname: string | null): { title: string; category?: string } {
    if (!pathname) return { title: "Dashboard", category: "Overview" };
    if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
    const sorted = Object.keys(ROUTE_TITLES).sort((a, b) => b.length - a.length);
    for (const route of sorted) {
        if (pathname.startsWith(route)) return ROUTE_TITLES[route];
    }
    return { title: "Dashboard", category: "Overview" };
}

interface NoticeData {
    id: string;
    title: string;
    content: string | null;
    created_at: string;
    priority: string | null;
}

export function NotificationPopover() {
    const supabase = useMemo(() => createClient(), []);
    const [hasNotices, setHasNotices] = useState(false);
    const [noticesList, setNoticesList] = useState<NoticeData[]>([]);
    const [noticesLoaded, setNoticesLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const { count } = await supabase
                .from("notices")
                .select("id", { count: "exact", head: true })
                .eq("is_published", true);
            if (!cancelled) setHasNotices((count ?? 0) > 0);
        })();
        return () => { cancelled = true; };
    }, [supabase]);

    const handlePopoverOpen = useCallback(async (open: boolean) => {
        if (open && !noticesLoaded) {
            const { data } = await supabase
                .from("notices")
                .select("id, title, content, created_at, priority")
                .eq("is_published", true)
                .order("created_at", { ascending: false })
                .limit(5);
            setNoticesList((data as NoticeData[] | null) || []);
            setNoticesLoaded(true);
        }
    }, [supabase, noticesLoaded]);

    return (
        <Popover onOpenChange={handlePopoverOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all"
                    aria-label={hasNotices ? "Notifications, has new items" : "Notifications"}
                >
                    <Bell size={18} strokeWidth={1.7} aria-hidden="true" />
                    {hasNotices && (
                        <span
                            className="absolute top-1.5 right-1.5 h-2 w-2 bg-destructive rounded-full ring-2 ring-card animate-pulse"
                            aria-hidden="true"
                        />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-[calc(100vw-24px)] max-w-80 sm:w-80 p-0 overflow-hidden shadow-xl border border-border z-50 mr-2 sm:mr-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {noticesList.length || (hasNotices ? "New" : "0")}
                        </Badge>
                    </div>
                    <Link
                        href="/dashboard/administration/notice"
                        className="text-[11px] font-medium text-primary hover:underline"
                    >
                        View all
                    </Link>
                </div>
                <div className="max-h-[300px] overflow-y-auto thin-scrollbar">
                    {noticesList.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            {noticesLoaded ? "No active notices" : "Checking notices…"}
                        </div>
                    ) : (
                        <div className="divide-y divide-border/60">
                            {noticesList.map((n) => (
                                <div key={n.id} className="px-4 py-3 hover:bg-muted/40 transition-colors">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h4 className="text-[13px] font-medium leading-snug text-foreground line-clamp-1">{n.title}</h4>
                                        <span className="text-[10.5px] font-medium text-muted-foreground whitespace-nowrap shrink-0">
                                            {new Date(n.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                                        </span>
                                    </div>
                                    {n.content && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                            {n.content}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function UserDropdown() {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const { email, fullName, role } = useUserRole();

    const displayName = fullName || email?.split("@")[0] || "Account";
    const roleLabel = role ? ROLE_LABELS_EN[role] : "User";

    const handleSignOut = useCallback(async () => {
        await supabase.auth.signOut();
        toast.success("Signed out successfully");
        router.push("/login");
        router.refresh();
    }, [supabase, router]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="h-8.5 w-8.5 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary transition-all active:scale-95 shadow-xs"
                    aria-label="Account menu"
                >
                    {displayName.charAt(0).toUpperCase()}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-56 p-1.5 shadow-xl border-border z-50 mr-2 sm:mr-0">
                <div className="px-3 py-2.5 bg-muted/30 rounded-lg mb-1">
                    <p className="font-semibold text-[13px] text-foreground truncate">{displayName}</p>
                    {email && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{email}</p>}
                    <div className="mt-1.5">
                        <Badge variant="outline" className="text-[10px] font-medium bg-background">
                            <ShieldCheck size={11} className="text-emerald-500 mr-1" /> {roleLabel}
                        </Badge>
                    </div>
                </div>

                <DropdownMenuItem asChild className="cursor-pointer text-xs rounded-md">
                    <Link href="/dashboard/settings" className="flex items-center gap-2">
                        <Settings size={14} strokeWidth={1.7} />
                        Settings & Preferences
                    </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    onClick={() => void handleSignOut()}
                    className="gap-2 cursor-pointer text-xs text-destructive focus:text-destructive focus:bg-destructive/10 rounded-md"
                >
                    <LogOut size={14} strokeWidth={1.7} />
                    Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function Header() {
    const pathname = usePathname();
    const meta = getPageMeta(pathname);

    return (
        <header className="hidden lg:flex bg-card border-b border-border h-14 px-6 items-center justify-between gap-4 sticky top-0 z-30 shrink-0">
            <div className="min-w-0 flex items-center gap-2">
                {meta.category && (
                    <>
                        <span className="text-xs font-medium text-muted-foreground">{meta.category}</span>
                        <span className="text-muted-foreground/40 text-xs font-medium">/</span>
                    </>
                )}
                <h2 className="text-[14.5px] font-semibold text-foreground truncate">{meta.title}</h2>
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                <GlobalSearch />
                <ThemeToggle />
                <NotificationPopover />
                <UserDropdown />
            </div>
        </header>
    );
}
