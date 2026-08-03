"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, User } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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
import { cn } from "@/lib/utils";

const ROUTE_TITLES: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/dashboard/students": "Students",
    "/dashboard/administration/teachers-rooms": "Teachers",
    "/dashboard/administration/notice": "Notice Board",
    "/dashboard/results": "Results",
    "/dashboard/settings": "Settings",
    "/dashboard/classes": "Classes",
    "/dashboard/subjects": "Subjects",
    "/dashboard/exams": "Exams",
    "/dashboard/marks": "Marks Entry",
    "/dashboard/attendance": "Attendance",
    "/dashboard/attendance/report": "Attendance",
    "/dashboard/administration/exam-schedule": "Exam Schedule",
    "/dashboard/administration/routine": "Class Routine",
    "/dashboard/administration/teacher-shift": "Teacher Shift",
    "/dashboard/promotion": "Promotion",
    "/dashboard/users": "User Management",
};

function getPageTitle(pathname: string | null): string {
    if (!pathname) return "Dashboard";
    if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
    const sorted = Object.keys(ROUTE_TITLES).sort((a, b) => b.length - a.length);
    for (const route of sorted) {
        if (pathname.startsWith(route)) return ROUTE_TITLES[route];
    }
    return "Dashboard";
}

interface NoticeData {
    id: string;
    title: string;
    content: string | null;
    created_at: string;
    priority: string | null;
}

function NotificationPopover() {
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
                    className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label={hasNotices ? "Notifications, has new items" : "Notifications"}
                >
                    <Bell size={18} strokeWidth={1.5} aria-hidden="true" />
                    {hasNotices && (
                        <span
                            className="absolute top-1.5 right-1.5 h-2 w-2 bg-destructive rounded-full"
                            aria-hidden="true"
                        />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
                    <span className="text-[11px] text-muted-foreground font-medium">
                        {noticesList.length} {noticesList.length === 1 ? "notice" : "notices"}
                    </span>
                </div>
                <div className="max-h-[280px] overflow-y-auto thin-scrollbar">
                    {noticesList.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            {noticesLoaded ? "No notifications" : "Loading…"}
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {noticesList.map((n) => (
                                <div key={n.id} className="px-4 py-3 hover:bg-muted/50 transition-colors">
                                    <div className="flex justify-between gap-2 mb-0.5">
                                        <h4 className="text-[13px] font-medium leading-snug text-foreground line-clamp-1">{n.title}</h4>
                                        <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
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

function UserDropdown() {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const { email, fullName } = useUserRole();

    const displayName = fullName || email?.split("@")[0] || "Account";

    const handleSignOut = useCallback(async () => {
        sessionStorage.removeItem("edu_session_active");
        await supabase.auth.signOut();
        toast.success("Signed out");
        router.push("/login");
        router.refresh();
    }, [supabase, router]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="h-8 w-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-xs font-medium text-muted-foreground transition-colors"
                    aria-label="Account menu"
                >
                    {displayName.charAt(0).toUpperCase()}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                {(fullName || email) && (
                    <div className="px-3 py-2.5 text-xs border-b border-border mb-1">
                        {fullName && <p className="font-medium text-foreground truncate">{fullName}</p>}
                        {email && <p className="text-muted-foreground truncate mt-0.5">{email}</p>}
                    </div>
                )}
                <DropdownMenuItem
                    onClick={() => void handleSignOut()}
                    className="gap-2 cursor-pointer text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                    <LogOut size={14} strokeWidth={1.5} />
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function Header() {
    const pathname = usePathname();
    const title = getPageTitle(pathname);

    return (
        <header className="hidden lg:flex bg-card border-b border-border h-14 px-6 items-center justify-between gap-4 sticky top-0 z-30 shrink-0">
            <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-foreground truncate">{title}</h2>
            </div>

            <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                <GlobalSearch />
                <NotificationPopover />
                <UserDropdown />
            </div>
        </header>
    );
}
