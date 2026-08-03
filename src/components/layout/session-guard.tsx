"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// 15 Minutes Inactivity Timeout in milliseconds
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

export function SessionGuard() {
    const router = useRouter();
    const supabase = createClient();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isHandlingLogout = useRef(false);

    const performLogout = async (reason: "session_expired" | "inactivity") => {
        if (isHandlingLogout.current) return;
        isHandlingLogout.current = true;

        try {
            sessionStorage.removeItem("edu_session_active");
            await supabase.auth.signOut();
        } catch {
            // Ignore signout errors if already invalidated
        }

        const message =
            reason === "inactivity"
                ? "Logged out due to 15 minutes of inactivity for security."
                : "Your session has ended. Please log in again.";

        toast.error(message);
        router.push(`/login?reason=${reason}`);
        router.refresh();
    };

    const resetInactivityTimer = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            void performLogout("inactivity");
        }, INACTIVITY_TIMEOUT_MS);
    };

    useEffect(() => {
        // 1. Enforce browser session check (Must have logged in during current session)
        const isSessionActive = sessionStorage.getItem("edu_session_active");
        if (!isSessionActive) {
            void performLogout("session_expired");
            return;
        }

        // 2. Setup activity listeners for inactivity timeout
        const activityEvents = [
            "mousedown",
            "mousemove",
            "keydown",
            "scroll",
            "touchstart",
            "click",
        ];

        resetInactivityTimer();

        const handleUserActivity = () => {
            resetInactivityTimer();
        };

        activityEvents.forEach((event) => {
            window.addEventListener(event, handleUserActivity, { passive: true });
        });

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            activityEvents.forEach((event) => {
                window.removeEventListener(event, handleUserActivity);
            });
        };
    }, []);

    return null;
}
