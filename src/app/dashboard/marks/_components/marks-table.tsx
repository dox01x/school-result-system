"use client";

import React, { useCallback, useMemo } from "react";
import type { Student } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";
import MarkInputCell from "./mark-input-cell";

/** Shape of a single student's marks data */
export interface MarkEntryData {
    student_id: string;
    marks: string;
    theory: string;
    mcq: string;
    practical: string;
    existing_id?: string;
}

interface MarksTableProps {
    students: Student[];
    markEntries: Record<string, MarkEntryData>;
    /** Whether we're in detailed mode (theory/mcq/practical breakdown) */
    useDetailed: boolean;
    showTheory: boolean;
    showMcq: boolean;
    showPractical: boolean;
    /** Maximum mark values */
    effectiveFullMarks: number;
    maxTheory: number;
    maxMcq: number;
    maxPractical: number;
    /** Callback when a cell value is committed (on blur or arrow navigation) */
    onCellCommit: (studentId: string, field: "marks" | "theory" | "mcq" | "practical", value: string) => void;
}

/**
 * Column index mapping for keyboard navigation.
 * Maps field names to sequential column indices.
 */
function buildColumnMap(
    useDetailed: boolean,
    showTheory: boolean,
    showMcq: boolean,
    showPractical: boolean,
): Record<string, number> {
    if (!useDetailed) return { marks: 0 };
    const map: Record<string, number> = {};
    let idx = 0;
    if (showTheory) map.theory = idx++;
    if (showMcq) map.mcq = idx++;
    if (showPractical) map.practical = idx++;
    return map;
}

/**
 * Memoized table row to avoid re-rendering all rows when a single cell changes.
 * Each row creates its own commit callbacks.
 */
const MarksTableRow = React.memo(function MarksTableRow({
    student,
    rowIndex,
    entry,
    useDetailed,
    showTheory,
    showMcq,
    showPractical,
    effectiveFullMarks,
    maxTheory,
    maxMcq,
    maxPractical,
    columnMap,
    totalRows,
    onCellCommit,
}: {
    student: Student;
    rowIndex: number;
    entry: MarkEntryData;
    useDetailed: boolean;
    showTheory: boolean;
    showMcq: boolean;
    showPractical: boolean;
    effectiveFullMarks: number;
    maxTheory: number;
    maxMcq: number;
    maxPractical: number;
    columnMap: Record<string, number>;
    totalRows: number;
    onCellCommit: (studentId: string, field: "marks" | "theory" | "mcq" | "practical", value: string) => void;
}) {
    const handleCommitMarks = useCallback(
        (val: string) => onCellCommit(student.id, "marks", val),
        [student.id, onCellCommit]
    );
    const handleCommitTheory = useCallback(
        (val: string) => onCellCommit(student.id, "theory", val),
        [student.id, onCellCommit]
    );
    const handleCommitMcq = useCallback(
        (val: string) => onCellCommit(student.id, "mcq", val),
        [student.id, onCellCommit]
    );
    const handleCommitPractical = useCallback(
        (val: string) => onCellCommit(student.id, "practical", val),
        [student.id, onCellCommit]
    );

    const detailedTotal = useDetailed
        ? (parseFloat(entry.theory) || 0) +
          (showMcq ? (parseFloat(entry.mcq) || 0) : 0) +
          (showPractical ? (parseFloat(entry.practical) || 0) : 0)
        : 0;

    return (
        <tr
            className={`border-b transition-colors ${
                rowIndex % 2 === 0 ? "bg-background" : "bg-muted/20"
            } hover:bg-accent/50`}
        >
            {/* Roll */}
            <td className="p-3 font-mono text-xs text-muted-foreground w-16 text-center">
                {student.roll}
            </td>

            {/* Name */}
            <td className="p-3 text-sm font-medium text-foreground">
                {student.name}
            </td>

            {/* Simple mode: single marks column */}
            {!useDetailed && (
                <td className="p-2 w-28">
                    <MarkInputCell
                        inputId={`mark-input-${rowIndex}-${columnMap.marks}`}
                        rowIndex={rowIndex}
                        colIndex={columnMap.marks}
                        totalRows={totalRows}
                        maxMarks={effectiveFullMarks}
                        initialValue={entry.marks}
                        onValueCommit={handleCommitMarks}
                    />
                </td>
            )}

            {/* Detailed mode: theory */}
            {showTheory && (
                <td className="p-2 w-24">
                    <MarkInputCell
                        inputId={`mark-input-${rowIndex}-${columnMap.theory}`}
                        rowIndex={rowIndex}
                        colIndex={columnMap.theory}
                        totalRows={totalRows}
                        maxMarks={maxTheory}
                        initialValue={entry.theory}
                        onValueCommit={handleCommitTheory}
                    />
                </td>
            )}

            {/* Detailed mode: mcq */}
            {showMcq && (
                <td className="p-2 w-24">
                    <MarkInputCell
                        inputId={`mark-input-${rowIndex}-${columnMap.mcq}`}
                        rowIndex={rowIndex}
                        colIndex={columnMap.mcq}
                        totalRows={totalRows}
                        maxMarks={maxMcq}
                        initialValue={entry.mcq}
                        onValueCommit={handleCommitMcq}
                    />
                </td>
            )}

            {/* Detailed mode: practical */}
            {showPractical && (
                <td className="p-2 w-24">
                    <MarkInputCell
                        inputId={`mark-input-${rowIndex}-${columnMap.practical}`}
                        rowIndex={rowIndex}
                        colIndex={columnMap.practical}
                        totalRows={totalRows}
                        maxMarks={maxPractical}
                        initialValue={entry.practical}
                        onValueCommit={handleCommitPractical}
                    />
                </td>
            )}

            {/* Detailed mode: computed total */}
            {useDetailed && (
                <td className="p-3 text-center w-20">
                    <Badge
                        variant={
                            detailedTotal > effectiveFullMarks
                                ? "destructive"
                                : detailedTotal > 0
                                ? "default"
                                : "secondary"
                        }
                    >
                        {detailedTotal || "—"}
                    </Badge>
                </td>
            )}
        </tr>
    );
});

