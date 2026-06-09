"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Shows a toast when the user is redirected with ?access=denied.
 * Cleans up the URL param after showing.
 */
export function AccessDeniedToast() {
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        if (searchParams.get("access") === "denied") {
            toast.error("আপনার এই পেইজে অ্যাক্সেস নেই", {
                description: "Access denied — you don't have permission to view that page.",
                duration: 5000,
            });
            // Clean URL
            router.replace("/dashboard", { scroll: false });
        }
    }, [searchParams, router]);

    return null;
}
