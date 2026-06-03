"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePromotionReminder } from "@/lib/hooks/usePromotionReminder";
import { createClient } from "@/lib/supabase/client";
import {
    CLASS_COLUMNS,
    GRADING_RULE_COLUMNS,
    SCHOOL_INFO_COLUMNS,
    SUBJECT_COLUMNS,
} from "@/lib/supabase/select-columns";
import type { Class, Subject, GradingRule } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Settings as Gear, BookOpen, Trophy, Building2 as Buildings, Save as FloppyDisk, AlertCircle as WarningCircle, CheckCircle2 as CheckCircle, SlidersHorizontal, ArrowUpRight, Bell } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { toast } from "sonner";

export default function SettingsPage() {
    const currentYear = new Date().getFullYear();
    const currentYearStr = String(currentYear);
    const [classes, setClasses] = useState<Class[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [gradingRules, setGradingRules] = useState<GradingRule[]>([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [schoolInfo, setSchoolInfo] = useState({
        id: "",
        name: "",
        address: "",
        phone: "",
        email: "",
        logo_url: "",
        principal_name: "",
        established_year: "",
        current_academic_year: currentYearStr,
        last_promotion_year: "",
    });
    const [savingSchoolInfo, setSavingSchoolInfo] = useState(false);
    const [detailedMarks, setDetailedMarks] = useState(false);
    const [genderSplitClassId, setGenderSplitClassId] = useState<string>("_none");
    const [savingPrefs, setSavingPrefs] = useState(false);
    const [dbConnected, setDbConnected] = useState<boolean | null>(null);
    const supabase = useMemo(() => createClient(), []);

    // Check DB connection + fetch school info
    useEffect(() => {
        (async () => {
            try {
                // Test connection
                const { error: testError } = await supabase.from("school_info").select("id", { count: "exact", head: true });
                if (testError) {
                    setDbConnected(false);
                    return;
                }
                setDbConnected(true);

                // Fetch school info
                const { data: schoolData } = await supabase.from("school_info").select(SCHOOL_INFO_COLUMNS).limit(1).maybeSingle();
                if (schoolData) {
                    const resolvedAcademicYear =
                        schoolData.current_academic_year || schoolData.last_promotion_year || currentYearStr;
                    setSchoolInfo({
                        id: schoolData.id,
                        name: schoolData.name || "",
                        address: schoolData.address || "",
                        phone: schoolData.phone || "",
                        email: schoolData.email || "",
                        logo_url: schoolData.logo_url || "",
                        principal_name: schoolData.principal_name || "",
                        established_year: schoolData.established_year || "",
                        current_academic_year: resolvedAcademicYear,
                        last_promotion_year: schoolData.last_promotion_year || "",
                    });
                    // Backfill missing academic year so future loads are consistent.
                    if (!schoolData.current_academic_year) {
                        await supabase
                            .from("school_info")
                            .update({ current_academic_year: resolvedAcademicYear })
                            .eq("id", schoolData.id);
                    }
                }

                // Load detailed_marks preference
                if (schoolData?.detailed_marks !== undefined) setDetailedMarks(schoolData.detailed_marks);
                if (schoolData?.gender_split_class_id) setGenderSplitClassId(schoolData.gender_split_class_id);

                // Fetch other data
                const [cRes, gRes] = await Promise.all([
                    supabase.from("classes").select(CLASS_COLUMNS).order("numeric_value"),
                    supabase.from("grading_rules").select(GRADING_RULE_COLUMNS).order("min_marks", { ascending: false }),
                ]);
                setClasses(cRes.data || []);
                setGradingRules(gRes.data || []);
                if (cRes.data && cRes.data.length > 0) setSelectedClass(cRes.data[0].id);
            } catch (err) {
                console.error("Settings data fetch failed:", err);
                setDbConnected(false);
            }
        })();
    }, [supabase, currentYearStr]);

    useEffect(() => {
        if (!selectedClass) return;
        (async () => {
            const { data } = await supabase
                .from("subjects")
                .select(SUBJECT_COLUMNS)
                .eq("class_id", selectedClass)
                .order("name");
            setSubjects(data || []);
        })();
    }, [selectedClass, supabase]);

    const { shouldShow: shouldShowPromotionReminder, currentYear: promotionCurrentYear, dismiss: dismissReminder } =
        usePromotionReminder(schoolInfo.current_academic_year);



    const handleSaveSchoolInfo = async () => {
        setSavingSchoolInfo(true);
        try {
            if (schoolInfo.id) {
                // Update existing — also initialize last_promotion_year if missing
                const updatePayload: Record<string, string> = {
                    name: schoolInfo.name,
                    address: schoolInfo.address,
                    phone: schoolInfo.phone,
                    email: schoolInfo.email,
                    logo_url: schoolInfo.logo_url,
                    principal_name: schoolInfo.principal_name,
                    established_year: schoolInfo.established_year,
                    current_academic_year: schoolInfo.current_academic_year,
                };
                // Fetch current last_promotion_year to check if it needs initializing
                const { data: current } = await supabase.from("school_info").select("last_promotion_year").eq("id", schoolInfo.id).single();
                if (!current?.last_promotion_year) {
                    updatePayload.last_promotion_year = new Date().getFullYear().toString();
                }
                if (!schoolInfo.current_academic_year) {
                    updatePayload.current_academic_year = schoolInfo.last_promotion_year || currentYearStr;
                }
                const { error } = await supabase
                    .from("school_info")
                    .update(updatePayload)
                    .eq("id", schoolInfo.id);
                if (error) throw error;
            } else {
                // Insert new singleton row — initialize last_promotion_year to current year
                const { data, error } = await supabase
                    .from("school_info")
                    .insert({
                        name: schoolInfo.name,
                        address: schoolInfo.address,
                        phone: schoolInfo.phone,
                        email: schoolInfo.email,
                        logo_url: schoolInfo.logo_url,
                        principal_name: schoolInfo.principal_name,
                        established_year: schoolInfo.established_year,
                        current_academic_year: schoolInfo.current_academic_year || currentYearStr,
                        last_promotion_year: new Date().getFullYear().toString(),
                    })
                    .select()
                    .single();
                if (error) throw error;
                if (data) setSchoolInfo((prev) => ({ ...prev, id: data.id }));
            }
            toast.success("School information saved successfully");
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save school information");
        } finally {
            setSavingSchoolInfo(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                icon={Gear}
                iconBg="bg-primary/10"
                iconColor="text-primary"
                title="Settings"
                subtitle="School info, preferences, and grading."
            />

            {/* Connection Status Banner */}
            {dbConnected === false && (
                <Card className="border border-red-200 bg-red-50/50 shadow-none rounded-2xl">
                    <CardContent className="flex items-start gap-3 py-4">
                        <WarningCircle size={20} strokeWidth={1.5} className="text-red-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-red-900 tracking-tight">Database not connected</p>
                            <p className="text-xs text-red-700/80 mt-1 font-medium">
                                Update your <code className="bg-red-100 px-1 rounded">.env.local</code> file with your Supabase credentials, then run the <code className="bg-red-100 px-1 rounded">schema.sql</code> in your Supabase SQL Editor. Restart the dev server after updating.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {dbConnected === true && (
                <div className="flex items-center gap-2 mb-2 bg-muted/50 px-3 py-2 rounded-xl border border-border/50 inline-flex">
                    <CheckCircle size={16} strokeWidth={2} className="text-muted-foreground" />
                    <p className="text-xs font-bold text-muted-foreground tracking-tight">Database connected successfully</p>
                </div>
            )}

            {shouldShowPromotionReminder && (
                <Card className="border border-red-200 bg-red-50/50 shadow-none rounded-2xl animate-in fade-in slide-in-from-top-2">
                    <CardContent className="py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Bell size={20} strokeWidth={1.5} className="text-red-500" />
                            <p className="text-sm text-red-900 font-bold tracking-tight">
                                New calendar year ({promotionCurrentYear}) detected, but active academic year is still {schoolInfo.current_academic_year}. Please execute the Yearly Promotion.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button asChild size="sm" className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-none transition-colors">
                                <Link href="/dashboard/promotion">Promote Now</Link>
                            </Button>
                            <Button variant="outline" size="sm" onClick={dismissReminder} className="border-0 bg-red-100 text-red-800 hover:bg-red-200 font-bold rounded-xl shadow-none">Dismiss</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Tabs defaultValue="school" className="space-y-6">
                <TabsList className="bg-muted rounded-2xl p-1 h-auto flex-wrap border-0 shadow-none">
                    <TabsTrigger value="school" className="rounded-xl text-xs font-bold px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all gap-2">
                        <Buildings size={14} strokeWidth={2} />
                        School Info
                    </TabsTrigger>
                    <TabsTrigger value="preferences" className="rounded-xl text-xs font-bold px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all gap-2">
                        <SlidersHorizontal size={14} strokeWidth={2} />
                        Preferences
                    </TabsTrigger>

                </TabsList>

                {/* ──── SCHOOL INFO TAB ──── */}
                <TabsContent value="school" className="space-y-4">
                    <Card className="border border-border/50 shadow-none bg-card rounded-2xl">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2 font-bold tracking-tight text-foreground">
                                <Buildings size={18} strokeWidth={2} className="text-muted-foreground" />
                                School Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="schoolName" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">School Name *</Label>
                                    <Input
                                        id="schoolName"
                                        placeholder="e.g., ABC International School"
                                        value={schoolInfo.name}
                                        onChange={(e) => setSchoolInfo({ ...schoolInfo, name: e.target.value })}
                                        className="bg-muted border-0 shadow-none h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-ring/30 font-semibold text-foreground"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="principalName" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Principal Name</Label>
                                    <Input
                                        id="principalName"
                                        placeholder="e.g., Mr. Rahman"
                                        value={schoolInfo.principal_name}
                                        onChange={(e) => setSchoolInfo({ ...schoolInfo, principal_name: e.target.value })}
                                        className="bg-muted border-0 shadow-none h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-ring/30 font-semibold text-foreground"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="address" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Address</Label>
                                <Textarea
                                    id="address"
                                    placeholder="Full school address"
                                    value={schoolInfo.address}
                                    onChange={(e) => setSchoolInfo({ ...schoolInfo, address: e.target.value })}
                                    rows={2}
                                    className="bg-muted border-0 shadow-none rounded-xl focus-visible:ring-1 focus-visible:ring-ring/30 font-semibold text-foreground"
                                />
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="phone" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Phone</Label>
                                    <Input
                                        id="phone"
                                        placeholder="+880 1XXX XXXXXX"
                                        value={schoolInfo.phone}
                                        onChange={(e) => setSchoolInfo({ ...schoolInfo, phone: e.target.value })}
                                        className="bg-muted border-0 shadow-none h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-ring/30 font-semibold text-foreground"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="email" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="info@school.edu"
                                        value={schoolInfo.email}
                                        onChange={(e) => setSchoolInfo({ ...schoolInfo, email: e.target.value })}
                                        className="bg-muted border-0 shadow-none h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-ring/30 font-semibold text-foreground"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="year" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Established Year</Label>
                                    <Input
                                        id="year"
                                        placeholder="e.g., 1990"
                                        value={schoolInfo.established_year}
                                        onChange={(e) => setSchoolInfo({ ...schoolInfo, established_year: e.target.value })}
                                        className="bg-muted border-0 shadow-none h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-ring/30 font-semibold text-foreground"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Calendar Year</Label>
                                    <Input
                                        value={currentYearStr}
                                        readOnly
                                        disabled
                                        className="bg-muted/50 border border-border/50 text-blue-700 font-bold h-11 rounded-xl shadow-none opacity-100"
                                    />
                                    <p className="text-[10px] font-bold text-muted-foreground/60 mt-1 px-1">Automatically detected clock year.</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="academicYear" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Active Academic Year</Label>
                                    <Input
                                        id="academicYear"
                                        value={schoolInfo.current_academic_year || "Not set"}
                                        readOnly
                                        disabled
                                        className={`font-bold h-11 rounded-xl border border-border/50 shadow-none opacity-100 ${Number(schoolInfo.current_academic_year || 0) < currentYear ? 'bg-red-50 text-red-700 border-red-200' : 'bg-muted text-foreground border-0'}`}
                                    />
                                    <p className="text-[10px] font-bold text-muted-foreground/60 mt-1 px-1">Updates only after yearly promotion.</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="logo" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Logo URL</Label>
                                    <Input
                                        id="logo"
                                        placeholder="https://example.com/logo.png"
                                        value={schoolInfo.logo_url}
                                        onChange={(e) => setSchoolInfo({ ...schoolInfo, logo_url: e.target.value })}
                                        className="bg-muted border-0 shadow-none h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-ring/30 font-semibold text-foreground"
                                    />
                                    <p className="text-[10px] font-bold text-muted-foreground/60 mt-1 px-1">
                                        Enter a public URL for your school logo. Default logo will be used if empty.
                                    </p>
                                </div>
                            </div>
                            <Button
                                onClick={handleSaveSchoolInfo}
                                disabled={savingSchoolInfo || dbConnected === false}
                                className="bg-primary text-primary-foreground font-semibold h-11 rounded-xl shadow-none hover:bg-primary/90 transition-colors mt-2 btn-press"
                            >
                                <FloppyDisk size={18} strokeWidth={1.5} className="mr-2" />
                                {savingSchoolInfo ? "Saving..." : "Save School Info"}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ──── PREFERENCES TAB ──── */}
                <TabsContent value="preferences" className="space-y-4">
                    <Card className="border border-border/50 shadow-none bg-card rounded-2xl">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2 font-bold tracking-tight text-foreground">
                                <Gear size={18} strokeWidth={2} className="text-muted-foreground" />
                                Setup Center
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                                <Link
                                    href="/dashboard/attendance"
                                    className="rounded-xl border-0 bg-muted p-4 hover:bg-muted/80 transition-colors"
                                >
                                    <p className="font-bold text-sm text-foreground">Attendance Setup</p>
                                </Link>
                                <Link
                                    href="/dashboard/administration/routine/settings"
                                    className="rounded-xl border-0 bg-muted p-4 hover:bg-muted/80 transition-colors"
                                >
                                    <p className="font-bold text-sm text-foreground">Routine Settings</p>
                                </Link>
                                <Link
                                    href="/dashboard/finance/fee-structure"
                                    className="rounded-xl border-0 bg-muted p-4 hover:bg-muted/80 transition-colors"
                                >
                                    <p className="font-bold text-sm text-foreground">Fee Structure Setup</p>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border border-border/50 shadow-none bg-card rounded-2xl">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2 font-bold tracking-tight text-foreground">
                                <SlidersHorizontal size={18} strokeWidth={2} className="text-muted-foreground" />
                                Marks Entry Preferences
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between rounded-xl border-0 bg-muted p-5">
                                <div className="space-y-1">
                                    <Label className="text-sm font-bold text-foreground">Detailed Marks Entry</Label>
                                </div>
                                <Switch checked={detailedMarks} onCheckedChange={async (checked) => {
                                    setDetailedMarks(checked);
                                    setSavingPrefs(true);
                                    try {
                                        if (schoolInfo.id) {
                                            await supabase.from("school_info").update({ detailed_marks: checked }).eq("id", schoolInfo.id);
                                        } else {
                                            const { data } = await supabase.from("school_info").insert({ detailed_marks: checked }).select().single();
                                            if (data) setSchoolInfo((prev) => ({ ...prev, id: data.id }));
                                        }
                                        toast.success(checked ? "Detailed marks enabled" : "Simple marks mode enabled");
                                    } catch (err) {
                                        console.error("Failed to save detailed marks preference:", err);
                                        toast.error("Failed to save preference");
                                    } finally {
                                        setSavingPrefs(false);
                                    }
                                }} />
                            </div>

                        </CardContent>
                    </Card>

                    {/* Gender-Based Promotion Setting */}
                    <Card className="border border-border/50 shadow-none bg-card rounded-2xl">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2 font-bold tracking-tight text-foreground">
                                <SlidersHorizontal size={18} strokeWidth={2} className="text-muted-foreground" />
                                Gender-Based Section Splitting
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between rounded-xl bg-muted border-0 p-5">
                                <div className="space-y-1 flex-1 mr-4">
                                    <Label className="text-sm font-bold text-foreground">Start From Class</Label>
                                </div>
                                <Select value={genderSplitClassId} onValueChange={async (v) => {
                                    const newVal = v === "_none" ? null : v;
                                    setGenderSplitClassId(v);
                                    setSavingPrefs(true);
                                    try {
                                        if (schoolInfo.id) {
                                            await supabase.from("school_info").update({ gender_split_class_id: newVal }).eq("id", schoolInfo.id);
                                        } else {
                                            const { data } = await supabase.from("school_info").insert({ gender_split_class_id: newVal }).select().single();
                                            if (data) setSchoolInfo((prev) => ({ ...prev, id: data.id }));
                                        }
                                        toast.success(newVal ? `Gender-based splitting will start from ${classes.find(c => c.id === newVal)?.name || 'selected class'}` : "Gender-based splitting disabled");
                                    } catch (err) {
                                        console.error("Failed to save gender split preference:", err);
                                        toast.error("Failed to save preference");
                                    } finally {
                                        setSavingPrefs(false);
                                    }
                                }}>
                                    <SelectTrigger className="w-[180px] bg-card border-0 shadow-sm h-11 rounded-xl font-bold text-foreground focus:ring-1 focus:ring-ring/30">
                                        <SelectValue placeholder="Disabled" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">Disabled</SelectItem>
                                        {classes.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                        </CardContent>
                    </Card>


                </TabsContent>


            </Tabs>
        </div>
    );
}
