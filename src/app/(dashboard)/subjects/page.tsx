"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { CLASS_COLUMNS, SUBJECT_COLUMNS } from "@/lib/supabase/select-columns";
import type { Class, Subject } from "@/lib/database.types";
import { getCachedClasses, getCachedSubjects } from "@/lib/cache/master-data-cache";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
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
import { Plus, Pencil, Trash2 as Trash, BookOpen, Layers } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const defaultSubject = {
    name: "",
    full_marks: 100,
    pass_marks: 33,
    has_theory: true,
    has_mcq: false,
    has_practical: false,
    theory_marks: 100,
    mcq_marks: 0,
    practical_marks: 0,
    is_optional: false,
    group_name: "Common",
};

export default function SubjectsPage() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
    const [form, setForm] = useState(defaultSubject);
    const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; description: string; onConfirm: () => void }>({ open: false, title: "", description: "", onConfirm: () => {} });
    const supabase = useMemo(() => createClient(), []);

    const fetchClasses = useCallback(async () => {
        try {
            const classData = await getCachedClasses();
            setClasses(classData || []);
            if (classData && classData.length > 0 && !selectedClass) {
                setSelectedClass(classData[0].id);
            }
        } catch {
            toast.error("Failed to load classes");
        }
    }, [selectedClass]);

    const fetchSubjects = useCallback(async () => {
        if (!selectedClass) return;
        setLoading(true);
        try {
            const data = await getCachedSubjects(selectedClass);
            setSubjects(data || []);
        } catch {
            toast.error("Failed to load subjects");
        } finally {
            setLoading(false);
        }
    }, [selectedClass]);

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);

    useEffect(() => {
        fetchSubjects();
    }, [fetchSubjects]);

    const handleSave = async () => {
        if (!form.name.trim() || !selectedClass) return;

        // Validate mark totals
        const totalParts =
            (form.has_theory ? form.theory_marks : 0) +
            (form.has_mcq ? form.mcq_marks : 0) +
            (form.has_practical ? form.practical_marks : 0);

        if (totalParts !== form.full_marks) {
            toast.error(
                `Mark breakdown sum (${totalParts}) must equal full marks (${form.full_marks})`
            );
            return;
        }

        try {
            const payload = {
                class_id: selectedClass,
                name: form.name.trim(),
                full_marks: form.full_marks,
                pass_marks: form.pass_marks,
                has_theory: form.has_theory,
                has_mcq: form.has_mcq,
                has_practical: form.has_practical,
                theory_marks: form.has_theory ? form.theory_marks : 0,
                mcq_marks: form.has_mcq ? form.mcq_marks : 0,
                practical_marks: form.has_practical ? form.practical_marks : 0,
                is_optional: form.is_optional,
                group_name: form.group_name === "Common" ? null : form.group_name,
            };

            if (editingSubject) {
                const { error } = await supabase
                    .from("subjects")
                    .update(payload)
                    .eq("id", editingSubject.id);
                if (error) throw error;
                toast.success("Subject updated");
            } else {
                const { error } = await supabase.from("subjects").insert(payload);
                if (error) throw error;
                toast.success(`Subject "${form.name.trim()}" created`);
            }

            setForm(defaultSubject);
            setEditingSubject(null);
            setDialogOpen(false);
            fetchSubjects();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save subject");
        }
    };

    const handleDelete = (subject: Subject) => {
        setConfirmState({
            open: true,
            title: `Delete "${subject.name}"?`,
            description: "This will remove this subject and all associated student marks. This cannot be undone.",
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from("subjects").delete().eq("id", subject.id);
                    if (error) throw error;
                    toast.success(`Subject "${subject.name}" deleted`);
                    fetchSubjects();
                } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Failed to delete subject");
                }
                setConfirmState(prev => ({ ...prev, open: false }));
            },
        });
    };

    const openEdit = (s: Subject) => {
        setEditingSubject(s);
        setForm({
            name: s.name,
            full_marks: s.full_marks,
            pass_marks: s.pass_marks,
            has_theory: s.has_theory,
            has_mcq: s.has_mcq,
            has_practical: s.has_practical,
            theory_marks: s.theory_marks,
            mcq_marks: s.mcq_marks,
            practical_marks: s.practical_marks,
            is_optional: s.is_optional || false,
            group_name: s.group_name || "Common",
        });
        setDialogOpen(true);
    };

    const totalCalculated =
        (form.has_theory ? form.theory_marks : 0) +
        (form.has_mcq ? form.mcq_marks : 0) +
        (form.has_practical ? form.practical_marks : 0);

    return (<>
        <div className="space-y-6">
            <PageHeader
                icon={BookOpen}
                title="Subjects"
                subtitle="Configure subject curriculum, full marks, pass marks, and evaluation components."
                actions={
                    <Button
                        onClick={() => {
                            setEditingSubject(null);
                            setForm(defaultSubject);
                            setDialogOpen(true);
                        }}
                        disabled={!selectedClass}
                        className="gap-2 font-semibold shadow-xs"
                    >
                        <Plus size={16} strokeWidth={2} />
                        Add Subject
                    </Button>
                }
            />

            {/* Class Funnel Selector */}
            <div className="bg-card rounded-2xl border border-border/80 p-4 sm:p-5 shadow-xs flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-[240px]">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                        <Layers size={18} strokeWidth={2} />
                    </div>
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Select Class</p>
                        <p className="text-sm font-semibold text-foreground">
                            {classes.find(c => c.id === selectedClass)?.name || "Select a class"}
                        </p>
                    </div>
                </div>

                <div className="w-full sm:w-64">
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger className="w-full bg-background border-border">
                            <SelectValue placeholder="Choose class" />
                        </SelectTrigger>
                        <SelectContent>
                            {classes.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Subject Modal Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) { setEditingSubject(null); setForm(defaultSubject); }
                if (open) setTimeout(() => document.getElementById("subject-name")?.focus(), 100);
            }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingSubject ? "Edit Subject" : "Create New Subject"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="subject-name">Subject Name *</Label>
                                <Input
                                    id="subject-name"
                                    placeholder="e.g., Mathematics, General Science"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="group-name">Group / Stream</Label>
                                    <Select value={form.group_name} onValueChange={(v) => setForm({ ...form, group_name: v })}>
                                        <SelectTrigger id="group-name">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Common">Common (All Groups)</SelectItem>
                                            <SelectItem value="Science">Science</SelectItem>
                                            <SelectItem value="Arts">Arts</SelectItem>
                                            <SelectItem value="Commerce">Commerce</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="optional-switch">Subject Type</Label>
                                    <div className="flex h-9 items-center justify-between px-3 rounded-lg border border-input bg-transparent">
                                        <Label htmlFor="optional-switch" className="text-xs font-medium cursor-pointer text-foreground">
                                            Optional Subject
                                        </Label>
                                        <Switch
                                            id="optional-switch"
                                            checked={form.is_optional}
                                            onCheckedChange={(c) => setForm({ ...form, is_optional: c })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="full-marks">Full Marks *</Label>
                                    <Input
                                        id="full-marks"
                                        type="number"
                                        value={form.full_marks}
                                        onChange={(e) => setForm({ ...form, full_marks: parseInt(e.target.value) || 0 })}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="pass-marks">Pass Marks *</Label>
                                    <Input
                                        id="pass-marks"
                                        type="number"
                                        value={form.pass_marks}
                                        onChange={(e) => setForm({ ...form, pass_marks: parseInt(e.target.value) || 0 })}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Mark Breakdown */}
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <Label className="font-semibold text-xs text-foreground uppercase tracking-wider">Evaluation Breakdown</Label>
                                    <Badge
                                        variant={totalCalculated === form.full_marks ? "success" : "destructive"}
                                        className="tabular-nums text-[10.5px]"
                                    >
                                        Total: {totalCalculated} / {form.full_marks}
                                    </Badge>
                                </div>

                                <div className="space-y-2 rounded-xl border border-border/80 p-3 bg-muted/20">
                                    <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/60">
                                        <div className="flex items-center gap-2.5">
                                            <Switch
                                                checked={form.has_theory}
                                                onCheckedChange={(c) => setForm({ ...form, has_theory: c })}
                                            />
                                            <span className="text-xs font-medium text-foreground">Theory Written</span>
                                        </div>
                                        {form.has_theory && (
                                            <Input
                                                type="number"
                                                className="w-20 h-8 text-center text-xs font-bold"
                                                value={form.theory_marks}
                                                onChange={(e) => setForm({ ...form, theory_marks: parseInt(e.target.value) || 0 })}
                                            />
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/60">
                                        <div className="flex items-center gap-2.5">
                                            <Switch
                                                checked={form.has_mcq}
                                                onCheckedChange={(c) => setForm({ ...form, has_mcq: c })}
                                            />
                                            <span className="text-xs font-medium text-foreground">MCQ (Objective)</span>
                                        </div>
                                        {form.has_mcq && (
                                            <Input
                                                type="number"
                                                className="w-20 h-8 text-center text-xs font-bold"
                                                value={form.mcq_marks}
                                                onChange={(e) => setForm({ ...form, mcq_marks: parseInt(e.target.value) || 0 })}
                                            />
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/60">
                                        <div className="flex items-center gap-2.5">
                                            <Switch
                                                checked={form.has_practical}
                                                onCheckedChange={(c) => setForm({ ...form, has_practical: c })}
                                            />
                                            <span className="text-xs font-medium text-foreground">Practical / Lab</span>
                                        </div>
                                        {form.has_practical && (
                                            <Input
                                                type="number"
                                                className="w-20 h-8 text-center text-xs font-bold"
                                                value={form.practical_marks}
                                                onChange={(e) => setForm({ ...form, practical_marks: parseInt(e.target.value) || 0 })}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button type="submit">
                                {editingSubject ? "Update Subject" : "Create Subject"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Subject List Table */}
            {selectedClass && subjects.length > 0 && (
                <Card className="rounded-2xl overflow-hidden">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Subject Name</TableHead>
                                    <TableHead className="text-center">Full Marks</TableHead>
                                    <TableHead className="text-center">Pass Marks</TableHead>
                                    <TableHead className="text-center">Theory</TableHead>
                                    <TableHead className="text-center">MCQ</TableHead>
                                    <TableHead className="text-center">Practical</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subjects.map((subject) => (
                                    <TableRow key={subject.id}>
                                        <TableCell className="font-semibold text-foreground">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span>{subject.name}</span>
                                                {subject.group_name && (
                                                    <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                                                        {subject.group_name}
                                                    </Badge>
                                                )}
                                                {subject.is_optional && (
                                                    <Badge variant="outline" className="text-[10px] font-semibold bg-muted/40">
                                                        Optional
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-foreground tabular-nums">
                                            {subject.full_marks}
                                        </TableCell>
                                        <TableCell className="text-center font-medium text-muted-foreground tabular-nums">
                                            {subject.pass_marks}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {subject.has_theory ? (
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {subject.theory_marks}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground/50">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {subject.has_mcq ? (
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {subject.mcq_marks}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground/50">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {subject.has_practical ? (
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {subject.practical_marks}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground/50">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    onClick={() => openEdit(subject)}
                                                    aria-label={`Edit ${subject.name}`}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                    onClick={() => handleDelete(subject)}
                                                    aria-label={`Delete ${subject.name}`}
                                                >
                                                    <Trash size={14} strokeWidth={1.8} />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {selectedClass && subjects.length === 0 && !loading && (
                <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card shadow-xs">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mb-4 mx-auto">
                        <BookOpen size={28} strokeWidth={1.8} />
                    </div>
                    <h3 className="font-bold text-lg text-foreground mb-1">No subjects found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                        Add subjects for this class along with their marks and grading configuration.
                    </p>
                    <Button onClick={() => setDialogOpen(true)} className="gap-2">
                        <Plus size={16} /> Add First Subject
                    </Button>
                </div>
            )}
        </div>

        <ConfirmDialog
            open={confirmState.open}
            onOpenChange={(open) => setConfirmState(prev => ({ ...prev, open }))}
            title={confirmState.title}
            description={confirmState.description}
            confirmLabel="Delete"
            variant="destructive"
            onConfirm={confirmState.onConfirm}
        />
    </>);
}
