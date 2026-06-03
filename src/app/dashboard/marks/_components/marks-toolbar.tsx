"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save as FloppyDisk, Check, Loader2 as SpinnerGap } from "lucide-react";

interface MarksToolbarProps {
    subjectName: string;
    examName: string;
    fullMarks: number;
    studentCount: number;
    saving: boolean;
    hasErrors: boolean;
    hasUnsaved: boolean;
    onSave: () => void;
}

/**
 * Toolbar above the marks table showing subject info, student count, and save button.
 * Shows auto-save status with visual indicators.
 */
const MarksToolbar = React.memo(function MarksToolbar({
    subjectName,
    examName,
    fullMarks,
    studentCount,
    saving,
    hasErrors,
    hasUnsaved,
    onSave,
}: MarksToolbarProps) {
    return (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-card">
            <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-foreground">
                    {subjectName}
                    <span className="text-muted-foreground font-normal mx-1.5">—</span>
                    <span className="text-muted-foreground font-normal">{examName}</span>
                </h2>
                <Badge variant="outline" className="border-border/50 text-muted-foreground rounded-md bg-muted/50 font-mono text-[10px] uppercase tracking-wider">
                    FM: {fullMarks}
                </Badge>
            </div>
            <div className="flex items-center gap-2.5">
                <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 rounded-md font-medium text-xs">
                    {studentCount} students
                </Badge>

                {/* Auto-save status indicator */}
                {saving && (
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                        <SpinnerGap size={12} strokeWidth={1.5} className="animate-spin" />
                        <span>Saving…</span>
                    </div>
                )}
                {!saving && !hasUnsaved && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <Check size={12} strokeWidth={1.5} />
                        <span>All saved</span>
                    </div>
                )}
                {!saving && hasUnsaved && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span>Unsaved</span>
                    </div>
                )}

                <Button
                    onClick={onSave}
                    disabled={saving || hasErrors}
                    size="sm"
                    className={hasUnsaved ? "bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-semibold shadow-none h-8 px-4 text-xs transition-all duration-200" : "border-border/50 text-foreground font-semibold rounded-lg hover:bg-muted transition-all duration-200 h-8 px-4 text-xs bg-transparent border"}
                >
                    <FloppyDisk size={14} strokeWidth={1.5} className="mr-1.5" />
                    {saving ? "Saving…" : "Save All"}
                </Button>
            </div>
        </div>
    );
});

MarksToolbar.displayName = "MarksToolbar";

export default MarksToolbar;