/**
 * The marks entry table with:
 * - Sticky header for scrolling with many students
 * - Fixed column widths for visual stability
 * - Each row is memoized independently
 * - Each cell manages its own local state (zero cross-cell re-renders)
 */
const MarksTable = React.memo(function MarksTable({
    students,
    markEntries,
    useDetailed,
    showTheory,
    showMcq,
    showPractical,
    effectiveFullMarks,
    maxTheory,
    maxMcq,
    maxPractical,
    onCellCommit,
}: MarksTableProps) {
    const columnMap = useMemo(
        () => buildColumnMap(useDetailed, showTheory, showMcq, showPractical),
        [useDetailed, showTheory, showMcq, showPractical]
    );

    return (
        <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto relative">
            <table className="w-full text-sm border-collapse">
                {/* ── Sticky Header ── */}
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                    <tr className="border-b">
                        <th className="text-center p-3 font-medium text-xs text-muted-foreground uppercase tracking-wider w-16">
                            Roll
                        </th>
                        <th className="text-left p-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">
                            Name
                        </th>
                        {!useDetailed && (
                            <th className="text-center p-3 font-medium text-xs text-muted-foreground uppercase tracking-wider w-28">
                                Marks{" "}
                                <Badge variant="outline" className="ml-1 text-[10px]">
                                    {effectiveFullMarks}
                                </Badge>
                            </th>
                        )}
                        {showTheory && (
                            <th className="text-center p-3 font-medium text-xs text-muted-foreground uppercase tracking-wider w-24">
                                Theory{" "}
                                <Badge variant="outline" className="ml-1 text-[10px]">
                                    {maxTheory}
                                </Badge>
                            </th>
                        )}
                        {showMcq && (
                            <th className="text-center p-3 font-medium text-xs text-muted-foreground uppercase tracking-wider w-24">
                                MCQ{" "}
                                <Badge variant="outline" className="ml-1 text-[10px]">
                                    {maxMcq}
                                </Badge>
                            </th>
                        )}
                        {showPractical && (
                            <th className="text-center p-3 font-medium text-xs text-muted-foreground uppercase tracking-wider w-24">
                                Practical{" "}
                                <Badge variant="outline" className="ml-1 text-[10px]">
                                    {maxPractical}
                                </Badge>
                            </th>
                        )}
                        {useDetailed && (
                            <th className="text-center p-3 font-medium text-xs text-muted-foreground uppercase tracking-wider w-20">
                                Total
                            </th>
                        )}
                    </tr>
                </thead>

                {/* ── Body ── */}
                <tbody>
                    {students.map((student, idx) => {
                        const entry = markEntries[student.id];
                        if (!entry) return null;

                        return (
                            <MarksTableRow
                                key={student.id}
                                student={student}
                                rowIndex={idx}
                                entry={entry}
                                useDetailed={useDetailed}
                                showTheory={showTheory}
                                showMcq={showMcq}
                                showPractical={showPractical}
                                effectiveFullMarks={effectiveFullMarks}
                                maxTheory={maxTheory}
                                maxMcq={maxMcq}
                                maxPractical={maxPractical}
                                columnMap={columnMap}
                                totalRows={students.length}
                                onCellCommit={onCellCommit}
                            />
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
});

MarksTable.displayName = "MarksTable";

export default MarksTable;
