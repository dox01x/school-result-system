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
            const { count } = await supabase
                .from("notices")
                .select("id", { count: "exact", head: true })
                .eq("is_published", true);
            setHasNotices((count ?? 0) > 0);
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
        <header className="bg-card border-b border-border h-16 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shrink-0 overflow-visible">
            <div className="min-w-0 shrink">
                <h1 className="text-lg font-bold text-foreground font-heading truncate">{title}</h1>
                <p className="text-[11px] text-muted-foreground truncate -mt-0.5">{breadcrumb}</p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 justify-end">
                <GlobalSearch />

                <button type="button" className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 btn-press" aria-label="Notifications">
                    <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    {hasNotices && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-card" />
                    )}
                </button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="h-9 min-w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary px-2 gap-1 text-xs font-semibold hover:ring-2 hover:ring-primary/20 transition-all duration-200 btn-press"
                            aria-label="Account menu"
                        >
                            <User className="h-4 w-4 shrink-0" strokeWidth={2} />
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
                            <LogOut className="h-4 w-4" />
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
