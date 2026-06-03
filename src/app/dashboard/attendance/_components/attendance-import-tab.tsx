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
import { Download as DownloadSimple, Loader2 as SpinnerGap, RefreshCw as ArrowsClockwise, Check, AlertCircle as WarningCircle, FileSpreadsheet as FileXls } from "lucide-react";

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
            <div className="rounded-2xl border-2 border-dashed border-border/50 p-12 text-center">
                <FileXls className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">Select a class and section to import attendance</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Sheet Format Guide */}
            <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-none">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <p className="text-sm font-bold text-foreground flex items-center gap-2">
                            <FileXls size={16} strokeWidth={2} className="text-muted-foreground" />
                            Sheet Format Guide
                        </p>
                    </div>
                    <a
                        href="/templates/attendance-sheet-sample.csv"
                        download
                        className="inline-flex items-center gap-1.5 rounded-xl border-0 bg-muted px-4 py-2 text-xs font-bold text-foreground hover:bg-muted/80 transition-colors shadow-none"
                    >
                        <DownloadSimple size={14} strokeWidth={2} />
                        Sample CSV
                    </a>
                </div>
            </div>

            {/* Sheet Config */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Google Sheet ID or URL</Label>
                    <Input
                        value={sheetId}
                        onChange={(e) => setSheetId(extractGoogleSheetId(e.target.value))}
                        placeholder="Paste Sheet URL or ID..."
                        className="h-11 rounded-xl bg-muted border-0 text-sm font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Range</Label>
                    <Input
                        value={range}
                        onChange={(e) => setRange(e.target.value)}
                        placeholder="e.g. Sheet1!A1:AG60"
                        className="h-11 rounded-xl bg-muted border-0 text-sm font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none"
                    />
                </div>
            </div>

            {/* Import Button */}
            <div className="flex items-center gap-3">
                <Button
                    onClick={() => void handleImport(false)}
                    disabled={importing || !sheetId.trim() || !range.trim()}
                    className="h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-none px-6"
                >
                    {importing ? (
                        <>
                            <SpinnerGap size={16} strokeWidth={2} className="mr-2 animate-spin" />
                            Importing…
                        </>
                    ) : (
                        <>
                            <DownloadSimple size={16} strokeWidth={2} className="mr-2" />
                            Import Attendance
                        </>
                    )}
                </Button>
                {configLoaded && sheetId && (
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1 bg-muted px-3 py-1.5 rounded-lg">
                        <Check size={14} strokeWidth={2} className="text-muted-foreground" />
                        Config loaded
                    </span>
                )}
            </div>

            {/* Auto Sync */}
            <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 shadow-none">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-bold text-foreground">Auto Sync</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAutoSyncEnabled((v) => !v)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring/30 ${
                            autoSyncEnabled ? "bg-primary" : "bg-muted"
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
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Interval (sec)</Label>
                            <Input
                                type="number"
                                value={syncIntervalSec}
                                onChange={(e) => setSyncIntervalSec(Math.max(10, Number(e.target.value)))}
                                min={10}
                                className="h-10 rounded-xl bg-muted border-0 text-sm font-bold text-foreground focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Status</Label>
                            <div className="h-10 rounded-xl border-0 bg-muted px-4 flex items-center gap-2 text-xs font-bold">
                                {syncStatus === "syncing" ? (
                                    <>
                                        <ArrowsClockwise size={14} strokeWidth={2} className="animate-spin text-muted-foreground" />
                                        <span className="text-foreground">Syncing…</span>
                                    </>
                                ) : syncStatus === "error" ? (
                                    <>
                                        <WarningCircle size={14} strokeWidth={2} className="text-red-500" />
                                        <span className="text-red-700">Error</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                        </span>
                                        <span className="text-emerald-700">Active</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Last Sync</Label>
                            <div className="h-10 rounded-xl border-0 bg-muted px-4 flex items-center text-xs font-bold text-muted-foreground">
                                {lastSyncTime ? lastSyncTime.toLocaleTimeString() : "—"}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Import Results */}
            {lastImport && (
                <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 shadow-none">
                    <p className="text-sm font-bold text-foreground tracking-tight">Import Results</p>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border-0 bg-muted p-3 text-center">
                            <p className="text-xl font-black text-foreground tabular-nums">{lastImport.imported_records}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Imported</p>
                        </div>
                        <div className="rounded-xl border-0 bg-muted p-3 text-center">
                            <p className="text-xl font-black text-foreground tabular-nums">{lastImport.matched_students_rows}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Matched</p>
                        </div>
                        <div className="rounded-xl border-0 bg-muted p-3 text-center">
                            <p className="text-xl font-black text-muted-foreground/60 tabular-nums">{lastImport.skipped_rows}</p>
                            <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest mt-0.5">Skipped</p>
                        </div>
                    </div>
                    <div className="text-xs font-bold text-muted-foreground px-1">
                        Detected dates: {(lastImport.detected_dates || []).slice(0, 10).join(", ")}
                        {(lastImport.detected_dates || []).length > 10 ? "…" : ""}
                    </div>
                    {lastImport.warnings?.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2 shadow-none">
                            <p className="text-xs font-bold text-amber-800 flex items-center gap-2">
                                <WarningCircle size={16} strokeWidth={2} className="text-amber-600" />
                                Warnings ({lastImport.warnings.length})
                            </p>
                            <ul className="space-y-1 text-[11px] font-bold text-amber-700/80 max-h-32 overflow-y-auto pl-1">
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
                        <p className="text-xs font-bold text-muted-foreground px-1">{lastImport.message}</p>
                    )}
                </div>
            )}
        </div>
    );
}
