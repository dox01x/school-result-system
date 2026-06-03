"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { CalendarCheck } from "lucide-react";
import Image from "next/image";

type Props = {
    schoolLogoUrl?: string;
    academicYear?: string;
};

export function WelcomeBanner({ schoolLogoUrl, academicYear }: Props) {
    const [userName, setUserName] = useState<string | null>(null);
    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        void (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setUserName("Admin");
                return;
            }
            const authName = (user.user_metadata?.display_name as string)?.trim();
            setUserName(authName || user.email?.split("@")[0]?.replace(/[._]/g, " ") || "Admin");
        })();
    }, [supabase]);

    const now = new Date();
    const greeting = now.getHours() < 12 ? "Good Morning" : now.getHours() < 17 ? "Good Afternoon" : "Good Evening";
    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    return (
        <div className="relative rounded-3xl p-8 h-full text-foreground border border-border bg-card shadow-sm flex flex-col justify-center">
            <div className="relative z-10 flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black font-heading tracking-tight text-foreground">
                        {greeting}
                        {userName ? `, ${userName}` : ""}
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1.5 font-medium">{dateStr}</p>
                    {academicYear && (
                        <span className="inline-flex items-center gap-1.5 mt-5 text-xs font-bold bg-muted text-foreground px-3 py-1.5 rounded-lg">
                            <CalendarCheck className="h-3.5 w-3.5" strokeWidth={2} /> Active Academic Year: {academicYear}
                        </span>
                    )}
                </div>
                {schoolLogoUrl && (
                    <Image
                        src={schoolLogoUrl}
                        alt="School Logo"
                        width={72}
                        height={72}
                        className="hidden md:block h-20 w-20 rounded-2xl object-contain bg-muted/50 dark:bg-primary border border-border p-2 shadow-sm"
                    />
                )}
            </div>
        </div>
    );
}
