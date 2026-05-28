"use client";

import type { Class, Section } from "@/lib/database.types";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS = [
    { v: 1, l: "January" }, { v: 2, l: "February" }, { v: 3, l: "March" },
    { v: 4, l: "April" }, { v: 5, l: "May" }, { v: 6, l: "June" },
    { v: 7, l: "July" }, { v: 8, l: "August" }, { v: 9, l: "September" },
    { v: 10, l: "October" }, { v: 11, l: "November" }, { v: 12, l: "December" },
];


export type AttendanceFilterState = {
    selectedClass: string;
    selectedSection: string;
    year: number;
    month: number;
};

type Props = {
    classes: Class[];
    sections: Section[];
    filters: AttendanceFilterState;
    onClassChange: (classId: string) => void;
    onSectionChange: (sectionId: string) => void;
    onYearChange: (year: number) => void;
    onMonthChange: (month: number) => void;
    loading?: boolean;
    compact?: boolean;
};

export function AttendanceFilters({
    classes,
    sections,
    filters,
    onClassChange,
    onSectionChange,
    onYearChange,
    onMonthChange,
    loading,
    compact,
}: Props) {
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

    return (
        <div className={`grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-4"}`}>
            <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Class</Label>
                <Select value={filters.selectedClass} onValueChange={onClassChange} disabled={loading}>
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white text-sm">
                        <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                        {classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Section</Label>
                <Select value={filters.selectedSection} onValueChange={onSectionChange} disabled={!filters.selectedClass || loading}>
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white text-sm">
                        <SelectValue placeholder={filters.selectedClass ? "Select section" : "Select class first"} />
                    </SelectTrigger>
                    <SelectContent>
                        {sections.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {filters.selectedClass && sections.length === 0 && !loading && (
                    <p className="text-[10px] text-muted-foreground">No sections found</p>
                )}
            </div>
            <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Year</Label>
                <Select value={String(filters.year)} onValueChange={(v) => onYearChange(Number(v))}>
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {yearOptions.map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Month</Label>
                <Select value={String(filters.month)} onValueChange={(v) => onMonthChange(Number(v))}>
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {MONTHS.map((m) => (
                            <SelectItem key={m.v} value={String(m.v)}>
                                {m.l}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
