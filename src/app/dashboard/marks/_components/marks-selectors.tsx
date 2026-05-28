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
 * Filter selector row for the marks entry page.
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="flex flex-col">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 px-1">Class</p>
                <Select value={selectedClass} onValueChange={onClassChange}>
                    <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Class" /></SelectTrigger>
                    <SelectContent>
                        {classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 px-1">Section</p>
                <Select value={selectedSection} onValueChange={onSectionChange}>
                    <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Section" /></SelectTrigger>
                    <SelectContent>
                        {sections.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 px-1">Exam</p>
                <Select value={selectedExam} onValueChange={onExamChange}>
                    <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Exam" /></SelectTrigger>
                    <SelectContent>
                        {exams.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 px-1">Subject</p>
                <Select value={selectedSubject} onValueChange={onSubjectChange}>
                    <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Subject" /></SelectTrigger>
                    <SelectContent>
                        {subjects.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 px-1">Year</p>
                <Select value={academicYear} onValueChange={onAcademicYearChange}>
                    <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Year" /></SelectTrigger>
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
