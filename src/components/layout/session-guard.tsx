"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function SessionGuard() {
    const router = useRouter();
    const supabase = createClient();
    const isHandlingLogout = useRef(false);

    useEffect(() => {
        // Enforce browser session check: sessionStorage is cleared when the tab/browser closes,
        // so users must log in again only when they open a new tab or reopen the browser.
        const isSessionActive = sessionStorage.getItem("edu_session_active");
        if (!isSessionActive) {
            if (isHandlingLogout.current) return;
            isHandlingLogout.current = true;

            const logout = async () => {
                try {
                    sessionStorage.removeItem("edu_session_active");
                    await supabase.auth.signOut();
                } catch {
                    // Ignore signout errors if already invalidated
                }

                toast.error("Your session has ended. Please log in again.");
                router.push("/login?reason=session_expired");
                router.refresh();
            };

            void logout();
        }
    }, []);

    return null;
}

