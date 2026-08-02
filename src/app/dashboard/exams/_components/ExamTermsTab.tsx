"use client";

import { useState } from "react";
import type { Exam } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 as Trash, ClipboardList as ClipboardText } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ExamTermsTabProps {
    exams: Exam[];
    loading: boolean;
    supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>;
    onRefresh: () => void;
}

const getTypeLabel = (type: string) =>
    type === "mct" ? "MCT" : type === "standalone" ? "Standalone" : "Semester";
const getTypeColor = () =>
    "bg-muted text-muted-foreground border-0 rounded-md font-medium uppercase tracking-wider text-[10px]";

export function ExamTermsTab({ exams, loading, supabase, onRefresh }: ExamTermsTabProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingExam, setEditingExam] = useState<Exam | null>(null);
    const [form, setForm] = useState({ name: "", exam_type: "mct" as string, term: 1 });
    const [confirmState, setConfirmState] = useState<{
        open: boolean; title: string; description: string; onConfirm: () => void;
    }>({ open: false, title: "", description: "", onConfirm: () => {} });

    const termGroups = [1, 2, 3].map((term) => ({
        term,
        mct: exams.find((e) => e.exam_type === "mct" && e.term === term),
        semester: exams.find((e) => e.exam_type === "semester" && e.term === term),
    })).filter((g) => g.mct || g.semester);
    const standaloneExams = exams.filter((e) => e.exam_type === "standalone");

    const handleSave = async () => {
        if (!form.name.trim()) return;
        try {
            const isStandalone = form.exam_type === "standalone";
            const payload = {
                name: form.name.trim(),
                exam_type: form.exam_type,
                term: isStandalone ? null : form.term,
            };
            if (editingExam) {
                const { error } = await supabase.from("exams").update(payload).eq("id", editingExam.id);
                if (error) throw error;
                toast.success("Exam updated");
            } else {
                const { error } = await supabase.from("exams").insert(payload);
                if (error) throw error;
                toast.success(`Exam "${form.name.trim()}" created`);
            }
            setForm({ name: "", exam_type: "mct", term: 1 });
            setEditingExam(null);
            setDialogOpen(false);
            onRefresh();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save exam");
        }
    };

    const handleDelete = (exam: Exam) => {
        setConfirmState({
            open: true,
            title: `Delete "${exam.name}"?`,
            description: "All linked marks will be permanently removed. This action cannot be undone.",
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from("exams").delete().eq("id", exam.id);
                    if (error) throw error;
                    toast.success(`Exam "${exam.name}" deleted`);
                    onRefresh();
                } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Failed to delete exam");
                }
                setConfirmState(prev => ({ ...prev, open: false }));
            },
        });
    };

    const openEdit = (exam: Exam) => {
        setEditingExam(exam);
        setForm({ name: exam.name, exam_type: exam.exam_type, term: exam.term ?? 1 });
        setDialogOpen(true);
    };

    const renderExamRow = (exam: Exam) => (
        <div key={exam.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 group hover:bg-muted/50 transition-colors duration-200">
            <div className="flex items-center gap-3">
                <Badge className={getTypeColor()}>{getTypeLabel(exam.exam_type)}</Badge>
                <span className="font-medium text-foreground">{exam.name}</span>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(exam)}>
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20" onClick={() => handleDelete(exam)}>
                    <Trash size={14} strokeWidth={1.5} />
                </Button>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button className="bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-semibold shadow-none transition-all duration-200 "
                    onClick={() => { setForm({ name: "", exam_type: "mct", term: 1 }); setEditingExam(null); setDialogOpen(true); }}
                >
                    <Plus size={16} strokeWidth={1.5} className="mr-2" />Add Exam
                </Button>
            </div>

            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingExam(null); if (o) setTimeout(() => document.getElementById("exam-name-input")?.focus(), 100); }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingExam ? "Edit Exam" : "Create Exam"}</DialogTitle></DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6 py-6">
                        <div className="space-y-2">
                            <Label>Exam Name</Label>
                            <Input id="exam-name-input" placeholder='e.g., "1st MCT", "1st Semester"' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={form.exam_type} onValueChange={(v) => setForm({ ...form, exam_type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mct">MCT</SelectItem>
                                        <SelectItem value="semester">Semester</SelectItem>
                                        <SelectItem value="standalone">Standalone</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {form.exam_type !== "standalone" && (
                                <div className="space-y-2">
                                    <Label>Term</Label>
                                    <Select value={(form.term || 1).toString()} onValueChange={(v) => setForm({ ...form, term: parseInt(v) })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">1st Term</SelectItem>
                                            <SelectItem value="2">2nd Term</SelectItem>
                                            <SelectItem value="3">3rd Term</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline" className="border-border text-foreground font-semibold rounded-xl hover:bg-muted transition-all duration-200">Cancel</Button></DialogClose>
                            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-none transition-all duration-200">{editingExam ? "Update" : "Create"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {exams.length === 0 && !loading ? (
                <div className="bg-transparent rounded-2xl border-2 border-dashed border-border p-12 text-center shadow-none">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 mx-auto text-muted-foreground/40">
                        <ClipboardText size={32} strokeWidth={1.2} />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground mb-4">No exams configured</h3>
                </div>
            ) : (
                <div className="space-y-4">
                    {termGroups.map(({ term, mct, semester }) => (
                        <Card key={term} className="bg-card rounded-2xl border-border shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Term {term}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {[mct, semester].filter(Boolean).map((exam) => exam && renderExamRow(exam))}
                                {!mct && <p className="text-xs text-muted-foreground italic pl-2">No MCT exam for this term</p>}
                                {!semester && <p className="text-xs text-muted-foreground italic pl-2">No Semester exam for this term</p>}
                            </CardContent>
                        </Card>
                    ))}
                    {termGroups.length === 0 && exams.length > 0 && (
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {exams.map((exam) => (
                                <Card key={exam.id} className="group bg-card border-border rounded-xl shadow-none transition-colors hover:bg-muted/50">
                                    <CardContent className="flex items-center justify-between py-4">
                                        <div className="flex items-center gap-3">
                                            <Badge className={getTypeColor()}>{getTypeLabel(exam.exam_type)}</Badge>
                                            <span className="font-medium text-foreground">{exam.name}</span>
                                            <Badge variant="outline" className="border-border text-muted-foreground rounded-md bg-muted/50 text-[10px] uppercase tracking-wider font-medium">Term {exam.term}</Badge>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(exam)}><Pencil className="h-3.5 w-3.5" strokeWidth={1.5} /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20" onClick={() => handleDelete(exam)}><Trash size={14} strokeWidth={1.5} /></Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                    {standaloneExams.length > 0 && (
                        <Card className="bg-card rounded-2xl border-border shadow-none">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Standalone Exams</CardTitle></CardHeader>
                            <CardContent className="space-y-2">
                                {standaloneExams.map((exam) => renderExamRow(exam))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            <ConfirmDialog
                open={confirmState.open}
                onOpenChange={(open) => setConfirmState(prev => ({ ...prev, open }))}
                title={confirmState.title}
                description={confirmState.description}
                confirmLabel="Delete"
                variant="destructive"
                onConfirm={confirmState.onConfirm}
            />
        </div>
    );
}
