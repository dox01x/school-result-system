"use client";

import React, { useState, useCallback } from "react";
import type { Student } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Download as DownloadSimple, RefreshCw as ArrowsClockwise } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Papa from "papaparse";

/** Mark entry shape for import matching */
interface MarkImportEntry {
    marks: string;
    theory: string;
    mcq: string;
    practical: string;
}

interface ImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    students: Student[];
    useDetailed: boolean;
    currentSubjectName: string;
    /** Called with a map of studentId → updated fields */
    onImport: (updates: Record<string, Partial<MarkImportEntry>>) => void;
    /** Sheets config persistence */
    sheetsForm: { sheetId: string; range: string };
    onSheetsFormChange: (form: { sheetId: string; range: string }) => void;
    /** Auto-sync controls */
    autoSyncEnabled: boolean;
    onToggleAutoSync: () => void;
    syncIntervalSec: number;
    onSyncIntervalChange: (sec: number) => void;
    /** Fetch from Google Sheets */
    onFetchSheets: () => Promise<void>;
    sheetsLoading: boolean;
}

/**
 * Import dialog supporting CSV file upload and Google Sheets integration.
 * Extracted from the monolithic marks page for modularity.
 */
const ImportDialog = React.memo(function ImportDialog({
    open,
    onOpenChange,
    students,
    useDetailed,
    currentSubjectName,
    onImport,
    sheetsForm,
    onSheetsFormChange,
    autoSyncEnabled,
    onToggleAutoSync,
    syncIntervalSec,
    onSyncIntervalChange,
    onFetchSheets,
    sheetsLoading,
}: ImportDialogProps) {

    /** Parse and match CSV rows against student rolls */
    const handleCSVImport = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const rows = results.data as Record<string, string>[];
                    const updates: Record<string, Partial<MarkImportEntry>> = {};
                    let matched = 0;

                    rows.forEach((row) => {
                        const roll = (row.roll || row.Roll || "").toString().trim();
                        const student = students.find((s) => s.roll === roll);
                        if (!student) return;

                        const entry: Partial<MarkImportEntry> = {};
                        const marksVal = (row.marks || row.Marks || row.number || row.Number || "").trim();
                        if (marksVal) entry.marks = marksVal;

                        if (useDetailed) {
                            if (row.theory || row.Theory) entry.theory = (row.theory || row.Theory || "").trim();
                            if (row.mcq || row.MCQ) entry.mcq = (row.mcq || row.MCQ || "").trim();
                            if (row.practical || row.Practical) entry.practical = (row.practical || row.Practical || "").trim();
                        }

                        updates[student.id] = entry;
                        matched++;
                    });

                    onImport(updates);
                    toast.success(`${matched} students matched from CSV`);
                    onOpenChange(false);
                },
            });
            e.target.value = "";
        },
        [students, useDetailed, onImport, onOpenChange]
    );

    /** DownloadSimple a sample CSV template */
    const downloadSampleCSV = useCallback(() => {
        const header = useDetailed ? "roll,name,theory,mcq,practical" : "roll,name,marks";
        const rows = students.slice(0, 3).map((s) =>
            useDetailed ? `${s.roll},${s.name},,,` : `${s.roll},${s.name},`
        );
        const csv = [header, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `marks_template_${currentSubjectName || "subject"}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [students, useDetailed, currentSubjectName]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-card rounded-3xl border-border/50 shadow-lg sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Import Marks</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="csv" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-muted rounded-xl p-1 h-11">
                        <TabsTrigger value="csv" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">CSV File</TabsTrigger>
                        <TabsTrigger value="sheets" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Google Sheets</TabsTrigger>
                    </TabsList>

                    {/* ── CSV Tab ── */}
                    <TabsContent value="csv" className="space-y-6 pt-4 pb-2 min-h-[280px] flex flex-col">
                        <p className="text-sm text-muted-foreground">
                            Upload a CSV file with marks data. Required headers:{" "}
                            <strong className="font-mono bg-muted px-1 py-0.5 rounded">roll</strong>,{" "}
                            <strong className="font-mono bg-muted px-1 py-0.5 rounded">name</strong>, and{" "}
                            <strong className="font-mono bg-muted px-1 py-0.5 rounded">
                                {useDetailed ? "theory, mcq, practical" : "marks"}
                            </strong>.
                        </p>
                        <div className="flex-1 flex justify-center items-center border-2 border-dashed rounded-lg p-8 hover:bg-muted/50 transition-colors relative">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={downloadSampleCSV}
                                className="absolute top-4 right-4 rounded-lg bg-muted border-0 hover:bg-muted/80"
                                title="Download a sample CSV with student rolls"
                            >
                                <DownloadSimple size={14} strokeWidth={1.5} className="mr-1" />
                                Sample CSV
                            </Button>
                            <label className="flex flex-col items-center cursor-pointer w-full text-center mt-6">
                                <Upload size={40} strokeWidth={1.2} className="text-muted-foreground/40 mb-4 mx-auto" />
                                <span className="font-medium text-sm text-foreground">Click to select CSV file</span>
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleCSVImport}
                                />
                            </label>
                        </div>
                    </TabsContent>

                    {/* ── Google Sheets Tab ── */}
                    <TabsContent value="sheets" className="space-y-4 pt-4 min-h-[280px] flex flex-col">
                        <div className="space-y-3 flex-1">
                            <Input
                                placeholder="Sheet ID or Link (e.g. docs.google.com/...)"
                                value={sheetsForm.sheetId}
                                onChange={(e) => {
                                    let val = e.target.value;
                                    const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                                    if (match) val = match[1];
                                    onSheetsFormChange({ ...sheetsForm, sheetId: val });
                                }}
                                className="h-11 rounded-xl bg-muted border-0 focus-visible:ring-1 focus-visible:ring-ring/30 px-4"
                            />
                            <Input
                                placeholder="Range (e.g. A1:C50)"
                                value={sheetsForm.range}
                                onChange={(e) =>
                                    onSheetsFormChange({ ...sheetsForm, range: e.target.value })
                                }
                                className="h-11 rounded-xl bg-muted border-0 focus-visible:ring-1 focus-visible:ring-ring/30 px-4"
                            />

                            {/* Auto-sync toggle */}
                            <div className="flex items-center justify-between bg-muted/30 border rounded-md p-2 mt-4">
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium">Auto-Sync</span>
                                    {autoSyncEnabled && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <input
                                                type="range"
                                                min={5}
                                                max={10}
                                                value={syncIntervalSec}
                                                onChange={(e) => onSyncIntervalChange(parseInt(e.target.value))}
                                                className="w-20 h-1 bg-muted rounded-full appearance-none cursor-pointer accent-emerald-500"
                                            />
                                            <span className="text-[10px] text-muted-foreground">
                                                {syncIntervalSec}s
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant={autoSyncEnabled ? "secondary" : "outline"}
                                    size="sm"
                                    className={`h-7 px-2 text-xs ${
                                        autoSyncEnabled
                                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border-emerald-200"
                                            : ""
                                    }`}
                                    onClick={onToggleAutoSync}
                                >
                                    <ArrowsClockwise
                                        className={`h-3 w-3 mr-1 ${
                                            autoSyncEnabled
                                                ? "animate-spin text-emerald-600"
                                                : "text-muted-foreground"
                                        }`}
                                    />
                                    {autoSyncEnabled ? "ON" : "OFF"}
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-dashed border-border/50 mt-auto">
                            <div className="text-xs text-muted-foreground flex gap-1 items-center">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                need: roll, name, {useDetailed ? "theory, mcq…" : "marks"}
                            </div>
                            <div className="flex gap-2">
                                <DialogClose asChild>
                                    <Button variant="ghost" size="sm" className="rounded-xl">Cancel</Button>
                                </DialogClose>
                                <Button size="sm" onClick={onFetchSheets} disabled={sheetsLoading} className="bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 shadow-none font-semibold transition-all duration-200">
                                    {sheetsLoading ? "…" : "Import Now"}
                                </Button>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
});

ImportDialog.displayName = "ImportDialog";

export default ImportDialog;
