"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { SCHOOL_INFO_COLUMNS, PROMOTION_LOG_COLUMNS } from "@/lib/supabase/select-columns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import {
    ArrowUpCircle, CheckCircle2, AlertTriangle, Users, Archive,
    GraduationCap, ArrowRight, Undo2, Download, Shield, Loader2,
    ChevronRight, Info, Clock
} from "lucide-react";

/* ────── Types ────── */
type Transition = {
    from_class: string; from_section: string;
    to_class: string; to_section?: string;
    to_section_boys?: string; to_section_girls?: string;
    gender_split: boolean; total_students: number;
    boys_count?: number; girls_count?: number; unset_count?: number;
};
type ExamineeStudent = { id: string; name: string; roll: string; student_id: string | null; section_name: string };
type PreviewData = {
    current_academic_year: string; next_academic_year: string;
    already_promoted: boolean; transitions: Transition[];
    examinee_to_archive: ExamineeStudent[];
    total_promote: number; total_new_examinee: number; total_archive: number;
};
type PromotionResult = {
    promoted: number; archived: number; new_examinee: number;
    academic_year_from: string; academic_year_to: string; promotion_log_id: string;
};

const STEPS = ["Configure", "Preview", "Confirm", "Report"];

export default function PromotionPage() {
    const supabase = useMemo(() => createClient(), []);
    const [step, setStep] = useState(0);
    const [schoolInfo, setSchoolInfo] = useState<{
        current_academic_year: string; last_promotion_year: string;
    }>({ current_academic_year: "", last_promotion_year: "" });
    const [targetYear, setTargetYear] = useState("");
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [promoting, setPromoting] = useState(false);
    const [result, setResult] = useState<PromotionResult | null>(null);
    const [undoing, setUndoing] = useState(false);
    const [undone, setUndone] = useState(false);
    const [recentLogs, setRecentLogs] = useState<Array<{
        id: string; academic_year_from: string; academic_year_to: string;
        promoted_count: number; archived_count: number; examinee_count: number;
        performed_at: string; is_undone: boolean;
    }>>([]);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.from("school_info").select(SCHOOL_INFO_COLUMNS).limit(1).maybeSingle();
            if (data) {
                const yr = data.current_academic_year || String(new Date().getFullYear());
                setSchoolInfo({ current_academic_year: yr, last_promotion_year: data.last_promotion_year || "" });
                setTargetYear(String(Number(yr) + 1));
            }
            const { data: logs } = await supabase.from("promotion_logs").select(PROMOTION_LOG_COLUMNS).order("performed_at", { ascending: false }).limit(5);
            if (logs) setRecentLogs(logs as typeof recentLogs);
        })();
    }, []);

    const currentYear = new Date().getFullYear();

    const loadPreview = useCallback(async () => {
        setLoadingPreview(true);
        try {
            const res = await fetch("/api/promotion/preview");
            const json = await res.json();
            if (!res.ok || !json.success) { toast.error(json.error || "Preview failed"); return; }
            setPreview(json.data as PreviewData);
            setStep(1);
        } catch { toast.error("Failed to load preview"); } finally { setLoadingPreview(false); }
    }, []);

    const executePromotion = useCallback(async () => {
        setPromoting(true);
        try {
            const res = await fetch("/api/promotion/yearly", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target_academic_year: targetYear }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) { toast.error(json.error || "Promotion failed"); return; }
            setResult(json.data as PromotionResult);
            setStep(3);
            toast.success("Promotion completed successfully!");
        } catch { toast.error("Promotion failed"); } finally { setPromoting(false); }
    }, [targetYear]);

    const handleUndo = useCallback(async (logId: string) => {
        setUndoing(true);
        try {
            const res = await fetch("/api/promotion/undo", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ promotion_log_id: logId }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) { toast.error(json.error || "Undo failed"); return; }
            setUndone(true);
            toast.success(`Promotion undone. Restored to year ${json.data.academic_year_restored}`);
        } catch { toast.error("Undo failed"); } finally { setUndoing(false); }
    }, []);

    const downloadCSV = useCallback(() => {
        if (!preview) return;
        const rows = [["From Class", "From Section", "To Class", "To Section", "Students"]];
        for (const t of preview.transitions) {
            rows.push([t.from_class, t.from_section, t.to_class, t.to_section || (t.gender_split ? "Boys/Girls" : ""), String(t.total_students)]);
        }
        const csv = rows.map(r => r.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `promotion_report_${targetYear}.csv`; a.click();
        URL.revokeObjectURL(url);
    }, [preview, targetYear]);

    return (
        <div className="space-y-6">
            <PageHeader icon={ArrowUpCircle} iconBg="bg-indigo-50" iconColor="text-indigo-600" title="Yearly Promotion" subtitle="Promote students to the next academic year safely." />

            {/* Stepper */}
            <div className="flex items-center gap-0 overflow-x-auto pb-2">
                {STEPS.map((s, i) => (
                    <div key={s} className="flex items-center">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${i === step ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : i < step ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${i === step ? "bg-white/20 text-white" : i < step ? "bg-emerald-200 text-emerald-700" : "bg-slate-200 text-slate-400"}`}>
                                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                            </div>
                            <span className="hidden sm:inline">{s}</span>
                        </div>
                        {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300 mx-1 shrink-0" />}
                    </div>
                ))}
            </div>

            {/* ─── STEP 0: Configure ─── */}
            {step === 0 && (
                <div className="space-y-4">
                    {currentYear.toString() !== schoolInfo.current_academic_year && schoolInfo.current_academic_year && (
                        <Card className="border-amber-200 bg-amber-50/60">
                            <CardContent className="py-4 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-800">Promotion Required</p>
                                    <p className="text-xs text-amber-700 mt-1">Current calendar year ({currentYear}) does not match the academic year ({schoolInfo.current_academic_year}). Please run the promotion.</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {currentYear.toString() === schoolInfo.current_academic_year && schoolInfo.current_academic_year && (
                        <Card className="border-emerald-200 bg-emerald-50/60">
                            <CardContent className="py-4 flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-emerald-800">No Promotion Needed</p>
                                    <p className="text-xs text-emerald-700 mt-1">Calendar year and academic year are in sync ({currentYear}). Everything is up to date.</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Info className="h-4 w-4" />Current Status</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-xl border p-4 bg-slate-50/50">
                                    <p className="text-xs text-muted-foreground font-medium">Current Year</p>
                                    <p className="text-lg font-bold text-slate-800 mt-1">{currentYear}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">Calendar year</p>
                                </div>
                                <div className={`rounded-xl border p-4 ${currentYear.toString() === schoolInfo.current_academic_year ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'}`}>
                                    <p className={`text-xs font-medium ${currentYear.toString() === schoolInfo.current_academic_year ? 'text-emerald-600' : 'text-amber-600'}`}>Academic Year</p>
                                    <p className="text-lg font-bold text-slate-800 mt-1">{schoolInfo.current_academic_year || "Not set"}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">Active academic year in system</p>
                                </div>
                                <div className="rounded-xl border p-4 bg-indigo-50/50 border-indigo-200">
                                    <p className="text-xs text-indigo-600 font-medium">Next Year</p>
                                    <p className="text-lg font-bold text-slate-800 mt-1">{targetYear}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">Year after promotion</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {recentLogs.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Recent Promotions</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {recentLogs.map((log) => (
                                        <div key={log.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                                            <div className="flex items-center gap-3">
                                                <Badge variant={log.is_undone ? "secondary" : "default"} className={log.is_undone ? "" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"}>
                                                    {log.is_undone ? "Undone" : "Active"}
                                                </Badge>
                                                <span>{log.academic_year_from} → {log.academic_year_to}</span>
                                                <span className="text-muted-foreground">({log.promoted_count} promoted)</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">{new Date(log.performed_at).toLocaleDateString()}</span>
                                                {!log.is_undone && (new Date().getTime() - new Date(log.performed_at).getTime()) < 86400000 && (
                                                    <Button variant="outline" size="sm" onClick={() => handleUndo(log.id)} disabled={undoing} className="text-xs h-7">
                                                        <Undo2 className="h-3 w-3 mr-1" />{undoing ? "..." : "Undo"}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Button onClick={loadPreview} disabled={loadingPreview || (currentYear.toString() === schoolInfo.current_academic_year) || !targetYear} className="bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all duration-200 btn-press h-11 px-6">
                        {loadingPreview ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading Preview...</> : <>Preview Promotion <ArrowRight className="h-4 w-4 ml-2" /></>}
                    </Button>
                </div>
            )}

            {/* ─── STEP 1: Preview ─── */}
            {step === 1 && preview && (
                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-4">
                        {[
                            { label: "Total Students", value: preview.total_promote + preview.total_new_examinee, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
                            { label: "Promoted", value: preview.total_promote, icon: ArrowUpCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
                            { label: "New Examinee", value: preview.total_new_examinee, icon: GraduationCap, color: "text-amber-600", bg: "bg-amber-50" },
                            { label: "To Archive", value: preview.total_archive, icon: Archive, color: "text-slate-600", bg: "bg-slate-100" },
                        ].map((s) => (
                            <Card key={s.label}>
                                <CardContent className="py-4 flex items-center gap-3">
                                    <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                                        <s.icon className={`h-5 w-5 ${s.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{s.value}</p>
                                        <p className="text-xs text-muted-foreground">{s.label}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card>
                        <CardHeader><CardTitle className="text-base">Class Transitions</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {preview.transitions.map((t, i) => (
                                    <div key={i} className="flex items-center justify-between rounded-lg border p-3 hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Badge variant="secondary">{t.from_class} {t.from_section}</Badge>
                                            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                                            {t.gender_split ? (
                                                <div className="flex gap-1">
                                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Boys ({t.boys_count})</Badge>
                                                    <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-100">Girls ({t.girls_count})</Badge>
                                                    {(t.unset_count ?? 0) > 0 && <Badge variant="secondary">Unset ({t.unset_count})</Badge>}
                                                </div>
                                            ) : (
                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{t.to_class} {t.to_section}</Badge>
                                            )}
                                        </div>
                                        <span className="text-sm font-semibold text-slate-600">{t.total_students} students</span>
                                    </div>
                                ))}
                                {preview.transitions.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-6">No eligible students found for promotion.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {preview.examinee_to_archive.length > 0 && (
                        <Card className="border-amber-200">
                            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Archive className="h-4 w-4 text-amber-600" />Examinee Students to Archive ({preview.examinee_to_archive.length})</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                    {preview.examinee_to_archive.slice(0, 12).map((s) => (
                                        <div key={s.id} className="rounded-lg border p-2 text-sm">
                                            <span className="font-medium">{s.name}</span>
                                            <span className="text-muted-foreground ml-2">Roll {s.roll}</span>
                                        </div>
                                    ))}
                                    {preview.examinee_to_archive.length > 12 && (
                                        <div className="rounded-lg border p-2 text-sm text-muted-foreground text-center">
                                            +{preview.examinee_to_archive.length - 12} more...
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setStep(0)}>← Back</Button>
                        <Button onClick={() => setStep(2)} disabled={preview.transitions.length === 0} className="bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 btn-press">
                            Continue to Confirm <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </div>
            )}

            {/* ─── STEP 2: Confirm ─── */}
            {step === 2 && preview && (
                <div className="space-y-4">
                    <Card className="border-red-200 bg-red-50/30">
                        <CardHeader><CardTitle className="text-base flex items-center gap-2 text-red-700"><Shield className="h-4 w-4" />Final Confirmation Required</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-xl bg-white border p-4 space-y-2 text-sm">
                                <p><strong>Academic Year:</strong> {preview.current_academic_year} → {preview.next_academic_year}</p>
                                <p><strong>Students to promote:</strong> {preview.total_promote + preview.total_new_examinee}</p>
                                <p><strong>New Examinee:</strong> {preview.total_new_examinee}</p>
                                <p><strong>Students to archive:</strong> {preview.total_archive}</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm text-red-700 font-semibold">Type &quot;PROMOTE&quot; to confirm this action:</p>
                                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value.toUpperCase())} placeholder="Type PROMOTE here" className="max-w-xs font-mono text-lg tracking-wider border-red-200 focus-visible:ring-red-300" />
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => { setStep(1); setConfirmText(""); }}>← Back</Button>
                                <Button onClick={executePromotion} disabled={confirmText !== "PROMOTE" || promoting} className="bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 btn-press">
                                    {promoting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Promoting...</> : <>Execute Promotion</>}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ─── STEP 3: Report ─── */}
            {step === 3 && result && (
                <div className="space-y-4">
                    <Card className="border-emerald-200 bg-emerald-50/30">
                        <CardContent className="py-6 text-center space-y-3">
                            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                            </div>
                            <h2 className="text-xl font-bold text-emerald-800">Promotion Completed Successfully!</h2>
                            <p className="text-sm text-emerald-700">{result.academic_year_from} → {result.academic_year_to}</p>
                        </CardContent>
                    </Card>

                    <div className="grid gap-3 md:grid-cols-3">
                        <Card><CardContent className="py-4 text-center"><p className="text-3xl font-bold text-indigo-600">{result.promoted}</p><p className="text-xs text-muted-foreground mt-1">Students Promoted</p></CardContent></Card>
                        <Card><CardContent className="py-4 text-center"><p className="text-3xl font-bold text-amber-600">{result.new_examinee}</p><p className="text-xs text-muted-foreground mt-1">New Examinee</p></CardContent></Card>
                        <Card><CardContent className="py-4 text-center"><p className="text-3xl font-bold text-slate-600">{result.archived}</p><p className="text-xs text-muted-foreground mt-1">Archived</p></CardContent></Card>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={downloadCSV}><Download className="h-4 w-4 mr-2" />Download CSV</Button>
                        {!undone && (
                            <Button variant="outline" onClick={() => handleUndo(result.promotion_log_id)} disabled={undoing} className="text-red-600 border-red-200 hover:bg-red-50">
                                <Undo2 className="h-4 w-4 mr-2" />{undoing ? "Undoing..." : "Undo Promotion (24h)"}
                            </Button>
                        )}
                        {undone && <Badge className="bg-amber-100 text-amber-700 h-9 px-4">Promotion Undone</Badge>}
                    </div>
                </div>
            )}
        </div>
    );
}
