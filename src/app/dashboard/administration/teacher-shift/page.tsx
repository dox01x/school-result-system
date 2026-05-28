"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { TEACHER_COLUMNS } from "@/lib/supabase/select-columns";
import type { Teacher, TeacherShift, LeaveRequest } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { UserCog, Plus, Trash2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function TeacherShiftPage() {
    const supabase = useMemo(() => createClient(), []);

    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [shifts, setShifts] = useState<TeacherShift[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
    const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [shiftForm, setShiftForm] = useState({
        id: "",
        teacher_id: "",
        shift_date: "",
        start_time: "08:00",
        end_time: "14:00",
        duty_type: "regular",
        notes: "",
    });

    const [leaveForm, setLeaveForm] = useState({
        teacher_id: "",
        start_date: "",
        end_date: "",
        reason: "",
    });

    const [classesToCover, setClassesToCover] = useState<any[]>([]);
    const [proxyAssignments, setProxyAssignments] = useState<Record<string, string>>({}); // "date_routineId" -> proxyTeacherId

    const getDatesInRange = useCallback((start: string, end: string) => {
        const dates = [];
        let current = new Date(start);
        const endDate = new Date(end);
        while (current <= endDate) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return dates;
    }, []);

    const dateToSchoolDay = (date: Date) => {
        const map = { 6: 0, 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: -1 };
        return map[date.getDay() as keyof typeof map];
    };

    useEffect(() => {
        if (leaveForm.teacher_id && leaveForm.start_date && leaveForm.end_date && new Date(leaveForm.end_date) >= new Date(leaveForm.start_date)) {
            const fetchRoutines = async () => {
                const dates = getDatesInRange(leaveForm.start_date, leaveForm.end_date);
                const daysToFetch = [...new Set(dates.map(dateToSchoolDay).filter(d => d !== -1))];
                if (daysToFetch.length === 0) {
                    setClassesToCover([]);
                    return;
                }
                const { data } = await supabase
                    .from("class_routines")
                    .select(`
                        id, day_of_week, start_time, end_time,
                        classes(name), sections(name), subjects(name)
                    `)
                    .eq("teacher_id", leaveForm.teacher_id)
                    .in("day_of_week", daysToFetch);

                if (data) {
                    const cover = [];
                    for (const d of dates) {
                        const day = dateToSchoolDay(d);
                        const routinesForDay = data.filter(r => r.day_of_week === day);
                        for (const r of routinesForDay) {
                            cover.push({
                                date: d.toISOString().split("T")[0],
                                routine: r,
                            });
                        }
                    }
                    setClassesToCover(cover);
                }
            };
            fetchRoutines();
        } else {
            setClassesToCover([]);
        }
    }, [leaveForm.teacher_id, leaveForm.start_date, leaveForm.end_date, supabase, getDatesInRange]);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.from("teachers").select(TEACHER_COLUMNS).order("name");
            setTeachers(data || []);
            setLoading(false);
        })();
    }, [supabase]);

    const loadShifts = useCallback(async () => {
        const res = await fetch("/api/administration/teacher-shift");
        const result = await res.json();
        if (result.success) setShifts(result.data || []);
    }, []);

    const loadLeaves = useCallback(async () => {
        const res = await fetch("/api/administration/teacher-shift?type=leave");
        const result = await res.json();
        if (result.success) setLeaveRequests(result.data || []);
    }, []);

    useEffect(() => { loadShifts(); loadLeaves(); }, [loadShifts, loadLeaves]);

    const getTeacherName = (id: string) => teachers.find((t) => t.id === id)?.name || "—";

    const handleSaveShift = async () => {
        if (!shiftForm.teacher_id || !shiftForm.shift_date || !shiftForm.start_time || !shiftForm.end_time) {
            toast.error("Please fill in all required fields");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/administration/teacher-shift", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(shiftForm),
            });
            const result = await res.json();
            if (!result.success) { toast.error(result.error); return; }
            toast.success(shiftForm.id ? "Shift updated" : "Shift added");
            setShiftDialogOpen(false);
            loadShifts();
        } catch {
            toast.error("Failed to save shift");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveLeave = async () => {
        if (!leaveForm.teacher_id || !leaveForm.start_date || !leaveForm.end_date) {
            toast.error("Please fill in all required fields");
            return;
        }

        const proxies = Object.entries(proxyAssignments).map(([key, proxy_teacher_id]) => {
            const [date, routine_id] = key.split("_");
            return { date, routine_id, proxy_teacher_id };
        });

        setSubmitting(true);
        try {
            const res = await fetch("/api/administration/teacher-shift", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "leave", ...leaveForm, proxies }),
            });
            const result = await res.json();
            if (!result.success) { toast.error(result.error); return; }
            toast.success("Leave request submitted");
            setLeaveDialogOpen(false);
            loadLeaves();
        } catch {
            toast.error("Failed to submit leave request");
        } finally {
            setSubmitting(false);
        }
    };

    const handleLeaveAction = async (id: string, status: "approved" | "rejected") => {
        try {
            const res = await fetch("/api/administration/teacher-shift", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "leave_update", id, status }),
            });
            const result = await res.json();
            if (!result.success) { toast.error(result.error); return; }
            toast.success(`Leave ${status}`);
            loadLeaves();
        } catch {
            toast.error("Failed to update leave");
        }
    };

    const handleDeleteShift = async (id: string) => {
        try {
            const res = await fetch(`/api/administration/teacher-shift?id=${id}`, { method: "DELETE" });
            const result = await res.json();
            if (!result.success) { toast.error(result.error); return; }
            toast.success("Shift deleted");
            loadShifts();
        } catch {
            toast.error("Failed to delete");
        }
    };

    const dutyTypeBadge = (type: string) => {
        const map: Record<string, string> = {
            regular: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
            exam_duty: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
            extra: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
        };
        return map[type] || "";
    };

    const statusBadge = (status: string) => {
        const map: Record<string, string> = {
            pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
            approved: "bg-emerald-100 text-primary dark:bg-emerald-500/10 dark:text-emerald-400",
            rejected: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
        };
        return map[status] || "";
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Teacher Shift Management</h1>
                <p className="text-muted-foreground mt-1">Manage duty rosters and handle leave requests.</p>
            </div>

            <Tabs defaultValue="shifts">
                <TabsList>
                    <TabsTrigger value="shifts">Duty Roster</TabsTrigger>
                    <TabsTrigger value="leaves">
                        Leave Requests
                        {leaveRequests.filter((l) => l.status === "pending").length > 0 && (
                            <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-[10px]">
                                {leaveRequests.filter((l) => l.status === "pending").length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="shifts" className="space-y-4">
                    <div className="flex justify-end">
                        <Button size="sm" onClick={() => {
                            setShiftForm({ id: "", teacher_id: "", shift_date: "", start_time: "08:00", end_time: "14:00", duty_type: "regular", notes: "" });
                            setShiftDialogOpen(true);
                        }}>
                            <Plus className="h-4 w-4 mr-1" /> Add Shift
                        </Button>
                    </div>

                    {shifts.length === 0 ? (
                        <Card className="border-dashed border-2">
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <UserCog className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="font-semibold text-lg mb-1">No Shifts Assigned</h3>
                                <p className="text-sm text-muted-foreground max-w-sm">Click &quot;Add Shift&quot; to assign a duty shift to a teacher.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <UserCog className="h-4 w-4 text-muted-foreground" />
                                    Duty Roster
                                    <Badge variant="secondary" className="text-[10px] px-1.5">{shifts.length}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Teacher</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Time</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Notes</TableHead>
                                                <TableHead className="w-[60px]">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {shifts.map((s) => (
                                                <TableRow key={s.id}>
                                                    <TableCell className="font-medium">{getTeacherName(s.teacher_id)}</TableCell>
                                                    <TableCell>{s.shift_date}</TableCell>
                                                    <TableCell className="text-muted-foreground">{s.start_time} — {s.end_time}</TableCell>
                                                    <TableCell>
                                                        <Badge className={dutyTypeBadge(s.duty_type)}>{s.duty_type.replace("_", " ")}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{s.notes || "—"}</TableCell>
                                                    <TableCell>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400" onClick={() => handleDeleteShift(s.id)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="leaves" className="space-y-4">
                    <div className="flex justify-end">
                        <Button size="sm" onClick={() => {
                            setLeaveForm({ teacher_id: "", start_date: "", end_date: "", reason: "" });
                            setProxyAssignments({});
                            setLeaveDialogOpen(true);
                        }}>
                            <Plus className="h-4 w-4 mr-1" /> Request Leave
                        </Button>
                    </div>

                    {leaveRequests.length === 0 ? (
                        <Card className="border-dashed border-2">
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <UserCog className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="font-semibold text-lg mb-1">No Leave Requests</h3>
                                <p className="text-sm text-muted-foreground max-w-sm">No leave requests have been submitted.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="pt-4">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Teacher</TableHead>
                                                <TableHead>From</TableHead>
                                                <TableHead>To</TableHead>
                                                <TableHead>Reason</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="w-[100px]">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {leaveRequests.map((l) => (
                                                <TableRow key={l.id}>
                                                    <TableCell className="font-medium">{getTeacherName(l.teacher_id)}</TableCell>
                                                    <TableCell>{l.start_date}</TableCell>
                                                    <TableCell>{l.end_date}</TableCell>
                                                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{l.reason || "—"}</TableCell>
                                                    <TableCell>
                                                        <Badge className={statusBadge(l.status)}>{l.status}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {l.status === "pending" && (
                                                            <div className="flex items-center gap-1">
                                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-emerald-50 dark:hover:bg-emerald-500/10" onClick={() => handleLeaveAction(l.id, "approved")}>
                                                                    <CheckCircle className="h-4 w-4" />
                                                                </Button>
                                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => handleLeaveAction(l.id, "rejected")}>
                                                                    <XCircle className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* Shift Dialog */}
            <Dialog open={shiftDialogOpen} onOpenChange={(open) => { setShiftDialogOpen(open); if (open) setTimeout(() => document.getElementById("shift-date")?.focus(), 100); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{shiftForm.id ? "Edit" : "Add"} Duty Shift</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label>Teacher *</Label>
                            <Select value={shiftForm.teacher_id} onValueChange={(v) => setShiftForm((p) => ({ ...p, teacher_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select Teacher" /></SelectTrigger>
                                <SelectContent>{teachers.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Date *</Label>
                            <Input id="shift-date" type="date" value={shiftForm.shift_date} onChange={(e) => setShiftForm((p) => ({ ...p, shift_date: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("shift-start-time")?.focus(); }}} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label>Start Time *</Label>
                                <Input id="shift-start-time" type="time" value={shiftForm.start_time} onChange={(e) => setShiftForm((p) => ({ ...p, start_time: e.target.value }))} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>End Time *</Label>
                                <Input type="time" value={shiftForm.end_time} onChange={(e) => setShiftForm((p) => ({ ...p, end_time: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Duty Type</Label>
                            <Select value={shiftForm.duty_type} onValueChange={(v) => setShiftForm((p) => ({ ...p, duty_type: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="regular">Regular</SelectItem>
                                    <SelectItem value="exam_duty">Exam Duty</SelectItem>
                                    <SelectItem value="extra">Extra</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Notes</Label>
                            <Textarea value={shiftForm.notes} onChange={(e) => setShiftForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes..." rows={2} />
                        </div>
                        <Button onClick={handleSaveShift} disabled={submitting} className="mt-2">
                            {submitting ? "Saving..." : shiftForm.id ? "Update" : "Add Shift"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Leave Dialog */}
            <Dialog open={leaveDialogOpen} onOpenChange={(open) => { setLeaveDialogOpen(open); if (open) setTimeout(() => document.getElementById("leave-start-date")?.focus(), 100); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Request Leave</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label>Teacher *</Label>
                            <Select value={leaveForm.teacher_id} onValueChange={(v) => setLeaveForm((p) => ({ ...p, teacher_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select Teacher" /></SelectTrigger>
                                <SelectContent>{teachers.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label>From Date *</Label>
                                <Input id="leave-start-date" type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm((p) => ({ ...p, start_date: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("leave-end-date")?.focus(); }}} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>To Date *</Label>
                                <Input id="leave-end-date" type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm((p) => ({ ...p, end_date: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Reason</Label>
                            <Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))} placeholder="Reason for leave..." rows={2} />
                        </div>

                        {classesToCover.length > 0 && (
                            <div className="grid gap-2 border-t pt-2 mt-1 max-h-[250px] overflow-y-auto pr-2">
                                <Label className="text-sm font-semibold text-primary">Proxy Assignments (Classes to be Covered)</Label>
                                {classesToCover.map((c, i) => {
                                    const key = `${c.date}_${c.routine.id}`;
                                    const classItem = (c.routine.classes as any)?.name || "Class";
                                    const subjectItem = (c.routine.subjects as any)?.name || "Subject";
                                    return (
                                        <div key={i} className="flex flex-col gap-1.5 p-2 border rounded-md bg-muted/20">
                                            <div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
                                                <span>{c.date} ({c.routine.start_time} - {c.routine.end_time})</span>
                                                <Badge variant="outline" className="text-[10px]">{classItem} - {subjectItem}</Badge>
                                            </div>
                                            <Select value={proxyAssignments[key] || "unassigned"} onValueChange={(v) => setProxyAssignments(p => ({ ...p, [key]: v }))}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Proxy Teacher" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unassigned" disabled>Select Proxy Teacher</SelectItem>
                                                    {teachers.filter(t => t.id !== leaveForm.teacher_id).map((t) => (
                                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <Button onClick={handleSaveLeave} disabled={submitting} className="mt-2">
                            {submitting ? "Submitting..." : "Submit Leave Request"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
