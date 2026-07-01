"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    CLASS_COLUMNS,
    EXAM_COLUMNS,
    EXAM_SUBJECT_CONFIG_COLUMNS,
    SECTION_COLUMNS,
    SUBJECT_COLUMNS,
    STUDENT_COLUMNS,
    MARK_COLUMNS,
    SHEET_CONFIG_COLUMNS,
} from "@/lib/supabase/select-columns";
import type { Class, Section, Subject, Exam, Student, ExamSubjectConfig } from "@/lib/database.types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PencilLine as PencilSimpleLine, AlertCircle as WarningCircle, Upload, RefreshCw as ArrowsClockwise, Save as FloppyDisk } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";

import MarksSelectors from "./_components/marks-selectors";
import MarksToolbar from "./_components/marks-toolbar";
import MarksTable from "./_components/marks-table";
import type { MarkEntryData } from "./_components/marks-table";
import ImportDialog from "./_components/import-dialog";
import AutoSyncBanner from "./_components/auto-sync-banner";

/**
 * Marks Entry Page — Orchestrator Component
 *
 * Responsibilities:
 * - Data fetching (classes, sections, subjects, exams, students, marks)
 * - State coordination between child components
 * - Batch save via server API (/api/marks/batch)
 * - Google Sheets sync management
 *
 * Rendering is delegated entirely to child components.
 * Mark values are stored in a ref + state hybrid:
 * - markEntriesRef: authoritative source (for save/export), updated immediately
 * - markEntries state: triggers child re-render ONLY on full reload/import
 */
