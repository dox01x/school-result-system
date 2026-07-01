"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { CLASS_COLUMNS, SUBJECT_COLUMNS } from "@/lib/supabase/select-columns";
import type { Class, Subject } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2 as Trash, BookOpen as BookOpenText } from "lucide-react";
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
    const supabase = useMemo(() => createClient() as any, []);

    const fetchClasses = useCallback(async () => {
        try {
            const { data: classData, error } = await supabase
                .from("classes")
                .select(CLASS_COLUMNS)
                .order("numeric_value");
            if (error) throw error;
            setClasses(classData || []);
            if (classData && classData.length > 0 && !selectedClass) {
                setSelectedClass(classData[0].id);
            }
        } catch {
            toast.error("Failed to load classes");
        }
    }, [supabase]);

    const fetchSubjects = useCallback(async () => {
        if (!selectedClass) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("subjects")
                .select(SUBJECT_COLUMNS)
                .eq("class_id", selectedClass)
                .order("name");
            if (error) throw error;
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
                `Mark breakdown (${totalParts}) must equal full marks (${form.full_marks})`
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
            resetForm();
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
            description: "This subject and all linked marks will be permanently removed.",
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from("subjects")
                        .delete()
                        .eq("id", subject.id);
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

    const resetForm = () => {
        setForm(defaultSubject);
        setEditingSubject(null);
    };

    const openEdit = (subject: Subject) => {
        setEditingSubject(subject);
        setForm({
            name: subject.name,
            full_marks: subject.full_marks,
            pass_marks: subject.pass_marks,
            has_theory: subject.has_theory,
            has_mcq: subject.has_mcq,
            has_practical: subject.has_practical,
            theory_marks: subject.theory_marks,
            mcq_marks: subject.mcq_marks,
            practical_marks: subject.practical_marks,
            is_optional: subject.is_optional || false,
            group_name: subject.group_name || "Common",
        });
        setDialogOpen(true);
    };

    return (<>
        <div className="space-y-6">
            <PageHeader
                icon={BookOpenText}
                title="Subjects"
                subtitle="Manage subjects per class."
                actions={
                    <Button
                        onClick={() => { resetForm(); setDialogOpen(true); }}
                        disabled={!selectedClass}
                        className="bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-semibold shadow-none transition-all duration-200 btn-press"
                    >
                        <Plus size={16} strokeWidth={1.5} className="mr-2" />
                        Add Subject
                    </Button>
                }
            />

            {/* Funnels Card */}
            {classes.length > 0 && (
                <div className="bg-card rounded-2xl border border-border/50 p-5">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex-1 min-w-[140px]">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Class</p>
                            <Select value={selectedClass} onValueChange={setSelectedClass}>
                                <SelectTrigger className="w-full h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                                    <SelectValue placeholder="Select class" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border/50 shadow-md">
                                    {classes.map((cls) => (
                                        <SelectItem key={cls.id} value={cls.id} className="rounded-lg">
                                            {cls.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            )}

            {/* Subject Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
                if (open) setTimeout(() => document.getElementById("subject-name-input")?.focus(), 100);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingSubject ? "Edit Subject" : "Add New Subject"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label>Subject Name</Label>
                            <Input
                                id="subject-name-input"
                                placeholder="e.g., Mathematics, English"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("subject-full-marks")?.focus(); }}}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={form.is_optional}
                                onCheckedChange={(checked) => setForm({ ...form, is_optional: checked })}
                            />
                            <Label className="cursor-pointer">Is Optional Subject?</Label>
                        </div>
                        <div className="space-y-2">
                            <Label>Group</Label>
                            <div className="flex w-full gap-2 pt-1">
                                {[{ value: "Common", label: "Common (All)" }, { value: "Science", label: "Science" }, { value: "Arts", label: "Arts" }, { value: "Commerce", label: "Commerce" }].map((opt) => (
                                    <label key={opt.value} className={`flex-1 flex items-center justify-center px-3 py-2.5 rounded-xl border cursor-pointer transition-colors text-center ${form.group_name === opt.value ? "border-primary bg-primary text-primary-foreground font-medium shadow-none" : "border-border/50 bg-muted/50 hover:bg-muted text-muted-foreground font-medium"}`}>
                                        <input type="radio" name="subject-group" value={opt.value} checked={form.group_name === opt.value} onChange={() => setForm({ ...form, group_name: opt.value })} className="sr-only" />
                                        <span className="text-xs sm:text-sm whitespace-nowrap">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Full Marks</Label>
                                <Input
                                    id="subject-full-marks"
                                    type="number"
                                    value={form.full_marks}
                                    onChange={(e) =>
                                        setForm({ ...form, full_marks: parseInt(e.target.value) || 0 })
                                    }
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("subject-pass-marks")?.focus(); }}}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Pass Marks</Label>
                                <Input
                                    id="subject-pass-marks"
                                    type="number"
                                    value={form.pass_marks}
                                    onChange={(e) =>
                                        setForm({ ...form, pass_marks: parseInt(e.target.value) || 0 })
                                    }
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); }}}
                                />
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <p className="text-sm font-medium text-foreground">Mark Distribution</p>
                            <div className="space-y-3 rounded-xl border border-border/50/60 bg-muted/50/50 p-4">
                                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card p-4">
                                    <div className="flex items-center gap-3">
                                        <Switch
                                            checked={form.has_theory}
                                            onCheckedChange={(checked) =>
                                                setForm({ ...form, has_theory: checked })
                                            }
                                        />
                                        <Label className="cursor-pointer font-medium">Theory</Label>
                                    </div>
                                    {form.has_theory && (
                                        <Input
                                            type="number"
                                            className="w-24 text-center transition-all focus:w-28"
                                            value={form.theory_marks}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    theory_marks: parseInt(e.target.value) || 0,
                                                })
                                            }
                                        />
                                    )}
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card p-4">
                                    <div className="flex items-center gap-3">
                                        <Switch
                                            checked={form.has_mcq}
                                            onCheckedChange={(checked) =>
                                                setForm({ ...form, has_mcq: checked })
                                            }
                                        />
                                        <Label className="cursor-pointer font-medium">MCQ</Label>
                                    </div>
                                    {form.has_mcq && (
                                        <Input
                                            type="number"
                                            className="w-24 text-center transition-all focus:w-28"
                                            value={form.mcq_marks}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    mcq_marks: parseInt(e.target.value) || 0,
                                                })
                                            }
                                        />
                                    )}
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card p-4">
                                    <div className="flex items-center gap-3">
                                        <Switch
                                            checked={form.has_practical}
                                            onCheckedChange={(checked) =>
                                                setForm({ ...form, has_practical: checked })
                                            }
                                        />
                                        <Label className="cursor-pointer font-medium">Practical</Label>
                                    </div>
                                    {form.has_practical && (
                                        <Input
                                            type="number"
                                            className="w-24 text-center transition-all focus:w-28"
                                            value={form.practical_marks}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    practical_marks: parseInt(e.target.value) || 0,
                                                })
                                            }
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline" className="border-border/50 text-foreground font-semibold rounded-xl hover:bg-muted transition-all duration-200">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-none transition-all duration-200">
                            {editingSubject ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* No class selected */}
            {classes.length === 0 && !loading && (
                <div className="bg-transparent rounded-2xl border-2 border-dashed border-border/50 p-12 text-center shadow-none">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 mx-auto text-muted-foreground/40">
                        <BookOpenText size={32} strokeWidth={1.2} />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground mb-1">No classes found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        Create a class first before adding subjects.
                    </p>
                </div>
            )}

            {/* Subject Table */}
            {selectedClass && subjects.length > 0 && (
                <Card className="bg-card rounded-2xl border-border/50 shadow-none">
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
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subjects.map((subject) => (
                                    <TableRow key={subject.id}>
                                        <TableCell className="font-medium text-foreground">
                                            {subject.name}
                                            {subject.group_name && (
                                                <Badge variant="secondary" className="ml-2 text-[10px] bg-muted text-muted-foreground border-0 rounded-md font-medium uppercase tracking-wider">
                                                    {subject.group_name}
                                                </Badge>
                                            )}
                                            {subject.is_optional && (
                                                <Badge variant="outline" className="ml-2 text-[10px] bg-muted/50 text-muted-foreground border border-border/50 rounded-md font-medium uppercase tracking-wider">
                                                    Optional
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center font-medium text-foreground">{subject.full_marks}</TableCell>
                                        <TableCell className="text-center font-medium text-foreground">{subject.pass_marks}</TableCell>
                                        <TableCell className="text-center">
                                            {subject.has_theory ? (
                                                <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 rounded-md font-medium">{subject.theory_marks}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {subject.has_mcq ? (
                                                <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 rounded-md font-medium">{subject.mcq_marks}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {subject.has_practical ? (
                                                <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 rounded-md font-medium">{subject.practical_marks}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => openEdit(subject)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20"
                                                    onClick={() => handleDelete(subject)}
                                                >
                                                    <Trash size={14} strokeWidth={1.5} />
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

            {/* Empty subjects */}
            {selectedClass && subjects.length === 0 && !loading && classes.length > 0 && (
                <div className="bg-transparent rounded-2xl border-2 border-dashed border-border/50 p-12 text-center shadow-none">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 mx-auto text-muted-foreground/40">
                        <BookOpenText size={32} strokeWidth={1.2} />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground mb-1">No subjects yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        Add subjects to this class with mark distribution settings.
                    </p>
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
