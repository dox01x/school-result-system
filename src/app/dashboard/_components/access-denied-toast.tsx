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
            toast.error("Access Restricted", {
                description: "You do not have permission to view that page.",
                duration: 4000,
            });
            // Clean URL
            router.replace("/dashboard", { scroll: false });
        }
    }, [searchParams, router]);

    return null;
}