export default function MarksPage() {
    // ── Dropdown data ──
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [examSubjectConfigs, setExamSubjectConfigs] = useState<ExamSubjectConfig[]>([]);

    // ── Selection state ──
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedExam, setSelectedExam] = useState("");
    const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());

    // ── Mark data ──
    const [students, setStudents] = useState<Student[]>([]);
    const [markEntries, setMarkEntries] = useState<Record<string, MarkEntryData>>({});
    const markEntriesRef = useRef<Record<string, MarkEntryData>>({});
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasUnsaved, setHasUnsaved] = useState(false);
    const [isFetchingMarks, setIsFetchingMarks] = useState(false);
    const cachedStudentsRef = useRef<Record<string, Student[]>>({});

    // ── Auto-save debounce ──
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savingRef = useRef(false);
    const pendingSaveRef = useRef(false);

    // ── Settings ──
    const [detailedMarks, setDetailedMarks] = useState(false);

    // ── Import / Sync ──
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [sheetsForm, setSheetsForm] = useState({ sheetId: "", range: "" });
    const [sheetsLoading, setSheetsLoading] = useState(false);
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
    const [syncIntervalSec, setSyncIntervalSec] = useState(7);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
    const autoSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const supabase = useMemo(() => createClient() as any, []);

    // ── Derived values ──
    const currentSubject = subjects.find((s) => s.id === selectedSubject);
    const currentExam = exams.find((e) => e.id === selectedExam);
    const isMCT = currentExam?.exam_type === "mct";

    const currentConfig = examSubjectConfigs.find(
        (c) => c.exam_id === selectedExam && c.subject_id === selectedSubject
    );
    const effectiveFullMarks = currentConfig?.full_marks ?? currentSubject?.full_marks ?? 100;
    const scaleFactor = currentSubject ? effectiveFullMarks / currentSubject.full_marks : 1;
    const effectiveTheoryMarks = currentSubject ? Math.round(currentSubject.theory_marks * scaleFactor) : 0;
    const effectiveMcqMarks = currentSubject ? Math.round(currentSubject.mcq_marks * scaleFactor) : 0;
    const effectivePracticalMarks = currentSubject ? Math.round(currentSubject.practical_marks * scaleFactor) : 0;

    const useDetailed = detailedMarks && !isMCT;
    const showTheory = useDetailed && (currentSubject?.has_theory ?? false);
    const showMcq = useDetailed && (currentSubject?.has_mcq ?? false);
    const showPractical = useDetailed && (currentSubject?.has_practical ?? false);
    const maxTheory = isMCT ? effectiveFullMarks : effectiveTheoryMarks;
    const maxMcq = effectiveMcqMarks;
    const maxPractical = effectivePracticalMarks;

    const academicYearOptions = useMemo(() => {
        const y = new Date().getFullYear();
        const options: string[] = [];
        for (let i = y - 2; i <= y + 1; i++) options.push(i.toString());
        return options;
    }, []);

    const filteredSubjects = useMemo(() => {
        if (!selectedExam) return subjects;
        const configsForExam = examSubjectConfigs.filter((c) => c.exam_id === selectedExam);
        if (configsForExam.length === 0) return subjects;
        const configuredIds = new Set(configsForExam.map((c) => c.subject_id));
        return subjects.filter((s) => configuredIds.has(s.id));
    }, [subjects, selectedExam, examSubjectConfigs]);

    // ── Data fetching: dropdowns + settings ──
    useEffect(() => {
        (async () => {
            const [cRes, eRes, configRes, schoolRes] = await Promise.all([
                supabase.from("classes").select(CLASS_COLUMNS).order("numeric_value"),
                supabase.from("exams").select(EXAM_COLUMNS).order("term").order("exam_type"),
                supabase.from("exam_subject_config").select(EXAM_SUBJECT_CONFIG_COLUMNS),
                supabase.from("school_info").select("detailed_marks").limit(1).single(),
            ]);
            setClasses(cRes.data || []);
            setExams(eRes.data || []);
            setExamSubjectConfigs(configRes.data || []);
            if (schoolRes.data?.detailed_marks) setDetailedMarks(true);
        })();
    }, [supabase]);

    // ── Fetch sections + subjects when class changes ──
    useEffect(() => {
        if (!selectedClass) return;
        (async () => {
            const [sRes, subRes] = await Promise.all([
                supabase.from("sections").select(SECTION_COLUMNS).eq("class_id", selectedClass).order("name"),
                supabase.from("subjects").select(SUBJECT_COLUMNS).eq("class_id", selectedClass).order("name"),
            ]);
            setSections(sRes.data || []);
            setSubjects(subRes.data || []);
            setSelectedSection("");
            setSelectedSubject("");
        })();
    }, [selectedClass, supabase]);

    // ── Load students + existing marks ──
    const loadMarks = useCallback(async () => {
        if (!selectedClass || !selectedSection || !selectedSubject || !selectedExam) {
            setStudents([]);
            setMarkEntries({});
            markEntriesRef.current = {};
            setLoaded(false);
            return;
        }

        setIsFetchingMarks(true);

        try {
            const subjectData = subjects.find((s) => s.id === selectedSubject);
            const groupKey = subjectData?.group_name && subjectData.group_name !== "Common" ? subjectData.group_name : "all";
            const cacheKey = `${selectedClass}-${selectedSection}-${groupKey}`;

            let sortedStudents: Student[] = [];

            if (cachedStudentsRef.current[cacheKey]) {
                sortedStudents = cachedStudentsRef.current[cacheKey];
            } else {
                let query = supabase
                    .from("students")
                    .select(STUDENT_COLUMNS)
                    .eq("class_id", selectedClass)
                    .eq("section_id", selectedSection);

                if (groupKey !== "all") {
                    query = query.eq("group_name", groupKey);
                }
                const { data: stdData } = await query.order("roll");

                sortedStudents = ((stdData || []) as any[]).sort((a: any, b: any) => {
                    const na = parseInt(a.roll), nb = parseInt(b.roll);
                    if (!isNaN(na) && !isNaN(nb)) return na - nb;
                    return a.roll.localeCompare(b.roll);
                });

                cachedStudentsRef.current[cacheKey] = sortedStudents;
            }

            let markQuery = supabase
                .from("marks")
                .select(MARK_COLUMNS)
                .eq("subject_id", selectedSubject)
                .eq("exam_id", selectedExam)
                .in("student_id", sortedStudents.map((s) => s.id));
            if (academicYear) markQuery = markQuery.eq("academic_year", academicYear);
            const { data: markData } = await markQuery;

            setStudents(sortedStudents);

            const entries: Record<string, MarkEntryData> = {};
            sortedStudents.forEach((student) => {
                const existing = ((markData || []) as any[]).find((m: any) => m.student_id === student.id);
                entries[student.id] = {
                    student_id: student.id,
                    marks: existing?.total?.toString() || "",
                    theory: existing?.theory?.toString() || "",
                    mcq: existing?.mcq?.toString() || "",
                    practical: existing?.practical?.toString() || "",
                    existing_id: existing?.id,
                };
            });

            markEntriesRef.current = entries;
            setMarkEntries(entries);
            setLoaded(true);
            setHasUnsaved(false);
        } catch {
            toast.error("Failed to load marks");
        } finally {
            setIsFetchingMarks(false);
        }
    }, [selectedClass, selectedSection, selectedSubject, selectedExam, academicYear, subjects, supabase]);

    useEffect(() => {
        loadMarks();
    }, [loadMarks]);

    /**
     * Save all marks via the server-validated batch API.
     * Reads from markEntriesRef (always up-to-date) rather than state.
     */
    const handleSave = useCallback(async (silent = false) => {
        if (!currentSubject) return;
        if (savingRef.current) {
            pendingSaveRef.current = true;
            return;
        }
        savingRef.current = true;
        setSaving(true);

        try {
            const entries = Object.entries(markEntriesRef.current)
                .map(([studentId, entry]) => {
                    let theory: number | null = null;
                    let mcq: number | null = null;
                    let practical: number | null = null;
                    let total: number;
                    let hasInput = false;

                    if (useDetailed && (showTheory || showMcq || showPractical)) {
                        const tStr = (entry.theory || "").trim();
                        const mStr = (entry.mcq || "").trim();
                        const pStr = (entry.practical || "").trim();
                        
                        theory = tStr !== "" ? (isNaN(parseFloat(tStr)) ? 0 : parseFloat(tStr)) : null;
                        mcq = mStr !== "" ? (isNaN(parseFloat(mStr)) ? 0 : parseFloat(mStr)) : null;
                        practical = pStr !== "" ? (isNaN(parseFloat(pStr)) ? 0 : parseFloat(pStr)) : null;
                        total = (theory ?? 0) + (mcq ?? 0) + (practical ?? 0);
                        
                        hasInput = tStr !== "" || mStr !== "" || pStr !== "";
                    } else {
                        const mStr = (entry.marks || "").trim();
                        const val = mStr !== "" ? (isNaN(parseFloat(mStr)) ? 0 : parseFloat(mStr)) : 0;
                        total = val;
                        theory = mStr !== "" ? val : null;
                        
                        hasInput = mStr !== "";
                    }

                    return { student_id: studentId, theory, mcq, practical, total, hasInput, existing_id: entry.existing_id };
                })
                .filter((e) => e.hasInput || e.existing_id)
                .map(({ hasInput, existing_id, ...rest }) => rest);

            if (entries.length === 0) {
                if (!silent) toast.info("No marks to save");
                return;
            }

            const res = await fetch("/api/marks/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subject_id: selectedSubject,
                    exam_id: selectedExam,
                    academic_year: academicYear,
                    entries,
                }),
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || "Failed to save marks");
            }

            if (!silent) toast.success(`${json.count} marks saved`);
            setHasUnsaved(false);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save marks");
        } finally {
            savingRef.current = false;
            setSaving(false);
            // If another save was queued during this one, fire it
            if (pendingSaveRef.current) {
                pendingSaveRef.current = false;
                handleSave(true);
            }
        }
    }, [currentSubject, useDetailed, showTheory, showMcq, showPractical, selectedSubject, selectedExam, academicYear]);

    // Keep a ref to the latest handleSave so the debounced timer never goes stale
    const handleSaveRef = useRef(handleSave);
    useEffect(() => {
        handleSaveRef.current = handleSave;
    }, [handleSave]);

    // ── Cell commit handler (called on blur / arrow nav from MarkInputCell) ──
    const handleCellCommit = useCallback(
        (studentId: string, field: "marks" | "theory" | "mcq" | "practical", value: string) => {
            const prev = markEntriesRef.current[studentId];
            if (!prev) return;
            // Only update ref (no re-render). The cell manages its own display state.
            markEntriesRef.current[studentId] = { ...prev, [field]: value };
            setHasUnsaved(true);

            // Debounced auto-save after 100ms
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
            autoSaveTimerRef.current = setTimeout(() => {
                autoSaveTimerRef.current = null;
                handleSaveRef.current(true);
            }, 100);
        },
        []
    );

    // Cleanup auto-save timer on unmount
    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, []);

    // ── Google Sheets fetch (shared for manual + auto-sync) ──
    const fetchSheetData = useCallback(
        async (sheetId: string, range: string, silent = false): Promise<number> => {
            const res = await fetch("/api/sheets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sheetId, range }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to fetch sheet");

            const rows: string[][] = json.data || [];
            if (rows.length < 2) {
                if (!silent) toast.error("No data rows found");
                return 0;
            }

            const headers = rows[0].map((h: string) => h.toLowerCase().trim());
            const rollIdx = headers.findIndex((h) => h === "roll");
            const marksIdx = headers.findIndex((h) => h === "marks" || h === "number");
            const theoryIdx = headers.findIndex((h) => h === "theory");
            const mcqIdx = headers.findIndex((h) => h === "mcq");
            const practicalIdx = headers.findIndex((h) => h === "practical");

            if (rollIdx < 0) {
                if (!silent) toast.error("Sheet must have a 'roll' column");
                return 0;
            }

            // Build updates from sheet data
            const newEntries = { ...markEntriesRef.current };
            let matched = 0;

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const roll = (row[rollIdx] || "").trim();
                const student = students.find((s) => s.roll === roll);
                if (student && newEntries[student.id]) {
                    if (marksIdx >= 0) newEntries[student.id] = { ...newEntries[student.id], marks: (row[marksIdx] || "").trim() };
                    if (useDetailed) {
                        if (theoryIdx >= 0) newEntries[student.id] = { ...newEntries[student.id], theory: (row[theoryIdx] || "").trim() };
                        if (mcqIdx >= 0) newEntries[student.id] = { ...newEntries[student.id], mcq: (row[mcqIdx] || "").trim() };
                        if (practicalIdx >= 0) newEntries[student.id] = { ...newEntries[student.id], practical: (row[practicalIdx] || "").trim() };
                    }
                    matched++;
                }
            }

            markEntriesRef.current = newEntries;
            setMarkEntries({ ...newEntries }); // trigger re-render so cells pick up new initialValues
            setHasUnsaved(true);
            return matched;
        },
        [students, useDetailed]
    );

    const handleGoogleSheetsFetch = useCallback(async () => {
        if (!sheetsForm.sheetId || !sheetsForm.range) {
            toast.error("Sheet ID and Range are required");
            return;
        }
        setSheetsLoading(true);
        try {
            const count = await fetchSheetData(sheetsForm.sheetId, sheetsForm.range);
            if (count > 0) {
                toast.success("Marks imported from Google Sheets");

                // Persist config
                await supabase
                    .from("sheet_configs")
                    .delete()
                    .eq("type", "marks")
                    .eq("class_id", selectedClass)
                    .eq("section_id", selectedSection)
                    .eq("subject_id", selectedSubject)
                    .eq("exam_id", selectedExam);

                await supabase.from("sheet_configs").insert({
                    type: "marks",
                    class_id: selectedClass,
                    section_id: selectedSection,
                    subject_id: selectedSubject,
                    exam_id: selectedExam,
                    sheet_id: sheetsForm.sheetId,
                    sheet_range: sheetsForm.range,
                });

                setImportDialogOpen(false);
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to fetch Google Sheets data");
        } finally {
            setSheetsLoading(false);
        }
    }, [sheetsForm, fetchSheetData, supabase, selectedClass, selectedSection, selectedSubject, selectedExam]);

    // ── Auto-sync interval ──
    useEffect(() => {
        if (autoSyncRef.current) {
            clearInterval(autoSyncRef.current);
            autoSyncRef.current = null;
        }
        if (!autoSyncEnabled || !sheetsForm.sheetId || !sheetsForm.range || !loaded) {
            setSyncStatus("idle");
            return;
        }

        const doSync = async () => {
            setSyncStatus("syncing");
            try {
                await fetchSheetData(sheetsForm.sheetId, sheetsForm.range, true);
                setLastSyncTime(new Date());
                setSyncStatus("idle");
            } catch {
                setSyncStatus("error");
            }
        };

        doSync();
        autoSyncRef.current = setInterval(doSync, syncIntervalSec * 1000);

        return () => {
            if (autoSyncRef.current) {
                clearInterval(autoSyncRef.current);
                autoSyncRef.current = null;
            }
        };
    }, [autoSyncEnabled, syncIntervalSec, sheetsForm.sheetId, sheetsForm.range, loaded, fetchSheetData]);

    // Reset sync on selection change
    useEffect(() => {
        setAutoSyncEnabled(false);
        setSheetsForm({ sheetId: "", range: "" });
    }, [selectedClass, selectedSection, selectedSubject, selectedExam]);

    // Auto-fill sheets form from saved config
    useEffect(() => {
        if (!selectedClass || !selectedSection || !selectedSubject || !selectedExam || !loaded) return;
        (async () => {
            try {
                const { data: config } = await supabase
                    .from("sheet_configs")
                    .select(SHEET_CONFIG_COLUMNS)
                    .eq("type", "marks")
                    .eq("class_id", selectedClass)
                    .eq("section_id", selectedSection)
                    .eq("subject_id", selectedSubject)
                    .eq("exam_id", selectedExam)
                    .maybeSingle();

                if (config) {
                    setSheetsForm({ sheetId: config.sheet_id, range: config.sheet_range });
                } else {
                    const { data: anyConfig } = await supabase
                        .from("sheet_configs")
                        .select("sheet_id")
                        .eq("type", "marks")
                        .eq("class_id", selectedClass)
                        .eq("section_id", selectedSection)
                        .limit(1)
                        .maybeSingle();
                    if (anyConfig) {
                        setSheetsForm({ sheetId: anyConfig.sheet_id, range: "" });
                    }
                }
            } catch {
                // Silently fail — non-critical
            }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedClass, selectedSection, selectedSubject, selectedExam, loaded]);

    /** Handle import from CSV/Sheets dialog */
    const handleImport = useCallback(
        (updates: Record<string, Partial<MarkEntryData>>) => {
            const newEntries = { ...markEntriesRef.current };
            for (const [studentId, fields] of Object.entries(updates)) {
                if (newEntries[studentId]) {
                    newEntries[studentId] = { ...newEntries[studentId], ...fields };
                }
            }
            markEntriesRef.current = newEntries;
            setMarkEntries({ ...newEntries });
            setHasUnsaved(true);
        },
        []
    );

    /** Toggle auto-sync with config persistence */
    const handleToggleAutoSync = useCallback(async () => {
        if (!autoSyncEnabled) {
            if (!sheetsForm.sheetId || !sheetsForm.range) {
                toast.error("Required for sync");
                return;
            }
            await supabase.from("sheet_configs").delete()
                .eq("type", "marks")
                .eq("class_id", selectedClass)
                .eq("section_id", selectedSection)
                .eq("subject_id", selectedSubject)
                .eq("exam_id", selectedExam);
            await supabase.from("sheet_configs").insert({
                type: "marks",
                class_id: selectedClass,
                section_id: selectedSection,
                subject_id: selectedSubject,
                exam_id: selectedExam,
                sheet_id: sheetsForm.sheetId,
                sheet_range: sheetsForm.range,
            });
            setAutoSyncEnabled(true);
            setImportDialogOpen(false);
            toast.success("Sync Started");
        } else {
            setAutoSyncEnabled(false);
            toast.info("Sync Stopped");
        }
    }, [autoSyncEnabled, sheetsForm, supabase, selectedClass, selectedSection, selectedSubject, selectedExam]);

    /** Handle exam change — also reset subject */
    const handleExamChange = useCallback((v: string) => {
        setSelectedExam(v);
        setSelectedSubject("");
    }, []);

    // ── Render ──
    return (
        <div className="space-y-6">
            {/* ── Page Header ── */}
            <PageHeader
                icon={PencilSimpleLine}
                title="Marks Entry"
                subtitle="Enter marks for each student."
                actions={
                    <div className="flex items-center gap-2 flex-wrap">
                        {saving && (
                            <span className="text-primary font-medium text-xs">(Saving…)</span>
                        )}
                        {!saving && hasUnsaved && (
                            <span className="text-amber-500 font-medium text-xs">(Unsaved)</span>
                        )}
                        {!saving && !hasUnsaved && loaded && students.length > 0 && (
                            <span className="text-emerald-500 font-medium text-xs">(Saved)</span>
                        )}
                        {lastSyncTime && (
                            <span className="text-muted-foreground text-xs font-medium">
                                Synced: {lastSyncTime.toLocaleTimeString()}
                            </span>
                        )}
                        <Button variant="outline" className="border-border/50 text-foreground font-semibold rounded-xl hover:bg-muted transition-all duration-200" onClick={() => setImportDialogOpen(true)} disabled={!loaded}>
                            <Upload size={16} strokeWidth={1.5} className="mr-2" />
                            Import
                        </Button>
                    </div>
                }
            />

            {/* ── Auto-sync banner ── */}
            <AutoSyncBanner
                enabled={autoSyncEnabled}
                intervalSec={syncIntervalSec}
                syncStatus={syncStatus}
                lastSyncTime={lastSyncTime}
                onStop={() => setAutoSyncEnabled(false)}
            />

            {/* ── Import Dialog ── */}
            <ImportDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                students={students}
                useDetailed={useDetailed}
                currentSubjectName={currentSubject?.name || ""}
                onImport={handleImport}
                sheetsForm={sheetsForm}
                onSheetsFormChange={setSheetsForm}
                autoSyncEnabled={autoSyncEnabled}
                onToggleAutoSync={handleToggleAutoSync}
                syncIntervalSec={syncIntervalSec}
                onSyncIntervalChange={setSyncIntervalSec}
                onFetchSheets={handleGoogleSheetsFetch}
                sheetsLoading={sheetsLoading}
            />

            {/* ── Selectors ── */}
            <div className="bg-card rounded-2xl border border-border/50 shadow-none p-5">
                <MarksSelectors
                classes={classes}
                sections={sections}
                subjects={filteredSubjects}
                exams={exams}
                academicYearOptions={academicYearOptions}
                selectedClass={selectedClass}
                selectedSection={selectedSection}
                selectedSubject={selectedSubject}
                selectedExam={selectedExam}
                academicYear={academicYear}
                onClassChange={setSelectedClass}
                onSectionChange={setSelectedSection}
                onSubjectChange={setSelectedSubject}
                onExamChange={handleExamChange}
                onAcademicYearChange={setAcademicYear}
                />
            </div>

            {/* ── Empty states / Loading ── */}
            {isFetchingMarks ? (
                <div className="bg-transparent rounded-2xl border-2 border-dashed border-border/50 shadow-none p-12 text-center flex flex-col items-center justify-center">
                    <ArrowsClockwise size={32} strokeWidth={1.5} className="text-muted-foreground/60 animate-spin mb-4" />
                    <h3 className="font-semibold text-lg text-foreground mb-4">Loading Marks...</h3>
                </div>
            ) : !loaded ? (
                <div className="bg-transparent rounded-2xl border-2 border-dashed border-border/50 p-12 text-center shadow-none">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 mx-auto text-muted-foreground/40">
                        <PencilSimpleLine size={32} strokeWidth={1.2} />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground mb-4">Select filters above</h3>
                </div>
            ) : loaded && students.length === 0 ? (
                <div className="bg-transparent rounded-2xl border-2 border-dashed border-border/50 p-12 text-center shadow-none">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 mx-auto text-muted-foreground/40">
                        <WarningCircle size={32} strokeWidth={1.2} />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground mb-4">No students found</h3>
                </div>
            ) : (
                loaded && students.length > 0 && currentSubject && (
                    <Card className="bg-card rounded-2xl border-border/50 shadow-none overflow-hidden">
                        <MarksToolbar
                            subjectName={currentSubject.name}
                            examName={currentExam?.name || ""}
                            fullMarks={effectiveFullMarks}
                            studentCount={students.length}
                            saving={saving}
                            hasErrors={false}
                            hasUnsaved={hasUnsaved}
                            onSave={handleSave}
                        />

                        <MarksTable
                            students={students}
                            markEntries={markEntries}
                            useDetailed={useDetailed}
                            showTheory={showTheory}
                            showMcq={showMcq}
                            showPractical={showPractical}
                            effectiveFullMarks={effectiveFullMarks}
                            maxTheory={maxTheory}
                            maxMcq={maxMcq}
                            maxPractical={maxPractical}
                            onCellCommit={handleCellCommit}
                        />

                        {/* Bottom bar */}
                        <div className="flex items-center justify-end px-5 py-3 border-t bg-muted/20">
                            <Button onClick={() => handleSave(false)} disabled={saving} size="sm" className={hasUnsaved ? "bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-semibold shadow-none h-8 px-4 text-xs transition-all duration-200 btn-press" : "border-border/50 text-foreground font-semibold rounded-xl hover:bg-muted transition-all duration-200 h-8 px-4 text-xs bg-transparent border"}>
                                <FloppyDisk size={14} strokeWidth={1.5} className="mr-1.5" />
                                {saving ? "Saving…" : "Save All"}
                            </Button>
                        </div>
                    </Card>
                )
            )}
        </div>
    );
}
