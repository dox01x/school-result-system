"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useAutoSave, type SaveStatus } from "@/lib/hooks/useAutoSave";

interface MarkInputCellProps {
    /** Unique identifier: `mark-input-{rowIndex}-{colIndex}` */
    inputId: string;
    /** Row index in the student list (for keyboard navigation) */
    rowIndex: number;
    /** Column index (for keyboard navigation) */
    colIndex: number;
    /** Total number of rows (students) */
    totalRows: number;
    /** Maximum allowed marks value */
    maxMarks: number;
    /** Initial value loaded from database */
    initialValue: string;
    /** Callback when a committed value changes (on blur) */
    onValueCommit: (value: string) => void;
    /** Optional: enable auto-save mode (flashes on save) */
    autoSaveEnabled?: boolean;
}

/**
 * A single marks input cell with Excel-like UX behaviors:
 * - Arrow Up/Down + Enter navigate between rows
 * - Left/Right arrow navigate between columns (at edges)
 * - Focus auto-selects text
 * - Non-numeric keys are blocked (whitelist)
 * - Values exceeding max are auto-clamped
 * - Green save-flash animation on successful commit
 * - Inline save status indicator (✓ / spinner / error)
 *
 * Wrapped in React.memo to prevent re-renders from parent state changes.
 * Each cell manages its own local state — typing in one cell
 * does NOT re-render any other cell in the table.
 */
const MarkInputCell = React.memo(function MarkInputCell({
    inputId,
    rowIndex,
    colIndex,
    totalRows,
    maxMarks,
    initialValue,
    onValueCommit,
    autoSaveEnabled = false,
}: MarkInputCellProps) {
    const [localValue, setLocalValue] = useState(initialValue);
    const [hasError, setHasError] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    // Sync when parent resets data (e.g., after import or reload)
    useEffect(() => {
        setLocalValue(initialValue);
        setHasError(false);
    }, [initialValue]);

    /** Commit the current local value to parent state */
    const commitValue = useCallback(() => {
        onValueCommit(localValue);
    }, [localValue, onValueCommit]);

    /**
     * UX: Keyboard navigation (Excel-like)
     * - ArrowDown / Enter → focus next row (same column)
     * - ArrowUp → focus previous row (same column)
     * - ArrowRight → next column (at end of input)
     * - ArrowLeft → prev column (at start of input)
     * - Escape → revert + blur
     */
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            // Block invalid keys (whitelist approach)
            const allowedKeys = [
                "Backspace",
                "Tab",
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "Delete",
                "Enter",
                "Escape",
                ".",
            ];

            if (!allowedKeys.includes(e.key) && !/^[0-9]$/.test(e.key)) {
                e.preventDefault();
                return;
            }

            if (e.key === "Escape") {
                e.preventDefault();
                setLocalValue(initialValue);
                setHasError(false);
                inputRef.current?.blur();
                return;
            }

            if (e.key === "ArrowDown" || e.key === "Enter") {
                e.preventDefault();
                commitValue();
                const nextInput = document.getElementById(
                    `mark-input-${rowIndex + 1}-${colIndex}`
                );
                nextInput?.focus();
                return;
            }

            if (e.key === "ArrowUp") {
                e.preventDefault();
                commitValue();
                const prevInput = document.getElementById(
                    `mark-input-${rowIndex - 1}-${colIndex}`
                );
                prevInput?.focus();
                return;
            }

            // ArrowRight → next column (only if cursor at end)
            if (e.key === "ArrowRight") {
                const input = e.currentTarget;
                if (input.selectionStart === input.value.length) {
                    e.preventDefault();
                    commitValue();
                    const next = document.getElementById(
                        `mark-input-${rowIndex}-${colIndex + 1}`
                    );
                    if (next) next.focus();
                }
                return;
            }

            // ArrowLeft → prev column (only if cursor at start)
            if (e.key === "ArrowLeft") {
                const input = e.currentTarget;
                if (input.selectionStart === 0) {
                    e.preventDefault();
                    commitValue();
                    const prev = document.getElementById(
                        `mark-input-${rowIndex}-${colIndex - 1}`
                    );
                    if (prev) prev.focus();
                }
                return;
            }
        },
        [rowIndex, colIndex, commitValue, initialValue]
    );

    /** Auto-select text on focus */
    const handleFocus = useCallback(
        (e: React.FocusEvent<HTMLInputElement>) => {
            e.target.select();
            setIsFocused(true);
        },
        []
    );

    /** Auto-correct values exceeding max. Clamp silently. */
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            let raw = e.target.value;

            // Allow empty (clearing field)
            if (raw === "" || raw === ".") {
                setLocalValue(raw);
                setHasError(false);
                return;
            }

            const num = parseFloat(raw);

            if (isNaN(num)) {
                return; // blocked by keydown, but safety net
            }

            // Auto-clamp to max
            if (num > maxMarks) {
                raw = maxMarks.toString();
                setLocalValue(raw);
                setHasError(false);
                return;
            }

            // Auto-clamp to 0
            if (num < 0) {
                raw = "0";
                setLocalValue(raw);
                setHasError(false);
                return;
            }

            setLocalValue(raw);
            setHasError(false);
        },
        [maxMarks]
    );

    const handleBlur = useCallback(() => {
        setIsFocused(false);
        commitValue();
    }, [commitValue]);

    return (
        <div className="relative">
            <input
                ref={inputRef}
                id={inputId}
                type="number"
                inputMode="decimal"
                data-row={rowIndex}
                data-col={colIndex}
                className={`
                    w-full h-9 px-2 text-center text-sm
                    rounded-lg border-0 bg-muted
                    transition-colors duration-150 text-foreground font-medium
                    outline-none focus:ring-1 focus:ring-ring/30
                    ${isFocused
                        ? "bg-muted/80 z-10 relative"
                        : hasError
                            ? "ring-1 ring-destructive bg-destructive/5"
                            : "hover:bg-muted/80"
                    }
                    ${hasError ? "error-shake" : ""}
                `}
                value={localValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                min={0}
                max={maxMarks}
                placeholder="—"
                autoComplete="off"
            />

        </div>
    );
});

MarkInputCell.displayName = "MarkInputCell";

export default MarkInputCell;
