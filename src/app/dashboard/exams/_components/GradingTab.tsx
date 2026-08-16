"use client";

import { useState, useMemo } from "react";
import type { GradingRule } from "@/lib/database.types";
import { ALL_DEFAULT_GRADING } from "@/lib/constants/exam-defaults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2 as Trash, Medal, RotateCcw as ArrowCounterClockwise, AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface GradingTabProps {
    gradingRules: GradingRule[];
    loading: boolean;
    supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>;
    onRefresh: () => void;
}

const getGradeBadgeColor = (grade: string) => {
    switch (grade.toUpperCase()) {
        case "A+":
            return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
        case "A":
            return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30";
        case "A-":
            return "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30";
        case "B":
            return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
        case "C":
            return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
        case "D":
            return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30";
        case "F":
            return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold";
        default:
            return "bg-muted text-muted-foreground border-border";
    }
};

export function GradingTab({ gradingRules, loading, supabase, onRefresh }: GradingTabProps) {
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingGrade, setEditingGrade] = useState<GradingRule | null>(null);
    const [form, setForm] = useState({
        marks_category: 100,
        min_marks: 0,
        max_marks: 100,
        grade: "",
        grade_point: 5.0,
    });
    const [formError, setFormError] = useState<string>("");
    const [submitting, setSubmitting] = useState(false);

    const [confirmState, setConfirmState] = useState<{
        open: boolean;
        title: string;
        description: string;
        onConfirm: () => void;
    }>({ open: false, title: "", description: "", onConfirm: () => {} });

    // Distinct categories in the system
    const availableCategories = useMemo(() => {
        const set = new Set<number>([100, 75, 50, 25]);
        gradingRules.forEach((r) => set.add(r.marks_category));
        return Array.from(set).sort((a, b) => b - a);
    }, [gradingRules]);

    // Filtered rules
    const filteredRules = useMemo(() => {
        return gradingRules.filter((r) => {
            const matchesCat =
                categoryFilter === "all" ? true : r.marks_category.toString() === categoryFilter;
            const matchesSearch = searchQuery
                ? r.grade.toLowerCase().includes(searchQuery.toLowerCase())
                : true;
            return matchesCat && matchesSearch;
        });
    }, [gradingRules, categoryFilter, searchQuery]);

    // Validation logic
    const validateForm = () => {
        const trimmedGrade = form.grade.trim();
        if (!trimmedGrade) {
            setFormError("Grade name is required (e.g. A+, A, B)");
            return false;
        }
        if (form.min_marks < 0) {
            setFormError("Minimum marks cannot be negative");
            return false;
        }
        if (form.max_marks <= 0) {
            setFormError("Maximum marks must be greater than 0");
            return false;
        }
        if (form.min_marks > form.max_marks) {
            setFormError("Minimum marks cannot exceed Maximum marks");
            return false;
        }
        if (form.grade_point < 0 || form.grade_point > 5.0) {
            setFormError("Grade point must be between 0.00 and 5.00");
            return false;
        }

        // Check range overlap with existing rules in the same category
        const conflictingRule = gradingRules.find((r) => {
            if (r.id === editingGrade?.id) return false;
            if (r.marks_category !== form.marks_category) return false;
            // Overlap condition: !(max1 < min2 || min1 > max2)
            const overlap = !(form.max_marks < r.min_marks || form.min_marks > r.max_marks);
            return overlap;
        });

        if (conflictingRule) {
            setFormError(
                `Marks range [${form.min_marks} - ${form.max_marks}] overlaps with Grade "${conflictingRule.grade}" [${conflictingRule.min_marks} - ${conflictingRule.max_marks}] in the ${form.marks_category} Marks category.`
            );
            return false;
        }

        setFormError("");
        return true;
    };

    const handleSave = async () => {
        if (!validateForm()) return;
        setSubmitting(true);
        try {
            const payload = {
                marks_category: form.marks_category,
                min_marks: form.min_marks,
                max_marks: form.max_marks,
                grade: form.grade.trim().toUpperCase(),
                grade_point: form.grade_point,
            };

            if (editingGrade) {
                const { error } = await supabase
                    .from("grading_rules")
                    .update(payload)
                    .eq("id", editingGrade.id);
                if (error) throw error;
                toast.success(`Grading rule "${payload.grade}" updated`);
            } else {
                const { error } = await supabase.from("grading_rules").insert(payload);
                if (error) throw error;
                toast.success(`Grading rule "${payload.grade}" added`);
            }

            setForm({ marks_category: 100, min_marks: 0, max_marks: 100, grade: "", grade_point: 5.0 });
            setEditingGrade(null);
            setDialogOpen(false);
            onRefresh();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save grading rule");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (rule: GradingRule) => {
        setConfirmState({
            open: true,
            title: `Delete Grade "${rule.grade}" (${rule.marks_category} Marks)?`,
            description: `This will remove the [${rule.min_marks} - ${rule.max_marks}] mark range rule from calculations.`,
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from("grading_rules").delete().eq("id", rule.id);
                    if (error) throw error;
                    toast.success("Grading rule deleted");
                    onRefresh();
                } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Failed to delete grading rule");
                }
                setConfirmState((prev) => ({ ...prev, open: false }));
            },
        });
    };

    const handleReset = () => {
        setConfirmState({
            open: true,
            title: "Reset grading rules to Bangladesh defaults?",
            description:
                "All custom grading rules will be replaced with standard 100, 75, 50, and 25-mark NCTB scale rules (A+: 80-100%, A: 70-79%, A-: 60-69%, B: 50-59%, C: 40-49%, D: 33-39%, F: <33%).",
            onConfirm: async () => {
                try {
                    await supabase.from("grading_rules").delete().neq("id", "00000000-0000-0000-0000-000000000000");
                    await supabase.from("grading_rules").insert(ALL_DEFAULT_GRADING);
                    toast.success("Grading rules reset to NCTB defaults successfully");
                    onRefresh();
                } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : "Failed to reset grading rules");
                }
                setConfirmState((prev) => ({ ...prev, open: false }));
            },
        });
    };

    const openAdd = () => {
        const cat = categoryFilter !== "all" ? parseInt(categoryFilter, 10) : 100;
        setEditingGrade(null);
        setForm({
            marks_category: cat,
            min_marks: 80,
            max_marks: cat,
            grade: "",
            grade_point: 5.0,
        });
        setFormError("");
        setDialogOpen(true);
    };

    const openEdit = (rule: GradingRule) => {
        setEditingGrade(rule);
        setForm({
            marks_category: rule.marks_category,
            min_marks: rule.min_marks,
            max_marks: rule.max_marks,
            grade: rule.grade,
            grade_point: rule.grade_point,
        });
        setFormError("");
        setDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border">
                <div className="flex items-center gap-2 flex-wrap flex-1">
                    {/* Category Filter */}
                    <div className="w-full sm:w-auto">
                        <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
                            <TabsList className="bg-muted/50 rounded-xl p-1 h-9">
                                <TabsTrigger value="all" className="rounded-lg text-xs font-semibold px-3">
                                    All ({gradingRules.length})
                                </TabsTrigger>
                                {availableCategories.map((cat) => (
                                    <TabsTrigger key={cat} value={cat.toString()} className="rounded-lg text-xs font-semibold px-3">
                                        {cat}M
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Search */}
                    <div className="relative w-full sm:w-40">
                        <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Filter grade..."
                            className="pl-8 h-9 text-xs rounded-xl bg-muted/30 border-border/80"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-border text-foreground font-semibold rounded-xl hover:bg-muted text-xs h-9"
                        onClick={handleReset}
                    >
                        <ArrowCounterClockwise size={14} className="mr-1.5" />
                        Reset Defaults
                    </Button>
                    <Button
                        size="sm"
                        className="bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-bold text-xs h-9 px-3.5 shadow-none"
                        onClick={openAdd}
                    >
                        <Plus size={15} className="mr-1" />
                        Add Rule
                    </Button>
                </div>
            </div>

            {/* Empty State */}
            {gradingRules.length === 0 && !loading ? (
                <Card className="bg-transparent rounded-2xl border-2 border-dashed border-border shadow-none">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                        <Medal size={36} strokeWidth={1.2} className="text-muted-foreground/40" />
                        <h3 className="font-semibold text-lg text-foreground">No grading rules defined</h3>
                        <p className="text-xs text-muted-foreground max-w-sm">
                            Click &quot;Reset Defaults&quot; to load standard Bangladesh NCTB grading scales or &quot;Add Rule&quot; to create custom ranges.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {availableCategories
                        .filter((cat) => (categoryFilter === "all" ? true : cat.toString() === categoryFilter))
                        .map((cat) => {
                            const catRules = filteredRules
                                .filter((r) => r.marks_category === cat)
                                .sort((a, b) => b.min_marks - a.min_marks);

                            if (catRules.length === 0 && searchQuery) return null;

                            return (
                                <Card key={cat} className="bg-card rounded-2xl border-border shadow-none overflow-hidden">
                                    <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border flex flex-row items-center justify-between">
                                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                            <Medal size={14} className="text-primary" />
                                            <span>{cat} Marks Scale Rules</span>
                                        </CardTitle>
                                        <Badge variant="secondary" className="text-[10px] font-bold">
                                            {catRules.length} Tiers
                                        </Badge>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                        <TableHead className="text-xs font-bold w-40">Score Range</TableHead>
                                                        <TableHead className="text-center text-xs font-bold w-28">Letter Grade</TableHead>
                                                        <TableHead className="text-center text-xs font-bold w-28">Grade Point (GPA)</TableHead>
                                                        <TableHead className="text-center text-xs font-bold">Scale Proportion</TableHead>
                                                        <TableHead className="text-right text-xs font-bold w-24">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {catRules.map((rule) => {
                                                        const pctMin = Math.round((rule.min_marks / cat) * 100);
                                                        const pctMax = Math.round((rule.max_marks / cat) * 100);
                                                        return (
                                                            <TableRow key={rule.id} className="hover:bg-muted/40 transition-colors">
                                                                <TableCell className="font-bold text-xs">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-mono text-foreground text-sm">
                                                                            {rule.min_marks} - {rule.max_marks}
                                                                        </span>
                                                                        <span className="text-[10px] text-muted-foreground">
                                                                            ({pctMin}% - {pctMax}%)
                                                                        </span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={`text-xs font-black rounded-lg px-2.5 py-0.5 ${getGradeBadgeColor(
                                                                            rule.grade
                                                                        )}`}
                                                                    >
                                                                        {rule.grade}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-center font-mono font-bold text-sm text-foreground">
                                                                    {Number(rule.grade_point).toFixed(2)}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <div className="w-full max-w-[160px] mx-auto bg-muted rounded-full h-2 overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-primary/70 rounded-full"
                                                                            style={{
                                                                                width: `${Math.min(
                                                                                    100,
                                                                                    Math.max(5, pctMax - pctMin + 5)
                                                                                )}%`,
                                                                                marginLeft: `${pctMin}%`,
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex justify-end gap-1">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                                                                            onClick={() => openEdit(rule)}
                                                                        >
                                                                            <Pencil size={13} />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20"
                                                                            onClick={() => handleDelete(rule)}
                                                                        >
                                                                            <Trash size={13} />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                </div>
            )}

            {/* Dialog: Add / Edit Rule */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <Medal size={18} className="text-primary" />
                            {editingGrade ? "Edit Grading Rule" : "Add Grading Rule"}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Define mark range boundaries, letter grade, and grade points for GPA calculation.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSave();
                        }}
                        className="space-y-4 py-2"
                    >
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Marks Category</Label>
                            <Select
                                value={String(form.marks_category)}
                                onValueChange={(v) => {
                                    const cat = parseInt(v, 10);
                                    setForm({
                                        ...form,
                                        marks_category: cat,
                                        max_marks: form.max_marks > cat ? cat : form.max_marks,
                                    });
                                }}
                            >
                                <SelectTrigger className="h-10 rounded-xl bg-muted/40 font-medium text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border shadow-md">
                                    <SelectItem value="100" className="text-xs">100 Full Marks Scale</SelectItem>
                                    <SelectItem value="75" className="text-xs">75 Full Marks Scale</SelectItem>
                                    <SelectItem value="50" className="text-xs">50 Full Marks Scale</SelectItem>
                                    <SelectItem value="25" className="text-xs">25 Full Marks Scale</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Min Marks</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={form.marks_category}
                                    value={form.min_marks}
                                    onChange={(e) => {
                                        setForm({ ...form, min_marks: parseFloat(e.target.value) || 0 });
                                        if (formError) setFormError("");
                                    }}
                                    className="h-10 rounded-xl text-xs font-medium"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Max Marks</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={form.marks_category}
                                    value={form.max_marks}
                                    onChange={(e) => {
                                        setForm({ ...form, max_marks: parseFloat(e.target.value) || 0 });
                                        if (formError) setFormError("");
                                    }}
                                    className="h-10 rounded-xl text-xs font-medium"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Letter Grade</Label>
                                <Input
                                    placeholder="A+, A, A-, B, C, D, F"
                                    value={form.grade}
                                    onChange={(e) => {
                                        setForm({ ...form, grade: e.target.value.toUpperCase() });
                                        if (formError) setFormError("");
                                    }}
                                    className="h-10 rounded-xl text-xs font-bold uppercase"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Grade Point (0.0 - 5.0)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    max={5.0}
                                    value={form.grade_point}
                                    onChange={(e) => {
                                        setForm({ ...form, grade_point: parseFloat(e.target.value) || 0 });
                                        if (formError) setFormError("");
                                    }}
                                    className="h-10 rounded-xl text-xs font-mono font-bold"
                                />
                            </div>
                        </div>

                        {formError && (
                            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-start gap-2">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                <span>{formError}</span>
                            </div>
                        )}

                        <DialogFooter className="gap-2 pt-2">
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl text-xs font-semibold"
                                >
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                                {submitting ? "Saving..." : editingGrade ? "Update Rule" : "Add Rule"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirm Dialog */}
            <ConfirmDialog
                open={confirmState.open}
                onOpenChange={(open) => setConfirmState((prev) => ({ ...prev, open }))}
                title={confirmState.title}
                description={confirmState.description}
                confirmLabel="Proceed"
                variant="destructive"
                onConfirm={confirmState.onConfirm}
            />
        </div>
    );
}
