"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SheetConfig } from "@/lib/database.types";
import { SHEET_CONFIG_COLUMNS } from "@/lib/supabase/select-columns";
import type { AttendanceFilterState } from "./attendance-filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Loader2, RefreshCw, Check, AlertCircle, FileSpreadsheet } from "lucide-react";

type PreviewInfo = {
    detected_dates: string[];
    matched_students_rows: number;
    imported_records: number;
    skipped_rows: number;
    warnings: { row?: number; message: string }[];
    message?: string;
};

type Props = {
    filters: AttendanceFilterState;
    onImportComplete?: () => void;
};

function extractGoogleSheetId(input: string): string {
    const v = (input || "").trim();
    if (!v) return "";
    if (!v.includes("http")) return v;
    try {
        const url = new URL(v);
        const m = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (m?.[1]) return m[1];
        const key = url.searchParams.get("key");
        if (key) return key;
    } catch {
        return v;
    }
    return v;
}

export function AttendanceImportTab({ filters, onImportComplete }: Props) {
    const supabase = useMemo(() => createClient(), []);
    const { selectedClass, selectedSection, year, month } = filters;

    const [sheetId, setSheetId] = useState("");
    const [range, setRange] = useState("");
    const [importing, setImporting] = useState(false);
    const [lastImport, setLastImport] = useState<PreviewInfo | null>(null);
    const [configLoaded, setConfigLoaded] = useState(false);

    // Auto-sync
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
    const [syncIntervalSec, setSyncIntervalSec] = useState(30);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
    const autoSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load saved config from DB
    useEffect(() => {
        if (!selectedClass || !selectedSection) {
            setSheetId("");
            setRange("");
            setConfigLoaded(false);
            return;
        }
        setConfigLoaded(false);
        void (async () => {
            const { data } = await supabase
                .from("sheet_configs")
                .select(SHEET_CONFIG_COLUMNS)
                .eq("type", "attendance")
                .eq("class_id", selectedClass)
                .eq("section_id", selectedSection)
                .maybeSingle();
            if (data) {
                const cfg = data as unknown as SheetConfig;
                setSheetId(cfg.sheet_id);
                setRange(cfg.sheet_range);
            } else {
                setSheetId("");
                setRange("");
            }
            setConfigLoaded(true);
        })();
    }, [supabase, selectedClass, selectedSection]);

    // Stop auto-sync when filters change
    useEffect(() => {
        setAutoSyncEnabled(false);
        setLastImport(null);
    }, [selectedClass, selectedSection]);

    // Core import function — wrapped in useCallback with all deps
    const handleImport = useCallback(async (silent = false) => {
        if (!selectedClass || !selectedSection) {
            if (!silent) toast.error("Please select class and section");
            return;
        }
        if (!sheetId.trim() || !range.trim()) {
            if (!silent) toast.error("Sheet ID and Range are required");
            return;
        }
        if (!silent) {
            setImporting(true);
            setLastImport(null);
        } else {
            setSyncStatus("syncing");
        }
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            let accessToken = session?.access_token || "";
            if (!accessToken) {
                const { data: refreshed } = await supabase.auth.refreshSession();
                accessToken = refreshed.session?.access_token || "";
            }
            const res = await fetch("/api/attendance/import", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({
                    class_id: selectedClass,
                    section_id: selectedSection,
                    sheet_id: sheetId.trim(),
                    range: range.trim(),
                    year,
                    month,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                if (!silent) {
                    toast.error(json.error || `Import failed (${res.status})`);
                    if (json?.data && Array.isArray(json.data.detected_dates)) {
                        setLastImport(json.data as PreviewInfo);
                    }
                } else {
                    setSyncStatus("error");
                }
                return;
            }
            const info = json.data as PreviewInfo;
            if (!silent) {
                setLastImport(info);
                toast.success(`Imported ${info.imported_records} attendance records`);
                onImportComplete?.();
            } else {
                setLastSyncTime(new Date());
                setSyncStatus("idle");
            }

            // Save config — UPSERT pattern (fix race condition)
            await supabase
                .from("sheet_configs")
                .upsert(
                    {
                        type: "attendance",
                        class_id: selectedClass,
                        section_id: selectedSection,
                        subject_id: null,
                        exam_id: null,
                        sheet_id: sheetId.trim(),
                        sheet_range: range.trim(),
                    },
                    { onConflict: "type,class_id,section_id,subject_id,exam_id" }
                );
        } catch (err: unknown) {
            if (!silent) toast.error(err instanceof Error ? err.message : "Import failed");
            else setSyncStatus("error");
        } finally {
            if (!silent) setImporting(false);
        }
    }, [supabase, selectedClass, selectedSection, sheetId, range, year, month, onImportComplete]);

    // Auto-sync interval — handleImport is now in deps (Bug #3 fix)
    useEffect(() => {
        if (!autoSyncEnabled) {
            if (autoSyncRef.current) clearInterval(autoSyncRef.current);
            autoSyncRef.current = null;
            setSyncStatus("idle");
            return;
        }
        if (autoSyncRef.current) clearInterval(autoSyncRef.current);
        autoSyncRef.current = setInterval(() => {
            void handleImport(true);
        }, Math.max(10, syncIntervalSec) * 1000);
        return () => {
            if (autoSyncRef.current) clearInterval(autoSyncRef.current);
            autoSyncRef.current = null;
        };
    }, [autoSyncEnabled, syncIntervalSec, handleImport]);

    if (!selectedClass || !selectedSection) {
        return (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
                <FileSpreadsheet className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">Select a class and section to import attendance</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Sheet Format Guide */}
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50/50 to-slate-50/50 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                            Sheet Format Guide
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Headers: <code className="bg-white px-1.5 py-0.5 rounded border text-[10px]">roll</code>,{" "}
                            <code className="bg-white px-1.5 py-0.5 rounded border text-[10px]">name</code>, then day columns (
                            <code className="bg-white px-1.5 py-0.5 rounded border text-[10px]">1</code>,{" "}
                            <code className="bg-white px-1.5 py-0.5 rounded border text-[10px]">2</code>, … or{" "}
                            <code className="bg-white px-1.5 py-0.5 rounded border text-[10px]">2026-05-01</code>).
                            Cells: <code className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px] text-emerald-700">P</code>{" "}
                            / <code className="bg-red-50 px-1.5 py-0.5 rounded border border-red-200 text-[10px] text-red-700">A</code>
                        </p>
                    </div>
                    <a
                        href="/templates/attendance-sheet-sample.csv"
                        download
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <Download className="h-3 w-3" />
                        Sample CSV
                    </a>
                </div>
            </div>

            {/* Sheet Config */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Google Sheet ID or URL</Label>
                    <Input
                        value={sheetId}
                        onChange={(e) => setSheetId(extractGoogleSheetId(e.target.value))}
                        placeholder="Paste Sheet URL or ID..."
                        className="h-9 rounded-lg bg-white border-slate-200 text-sm"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Range</Label>
                    <Input
                        value={range}
                        onChange={(e) => setRange(e.target.value)}
                        placeholder="e.g. Sheet1!A1:AG60"
                        className="h-9 rounded-lg bg-white border-slate-200 text-sm"
                    />
                </div>
            </div>

            {/* Import Button */}
            <div className="flex items-center gap-3">
                <Button
                    onClick={() => void handleImport(false)}
                    disabled={importing || !sheetId.trim() || !range.trim()}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
                >
                    {importing ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importing…
                        </>
                    ) : (
                        <>
                            <Download className="h-4 w-4 mr-2" />
                            Import Attendance
                        </>
                    )}
                </Button>
                {configLoaded && sheetId && (
                    <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Config loaded from database
                    </span>
                )}
            </div>

            {/* Auto Sync */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-slate-800">Auto Sync</p>
                        <p className="text-xs text-muted-foreground">Automatically re-import from the sheet at regular intervals.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAutoSyncEnabled((v) => !v)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                            autoSyncEnabled ? "bg-primary" : "bg-slate-200"
                        }`}
                        role="switch"
                        aria-checked={autoSyncEnabled}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                                autoSyncEnabled ? "translate-x-6" : "translate-x-1"
                            }`}
                        />
                    </button>
                </div>

                {autoSyncEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Interval (sec)</Label>
                            <Input
                                type="number"
                                value={syncIntervalSec}
                                onChange={(e) => setSyncIntervalSec(Math.max(10, Number(e.target.value)))}
                                min={10}
                                className="h-8 rounded-lg bg-slate-50 border-slate-200 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</Label>
                            <div className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 flex items-center gap-2 text-xs">
                                {syncStatus === "syncing" ? (
                                    <>
                                        <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                                        <span className="text-blue-600 font-medium">Syncing…</span>
                                    </>
                                ) : syncStatus === "error" ? (
                                    <>
                                        <AlertCircle className="h-3 w-3 text-red-500" />
                                        <span className="text-red-600 font-medium">Error</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                        </span>
                                        <span className="text-emerald-600 font-medium">Active</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Last Sync</Label>
                            <div className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 flex items-center text-xs text-slate-600">
                                {lastSyncTime ? lastSyncTime.toLocaleTimeString() : "—"}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Import Results */}
            {lastImport && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <p className="text-sm font-semibold text-slate-800">Import Results</p>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-3 text-center">
                            <p className="text-lg font-bold text-emerald-700 tabular-nums">{lastImport.imported_records}</p>
                            <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">Imported</p>
                        </div>
                        <div className="rounded-lg border bg-blue-50 border-blue-200 p-3 text-center">
                            <p className="text-lg font-bold text-blue-700 tabular-nums">{lastImport.matched_students_rows}</p>
                            <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wider">Matched</p>
                        </div>
                        <div className="rounded-lg border bg-amber-50 border-amber-200 p-3 text-center">
                            <p className="text-lg font-bold text-amber-700 tabular-nums">{lastImport.skipped_rows}</p>
                            <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wider">Skipped</p>
                        </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Detected dates: {(lastImport.detected_dates || []).slice(0, 10).join(", ")}
                        {(lastImport.detected_dates || []).length > 10 ? "…" : ""}
                    </div>
                    {lastImport.warnings?.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                                <AlertCircle className="h-3 w-3" />
                                Warnings ({lastImport.warnings.length})
                            </p>
                            <ul className="space-y-0.5 text-[11px] text-amber-700 max-h-32 overflow-y-auto">
                                {lastImport.warnings.slice(0, 10).map((w, i) => (
                                    <li key={i}>
                                        {w.row ? `Row ${w.row}: ` : ""}
                                        {w.message}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {lastImport.message && (
                        <p className="text-xs text-blue-600 font-medium">{lastImport.message}</p>
                    )}
                </div>
            )}
        </div>
    );
}
