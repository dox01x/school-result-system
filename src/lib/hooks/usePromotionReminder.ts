"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * usePromotionReminder — Encapsulates the promotion year reminder logic.
 *
 * Shows a reminder when the calendar year is ahead of the active academic year,
 * and persists dismissal per-year in localStorage.
 */
export function usePromotionReminder(academicYear: string | undefined) {
    const currentYear = new Date().getFullYear();
    const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

    useEffect(() => {
        const key = `promotion-reminder-dismissed-${currentYear}`;
        setDismissed(localStorage.getItem(key) === "1");
    }, [currentYear]);

    const shouldShow =
        !!academicYear &&
        Number(academicYear) < currentYear &&
        !dismissed;

    const dismiss = useCallback(() => {
        const key = `promotion-reminder-dismissed-${currentYear}`;
        localStorage.setItem(key, "1");
        setDismissed(true);
    }, [currentYear]);

    return { shouldShow, currentYear, dismiss };
}
