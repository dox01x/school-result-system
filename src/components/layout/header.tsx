"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, User } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
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

const routeTitles: Record<string, string> = {
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
};

function getPageTitle(pathname: string | null): string {
    if (!pathname) return "Dashboard";
    if (routeTitles[pathname]) return routeTitles[pathname];
    const sorted = Object.keys(routeTitles).sort((a, b) => b.length - a.length);
    for (const route of sorted) {
        if (pathname.startsWith(route)) return routeTitles[route];
    }
    return "Dashboard";
}

function getBreadcrumb(pathname: string | null): string {
    if (!pathname) return "Home";
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length <= 1) return "Home";
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, " ")).join(" / ");
}

export function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const title = getPageTitle(pathname);
    const breadcrumb = getBreadcrumb(pathname);
    const [email, setEmail] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState<string | null>(null);
    const [hasNotices, setHasNotices] = useState(false);
    const [noticesList, setNoticesList] = useState<any[]>([]);
    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        void (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setEmail(user.email ?? null);
            const name = (user.user_metadata?.display_name as string)?.trim();
            if (name) setDisplayName(name);
        })();
        // Check for recent notices
        void (async () => {
            const { data } = await supabase
                .from("notices")
                .select("id, title, content, created_at, priority")
                .eq("is_published", true)
                .order("created_at", { ascending: false })
                .limit(5);
            setNoticesList(data || []);
            setHasNotices((data?.length ?? 0) > 0);
        })();
    }, [supabase]);

    async function handleSignOut() {
        await supabase.auth.signOut();
        toast.success("Signed out");
        router.push("/login");
        router.refresh();
    }

    const headerLabel = displayName || email?.split("@")[0] || "Account";

    return (
        <header className="hidden lg:flex bg-card border-b border-border h-16 px-4 sm:px-6 items-center justify-between gap-4 sticky top-0 z-30 shrink-0 overflow-visible">
            <div className="min-w-0 shrink">
                <h1 className="text-lg font-bold text-foreground font-heading truncate">{title}</h1>
                <p className="text-[11px] text-muted-foreground truncate -mt-0.5">{breadcrumb}</p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 justify-end">
                <GlobalSearch />

                <Popover>
                    <PopoverTrigger asChild>
                        <button type="button" className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 btn-press" aria-label="Notifications">
                            <Bell size={20} strokeWidth={1.5} />
                            {hasNotices && (
                                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-card" />
                            )}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-0 border-border/50 shadow-xl rounded-xl">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
                            <h3 className="font-bold text-sm">Notifications</h3>
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                                {noticesList.length} New
                            </span>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                            {noticesList.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground font-medium">
                                    No new notifications
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    {noticesList.map(n => (
                                        <div key={n.id} className="p-4 border-b border-border/50 hover:bg-muted/30 transition-colors last:border-0">
                                            <div className="flex justify-between gap-2 mb-1">
                                                <h4 className="text-sm font-bold leading-tight text-foreground">{n.title}</h4>
                                                <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap shrink-0">
                                                    {new Date(n.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                </span>
                                            </div>
                                            <p className="text-[13px] text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                                                {n.content}
                                            </p>
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <User size={10} strokeWidth={2.5} className="text-primary" />
                                                </div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    Admin
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="h-9 min-w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary px-2 gap-1 text-xs font-semibold hover:ring-2 hover:ring-primary/20 transition-all duration-200 btn-press"
                            aria-label="Account menu"
                        >
                            <User size={18} strokeWidth={2.5} className="shrink-0" />
                            <span className="hidden sm:inline max-w-[120px] truncate">
                                {headerLabel}
                            </span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        {(displayName || email) && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground border-b border-border mb-1">
                                {displayName && <p className="font-medium text-foreground truncate">{displayName}</p>}
                                {email && <p className="truncate">{email}</p>}
                            </div>
                        )}
                        <DropdownMenuItem onClick={() => void handleSignOut()} className="gap-2 cursor-pointer">
                            <LogOut size={16} strokeWidth={2.5} />
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
