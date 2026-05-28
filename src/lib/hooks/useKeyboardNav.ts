"use client";

import { useCallback } from "react";

/**
 * useKeyboardNav — Universal keyboard navigation using data-row/data-col attributes.
 *
 * Usage:
 *   <input data-row={0} data-col={0} onKeyDown={handleGridKeyDown} />
 *
 * Supported keys:
 *   - ArrowDown / Enter → move to next row (same column)
 *   - ArrowUp → move to previous row (same column)
 *   - ArrowRight → move to next column (same row)
 *   - ArrowLeft → move to previous column (same row)
 *   - Escape → blur current element
 */
export function useKeyboardNav(options?: {
    /** Called before navigating away from a cell (e.g., to commit value) */
    onBeforeMove?: () => void;
    /** Called when Escape is pressed */
    onEscape?: () => void;
    /** Custom container selector to scope queries (default: document) */
    containerSelector?: string;
}) {
    const handleGridKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const target = e.currentTarget;
            const row = parseInt(target.getAttribute("data-row") || "-1");
            const col = parseInt(target.getAttribute("data-col") || "-1");
            if (row < 0 || col < 0) return;

            const container = options?.containerSelector
                ? document.querySelector(options.containerSelector)
                : document;
            if (!container) return;

            const findCell = (r: number, c: number): HTMLElement | null => {
                return container.querySelector(
                    `[data-row="${r}"][data-col="${c}"]`
                );
            };

            switch (e.key) {
                case "ArrowDown": {
                    e.preventDefault();
                    options?.onBeforeMove?.();
                    const next = findCell(row + 1, col);
                    if (next) (next as HTMLElement).focus();
                    break;
                }
                case "Enter": {
                    e.preventDefault();
                    options?.onBeforeMove?.();
                    const next = findCell(row + 1, col);
                    if (next) (next as HTMLElement).focus();
                    break;
                }
                case "ArrowUp": {
                    e.preventDefault();
                    options?.onBeforeMove?.();
                    const prev = findCell(row - 1, col);
                    if (prev) (prev as HTMLElement).focus();
                    break;
                }
                case "ArrowRight": {
                    // Only navigate to next column if cursor is at end of input
                    const input = target as HTMLInputElement;
                    if (input.selectionStart === input.value.length) {
                        e.preventDefault();
                        options?.onBeforeMove?.();
                        const next = findCell(row, col + 1);
                        if (next) (next as HTMLElement).focus();
                    }
                    break;
                }
                case "ArrowLeft": {
                    // Only navigate to prev column if cursor is at start of input
                    const input2 = target as HTMLInputElement;
                    if (input2.selectionStart === 0) {
                        e.preventDefault();
                        options?.onBeforeMove?.();
                        const prev = findCell(row, col - 1);
                        if (prev) (prev as HTMLElement).focus();
                    }
                    break;
                }
                case "Escape": {
                    e.preventDefault();
                    options?.onEscape?.();
                    target.blur();
                    break;
                }
            }
        },
        [options]
    );

    return { handleGridKeyDown };
}

/**
 * useFormKeyboardNav — Tab-through form fields with Enter-to-submit.
 * 
 * Usage:
 *   <input data-field-index={0} onKeyDown={handleFormKeyDown} />
 *   <input data-field-index={1} onKeyDown={handleFormKeyDown} />
 *
 * Enter on the last field calls onSubmit. Enter on other fields moves to next.
 */
export function useFormKeyboardNav(options: {
    /** Total number of fields in the form */
    totalFields: number;
    /** Called when Enter is pressed on the last field */
    onSubmit: () => void;
    /** Container selector to scope queries */
    containerSelector?: string;
}) {
    const handleFormKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            if (e.key !== "Enter") return;

            const target = e.currentTarget;
            const idx = parseInt(target.getAttribute("data-field-index") || "-1");
            if (idx < 0) return;

            // Don't intercept Enter in textareas (for multi-line)
            if (target.tagName === "TEXTAREA" && !e.ctrlKey && !e.metaKey) return;

            e.preventDefault();

            if (idx >= options.totalFields - 1) {
                // Last field → submit
                options.onSubmit();
                return;
            }

            // Move to next field
            const container = options.containerSelector
                ? document.querySelector(options.containerSelector)
                : document;
            if (!container) return;

            const nextField = container.querySelector(
                `[data-field-index="${idx + 1}"]`
            ) as HTMLElement | null;

            if (nextField) {
                nextField.focus();
            }
        },
        [options]
    );

    return { handleFormKeyDown };
}
