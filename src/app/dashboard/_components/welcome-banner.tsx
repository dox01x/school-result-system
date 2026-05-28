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
        <div className="relative rounded-2xl p-6 text-white overflow-hidden shadow-sm bg-blue-600">
            <div className="relative z-10 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold font-heading tracking-tight">
                        {greeting}
                        {userName ? `, ${userName}` : ""}
                    </h2>
                    <p className="text-white/85 text-sm mt-1">{dateStr}</p>
                    {academicYear && (
                        <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium bg-white/15 backdrop-blur px-3 py-1 rounded-full">
                            <CalendarCheck className="h-3 w-3" /> Academic Year: {academicYear}
                        </span>
                    )}
                </div>
                {schoolLogoUrl && (
                    <Image
                        src={schoolLogoUrl}
                        alt="School Logo"
                        width={64}
                        height={64}
                        className="hidden md:block h-16 w-16 rounded-xl object-contain bg-white/10 p-1.5"
                    />
                )}
            </div>
        </div>
    );
}
