"use client";

import { useState, useCallback, useSyncExternalStore } from "react";

function subscribeToStorage(callback: () => void) {
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
}

/**
 * usePromotionReminder — Encapsulates the promotion year reminder logic.
 *
 * Shows a reminder when the calendar year is ahead of the active academic year,
 * and persists dismissal per-year in localStorage.
 */
export function usePromotionReminder(academicYear: string | undefined) {
    const currentYear = new Date().getFullYear();
    const key = `promotion-reminder-dismissed-${currentYear}`;

    const [localDismissed, setLocalDismissed] = useState(false);

    const isStoredDismissed = useSyncExternalStore(
        subscribeToStorage,
        () => (typeof window !== "undefined" ? localStorage.getItem(key) === "1" : true),
        () => true
    );

    const dismissed = localDismissed || isStoredDismissed;

    const shouldShow =
        !!academicYear &&
        Number(academicYear) < currentYear &&
        !dismissed;

    const dismiss = useCallback(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem(key, "1");
        }
        setLocalDismissed(true);
    }, [key]);

    return { shouldShow, currentYear, dismiss };
}
