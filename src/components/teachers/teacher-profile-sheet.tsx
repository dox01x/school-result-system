"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Teacher } from "@/lib/database.types";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Shield, Trash2 } from "lucide-react";

type TeacherProfileProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teacherId: string | null;
    onTeacherUpdated?: () => void;
    onRequestEdit?: (teacher: Teacher) => void;
    onRequestDelete?: (teacher: Teacher) => void;
};

const days = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu"];

export function TeacherProfileSheet({
    open,
    onOpenChange,
    teacherId,
    onTeacherUpdated,
    onRequestEdit,
    onRequestDelete,
}: TeacherProfileProps) {
    const supabase = useMemo(() => createClient(), []);
    const [loading, setLoading] = useState(false);
    const [teacher, setTeacher] = useState<Teacher | null>(null);
    const [routineRows, setRoutineRows] = useState<any[]>([]);
    const [leaveRows, setLeaveRows] = useState<any[]>([]);
    const [proxyRows, setProxyRows] = useState<any[]>([]);
    const [salaryConfig, setSalaryConfig] = useState<any>(null);
    const [salaryPayments, setSalaryPayments] = useState<any[]>([]);
    const [actionForm, setActionForm] = useState({
        name: "",
        phone: "",
        email: "",
        subject_specialty: "",
        designation: "",
        employee_type: "teacher",
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !teacherId) return;
        let cancelled = false;
        setLoading(true);
        void (async () => {
            const { data: teacherData, error } = await supabase
                .from("teachers")
                .select("id,name,phone,email,subject_specialty,designation,employee_type,proxy_count,created_at")
                .eq("id", teacherId)
                .maybeSingle();
            if (cancelled) return;
            if (error || !teacherData) {
                setLoading(false);
                return;
            }
            setTeacher(teacherData);
            setActionForm({
                name: teacherData.name || "",
                phone: teacherData.phone || "",
                email: teacherData.email || "",
                subject_specialty: teacherData.subject_specialty || "",
                designation: teacherData.designation || "",
                employee_type: teacherData.employee_type || "teacher",
            });

            const [routineRes, leaveRes, proxyRes, configRes, salaryRes] = await Promise.all([
                supabase
                    .from("class_routines")
                    .select("id,day_of_week,start_time,end_time,classes(name),sections(name),subjects(name),rooms(name)")
                    .eq("teacher_id", teacherId)
                    .order("day_of_week")
                    .order("start_time"),
                supabase.from("leave_requests").select("id,start_date,end_date,reason,status,created_at").eq("teacher_id", teacherId).order("created_at", { ascending: false }),
                supabase.from("proxy_assignments").select("id,assignment_date,routine_id,original_teacher_id,proxy_teacher_id,created_at").or(`original_teacher_id.eq.${teacherId},proxy_teacher_id.eq.${teacherId}`).order("assignment_date", { ascending: false }),
                supabase.from("staff_salary_config").select("id,basic_salary,allowances,deductions,effective_from,is_active").eq("staff_id", teacherId).eq("is_active", true).maybeSingle(),
                supabase.from("salary_payments").select("id,slip_number,month,year,net_salary,payment_date,payment_method").eq("staff_id", teacherId).order("payment_date", { ascending: false }).limit(12),
            ]);

            if (cancelled) return;
            setRoutineRows(routineRes.data || []);
            setLeaveRows(leaveRes.data || []);
            setProxyRows(proxyRes.data || []);
            setSalaryConfig(configRes.data || null);
            setSalaryPayments(salaryRes.data || []);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [open, teacherId, supabase]);

    const timetable = useMemo(() => {
        const table: Record<string, any[]> = {};
        for (const d of days) table[d] = [];
        for (const row of routineRows) {
            const key = days[row.day_of_week] || "Sat";
            table[key].push(row);
        }
        return table;
    }, [routineRows]);

    const salaryNumbers = useMemo(() => {
        if (!salaryConfig) return { basic: 0, allowances: 0, deductions: 0, net: 0 };
        const allowances = Object.values((salaryConfig.allowances || {}) as Record<string, unknown>).reduce(
            (sum: number, value: unknown) => sum + Number(value),
            0
        );
        const deductions = Object.values((salaryConfig.deductions || {}) as Record<string, unknown>).reduce(
            (sum: number, value: unknown) => sum + Number(value),
            0
        );
        const basic = Number(salaryConfig.basic_salary || 0);
        return { basic, allowances, deductions, net: basic + allowances - deductions };
    }, [salaryConfig]);

    const handleSaveInline = async () => {
        if (!teacher) return;
        setSaving(true);
        const { data, error } = await supabase
            .from("teachers")
            .update({
                name: actionForm.name.trim(),
                phone: actionForm.phone.trim(),
                email: actionForm.email.trim(),
                subject_specialty: actionForm.subject_specialty.trim(),
                designation: actionForm.designation.trim(),
                employee_type: actionForm.employee_type,
            })
            .eq("id", teacher.id)
            .select("id,name,phone,email,subject_specialty,designation,employee_type,proxy_count,created_at")
            .single();
        setSaving(false);
        if (error) {
            toast.error(error.message);
            return;
        }
        setTeacher(data);
        onTeacherUpdated?.();
        toast.success("Teacher profile updated");
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-[96vw] sm:max-w-[980px] p-0 bg-slate-50">
                <SheetHeader className="border-b bg-white">
                    <SheetTitle>Teacher Profile</SheetTitle>
                    <SheetDescription>Detailed profile, routine, leave, payroll and actions.</SheetDescription>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-80px)]">
                    {loading || !teacher ? (
                        <div className="p-6 text-sm text-muted-foreground">Loading profile...</div>
                    ) : (
                        <div className="p-6 space-y-5">
                            <div className="rounded-xl border border-slate-100 bg-white shadow-sm p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-4">
                                        <div className="h-14 w-14 rounded-full bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center text-xl font-bold">
                                            {teacher.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-semibold text-slate-800">{teacher.name}</h3>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-700">{teacher.designation || "Staff"}</Badge>
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-700">{(teacher.employee_type || "teacher").toUpperCase()}</Badge>
                                                {teacher.subject_specialty && <Badge variant="secondary" className="bg-teal-50 text-teal-700 border border-teal-100">{teacher.subject_specialty}</Badge>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onRequestEdit?.(teacher)}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
                                    </div>
                                </div>
                            </div>

                            <Tabs defaultValue="overview" className="space-y-4">
                                <TabsList className="w-full justify-start overflow-x-auto bg-white border border-slate-100 shadow-sm rounded-xl p-1">
                                    <TabsTrigger value="overview">Overview</TabsTrigger>
                                    <TabsTrigger value="routine">Class Routine</TabsTrigger>
                                    <TabsTrigger value="attendance">Attendance & Proxy</TabsTrigger>
                                    <TabsTrigger value="payroll">Payroll</TabsTrigger>
                                    <TabsTrigger value="actions">Actions</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="space-y-4">
                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">Contact & Responsibilities</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-3 text-sm">
                                            <div><p className="text-xs text-muted-foreground">Phone</p><p>{teacher.phone || "-"}</p></div>
                                            <div><p className="text-xs text-muted-foreground">Email</p><p>{teacher.email || "-"}</p></div>
                                            <div><p className="text-xs text-muted-foreground">Designation</p><p>{teacher.designation || "-"}</p></div>
                                            <div><p className="text-xs text-muted-foreground">Subject</p><p>{teacher.subject_specialty || "-"}</p></div>
                                            <div><p className="text-xs text-muted-foreground">Proxy Classes Taken</p><p>{teacher.proxy_count || 0}</p></div>
                                            <div><p className="text-xs text-muted-foreground">Routine Entries</p><p>{routineRows.length}</p></div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="routine" className="space-y-4">
                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">Weekly Timetable</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-3">
                                            {days.map((day) => (
                                                <div key={day} className="rounded-lg border border-slate-200 bg-white p-3">
                                                    <p className="font-medium mb-2">{day}</p>
                                                    {timetable[day]?.length ? timetable[day].map((r: any) => (
                                                        <div key={r.id} className="rounded-md border border-slate-200 bg-slate-50/40 p-2 mb-2 text-sm">
                                                            <p className="font-medium">{r.start_time} - {r.end_time}</p>
                                                            <p className="text-muted-foreground">{r.classes?.name} / {r.sections?.name}</p>
                                                            <p className="text-muted-foreground">{r.subjects?.name} {r.rooms?.name ? `• ${r.rooms.name}` : ""}</p>
                                                        </div>
                                                    )) : <p className="text-sm text-muted-foreground">No classes.</p>}
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="attendance" className="space-y-4">
                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">Leave Records</CardTitle></CardHeader>
                                        <CardContent className="space-y-2">
                                            {leaveRows.length === 0 && <p className="text-sm text-muted-foreground">No leave records.</p>}
                                            {leaveRows.map((l: any) => (
                                                <div key={l.id} className="flex items-center justify-between border rounded-lg p-2">
                                                    <div>
                                                        <p className="text-sm font-medium">{l.start_date} to {l.end_date}</p>
                                                        <p className="text-xs text-muted-foreground">{l.reason || "-"}</p>
                                                    </div>
                                                    <Badge variant="secondary">{l.status}</Badge>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">Proxy Class Log</CardTitle></CardHeader>
                                        <CardContent className="space-y-2">
                                            {proxyRows.length === 0 && <p className="text-sm text-muted-foreground">No proxy assignments.</p>}
                                            {proxyRows.map((p: any) => (
                                                <div key={p.id} className="flex items-center justify-between border rounded-lg p-2 text-sm">
                                                    <span>{p.assignment_date}</span>
                                                    <span className="text-muted-foreground">Routine: {p.routine_id.slice(0, 8)}</span>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="payroll" className="space-y-4">
                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">Current Salary Structure</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-3">
                                            <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-muted-foreground">Basic Salary</p><p className="text-xl font-semibold text-slate-800">{salaryNumbers.basic.toFixed(2)}</p></div>
                                            <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-muted-foreground">Estimated Net</p><p className="text-xl font-semibold text-blue-700">{salaryNumbers.net.toFixed(2)}</p></div>
                                            <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-muted-foreground">Allowances</p><p>{salaryNumbers.allowances.toFixed(2)}</p></div>
                                            <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-muted-foreground">Deductions</p><p>{salaryNumbers.deductions.toFixed(2)}</p></div>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">Recent Payments</CardTitle></CardHeader>
                                        <CardContent className="space-y-2">
                                            {salaryPayments.length === 0 && <p className="text-sm text-muted-foreground">No salary history.</p>}
                                            {salaryPayments.map((s: any) => (
                                                <div key={s.id} className="flex items-center justify-between border rounded-lg p-2 text-sm">
                                                    <div>
                                                        <p className="font-medium">{s.month}/{s.year}</p>
                                                        <p className="text-xs text-muted-foreground">{s.slip_number}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p>{Number(s.net_salary || 0).toFixed(2)}</p>
                                                        <p className="text-xs text-muted-foreground">{s.payment_date || "-"}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="actions" className="space-y-4">
                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">Update Profile</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-3">
                                            <div><Label>Name</Label><Input value={actionForm.name} onChange={(e) => setActionForm((p) => ({ ...p, name: e.target.value }))} /></div>
                                            <div><Label>Phone</Label><Input value={actionForm.phone} onChange={(e) => setActionForm((p) => ({ ...p, phone: e.target.value }))} /></div>
                                            <div><Label>Email</Label><Input value={actionForm.email} onChange={(e) => setActionForm((p) => ({ ...p, email: e.target.value }))} /></div>
                                            <div><Label>Designation</Label><Input value={actionForm.designation} onChange={(e) => setActionForm((p) => ({ ...p, designation: e.target.value }))} /></div>
                                            <div><Label>Subject Specialty</Label><Input value={actionForm.subject_specialty} onChange={(e) => setActionForm((p) => ({ ...p, subject_specialty: e.target.value }))} /></div>
                                            <div>
                                                <Label>Employee Type</Label>
                                                <Select value={actionForm.employee_type} onValueChange={(v) => setActionForm((p) => ({ ...p, employee_type: v }))}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="teacher">Teacher</SelectItem>
                                                        <SelectItem value="staff">Staff</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="md:col-span-2">
                                                <Button onClick={handleSaveInline} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">System Access</CardTitle></CardHeader>
                                        <CardContent className="flex gap-2">
                                            <Button variant="outline"><Shield className="h-4 w-4 mr-1" />Manage Access Controls</Button>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-red-200 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm text-red-600">Termination / Deletion</CardTitle></CardHeader>
                                        <CardContent>
                                            <Button variant="destructive" onClick={() => onRequestDelete?.(teacher)}><Trash2 className="h-4 w-4 mr-1" />Delete Employee</Button>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}

