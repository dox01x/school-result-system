"use client";

import { useState } from "react";
import type { GradingRule } from "@/lib/database.types";
import { ALL_DEFAULT_GRADING } from "@/lib/constants/exam-defaults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 as Trash, Medal, RotateCcw as ArrowCounterClockwise } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface GradingTabProps {
    gradingRules: GradingRule[];
    loading: boolean;
    supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>;
    onRefresh: () => void;
}

export function GradingTab({ gradingRules, loading, supabase, onRefresh }: GradingTabProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingGrade, setEditingGrade] = useState<GradingRule | null>(null);
    const [form, setForm] = useState({ marks_category: 100, min_marks: 0, max_marks: 100, grade: "", grade_point: 0 });
    const [confirmState, setConfirmState] = useState<{
        open: boolean; title: string; description: string; onConfirm: () => void;
    }>({ open: false, title: "", description: "", onConfirm: () => {} });

    const handleSave = async () => {
        if (!form.grade.trim()) return;
        try {
            const payload = {
                marks_category: form.marks_category,
                min_marks: form.min_marks,
                max_marks: form.max_marks,
                grade: form.grade.trim(),
                grade_point: form.grade_point,
            };
            if (editingGrade) {
                const { error } = await supabase.from("grading_rules").update(payload).eq("id", editingGrade.id);
                if (error) throw error;
                toast.success("Grading rule updated");
            } else {
                const { error } = await supabase.from("grading_rules").insert(payload);
                if (error) throw error;
                toast.success("Grading rule added");
            }
            setForm({ marks_category: 100, min_marks: 0, max_marks: 100, grade: "", grade_point: 0 });
            setEditingGrade(null);
            setDialogOpen(false);
            onRefresh();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save grading rule");
        }
    };

    const handleDelete = async (rule: GradingRule) => {
        try {
            const { error } = await supabase.from("grading_rules").delete().eq("id", rule.id);
            if (error) throw error;
            toast.success("Grading rule deleted");
            onRefresh();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to delete");
        }
    };

    const handleReset = () => {
        setConfirmState({
            open: true,
            title: "Reset grading rules?",
            description: "All current grading rules will be replaced with Bangladesh standard defaults. This cannot be undone.",
            onConfirm: async () => {
                try {
                    await supabase.from("grading_rules").delete().neq("id", "00000000-0000-0000-0000-000000000000");
                    await supabase.from("grading_rules").insert(ALL_DEFAULT_GRADING);
                    toast.success("Grading rules reset to defaults");
                    onRefresh();
                } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Failed to reset");
                }
                setConfirmState(prev => ({ ...prev, open: false }));
            },
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end gap-2">
                <Button variant="outline" className="border-border text-foreground font-semibold rounded-xl hover:bg-muted transition-all duration-200" onClick={handleReset}>
                    <ArrowCounterClockwise size={16} strokeWidth={1.5} className="mr-2" />Reset Defaults
                </Button>
                <Button className="bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-semibold shadow-none transition-all duration-200 "
                    onClick={() => { setForm({ marks_category: 100, min_marks: 0, max_marks: 100, grade: "", grade_point: 0 }); setEditingGrade(null); setDialogOpen(true); }}
                >
                    <Plus size={16} strokeWidth={1.5} className="mr-2" />Add Rule
                </Button>
            </div>

            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingGrade(null); if (o) setTimeout(() => document.getElementById("grade-input")?.focus(), 100); }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingGrade ? "Edit Grading Rule" : "Add Grading Rule"}</DialogTitle></DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6 py-6">
                        <div className="space-y-2">
                            <Label>Full Marks Category</Label>
                            <Select value={String(form.marks_category)} onValueChange={(v) => setForm({ ...form, marks_category: parseInt(v) })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="100">100 Marks</SelectItem>
                                    <SelectItem value="75">75 Marks</SelectItem>
                                    <SelectItem value="50">50 Marks</SelectItem>
                                    <SelectItem value="25">25 Marks</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Min %</Label>
                                <Input type="number" value={form.min_marks} onChange={(e) => setForm({ ...form, min_marks: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Max %</Label>
                                <Input type="number" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: parseFloat(e.target.value) || 0 })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Grade</Label>
                                <Input placeholder="A+, A, B, ..." value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Grade Point</Label>
                                <Input type="number" step="0.25" value={form.grade_point} onChange={(e) => setForm({ ...form, grade_point: parseFloat(e.target.value) || 0 })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline" className="border-border text-foreground font-semibold rounded-xl hover:bg-muted transition-all duration-200">Cancel</Button></DialogClose>
                            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-none transition-all duration-200">{editingGrade ? "Update" : "Add"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {gradingRules.length === 0 && !loading ? (
                <Card className="bg-transparent rounded-2xl border-2 border-dashed border-border shadow-none">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Medal size={32} strokeWidth={1.2} className="text-muted-foreground/40 mb-3" />
                        <h3 className="font-semibold text-lg text-foreground mb-1">No grading rules</h3>
                        <p className="text-sm text-muted-foreground">Define grade ranges like 80-100 = A+ (5.0).</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {[100, 75, 50, 25].filter((cat) => gradingRules.some((r) => r.marks_category === cat)).map((cat) => (
                        <Card key={cat} className="bg-card rounded-2xl border-border shadow-none">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{cat} Marks Subjects</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="whitespace-nowrap">Range (%)</TableHead>
                                                <TableHead className="whitespace-nowrap">Grade</TableHead>
                                                <TableHead className="whitespace-nowrap">Grade Point</TableHead>
                                                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {gradingRules.filter((r) => r.marks_category === cat).map((rule) => (
                                                <TableRow key={rule.id}>
                                                    <TableCell>{rule.min_marks} - {rule.max_marks}</TableCell>
                                                    <TableCell><Badge variant="secondary" className="bg-muted text-muted-foreground border-0 rounded-md font-medium">{rule.grade}</Badge></TableCell>
                                                    <TableCell className="font-mono">{rule.grade_point}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingGrade(rule); setForm({ marks_category: rule.marks_category, min_marks: rule.min_marks, max_marks: rule.max_marks, grade: rule.grade, grade_point: rule.grade_point }); setDialogOpen(true); }}>
                                                                <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20" onClick={() => handleDelete(rule)}>
                                                                <Trash size={14} strokeWidth={1.5} />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
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
