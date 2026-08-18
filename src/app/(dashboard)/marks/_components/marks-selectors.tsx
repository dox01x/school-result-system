"use client";

import React from "react";
import type { Class, Section, Subject, Exam } from "@/lib/database.types";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface MarksSelectorProps {
    classes: Class[];
    sections: Section[];
    subjects: Subject[];
    exams: Exam[];
    academicYearOptions: string[];
    selectedClass: string;
    selectedSection: string;
    selectedSubject: string;
    selectedExam: string;
    academicYear: string;
    onClassChange: (value: string) => void;
    onSectionChange: (value: string) => void;
    onSubjectChange: (value: string) => void;
    onExamChange: (value: string) => void;
    onAcademicYearChange: (value: string) => void;
}

/**
 * Funnels selector row for the marks entry page.
 * Renders 5 dropdowns: Class, Section, Exam, Subject, Academic Year.
 */
const MarksSelectors = React.memo(function MarksSelectors({
    classes,
    sections,
    subjects,
    exams,
    academicYearOptions,
    selectedClass,
    selectedSection,
    selectedSubject,
    selectedExam,
    academicYear,
    onClassChange,
    onSectionChange,
    onSubjectChange,
    onExamChange,
    onAcademicYearChange,
}: MarksSelectorProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="space-y-1.5">
                <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-bold">Class</Label>
                <Select value={selectedClass} onValueChange={onClassChange}>
                    <SelectTrigger className="w-full bg-background border-border text-xs sm:text-sm font-medium">
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
                <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-bold">Section</Label>
                <Select value={selectedSection} onValueChange={onSectionChange}>
                    <SelectTrigger className="w-full bg-background border-border text-xs sm:text-sm font-medium">
                        <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                        {sections.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1.5">
                <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-bold">Exam / Term</Label>
                <Select value={selectedExam} onValueChange={onExamChange}>
                    <SelectTrigger className="w-full bg-background border-border text-xs sm:text-sm font-medium">
                        <SelectValue placeholder="Select exam" />
                    </SelectTrigger>
                    <SelectContent>
                        {exams.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1.5">
                <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-bold">Subject</Label>
                <Select value={selectedSubject} onValueChange={onSubjectChange}>
                    <SelectTrigger className="w-full bg-background border-border text-xs sm:text-sm font-medium">
                        <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                        {subjects.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-bold">Year</Label>
                <Select value={academicYear} onValueChange={onAcademicYearChange}>
                    <SelectTrigger className="w-full bg-background border-border text-xs sm:text-sm font-medium">
                        <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                        {academicYearOptions.map((y) => (
                            <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
});

MarksSelectors.displayName = "MarksSelectors";

export default MarksSelectors;
