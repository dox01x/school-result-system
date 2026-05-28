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
import { Settings, BookOpen, Award, Building2, Save, AlertCircle, CheckCircle2, SlidersHorizontal, ArrowUpRight, Bell } from "lucide-react";
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
    const [savingSchool, setSavingSchool] = useState(false);
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
        setSavingSchool(true);
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
            setSavingSchool(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                icon={Settings}
                iconBg="bg-slate-100"
                iconColor="text-slate-600"
                title="Settings"
                subtitle="School info, preferences, and grading."
            />

            {/* Connection Status Banner */}
            {dbConnected === false && (
                <Card className="border-destructive bg-destructive/5">
                    <CardContent className="flex items-start gap-3 py-4">
                        <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-destructive">Database not connected</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Update your <code className="bg-muted px-1 rounded">.env.local</code> file with your Supabase credentials, then run the <code className="bg-muted px-1 rounded">schema.sql</code> in your Supabase SQL Editor. Restart the dev server after updating.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {dbConnected === true && (
                <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <p className="text-sm font-medium text-emerald-600">Database connected successfully</p>
                </div>
            )}

            {shouldShowPromotionReminder && (
                <Card className="border-red-200 bg-red-50/60 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <CardContent className="py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-red-600" />
                            <p className="text-sm text-red-800 font-medium">
                                New calendar year ({promotionCurrentYear}) detected, but active academic year is still {schoolInfo.current_academic_year}. Please execute the Yearly Promotion.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button asChild size="sm" className="bg-red-600 hover:bg-red-700 text-white font-bold transition-colors">
                                <Link href="/dashboard/promotion">Promote Now</Link>
                            </Button>
                            <Button variant="outline" size="sm" onClick={dismissReminder} className="border-red-300 text-red-800 hover:bg-red-100">Dismiss</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Tabs defaultValue="school" className="space-y-4">
                <TabsList className="bg-slate-100/80 rounded-xl p-1 h-auto flex-wrap">
                    <TabsTrigger value="school" className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all gap-2">
                        <Building2 className="h-3.5 w-3.5" />
                        School Info
                    </TabsTrigger>
                    <TabsTrigger value="preferences" className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all gap-2">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Preferences
                    </TabsTrigger>
                    <TabsTrigger value="distribution" className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all gap-2">
                        <BookOpen className="h-3.5 w-3.5" />
                        Mark Distribution
                    </TabsTrigger>
                    <TabsTrigger value="grading" className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all gap-2">
                        <Award className="h-3.5 w-3.5" />
                        Grading Overview
                    </TabsTrigger>
                </TabsList>

                {/* ──── SCHOOL INFO TAB ──── */}
                <TabsContent value="school" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                School Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="schoolName">School Name *</Label>
                                    <Input
                                        id="schoolName"
                                        placeholder="e.g., ABC International School"
                                        value={schoolInfo.name}
                                        onChange={(e) => setSchoolInfo({ ...schoolInfo, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="principalName">Principal Name</Label>
                                    <Input
                                        id="principalName"
                                        placeholder="e.g., Mr. Rahman"
                                        value={schoolInfo.principal_name}
                                        onChange={(e) => setSchoolInfo({ ...schoolInfo, principal_name: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                <Textarea
                                    id="address"
                                    placeholder="Full school address"
                                    value={schoolInfo.address}
                                    onChange={(e) => setSchoolInfo({ ...schoolInfo, address: e.target.value })}
                                    rows={2}
                                />
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input
                                        id="phone"
                                        placeholder="+880 1XXX XXXXXX"
                                        value={schoolInfo.phone}
                                        onChange={(e) => setSchoolInfo({ ...schoolInfo, phone: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="info@school.edu"
                                        value={schoolInfo.email}
                                        onChange={(e) => setSchoolInfo({ ...schoolInfo, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="year">Established Year</Label>
                                    <Input
                                        id="year"
                                        placeholder="e.g., 1990"
                                        value={schoolInfo.established_year}
                                        onChange={(e) => setSchoolInfo({ ...schoolInfo, established_year: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>Calendar Year</Label>
                                    <Input
                                        value={currentYearStr}
                                        readOnly
                                        disabled
                                        className="bg-muted text-blue-700 font-semibold border-blue-200"
                                    />
                                    <p className="text-xs text-muted-foreground">Automatically detected clock year.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="academicYear">Active Academic Year</Label>
                                    <Input
                                        id="academicYear"
                                        value={schoolInfo.current_academic_year || "Not set"}
                                        readOnly
                                        disabled
                                        className={`bg-muted font-semibold ${Number(schoolInfo.current_academic_year || 0) < currentYear ? 'text-red-600 border-red-300' : 'text-emerald-600 border-emerald-300'}`}
                                    />
                                    <p className="text-xs text-muted-foreground">Updates only after yearly promotion.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="logo">Logo URL</Label>
                                    <Input
                                        id="logo"
                                        placeholder="https://example.com/logo.png"
                                        value={schoolInfo.logo_url}
                                        onChange={(e) => setSchoolInfo({ ...schoolInfo, logo_url: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Enter a public URL for your school logo. Default logo will be used if empty.
                                    </p>
                                </div>
                            </div>
                            <Button
                                onClick={handleSaveSchoolInfo}
                                disabled={savingSchool || dbConnected === false}
                                className="bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 btn-press"
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {savingSchool ? "Saving..." : "Save School Info"}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ──── PREFERENCES TAB ──── */}
                <TabsContent value="preferences" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                Setup Center
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                Manual setup pages are grouped here so you can configure everything from one place.
                            </p>
                            <div className="grid gap-3 md:grid-cols-2">
                                <Link
                                    href="/dashboard/attendance"
                                    className="rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                                >
                                    <p className="font-medium text-sm">Attendance Setup</p>
                                    <p className="text-xs text-muted-foreground mt-1">Sheet ID, range, import and auto-sync configuration.</p>
                                </Link>
                                <Link
                                    href="/dashboard/administration/routine/settings"
                                    className="rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                                >
                                    <p className="font-medium text-sm">Routine Settings</p>
                                    <p className="text-xs text-muted-foreground mt-1">Manage class periods and default routine configuration.</p>
                                </Link>
                                <Link
                                    href="/dashboard/finance/fee-structure"
                                    className="rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                                >
                                    <p className="font-medium text-sm">Fee Structure Setup</p>
                                    <p className="text-xs text-muted-foreground mt-1">Set up tuition and fee heads for each class.</p>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4" />
                                Marks Entry Preferences
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Detailed Marks Entry</Label>
                                    <p className="text-sm text-muted-foreground">
                                        When enabled, marks entry will show separate fields for Theory, MCQ, and Practical.
                                        When disabled, only a single marks field is shown per student (recommended).
                                    </p>
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
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4" />
                                Gender-Based Section Splitting
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5 flex-1 mr-4">
                                    <Label className="text-base">Start From Class</Label>
                                    <p className="text-sm text-muted-foreground">
                                        When students are promoted to this class or higher, they will be automatically split into <strong>Boys Section</strong> and <strong>Girls Section</strong> based on their gender. Classes below this threshold will follow normal promotion rules.
                                    </p>
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
                                    <SelectTrigger className="w-[180px]">
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

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <ArrowUpRight className="h-4 w-4" />
                                Yearly Promotion
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Promote students to the next academic year with a safe step-by-step process. Includes preview, confirmation, and undo capability.
                            </p>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs text-muted-foreground">Current Academic Year</p>
                                    <p className="font-semibold">{schoolInfo.current_academic_year || "Not set"}</p>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs text-muted-foreground">Last Promotion</p>
                                    <p className="font-semibold">{schoolInfo.last_promotion_year || "Never"}</p>
                                </div>
                            </div>
                            <Link
                                href="/dashboard/promotion"
                                className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all duration-200 btn-press px-5 py-2.5 text-sm"
                            >
                                <ArrowUpRight className="h-4 w-4" />
                                Go to Promotion Page
                            </Link>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ──── MARK DISTRIBUTION TAB ──── */}
                <TabsContent value="distribution" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select class" /></SelectTrigger>
                            <SelectContent>
                                {classes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" asChild>
                            <Link href="/dashboard/subjects">Edit Subjects</Link>
                        </Button>
                    </div>

                    {subjects.length === 0 ? (
                        <Card className="border-dashed border-2">
                            <CardContent className="py-12 text-center">
                                <BookOpen className="h-10 w-10 text-muted-foreground mb-3 mx-auto" />
                                <h3 className="font-semibold mb-1">No subjects configured</h3>
                                <p className="text-sm text-muted-foreground">Add subjects to see mark distribution.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Subject</TableHead>
                                            <TableHead className="text-center">Full Marks</TableHead>
                                            <TableHead className="text-center">Pass Marks</TableHead>
                                            <TableHead className="text-center">Theory</TableHead>
                                            <TableHead className="text-center">MCQ</TableHead>
                                            <TableHead className="text-center">Practical</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {subjects.map((s) => (
                                            <TableRow key={s.id}>
                                                <TableCell className="font-medium">{s.name}</TableCell>
                                                <TableCell className="text-center">{s.full_marks}</TableCell>
                                                <TableCell className="text-center">{s.pass_marks}</TableCell>
                                                <TableCell className="text-center">
                                                    {s.has_theory ? <Badge variant="secondary">{s.theory_marks}</Badge> : <span className="text-muted-foreground">-</span>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {s.has_mcq ? <Badge variant="secondary">{s.mcq_marks}</Badge> : <span className="text-muted-foreground">-</span>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {s.has_practical ? <Badge variant="secondary">{s.practical_marks}</Badge> : <span className="text-muted-foreground">-</span>}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ──── GRADING TAB ──── */}
                <TabsContent value="grading" className="space-y-4">
                    <div className="flex justify-end">
                        <Button variant="outline" asChild>
                            <Link href="/dashboard/exams">Edit Grading Rules</Link>
                        </Button>
                    </div>

                    {gradingRules.length === 0 ? (
                        <Card className="border-dashed border-2">
                            <CardContent className="py-12 text-center">
                                <Award className="h-10 w-10 text-muted-foreground mb-3 mx-auto" />
                                <h3 className="font-semibold mb-1">No grading rules</h3>
                                <p className="text-sm text-muted-foreground">Configure grading in Exams → Grading System.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Percentage Range</TableHead>
                                            <TableHead className="text-center">Grade</TableHead>
                                            <TableHead className="text-center">Grade Point</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {gradingRules.map((rule) => (
                                            <TableRow key={rule.id}>
                                                <TableCell>{rule.min_marks}% — {rule.max_marks}%</TableCell>
                                                <TableCell className="text-center"><Badge>{rule.grade}</Badge></TableCell>
                                                <TableCell className="text-center font-mono">{rule.grade_point}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
