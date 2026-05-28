"use client";

import { useRef, useCallback, useState, useEffect } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveOptions {
    /** Debounce delay in milliseconds (default: 600) */
    delay?: number;
    /** The async function that performs the save */
    onSave: (value: string) => Promise<void>;
}

/**
 * useAutoSave — Debounced auto-save hook for input cells.
 *
 * Usage:
 *   const { localValue, setLocalValue, status, flush } = useAutoSave({
 *     delay: 600,
 *     onSave: async (val) => { await api.save(val); },
 *   });
 *
 * - `localValue`: controlled input value
 * - `setLocalValue`: update the input (triggers debounced save)
 * - `status`: "idle" | "saving" | "saved" | "error"
 * - `flush`: immediately save current value (call on blur/Enter)
 * - `reset`: set a new initial value without triggering save
 */
export function useAutoSave({ delay = 600, onSave }: UseAutoSaveOptions) {
    const [status, setStatus] = useState<SaveStatus>("idle");
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestValueRef = useRef<string>("");
    const savedValueRef = useRef<string>("");
    const onSaveRef = useRef(onSave);
    onSaveRef.current = onSave;

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const doSave = useCallback(async (value: string) => {
        if (value === savedValueRef.current) return;
        setStatus("saving");
        try {
            await onSaveRef.current(value);
            savedValueRef.current = value;
            setStatus("saved");
            // Reset to idle after showing "saved" briefly
            setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
        } catch {
            setStatus("error");
            setTimeout(() => setStatus((s) => (s === "error" ? "idle" : s)), 3000);
        }
    }, []);

    const scheduleAutoSave = useCallback(
        (value: string) => {
            latestValueRef.current = value;
            clearTimer();
            timerRef.current = setTimeout(() => {
                void doSave(value);
            }, delay);
        },
        [delay, clearTimer, doSave]
    );

    /** Immediately flush any pending save */
    const flush = useCallback(() => {
        clearTimer();
        const val = latestValueRef.current;
        if (val !== savedValueRef.current) {
            void doSave(val);
        }
    }, [clearTimer, doSave]);

    /** Reset the hook with a new initial value (no save triggered) */
    const reset = useCallback((value: string) => {
        clearTimer();
        latestValueRef.current = value;
        savedValueRef.current = value;
        setStatus("idle");
    }, [clearTimer]);

    // Cleanup on unmount
    useEffect(() => {
        return () => clearTimer();
    }, [clearTimer]);

    return {
        status,
        scheduleAutoSave,
        flush,
        reset,
        latestValueRef,
        savedValueRef,
    };
}
