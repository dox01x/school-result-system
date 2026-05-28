"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect from the old standalone report route to the unified attendance page.
 * Keeps backward compatibility for any bookmarks or links.
 */
export default function AttendanceReportRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/dashboard/attendance");
    }, [router]);

    return (
        <div className="flex items-center justify-center py-20">
            <p className="text-sm text-muted-foreground">Redirecting to Attendance…</p>
        </div>
    );
}
