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
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, School, Layers } from "lucide-react";
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

            const classesWithSections = (classData || []).map((cls) => ({
                ...cls,
                sections: (sectionData || []).filter((s) => s.class_id === cls.id),
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
            description: "Students in this section will lose their section assignment.",
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from("sections")
                        .delete()
                        .eq("id", section.id);
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
                iconBg="bg-indigo-50"
                iconColor="text-indigo-600"
                title="Classes"
                subtitle="Manage classes and sections."
                actions={
                    <Dialog open={dialogOpen} onOpenChange={(open) => {
                        setDialogOpen(open);
                        if (!open) { setEditingClass(null); setClassName(""); setClassNumericValue(0); }
                        if (open) setTimeout(() => document.getElementById("className")?.focus(), 100);
                    }}>
                        <DialogTrigger asChild>
                            <Button className="bg-blue-600 text-white rounded-xl hover:bg-blue-700 btn-press">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Class
                            </Button>
                        </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editingClass ? "Edit Class" : "Create New Class"}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 py-6">
                            <div className="grid gap-4 md:grid-cols-4">
                                <div className="space-y-2 md:col-span-3">
                                    <Label htmlFor="className">Class Name</Label>
                                    <Input
                                        id="className"
                                        placeholder="e.g., Class 10, Grade 5"
                                        value={className}
                                        onChange={(e) => setClassName(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && (editingClass ? handleUpdateClass() : handleCreateClass())}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="numericValue">Sort Order</Label>
                                    <Input
                                        id="numericValue"
                                        type="number"
                                        placeholder="0"
                                        value={classNumericValue}
                                        onChange={(e) => setClassNumericValue(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                <strong>Sort Order</strong> determines the display order (e.g., lower numbers appear first). Defaults to 0.
                            </p>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button onClick={editingClass ? handleUpdateClass : handleCreateClass}>
                                {editingClass ? "Update" : "Create"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                    </Dialog>
                }
            />

            {/* Section Dialog */}
            <Dialog open={sectionDialogOpen} onOpenChange={(open) => {
                setSectionDialogOpen(open);
                if (!open) { setAddingSectionTo(null); setSectionName(""); }
                if (open) setTimeout(() => document.getElementById("sectionName")?.focus(), 100);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Section</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-6">
                        <div className="space-y-2">
                            <Label htmlFor="sectionName">Section Name</Label>
                            <Input
                                id="sectionName"
                                placeholder="e.g., A, B, Science"
                                value={sectionName}
                                onChange={(e) => setSectionName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleAddSection}>Add Section</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Connection Banner */}
            <ConnectionBanner />

            {/* Empty State */}
            {!loading && classes.length === 0 && (
                <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
                    <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4 mx-auto">
                        <School className="h-6 w-6 text-indigo-500" />
                    </div>
                    <h3 className="font-semibold text-lg text-slate-800 font-heading mb-1">No classes yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        Create your first class to get started with managing sections and students.
                    </p>
                </div>
            )}

            {/* Classes Grid */}
            {classes.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
                    {classes.map((cls) => (
                        <Card
                            key={cls.id}
                            className="group hover-lift bg-white border-slate-100 rounded-2xl shadow-sm"
                        >
                            <CardHeader className="flex flex-row items-start justify-between pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                                        <School className="h-4 w-4 text-indigo-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base">{cls.name}</CardTitle>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {cls.sections.length} section{cls.sections.length !== 1 ? "s" : ""}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        aria-label={`Edit ${cls.name}`}
                                        onClick={() => {
                                            setEditingClass(cls);
                                            setClassName(cls.name);
                                            setClassNumericValue(cls.numeric_value || 0);
                                            setDialogOpen(true);
                                        }}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20"
                                        aria-label={`Delete ${cls.name}`}
                                        onClick={() => handleDeleteClass(cls)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {cls.sections.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {cls.sections.map((section) => (
                                                <Badge
                                                    key={section.id}
                                                    variant="secondary"
                                                    className="gap-1.5 pr-1"
                                                >
                                                    <Layers className="h-3 w-3" />
                                                    {section.name}
                                                    <button
                                                        className="ml-1 h-4 w-4 rounded-full hover:bg-destructive/20 flex items-center justify-center"
                                                        aria-label={`Delete section ${section.name}`}
                                                        onClick={() => handleDeleteSection(section)}
                                                    >
                                                        <Trash2 className="h-2.5 w-2.5" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">
                                            No sections added
                                        </p>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full mt-2"
                                        onClick={() => {
                                            setAddingSectionTo(cls.id);
                                            setSectionDialogOpen(true);
                                        }}
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1" />
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
                        <Card key={i}>
                            <CardHeader>
                                <div className="h-6 w-32 bg-muted animate-pulse rounded-lg" />
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="h-6 w-full bg-muted animate-pulse rounded-lg" />
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
