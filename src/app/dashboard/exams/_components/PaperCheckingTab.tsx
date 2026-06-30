"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { printHtml } from "@/lib/print-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CheckCircle, Printer, FileText } from "lucide-react";
import type { Exam } from "@/lib/database.types";

interface ClassInfo {
    id: string;
    name: string;
    numeric_value: number | null;
}

interface SubjectInfo {
    id: string;
    name: string;
    class_id: string;
}

interface TeacherInfo {
    id: string;
    name: string;
    designation: string;
    phone: string;
}

interface Distribution {
    id: string;
    exam_id: string;
    class_id: string;
    subject_id: string;
    teacher_id: string;
    total_copies: number;
    date_given: string;
    date_returned: string | null;
    status: string;
    notes: string | null;
}

interface FormData {
    class_id: string;
    subject_id: string;
    teacher_id: string;
    total_copies: string;
    date_given: string;
    date_returned: string;
    notes: string;
}

const emptyForm: FormData = {
    class_id: "",
    subject_id: "",
    teacher_id: "",
    total_copies: "",
    date_given: new Date().toISOString().split("T")[0],
    date_returned: "",
    notes: "",
};

export function PaperCheckingTab({ exams }: { exams: Exam[] }) {
    const [selectedExam, setSelectedExam] = useState("");
    const [distributions, setDistributions] = useState<Distribution[]>([]);
    const [classes, setClasses] = useState<ClassInfo[]>([]);
    const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
    const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);

    const supabase = useMemo(() => createClient(), []);

    // Load classes, subjects, teachers on mount
    useEffect(() => {
        const load = async () => {
            const [classRes, subjectRes, teacherRes] = await Promise.all([
                supabase.from("classes").select("id, name, numeric_value").order("numeric_value"),
                supabase.from("subjects").select("id, name, class_id"),
                supabase.from("teachers").select("id, name, designation, phone").order("name"),
            ]);
            if (classRes.data) setClasses(classRes.data);
            if (subjectRes.data) setSubjects(subjectRes.data);
            if (teacherRes.data) setTeachers(teacherRes.data);
        };
        load();
    }, [supabase]);

    // Load distributions when exam changes
    const loadDistributions = useCallback(async (examId: string) => {
        if (!examId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from("exam_paper_distributions")
            .select("id, exam_id, class_id, subject_id, teacher_id, total_copies, date_given, date_returned, status, notes")
            .eq("exam_id", examId)
            .order("date_given");
        if (error) {
            toast.error("Failed to load distributions");
        } else {
            setDistributions(data || []);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        if (selectedExam) loadDistributions(selectedExam);
        else setDistributions([]);
    }, [selectedExam, loadDistributions]);

    // Filtered subjects by selected class in form
    const filteredSubjects = useMemo(() => {
        if (!form.class_id) return [];
        return subjects.filter(s => s.class_id === form.class_id);
    }, [subjects, form.class_id]);

    // Open dialog for add
    const handleAdd = () => {
        setEditingId(null);
        setForm(emptyForm);
        setDialogOpen(true);
    };

    // Open dialog for edit
    const handleEdit = (dist: Distribution) => {
        setEditingId(dist.id);
        setForm({
            class_id: dist.class_id,
            subject_id: dist.subject_id,
            teacher_id: dist.teacher_id,
            total_copies: String(dist.total_copies),
            date_given: dist.date_given,
            date_returned: dist.date_returned || "",
            notes: dist.notes || "",
        });
        setDialogOpen(true);
    };

    // Save (add or update)
    const handleSave = async () => {
        if (!form.class_id || !form.subject_id || !form.teacher_id || !form.total_copies || !form.date_given) {
            toast.error("Please fill all required fields");
            return;
        }
        setSaving(true);
        const record = {
            exam_id: selectedExam,
            class_id: form.class_id,
            subject_id: form.subject_id,
            teacher_id: form.teacher_id,
            total_copies: parseInt(form.total_copies),
            date_given: form.date_given,
            date_returned: form.date_returned || null,
            status: form.date_returned ? "returned" : "pending",
            notes: form.notes || null,
        };

        if (editingId) {
            const { error } = await supabase
                .from("exam_paper_distributions")
                .update(record)
                .eq("id", editingId);
            if (error) toast.error("Failed to update");
            else toast.success("Distribution updated");
        } else {
            const { error } = await supabase
                .from("exam_paper_distributions")
                .insert(record);
            if (error) toast.error("Failed to add distribution");
            else toast.success("Distribution added");
        }
        setSaving(false);
        setDialogOpen(false);
        loadDistributions(selectedExam);
    };

    // Delete
    const handleDelete = async (id: string) => {
        const { error } = await supabase
            .from("exam_paper_distributions")
            .delete()
            .eq("id", id);
        if (error) toast.error("Failed to delete");
        else {
            toast.success("Distribution deleted");
            loadDistributions(selectedExam);
        }
    };

    // Mark as returned
    const handleMarkReturned = async (id: string) => {
        const today = new Date().toISOString().split("T")[0];
        const { error } = await supabase
            .from("exam_paper_distributions")
            .update({ date_returned: today, status: "returned" })
            .eq("id", id);
        if (error) toast.error("Failed to update");
        else {
            toast.success("Marked as returned");
            loadDistributions(selectedExam);
        }
    };

    // Helper to get name by ID
    const getClassName = (id: string) => classes.find(c => c.id === id)?.name || "—";
    const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name || "—";
    const getTeacherName = (id: string) => teachers.find(t => t.id === id)?.name || "—";
    const getTeacherDesignation = (id: string) => teachers.find(t => t.id === id)?.designation || "—";

    const formatDate = (d: string) => {
        if (!d) return "—";
        const date = new Date(d + "T00:00:00");
        return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    };

    // Summary stats
    const stats = useMemo(() => {
        const total = distributions.length;
        const pending = distributions.filter(d => d.status === "pending").length;
        const returned = distributions.filter(d => d.status === "returned").length;
        const totalCopies = distributions.reduce((sum, d) => sum + d.total_copies, 0);
        return { total, pending, returned, totalCopies };
    }, [distributions]);

    // Print
    const handlePrint = () => {
        const examName = exams.find(e => e.id === selectedExam)?.name || "";

        let rowsHtml = "";
        distributions.forEach((d, idx) => {
            const statusBg = d.status === "returned" ? "#d4edda" : "#fff3cd";
            const statusText = d.status === "returned" ? "Returned" : "Pending";
            rowsHtml += `<tr>
                <td style="border:1px solid #000;padding:4px 6px;text-align:center">${idx + 1}</td>
                <td style="border:1px solid #000;padding:4px 6px">${getClassName(d.class_id)}</td>
                <td style="border:1px solid #000;padding:4px 6px">${getSubjectName(d.subject_id)}</td>
                <td style="border:1px solid #000;padding:4px 6px">${getTeacherName(d.teacher_id)}</td>
                <td style="border:1px solid #000;padding:4px 6px;text-align:center">${d.total_copies}</td>
                <td style="border:1px solid #000;padding:4px 6px;text-align:center">${formatDate(d.date_given)}</td>
                <td style="border:1px solid #000;padding:4px 6px;text-align:center">${d.date_returned ? formatDate(d.date_returned) : "—"}</td>
                <td style="border:1px solid #000;padding:4px 6px;text-align:center"><span style="background:${statusBg};padding:2px 8px;border-radius:4px;font-size:10px">${statusText}</span></td>
                <td style="border:1px solid #000;padding:4px 6px;font-size:10px">${d.notes || ""}</td>
            </tr>`;
        });

        const thStyle = `border:1px solid #000;padding:5px 6px;text-align:center;font-weight:bold;background:#f0f0f0;font-size:11px`;

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Paper Checking Distribution</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #000; padding: 5mm; font-size: 12px; }
        @page { size: A4; margin: 5mm; }
    </style>
</head>
<body>
    <div style="text-align:center;margin-bottom:12px;border-bottom:2px solid #000;padding-bottom:8px">
        <h2 style="font-size:16px;font-weight:bold;margin:0 0 4px 0">Paper Checking Distribution List</h2>
        <p style="font-size:12px;margin:2px 0"><strong>Exam:</strong> ${examName}</p>
        <p style="font-size:11px;margin:2px 0;color:#555">Total: ${stats.total} distributions | ${stats.totalCopies} copies | Pending: ${stats.pending} | Returned: ${stats.returned}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
            <tr>
                <th style="${thStyle}">Sl.</th>
                <th style="${thStyle}">Class</th>
                <th style="${thStyle}">Subject</th>
                <th style="${thStyle}">Teacher</th>
                <th style="${thStyle}">Copies</th>
                <th style="${thStyle}">Date Given</th>
                <th style="${thStyle}">Date Returned</th>
                <th style="${thStyle}">Status</th>
                <th style="${thStyle}">Remarks</th>
            </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
    </table>

    <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:11px">
        <div>
            <div style="border-top:1px solid #000;width:150px;text-align:center;padding-top:4px">Date</div>
        </div>
        <div>
            <div style="border-top:1px solid #000;width:250px;text-align:center;padding-top:4px">Head Teacher / Exam Controller's Signature</div>
        </div>
    </div>
</body>
</html>`;

        printHtml(html);
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap bg-card p-4 rounded-2xl border border-border/50">
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                    <SelectTrigger className="w-[220px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Select Exam" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50 shadow-md">
                        {exams.map(e => (
                            <SelectItem key={e.id} value={e.id} className="rounded-lg">{e.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="ml-auto flex gap-2">
                    {selectedExam && distributions.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={handlePrint}
                            className="h-11 rounded-xl font-semibold shadow-none border-border/50 transition-all duration-200 gap-2"
                        >
                            <Printer className="h-4 w-4" /> Print List
                        </Button>
                    )}
                    {selectedExam && (
                        <Button
                            onClick={handleAdd}
                            className="h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-none transition-all duration-200 gap-2"
                        >
                            <Plus className="h-4 w-4" /> Add Distribution
                        </Button>
                    )}
                </div>
            </div>

            {!selectedExam && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground font-medium">Select an exam to manage paper checking distributions</p>
                </div>
            )}

            {selectedExam && (
                <>
                    {/* Stats Cards */}
                    {distributions.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Card className="shadow-none border-border/50 rounded-2xl">
                                <CardContent className="p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Total Distributions</p>
                                    <p className="text-2xl font-black text-foreground">{stats.total}</p>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border-border/50 rounded-2xl">
                                <CardContent className="p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Total Copies</p>
                                    <p className="text-2xl font-black text-foreground">{stats.totalCopies}</p>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border-border/50 rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
                                <CardContent className="p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold mb-1">Pending</p>
                                    <p className="text-2xl font-black text-amber-600">{stats.pending}</p>
                                </CardContent>
                            </Card>
                            <Card className="shadow-none border-border/50 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800">
                                <CardContent className="p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold mb-1">Returned</p>
                                    <p className="text-2xl font-black text-emerald-600">{stats.returned}</p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Table */}
                    <Card className="shadow-none border-border/50 rounded-2xl">
                        <CardHeader className="py-3 bg-muted/30 border-b border-border/50 rounded-t-2xl">
                            <CardTitle className="text-sm">Paper Distributions</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex justify-center py-12 text-muted-foreground text-sm">Loading...</div>
                            ) : distributions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
                                    <p className="text-muted-foreground text-sm">No distributions added yet</p>
                                    <p className="text-muted-foreground/60 text-xs mt-1">Click &quot;Add Distribution&quot; to assign papers to teachers</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs w-10">#</TableHead>
                                                <TableHead className="text-xs">Class</TableHead>
                                                <TableHead className="text-xs">Subject</TableHead>
                                                <TableHead className="text-xs">Teacher</TableHead>
                                                <TableHead className="text-xs text-center">Copies</TableHead>
                                                <TableHead className="text-xs">Date Given</TableHead>
                                                <TableHead className="text-xs">Date Returned</TableHead>
                                                <TableHead className="text-xs text-center">Status</TableHead>
                                                <TableHead className="text-xs">Remarks</TableHead>
                                                <TableHead className="text-xs text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {distributions.map((d, idx) => (
                                                <TableRow key={d.id}>
                                                    <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                                                    <TableCell className="text-xs font-medium">{getClassName(d.class_id)}</TableCell>
                                                    <TableCell className="text-xs">{getSubjectName(d.subject_id)}</TableCell>
                                                    <TableCell className="text-xs">
                                                        <div>{getTeacherName(d.teacher_id)}</div>
                                                        <div className="text-[10px] text-muted-foreground">{getTeacherDesignation(d.teacher_id)}</div>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-center font-mono font-bold">{d.total_copies}</TableCell>
                                                    <TableCell className="text-xs">{formatDate(d.date_given)}</TableCell>
                                                    <TableCell className="text-xs">{d.date_returned ? formatDate(d.date_returned) : "—"}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge
                                                            variant="secondary"
                                                            className={`text-[10px] rounded-md border-0 ${
                                                                d.status === "returned"
                                                                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                                                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                                            }`}
                                                        >
                                                            {d.status === "returned" ? "Returned" : "Pending"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{d.notes || "—"}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {d.status === "pending" && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                                    onClick={() => handleMarkReturned(d.id)}
                                                                    title="Mark as Returned"
                                                                >
                                                                    <CheckCircle className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => handleEdit(d)}
                                                                title="Edit"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => handleDelete(d.id)}
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Distribution" : "Add Paper Distribution"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Class *</Label>
                                <Select value={form.class_id} onValueChange={v => setForm(f => ({ ...f, class_id: v, subject_id: "" }))}>
                                    <SelectTrigger className="h-10 rounded-xl">
                                        <SelectValue placeholder="Select Class" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {classes.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject *</Label>
                                <Select value={form.subject_id} onValueChange={v => setForm(f => ({ ...f, subject_id: v }))} disabled={!form.class_id}>
                                    <SelectTrigger className="h-10 rounded-xl">
                                        <SelectValue placeholder="Select Subject" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {filteredSubjects.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Teacher *</Label>
                            <Select value={form.teacher_id} onValueChange={v => setForm(f => ({ ...f, teacher_id: v }))}>
                                <SelectTrigger className="h-10 rounded-xl">
                                    <SelectValue placeholder="Select Teacher" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {teachers.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.name} — {t.designation}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Copies *</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={form.total_copies}
                                    onChange={e => setForm(f => ({ ...f, total_copies: e.target.value }))}
                                    className="h-10 rounded-xl"
                                    placeholder="e.g. 40"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date Given *</Label>
                                <Input
                                    type="date"
                                    value={form.date_given}
                                    onChange={e => setForm(f => ({ ...f, date_given: e.target.value }))}
                                    className="h-10 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date Returned</Label>
                                <Input
                                    type="date"
                                    value={form.date_returned}
                                    onChange={e => setForm(f => ({ ...f, date_returned: e.target.value }))}
                                    className="h-10 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Remarks</Label>
                            <Input
                                value={form.notes}
                                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                className="h-10 rounded-xl"
                                placeholder="Any notes..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" className="rounded-xl">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleSave} disabled={saving} className="rounded-xl">
                            {saving ? "Saving..." : editingId ? "Update" : "Add"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
