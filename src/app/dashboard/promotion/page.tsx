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
import { ArrowUpCircle as ArrowCircleUp, CheckCircle2 as CheckCircle, AlertTriangle as Warning, Users, Archive, GraduationCap, ArrowRight, RotateCcw as ArrowCounterClockwise, Download as DownloadSimple, Shield, Loader2 as SpinnerGap, ChevronRight as CaretRight, Info, Clock } from "lucide-react";

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
            <PageHeader icon={ArrowCircleUp} iconBg="bg-primary/10" iconColor="text-primary" title="Yearly Promotion" subtitle="Promote students to the next academic year safely." />

            {/* Stepper */}
            <div className="flex items-center gap-0 overflow-x-auto pb-2">
                {STEPS.map((s, i) => (
                    <div key={s} className="flex items-center">
                        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${i === step ? "bg-primary text-primary-foreground shadow-none" : i < step ? "bg-muted text-foreground" : "bg-transparent text-muted-foreground"}`}>
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-black ${i === step ? "bg-white/20 text-primary-foreground" : i < step ? "bg-muted/80 text-foreground" : "bg-muted text-muted-foreground"}`}>
                                {i < step ? <CheckCircle size={16} strokeWidth={2.5} /> : i + 1}
                            </div>
                            <span className="hidden sm:inline">{s}</span>
                        </div>
                        {i < STEPS.length - 1 && <CaretRight size={16} strokeWidth={2} className="text-muted-foreground/40 mx-1 shrink-0" />}
                    </div>
                ))}
            </div>

            {/* ─── STEP 0: Configure ─── */}
            {step === 0 && (
                <div className="space-y-4">
                    {currentYear.toString() !== schoolInfo.current_academic_year && schoolInfo.current_academic_year && (
                        <Card className="border border-red-200 bg-red-50/50 shadow-none rounded-2xl">
                            <CardContent className="py-4 flex items-start gap-3">
                                <Warning size={20} strokeWidth={2} className="text-red-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-red-900 tracking-tight">Promotion Required</p>
                                    <p className="text-xs text-red-700/80 mt-1 font-medium">Current calendar year ({currentYear}) does not match the academic year ({schoolInfo.current_academic_year}). Please run the promotion.</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {currentYear.toString() === schoolInfo.current_academic_year && schoolInfo.current_academic_year && (
                        <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-xl border border-border/50 inline-flex">
                            <CheckCircle size={16} strokeWidth={2} className="text-muted-foreground" />
                            <p className="text-xs font-bold text-muted-foreground tracking-tight">Calendar year and active academic year are in sync ({currentYear}). Everything is up to date.</p>
                        </div>
                    )}

                    <Card className="border border-border/50 shadow-none bg-card rounded-2xl">
                        <CardHeader><CardTitle className="text-base flex items-center gap-2 font-bold tracking-tight text-foreground"><Info size={18} strokeWidth={2} className="text-muted-foreground" />Current Status</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-xl border-0 p-4 bg-muted">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Calendar Year</p>
                                    <p className="text-lg font-black text-foreground">{currentYear}</p>
                                    <p className="text-[11px] font-bold text-muted-foreground/60 mt-0.5">Calendar year</p>
                                </div>
                                <div className={`rounded-xl border-0 p-4 ${currentYear.toString() === schoolInfo.current_academic_year ? 'bg-muted' : 'bg-red-50/50'}`}>
                                    <p className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${currentYear.toString() === schoolInfo.current_academic_year ? 'text-muted-foreground' : 'text-red-600'}`}>Active Academic Year</p>
                                    <p className={`text-lg font-black ${currentYear.toString() === schoolInfo.current_academic_year ? 'text-foreground' : 'text-red-900'}`}>{schoolInfo.current_academic_year || "Not set"}</p>
                                    <p className={`text-[11px] font-bold mt-0.5 ${currentYear.toString() === schoolInfo.current_academic_year ? 'text-muted-foreground/60' : 'text-red-700/80'}`}>Active academic year in system</p>
                                </div>
                                <div className="rounded-xl border-0 p-4 bg-muted">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Next Year</p>
                                    <p className="text-lg font-black text-foreground">{targetYear}</p>
                                    <p className="text-[11px] font-bold text-muted-foreground/60 mt-0.5">Year after promotion</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {recentLogs.length > 0 && (
                        <Card className="border border-border/50 shadow-none bg-card rounded-2xl">
                            <CardHeader><CardTitle className="text-base flex items-center gap-2 font-bold tracking-tight text-foreground"><Clock size={18} strokeWidth={2} className="text-muted-foreground" />Recent Promotions</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {recentLogs.map((log) => (
                                        <div key={log.id} className="flex items-center justify-between rounded-xl border-0 bg-muted p-3 text-sm">
                                            <div className="flex items-center gap-3">
                                                <Badge className={`border-0 shadow-none font-bold px-2 py-0.5 ${log.is_undone ? "bg-muted/80 text-muted-foreground" : "bg-muted text-foreground hover:bg-muted/80"}`}>
                                                    {log.is_undone ? "Undone" : "Active"}
                                                </Badge>
                                                <span className="font-bold text-foreground">{log.academic_year_from} → {log.academic_year_to}</span>
                                                <span className="font-bold text-muted-foreground">({log.promoted_count} promoted)</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-muted-foreground/60">{new Date(log.performed_at).toLocaleDateString()}</span>
                                                {!log.is_undone && (new Date().getTime() - new Date(log.performed_at).getTime()) < 86400000 && (
                                                    <Button variant="outline" size="sm" onClick={() => handleUndo(log.id)} disabled={undoing} className="h-8 rounded-lg font-bold border-0 bg-card shadow-sm hover:bg-muted/50 text-foreground">
                                                        <ArrowCounterClockwise size={14} strokeWidth={2} className="mr-1" />{undoing ? "..." : "Undo"}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Button onClick={loadPreview} disabled={loadingPreview || (currentYear.toString() === schoolInfo.current_academic_year) || !targetYear} className="bg-primary text-primary-foreground font-bold rounded-xl shadow-none hover:bg-primary/90 h-11 px-6 transition-colors">
                        {loadingPreview ? <><SpinnerGap size={16} strokeWidth={2} className="mr-2 animate-spin" />Loading Preview...</> : <>Preview Promotion <ArrowRight size={16} strokeWidth={2} className="ml-2" /></>}
                    </Button>
                </div>
            )}

            {/* ─── STEP 1: Preview ─── */}
            {step === 1 && preview && (
                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-4">
                        {[
                            { label: "Total Students", value: preview.total_promote + preview.total_new_examinee, icon: Users, color: "text-foreground", bg: "bg-muted" },
                            { label: "Promoted", value: preview.total_promote, icon: ArrowCircleUp, color: "text-muted-foreground", bg: "bg-muted" },
                            { label: "New Examinee", value: preview.total_new_examinee, icon: GraduationCap, color: "text-muted-foreground", bg: "bg-muted" },
                            { label: "To Archive", value: preview.total_archive, icon: Archive, color: "text-muted-foreground", bg: "bg-muted/50" },
                        ].map((s) => (
                            <Card key={s.label} className="border border-border/50 shadow-none bg-card rounded-2xl">
                                <CardContent className="py-4 flex items-center gap-3">
                                    <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                                        <s.icon size={20} strokeWidth={2} className={`${s.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-foreground">{s.value}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{s.label}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card className="border border-border/50 shadow-none bg-card rounded-2xl">
                        <CardHeader><CardTitle className="text-base font-bold tracking-tight text-foreground">Class Transitions</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {preview.transitions.map((t, i) => (
                                    <div key={i} className="flex items-center justify-between rounded-xl border-0 bg-muted p-3 hover:bg-muted/80 transition-colors">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Badge className="bg-white text-foreground border-0 shadow-sm font-bold">{t.from_class} {t.from_section}</Badge>
                                            <ArrowRight size={14} strokeWidth={2} className="text-muted-foreground/60" />
                                            {t.gender_split ? (
                                                <div className="flex gap-1">
                                                    <Badge className="bg-white text-foreground border-0 shadow-sm font-bold">Boys ({t.boys_count})</Badge>
                                                    <Badge className="bg-white text-foreground border-0 shadow-sm font-bold">Girls ({t.girls_count})</Badge>
                                                    {(t.unset_count ?? 0) > 0 && <Badge className="bg-red-50 text-red-700 border-0 font-bold">Unset ({t.unset_count})</Badge>}
                                                </div>
                                            ) : (
                                                <Badge className="bg-primary text-primary-foreground hover:bg-primary/90 border-0 font-bold shadow-none">{t.to_class} {t.to_section}</Badge>
                                            )}
                                        </div>
                                        <span className="text-sm font-bold text-muted-foreground">{t.total_students} students</span>
                                    </div>
                                ))}
                                {preview.transitions.length === 0 && (
                                    <p className="text-sm font-bold text-muted-foreground/60 text-center py-6">No eligible students found for promotion.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {preview.examinee_to_archive.length > 0 && (
                        <Card className="border border-border/50 shadow-none bg-card rounded-2xl">
                            <CardHeader><CardTitle className="text-base flex items-center gap-2 font-bold tracking-tight text-foreground"><Archive size={18} strokeWidth={2} className="text-muted-foreground" />Examinee Students to Archive ({preview.examinee_to_archive.length})</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                    {preview.examinee_to_archive.slice(0, 12).map((s) => (
                                        <div key={s.id} className="rounded-xl bg-muted border-0 p-3 text-sm">
                                            <span className="font-bold text-foreground">{s.name}</span>
                                            <span className="font-bold text-muted-foreground ml-2">Roll {s.roll}</span>
                                        </div>
                                    ))}
                                    {preview.examinee_to_archive.length > 12 && (
                                        <div className="rounded-xl border-2 border-dashed border-border/50 p-3 text-sm font-bold text-muted-foreground/60 text-center flex items-center justify-center">
                                            +{preview.examinee_to_archive.length - 12} more...
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setStep(0)} className="h-11 rounded-xl font-bold border-border/50 shadow-none hover:bg-muted/50 text-foreground px-6">← Back</Button>
                        <Button onClick={() => setStep(2)} disabled={preview.transitions.length === 0} className="bg-primary text-primary-foreground font-bold rounded-xl shadow-none hover:bg-primary/90 h-11 px-6">
                            Continue to Confirm <ArrowRight size={16} strokeWidth={2} className="ml-2" />
                        </Button>
                    </div>
                </div>
            )}

            {/* ─── STEP 2: Confirm ─── */}
            {step === 2 && preview && (
                <div className="space-y-4">
                    <Card className="border border-red-200 bg-red-50/50 shadow-none rounded-2xl">
                        <CardHeader><CardTitle className="text-base flex items-center gap-2 text-red-700 font-bold tracking-tight"><Shield size={18} strokeWidth={2} className="text-red-500" />Final Confirmation Required</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-xl bg-white border border-red-100 p-4 space-y-2 text-sm font-medium text-red-900 shadow-sm">
                                <p><strong className="font-bold text-red-950">Active Academic Year:</strong> {preview.current_academic_year} → {preview.next_academic_year}</p>
                                <p><strong className="font-bold text-red-950">Students to promote:</strong> {preview.total_promote + preview.total_new_examinee}</p>
                                <p><strong className="font-bold text-red-950">New Examinee:</strong> {preview.total_new_examinee}</p>
                                <p><strong className="font-bold text-red-950">Students to archive:</strong> {preview.total_archive}</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm text-red-800 font-bold">Type &quot;PROMOTE&quot; to confirm this action:</p>
                                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value.toUpperCase())} placeholder="Type PROMOTE here" className="max-w-xs font-mono font-bold tracking-widest border-0 bg-white h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-red-300 shadow-sm text-foreground" />
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => { setStep(1); setConfirmText(""); }} className="h-11 rounded-xl font-bold border-0 bg-white text-red-800 hover:bg-red-100 shadow-none px-6">← Back</Button>
                                <Button onClick={executePromotion} disabled={confirmText !== "PROMOTE" || promoting} className="bg-red-600 text-white font-bold rounded-xl shadow-none hover:bg-red-700 h-11 px-6">
                                    {promoting ? <><SpinnerGap size={16} strokeWidth={2} className="mr-2 animate-spin" />Promoting...</> : <>Execute Promotion</>}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ─── STEP 3: Report ─── */}
            {step === 3 && result && (
                <div className="space-y-4">
                    <Card className="border border-emerald-200 bg-emerald-50/50 shadow-none rounded-2xl">
                        <CardContent className="py-8 text-center space-y-4">
                            <div className="h-20 w-20 rounded-full bg-emerald-100/80 flex items-center justify-center mx-auto mb-2">
                                <CheckCircle size={40} strokeWidth={2} className="text-emerald-600" />
                            </div>
                            <h2 className="text-2xl font-black text-emerald-900 tracking-tight">Promotion Completed Successfully!</h2>
                            <p className="text-sm font-bold text-emerald-700/80">{result.academic_year_from} → {result.academic_year_to}</p>
                        </CardContent>
                    </Card>

                    <div className="grid gap-3 md:grid-cols-3">
                        <Card className="border border-border/50 shadow-none bg-card rounded-2xl"><CardContent className="py-6 text-center"><p className="text-4xl font-black text-foreground">{result.promoted}</p><p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-2">Students Promoted</p></CardContent></Card>
                        <Card className="border border-border/50 shadow-none bg-card rounded-2xl"><CardContent className="py-6 text-center"><p className="text-4xl font-black text-foreground">{result.new_examinee}</p><p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-2">New Examinee</p></CardContent></Card>
                        <Card className="border border-border/50 shadow-none bg-card rounded-2xl"><CardContent className="py-6 text-center"><p className="text-4xl font-black text-muted-foreground/60">{result.archived}</p><p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground/60 mt-2">Archived</p></CardContent></Card>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={downloadCSV} className="h-11 rounded-xl font-bold border border-border/50 shadow-none hover:bg-muted/50 text-foreground px-6"><DownloadSimple size={18} strokeWidth={2} className="mr-2" />Download CSV</Button>
                        {!undone && (
                            <Button variant="outline" onClick={() => handleUndo(result.promotion_log_id)} disabled={undoing} className="h-11 rounded-xl font-bold border border-red-200 bg-red-50/50 text-red-700 hover:bg-red-100 shadow-none px-6">
                                <ArrowCounterClockwise size={18} strokeWidth={2} className="mr-2" />{undoing ? "Undoing..." : "Undo Promotion (24h)"}
                            </Button>
                        )}
                        {undone && <Badge className="bg-red-100 text-red-800 font-bold border-0 shadow-none h-11 px-6 rounded-xl text-sm flex items-center">Promotion Undone</Badge>}
                    </div>
                </div>
            )}
        </div>
    );
}
