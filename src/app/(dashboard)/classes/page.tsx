"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { CLASS_COLUMNS, SECTION_COLUMNS } from "@/lib/supabase/select-columns";
import type { Class, Section } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 as Trash, Building2 as Buildings, Layers as Stack, School } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import { ConnectionBanner } from "@/components/connection-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function ClassesPage() {
    const [classes, setClasses] = useState<(Class & { sections: Section[] })[]>([]);
    const [loading, setLoading] = useState(true);
    const [className, setClassName] = useState("");
    const [classNumericValue, setClassNumericValue] = useState(0);
    const [editingClass, setEditingClass] = useState<Class | null>(null);
    const [sectionName, setSectionName] = useState("");
    const [addingSectionTo, setAddingSectionTo] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
    const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; description: string; onConfirm: () => void }>({ open: false, title: "", description: "", onConfirm: () => {} });
    const supabase = useMemo(() => createClient(), []);

    const fetchClasses = useCallback(async () => {
        try {
            const { data: classData, error: classError } = await supabase
                .from("classes")
                .select(CLASS_COLUMNS)
                .order("numeric_value", { ascending: true });

            if (classError) throw classError;

            const { data: sectionData, error: sectionError } = await supabase
                .from("sections")
                .select(SECTION_COLUMNS)
                .order("name", { ascending: true });

            if (sectionError) throw sectionError;

            const classesWithSections = (classData as any[] || []).map((cls: any) => ({
                ...cls,
                sections: (sectionData as any[] || []).filter((s: any) => s.class_id === cls.id),
            }));

            setClasses(classesWithSections);
        } catch {
            toast.error("Failed to load classes");
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);

    const handleCreateClass = async () => {
        if (!className.trim()) return;
        try {
            const { error } = await supabase
                .from("classes")
                .insert({ name: className.trim(), numeric_value: classNumericValue });
            if (error) throw error;
            toast.success(`Class "${className.trim()}" created`);
            setClassName("");
            setClassNumericValue(0);
            setDialogOpen(false);
            fetchClasses();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to create class");
        }
    };

    const handleUpdateClass = async () => {
        if (!editingClass || !className.trim()) return;
        try {
            const { error } = await supabase
                .from("classes")
                .update({ name: className.trim(), numeric_value: classNumericValue })
                .eq("id", editingClass.id);
            if (error) throw error;
            toast.success("Class updated");
            setClassName("");
            setClassNumericValue(0);
            setEditingClass(null);
            setDialogOpen(false);
            fetchClasses();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to update class");
        }
    };

    const handleDeleteClass = (cls: Class) => {
        setConfirmState({
            open: true,
            title: `Delete "${cls.name}"?`,
            description: "This will also delete all sections, subjects, and students in this class. This cannot be undone.",
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from("classes").delete().eq("id", cls.id);
                    if (error) throw error;
                    toast.success(`Class "${cls.name}" deleted`);
                    fetchClasses();
                } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Failed to delete class");
                }
                setConfirmState(prev => ({ ...prev, open: false }));
            },
        });
    };

    const handleAddSection = async () => {
        if (!addingSectionTo || !sectionName.trim()) return;
        try {
            const { error } = await supabase
                .from("sections")
                .insert({ class_id: addingSectionTo, name: sectionName.trim() });
            if (error) throw error;
            toast.success(`Section "${sectionName.trim()}" added`);
            setSectionName("");
            setSectionDialogOpen(false);
            setAddingSectionTo(null);
            fetchClasses();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to add section");
        }
    };

    const handleDeleteSection = (section: Section) => {
        setConfirmState({
            open: true,
            title: `Delete section "${section.name}"?`,
            description: "This will remove this section and affect all enrolled students. This cannot be undone.",
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from("sections").delete().eq("id", section.id);
                    if (error) throw error;
                    toast.success(`Section "${section.name}" deleted`);
                    fetchClasses();
                } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Failed to delete section");
                }
                setConfirmState(prev => ({ ...prev, open: false }));
            },
        });
    };

    return (<>
        <div className="space-y-6">
            <PageHeader
                icon={School}
                title="Classes & Sections"
                subtitle="Configure grade levels, class names, and division sections."
                actions={
                    <Button
                        onClick={() => {
                            setEditingClass(null);
                            setClassName("");
                            setClassNumericValue(classes.length + 1);
                            setDialogOpen(true);
                        }}
                        className="gap-2 font-semibold shadow-xs"
                    >
                        <Plus size={16} strokeWidth={2} />
                        Add New Class
                    </Button>
                }
            />

            {/* Class Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) { setEditingClass(null); setClassName(""); setClassNumericValue(0); }
                if (open) setTimeout(() => document.getElementById("className")?.focus(), 100);
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingClass ? "Edit Class" : "Create New Class"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); editingClass ? handleUpdateClass() : handleCreateClass(); }}>
                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="className">Class Name *</Label>
                                <Input
                                    id="className"
                                    placeholder="e.g., Class 10, Grade 5"
                                    value={className}
                                    onChange={(e) => setClassName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="numericValue">Sort Order (Numeric)</Label>
                                <Input
                                    id="numericValue"
                                    type="number"
                                    placeholder="e.g., 10"
                                    value={classNumericValue}
                                    onChange={(e) => setClassNumericValue(parseInt(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button type="submit">
                                {editingClass ? "Update Class" : "Create Class"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Section Dialog */}
            <Dialog open={sectionDialogOpen} onOpenChange={(open) => {
                setSectionDialogOpen(open);
                if (!open) { setAddingSectionTo(null); setSectionName(""); }
                if (open) setTimeout(() => document.getElementById("sectionName")?.focus(), 100);
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Section</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleAddSection(); }}>
                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="sectionName">Section Name *</Label>
                                <Input
                                    id="sectionName"
                                    placeholder="e.g., Section A, Lotus, Science"
                                    value={sectionName}
                                    onChange={(e) => setSectionName(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button type="submit">Add Section</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConnectionBanner />

            {/* Empty State */}
            {!loading && classes.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card shadow-xs">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mb-4 mx-auto">
                        <Buildings size={28} strokeWidth={1.8} />
                    </div>
                    <h3 className="font-bold text-lg text-foreground mb-1">No classes created yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                        Add your institution&apos;s grades or classes to begin registering students.
                    </p>
                    <Button onClick={() => setDialogOpen(true)} className="gap-2">
                        <Plus size={16} /> Add First Class
                    </Button>
                </div>
            )}

            {/* Classes Grid */}
            {classes.length > 0 && (
                <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {classes.map((cls) => (
                        <Card
                            key={cls.id}
                            className="group hover:border-primary/40 transition-all duration-150 rounded-2xl"
                        >
                            <CardHeader className="flex flex-row items-start justify-between pb-3 gap-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                                        <Buildings size={18} strokeWidth={2} />
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-base truncate">{cls.name}</CardTitle>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {cls.sections.length} {cls.sections.length === 1 ? "Section" : "Sections"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        aria-label={`Edit ${cls.name}`}
                                        onClick={() => {
                                            setEditingClass(cls);
                                            setClassName(cls.name);
                                            setClassNumericValue(cls.numeric_value || 0);
                                            setDialogOpen(true);
                                        }}
                                    >
                                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        aria-label={`Delete ${cls.name}`}
                                        onClick={() => handleDeleteClass(cls)}
                                    >
                                        <Trash size={14} strokeWidth={1.8} />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-2">
                                <div className="space-y-3">
                                    {cls.sections.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                                            {cls.sections.map((section) => (
                                                <Badge
                                                    key={section.id}
                                                    variant="secondary"
                                                    className="gap-1.5 pl-2.5 pr-1 py-1 font-medium bg-muted/60 border-border/60 hover:bg-muted"
                                                >
                                                    <Stack className="h-3 w-3 text-muted-foreground" strokeWidth={1.8} />
                                                    <span>{section.name}</span>
                                                    <button
                                                        type="button"
                                                        className="ml-0.5 h-4 w-4 rounded-full hover:bg-destructive/20 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                                                        aria-label={`Delete section ${section.name}`}
                                                        onClick={() => handleDeleteSection(section)}
                                                    >
                                                        <Trash size={10} strokeWidth={2} />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic py-1">
                                            No sections added yet
                                        </p>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full gap-1.5 text-xs font-semibold rounded-xl hover:bg-muted/70"
                                        onClick={() => {
                                            setAddingSectionTo(cls.id);
                                            setSectionDialogOpen(true);
                                        }}
                                    >
                                        <Plus size={14} strokeWidth={2} />
                                        Add Section
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {loading && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="rounded-2xl">
                            <CardHeader>
                                <div className="h-6 w-32 bg-muted animate-pulse rounded-lg" />
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="h-8 w-full bg-muted animate-pulse rounded-lg" />
                                <div className="h-9 w-full bg-muted animate-pulse rounded-lg" />
                            </CardContent>
                        </Card>
                    ))}
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
