"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Save as FloppyDisk, Loader2 as SpinnerGap } from "lucide-react";

interface MarksToolbarProps {
    subjectName?: string;
    examName?: string;
    fullMarks?: number;
    studentCount?: number;
    saving: boolean;
    autoSaving?: boolean;
    hasErrors?: boolean;
    hasUnsaved?: boolean;
    onSave: () => void;
}

/**
 * Toolbar above the marks table containing the save button.
 */
const MarksToolbar = React.memo(function MarksToolbar({
    saving,
    hasErrors = false,
    onSave,
}: MarksToolbarProps) {
    return (
        <div className="flex items-center justify-end px-4 sm:px-5 py-3 border-b border-border bg-card">
            <Button
                type="button"
                onClick={onSave}
                disabled={saving || hasErrors}
                size="sm"
                className="border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-all duration-200 h-8 px-4 text-xs bg-transparent border shadow-none"
            >
                {saving ? (
                    <SpinnerGap size={14} strokeWidth={1.5} className="mr-1.5 animate-spin text-primary" />
                ) : (
                    <FloppyDisk size={14} strokeWidth={1.5} className="mr-1.5" />
                )}
                {saving ? "Saving…" : "Save All"}
            </Button>
        </div>
    );
});

MarksToolbar.displayName = "MarksToolbar";

export default MarksToolbar;
