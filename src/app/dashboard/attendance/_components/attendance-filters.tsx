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
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Class</Label>
                <Select value={filters.selectedClass} onValueChange={onClassChange} disabled={loading}>
                    <SelectTrigger className="bg-muted border-0 shadow-none h-11 rounded-xl font-bold text-foreground focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent className="border-border/50 rounded-xl shadow-md">
                        {classes.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="rounded-lg font-medium">{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Section</Label>
                <Select value={filters.selectedSection} onValueChange={onSectionChange} disabled={!filters.selectedClass || loading}>
                    <SelectTrigger className="bg-muted border-0 shadow-none h-11 rounded-xl font-bold text-foreground focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder={filters.selectedClass ? "Select section" : "Select class first"} />
                    </SelectTrigger>
                    <SelectContent className="border-border/50 rounded-xl shadow-md">
                        {sections.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="rounded-lg font-medium">{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {filters.selectedClass && sections.length === 0 && !loading && (
                    <p className="text-[10px] font-bold text-muted-foreground/60 px-1 mt-1">No sections found</p>
                )}
            </div>
            <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Year</Label>
                <Select value={String(filters.year)} onValueChange={(v) => onYearChange(Number(v))}>
                    <SelectTrigger className="bg-muted border-0 shadow-none h-11 rounded-xl font-bold text-foreground focus:ring-1 focus:ring-ring/30">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border/50 rounded-xl shadow-md">
                        {yearOptions.map((y) => (
                            <SelectItem key={y} value={String(y)} className="rounded-lg font-medium">{y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Month</Label>
                <Select value={String(filters.month)} onValueChange={(v) => onMonthChange(Number(v))}>
                    <SelectTrigger className="bg-muted border-0 shadow-none h-11 rounded-xl font-bold text-foreground focus:ring-1 focus:ring-ring/30">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border/50 rounded-xl shadow-md">
                        {MONTHS.map((m) => (
                            <SelectItem key={m.v} value={String(m.v)} className="rounded-lg font-medium">
                                {m.l}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
