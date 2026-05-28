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
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <Select value={selectedClass} onValueChange={onClassChange}>
                <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
                <SelectContent>
                    {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={selectedSection} onValueChange={onSectionChange}>
                <SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger>
                <SelectContent>
                    {sections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={selectedExam} onValueChange={onExamChange}>
                <SelectTrigger><SelectValue placeholder="Exam" /></SelectTrigger>
                <SelectContent>
                    {exams.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={selectedSubject} onValueChange={onSubjectChange}>
                <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                    {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={academicYear} onValueChange={onAcademicYearChange}>
                <SelectTrigger><SelectValue placeholder="Academic Year" /></SelectTrigger>
                <SelectContent>
                    {academicYearOptions.map((y) => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
});

MarksSelectors.displayName = "MarksSelectors";

export default MarksSelectors;
