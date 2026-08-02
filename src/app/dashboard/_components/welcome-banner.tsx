"use client";

import { useUserRole } from "@/lib/hooks/use-user-role";

type Props = {
    schoolLogoUrl?: string;
    academicYear?: string;
};

export function WelcomeBanner({ academicYear }: Props) {
    const { fullName, email } = useUserRole();

    const userName = fullName || (email ? email.split("@")[0].replace(/[._]/g, " ") : "Administrator");

    const now = new Date();
    const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    return (
        <div className="mb-6">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">
                        {greeting}, {userName}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {dateStr}
                        {academicYear && <span className="ml-2 text-muted-foreground">· Session {academicYear}</span>}
                    </p>
                </div>
            </div>
        </div>
    );
}
