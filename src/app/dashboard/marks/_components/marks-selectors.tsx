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
        <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[140px]">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Class</p>
                <Select value={selectedClass} onValueChange={onClassChange}>
                    <SelectTrigger className="w-full h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Class" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50 shadow-md">
                        {classes.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="rounded-lg">{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex-1 min-w-[140px]">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Section</p>
                <Select value={selectedSection} onValueChange={onSectionChange}>
                    <SelectTrigger className="w-full h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Section" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50 shadow-md">
                        {sections.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="rounded-lg">{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex-1 min-w-[140px]">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Exam</p>
                <Select value={selectedExam} onValueChange={onExamChange}>
                    <SelectTrigger className="w-full h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Exam" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50 shadow-md">
                        {exams.map((e) => (
                            <SelectItem key={e.id} value={e.id} className="rounded-lg">{e.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex-1 min-w-[140px]">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Subject</p>
                <Select value={selectedSubject} onValueChange={onSubjectChange}>
                    <SelectTrigger className="w-full h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Subject" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50 shadow-md">
                        {subjects.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="rounded-lg">{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex-1 min-w-[140px]">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">Year</p>
                <Select value={academicYear} onValueChange={onAcademicYearChange}>
                    <SelectTrigger className="w-full h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50 shadow-md">
                        {academicYearOptions.map((y) => (
                            <SelectItem key={y} value={y} className="rounded-lg">{y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
});

MarksSelectors.displayName = "MarksSelectors";

export default MarksSelectors;
