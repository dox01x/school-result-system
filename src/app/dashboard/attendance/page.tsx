"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Class, Section } from "@/lib/database.types";
import { CLASS_COLUMNS, SECTION_COLUMNS } from "@/lib/supabase/select-columns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BarChart3 as ChartBar, Download as DownloadSimple, PenLine as PencilSimpleLine, CalendarCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AttendanceFilters, type AttendanceFilterState } from "./_components/attendance-filters";
import { AttendanceReportTab } from "./_components/attendance-report-tab";
import { AttendanceImportTab } from "./_components/attendance-import-tab";
import { AttendanceManualTab } from "./_components/attendance-manual-tab";

export default function AttendancePage() {
    const supabase = useMemo(() => createClient(), []);
    const now = new Date();

    // Shared filter state
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("report");
    const selectionLoadedRef = useRef(false);

    // Key to force refresh report tab when import/manual save completes
    const [reportRefreshKey, setReportRefreshKey] = useState(0);

    const filters: AttendanceFilterState = {
        selectedClass,
        selectedSection,
        year,
        month,
    };

    // Fetch classes
    const fetchClasses = useCallback(async () => {
        const { data, error } = await supabase
            .from("classes")
            .select(CLASS_COLUMNS)
            .order("numeric_value");
        if (error) throw error;
        setClasses(data || []);
        if (data && data.length > 0 && !selectionLoadedRef.current) {
            const savedClassId = localStorage.getItem("attendance:selectedClass");
            const preferred =
                savedClassId && data.some((c) => c.id === savedClassId)
                    ? savedClassId
                    : data[0].id;
            setSelectedClass(preferred);
            selectionLoadedRef.current = true;
        }
    }, [supabase]);

    // Fetch sections (Bug #4 fix: removed selectedSection from deps)
    const fetchSections = useCallback(async () => {
        if (!selectedClass) return;
        const { data, error } = await supabase
            .from("sections")
            .select(SECTION_COLUMNS)
            .eq("class_id", selectedClass)
            .order("name");
        if (error) throw error;
        setSections(data || []);
        if (data && data.length > 0) {
            const savedSectionId = localStorage.getItem(
                `attendance:selectedSection:${selectedClass}`
            );
            const preferred =
                savedSectionId && data.some((s) => s.id === savedSectionId)
                    ? savedSectionId
                    : data[0].id;
            setSelectedSection(preferred);
        } else {
            setSelectedSection("");
        }
    }, [supabase, selectedClass]);

    // Persist selections
    useEffect(() => {
        if (!selectedClass) return;
        localStorage.setItem("attendance:selectedClass", selectedClass);
    }, [selectedClass]);

    useEffect(() => {
        if (!selectedClass || !selectedSection) return;
        localStorage.setItem(
            `attendance:selectedSection:${selectedClass}`,
            selectedSection
        );
    }, [selectedClass, selectedSection]);

    // Load data
    useEffect(() => {
        void (async () => {
            try {
                await fetchClasses();
            } catch {
                toast.error("Failed to load classes");
            } finally {
                setLoading(false);
            }
        })();
    }, [fetchClasses]);

    useEffect(() => {
        if (!selectedClass) return;
        void (async () => {
            try {
                await fetchSections();
            } catch {
                toast.error("Failed to load sections");
            }
        })();
    }, [fetchSections, selectedClass]);

    // Class change handler
    const handleClassChange = useCallback((classId: string) => {
        setSelectedClass(classId);
        setSelectedSection("");
    }, []);

    // Trigger report refresh
    const handleDataChange = useCallback(() => {
        setReportRefreshKey((k) => k + 1);
    }, []);

    return (
        <div className="space-y-5">
            {/* Page Header */}
            <PageHeader
                icon={CalendarCheck}
                iconBg="bg-primary/10"
                iconColor="text-primary"
                title="Attendance"
                subtitle="View reports, import from Google Sheets, or enter attendance manually."
            />

            {loading ? (
                <div className="space-y-4">
                    <div className="h-12 rounded-xl bg-muted animate-pulse" />
                    <div className="h-64 rounded-xl bg-muted animate-pulse" />
                </div>
            ) : (
                <>
                    {/* Shared Filters */}
                    <div className="bg-card rounded-2xl border border-border/50 shadow-none p-5">
                        <AttendanceFilters
                            classes={classes}
                            sections={sections}
                            filters={filters}
                            onClassChange={handleClassChange}
                            onSectionChange={setSelectedSection}
                            onYearChange={setYear}
                            onMonthChange={setMonth}
                            loading={loading}
                        />
                    </div>

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsList className="bg-muted rounded-2xl p-1 h-auto flex-wrap border-0 shadow-none">
                            <TabsTrigger
                                value="report"
                                className="rounded-xl text-xs font-bold px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all"
                            >
                                <ChartBar size={14} strokeWidth={2} className="mr-1.5" />
                                Report
                            </TabsTrigger>
                            <TabsTrigger
                                value="import"
                                className="rounded-xl text-xs font-bold px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all"
                            >
                                <DownloadSimple size={14} strokeWidth={2} className="mr-1.5" />
                                Google Sheets Import
                            </TabsTrigger>
                            <TabsTrigger
                                value="manual"
                                className="rounded-xl text-xs font-bold px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all"
                            >
                                <PencilSimpleLine size={14} strokeWidth={2} className="mr-1.5" />
                                Manual Entry
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="report" className="mt-0">
                            <AttendanceReportTab
                                key={reportRefreshKey}
                                filters={filters}
                            />
                        </TabsContent>

                        <TabsContent value="import" className="mt-0">
                            <AttendanceImportTab
                                filters={filters}
                                onImportComplete={handleDataChange}
                            />
                        </TabsContent>

                        <TabsContent value="manual" className="mt-0">
                            <AttendanceManualTab
                                filters={filters}
                                onSaveComplete={handleDataChange}
                            />
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    );
}
