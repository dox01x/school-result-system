"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AttendanceRecord, Class, Exam, Result, Section, Student } from "@/lib/database.types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import dynamic from "next/dynamic";
const BarChart = dynamic(() => import("recharts").then((mod) => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false });
import { toast } from "sonner";
import { Pencil, Printer, Trash2, MoveRight } from "lucide-react";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studentId: string | null;
    onStudentUpdated?: () => void;
    onRequestEdit?: (student: Student) => void;
    onRequestTransfer?: (student: Student) => void;
    onRequestDelete?: (student: Student) => void;
};

type MarkTrend = { exam: string; percentage: number };

const dayLabels = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu"];

export function StudentProfileSheet({
    open,
    onOpenChange,
    studentId,
    onStudentUpdated,
    onRequestEdit,
    onRequestTransfer,
    onRequestDelete,
}: Props) {
    const supabase = useMemo(() => createClient(), []);
    const [loading, setLoading] = useState(false);
    const [student, setStudent] = useState<Student | null>(null);
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [fees, setFees] = useState<{ receipt_number: string; amount_due: number; amount_paid: number; payment_date: string | null; fee_type: string }[]>([]);
    const [actionForm, setActionForm] = useState({
        name: "",
        phone: "",
        address: "",
        father_name: "",
        mother_name: "",
        blood_group: "",
        transferClassId: "",
        transferSectionId: "",
        transferRoll: "",
    });
    const [saving, setSaving] = useState(false);
    const [transferSections, setTransferSections] = useState<Section[]>([]);

    useEffect(() => {
        if (!open || !studentId) return;
        let cancelled = false;
        setLoading(true);
        void (async () => {
            const [studentRes, classesRes, sectionsRes, examsRes] = await Promise.all([
                supabase.from("students").select("id,student_id,class_id,section_id,roll,name,gender,father_name,mother_name,date_of_birth,phone,address,blood_group,group_name,created_at").eq("id", studentId).maybeSingle(),
                supabase.from("classes").select("id,name,numeric_value,created_at").order("numeric_value"),
                supabase.from("sections").select("id,class_id,name,created_at").order("name"),
                supabase.from("exams").select("id,name,exam_type,term,created_at").order("term").order("exam_type"),
            ]);

            if (cancelled) return;
            if (studentRes.error || !studentRes.data) {
                setLoading(false);
                return;
            }

            const fetchedStudent = studentRes.data;
            setStudent(fetchedStudent);
            setClasses(classesRes.data || []);
            setSections(sectionsRes.data || []);
            setExams(examsRes.data || []);
            setActionForm((prev) => ({
                ...prev,
                name: fetchedStudent.name || "",
                phone: fetchedStudent.phone || "",
                address: fetchedStudent.address || "",
                father_name: fetchedStudent.father_name || "",
                mother_name: fetchedStudent.mother_name || "",
                blood_group: fetchedStudent.blood_group || "",
                transferClassId: fetchedStudent.class_id || "",
                transferSectionId: fetchedStudent.section_id || "",
                transferRoll: fetchedStudent.roll || "",
            }));

            const [resultRes, attendanceRes, feeRes] = await Promise.all([
                supabase.from("results").select("id,student_id,exam_id,academic_year,total_marks,total_full_marks,percentage,gpa,grade,created_at").eq("student_id", studentId).order("created_at"),
                supabase.from("attendance_records").select("id,student_id,class_id,section_id,att_date,status,source,created_at,updated_at").eq("student_id", studentId).order("att_date", { ascending: false }),
                supabase.from("tuition_payments").select("receipt_number,amount_due,amount_paid,payment_date,fee_type").eq("student_id", studentId).order("payment_date", { ascending: false }).limit(12),
            ]);

            if (cancelled) return;
            setResults(resultRes.data || []);
            setAttendance(attendanceRes.data || []);
            setFees(feeRes.data || []);
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [open, studentId, supabase]);

    useEffect(() => {
        if (!actionForm.transferClassId) return;
        setTransferSections(sections.filter((s) => s.class_id === actionForm.transferClassId));
    }, [actionForm.transferClassId, sections]);

    const currentClass = classes.find((c) => c.id === student?.class_id);
    const currentSection = sections.find((s) => s.id === student?.section_id);

    const attendanceSummary = useMemo(() => {
        let present = 0;
        let absent = 0;
        const monthly: Record<string, { present: number; absent: number }> = {};
        for (const row of attendance) {
            if (row.status === "P") present += 1;
            if (row.status === "A") absent += 1;
            const month = row.att_date.slice(0, 7);
            if (!monthly[month]) monthly[month] = { present: 0, absent: 0 };
            if (row.status === "P") monthly[month].present += 1;
            if (row.status === "A") monthly[month].absent += 1;
        }
        const total = present + absent;
        return {
            present,
            absent,
            percentage: total ? Math.round((present / total) * 100) : 0,
            monthly,
        };
    }, [attendance]);

    const currentGpa = useMemo(() => {
        if (!results.length) return "0.00";
        return Math.max(...results.map((r) => r.gpa || 0)).toFixed(2);
    }, [results]);

    const trendData: MarkTrend[] = useMemo(() => {
        return results.map((r) => ({
            exam: exams.find((e) => e.id === r.exam_id)?.name || r.exam_id.slice(0, 6),
            percentage: Number(r.percentage || 0),
        }));
    }, [results, exams]);

    const pendingDue = useMemo(() => fees.reduce((sum, f) => sum + (Number(f.amount_due) - Number(f.amount_paid)), 0), [fees]);

    const handleUpdateBasic = async () => {
        if (!student) return;
        setSaving(true);
        const { error, data } = await supabase
            .from("students")
            .update({
                name: actionForm.name.trim(),
                phone: actionForm.phone.trim(),
                address: actionForm.address.trim(),
                father_name: actionForm.father_name.trim(),
                mother_name: actionForm.mother_name.trim(),
                blood_group: actionForm.blood_group.trim(),
            })
            .eq("id", student.id)
            .select("id,student_id,class_id,section_id,roll,name,gender,father_name,mother_name,date_of_birth,phone,address,blood_group,group_name,created_at")
            .single();

        if (error) {
            toast.error(error.message);
            setSaving(false);
            return;
        }

        setStudent(data);
        setSaving(false);
        onStudentUpdated?.();
        toast.success("Student profile updated");
    };

    const handleTransferInline = async () => {
        if (!student) return;
        if (!actionForm.transferClassId || !actionForm.transferSectionId || !actionForm.transferRoll.trim()) {
            toast.error("Select class, section and roll");
            return;
        }
        setSaving(true);
        const { error } = await supabase
            .from("students")
            .update({
                class_id: actionForm.transferClassId,
                section_id: actionForm.transferSectionId,
                roll: actionForm.transferRoll.trim(),
            })
            .eq("id", student.id);
        setSaving(false);
        if (error) {
            toast.error(error.message);
            return;
        }
        toast.success("Student transferred");
        onStudentUpdated?.();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[96vw] sm:max-w-[900px] p-0 gap-0 overflow-hidden bg-background">
                <DialogHeader className="border-b border-border/50 bg-muted/30 p-6">
                    <DialogTitle className="text-xl">Student Profile</DialogTitle>
                    <DialogDescription>Detailed profile, academics, attendance and actions.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[80vh] h-[800px]">
                    {loading || !student ? (
                        <div className="p-6 text-sm text-muted-foreground">Loading profile...</div>
                    ) : (
                        <div className="p-6 space-y-6">
                            <div className="rounded-2xl border-0 bg-muted/50 p-5">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-4">
                                        <div className="h-16 w-16 rounded-2xl bg-muted text-foreground flex items-center justify-center text-2xl font-bold">
                                            {student.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-semibold text-foreground">{student.name}</h3>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-lg font-medium">Roll {student.roll}</Badge>
                                                <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-lg font-medium">{currentClass?.name || "-"}</Badge>
                                                <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-lg font-medium">{currentSection?.name || "-"}</Badge>
                                                {student.student_id && <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-lg font-medium">{student.student_id}</Badge>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" className="border-0 bg-muted hover:bg-muted/80 text-foreground"><Printer className="h-4 w-4 mr-1" strokeWidth={1.2} />Print ID</Button>
                                        <Button size="sm" variant="outline" className="border-0 bg-muted hover:bg-muted/80 text-foreground" onClick={() => onRequestTransfer?.(student)}><MoveRight className="h-4 w-4 mr-1" strokeWidth={1.2} />Transfer</Button>
                                        <Button size="sm" onClick={() => onRequestEdit?.(student)}><Pencil className="h-4 w-4 mr-1" strokeWidth={1.2} />Edit</Button>
                                    </div>
                                </div>
                            </div>

                            <Tabs defaultValue="overview" className="space-y-4">
                                <TabsList className="w-full justify-start overflow-x-auto bg-muted border-0 rounded-xl p-1">
                                    <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Overview</TabsTrigger>
                                    <TabsTrigger value="academic" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Academic</TabsTrigger>
                                    <TabsTrigger value="attendance" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Attendance</TabsTrigger>
                                    <TabsTrigger value="fees" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Fees</TabsTrigger>
                                    <TabsTrigger value="actions" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Actions</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Card>
                                            <CardHeader><CardTitle className="text-sm">Personal & Parent Info</CardTitle></CardHeader>
                                            <CardContent className="grid grid-cols-2 gap-4 text-sm">
                                                <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Gender</p><p className="font-medium">{student.gender || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">DOB</p><p className="font-medium">{student.date_of_birth || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Father</p><p className="font-medium">{student.father_name || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Mother</p><p className="font-medium">{student.mother_name || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Phone</p><p className="font-medium">{student.phone || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Blood Group</p><p className="font-medium">{student.blood_group || "-"}</p></div>
                                                <div className="col-span-2"><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Address</p><p className="font-medium">{student.address || "-"}</p></div>
                                            </CardContent>
                                        </Card>
                                        <div className="grid gap-4">
                                            <Card><CardContent className="p-5 flex flex-col justify-center h-full"><p className="text-sm font-medium text-muted-foreground mb-2">Attendance %</p><p className="text-4xl font-bold text-foreground">{attendanceSummary.percentage}%</p></CardContent></Card>
                                            <Card><CardContent className="p-5 flex flex-col justify-center h-full"><p className="text-sm font-medium text-muted-foreground mb-2">Current GPA</p><p className="text-4xl font-bold text-foreground">{currentGpa}</p></CardContent></Card>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="academic" className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Performance Trend</CardTitle></CardHeader>
                                        <CardContent className="h-64">
                                            {trendData.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">No results found.</p>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={trendData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                        <XAxis dataKey="exam" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                                                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                                                        <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                                        <Bar dataKey="percentage" fill="#18181b" radius={[6, 6, 0, 0]} barSize={40} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Exam History</CardTitle></CardHeader>
                                        <CardContent className="space-y-3">
                                            {results.length === 0 && <p className="text-sm text-muted-foreground">No exam records.</p>}
                                            {results.map((r) => (
                                                <div key={r.id} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                                                    <div>
                                                        <p className="font-semibold text-foreground">{exams.find((e) => e.id === r.exam_id)?.name || r.exam_id}</p>
                                                        <p className="text-xs text-muted-foreground font-medium">Year {r.academic_year}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-base font-bold text-foreground">{Number(r.percentage).toFixed(2)}%</p>
                                                        <p className="text-xs text-muted-foreground font-medium">GPA {Number(r.gpa).toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="attendance" className="space-y-4">
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <Card><CardContent className="p-5"><p className="text-sm font-medium text-muted-foreground mb-2">Present</p><p className="text-3xl font-bold text-foreground">{attendanceSummary.present}</p></CardContent></Card>
                                        <Card><CardContent className="p-5"><p className="text-sm font-medium text-muted-foreground mb-2">Absent</p><p className="text-3xl font-bold text-foreground">{attendanceSummary.absent}</p></CardContent></Card>
                                        <Card><CardContent className="p-5"><p className="text-sm font-medium text-muted-foreground mb-2">Rate</p><p className="text-3xl font-bold text-foreground">{attendanceSummary.percentage}%</p></CardContent></Card>
                                    </div>
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Monthly Breakdown</CardTitle></CardHeader>
                                        <CardContent className="space-y-3">
                                            {Object.entries(attendanceSummary.monthly).sort((a, b) => b[0].localeCompare(a[0])).map(([month, v]) => (
                                                <div key={month} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                                                    <span className="font-medium text-foreground">{month}</span>
                                                    <span className="text-sm font-medium"><span className="text-muted-foreground">P: {v.present}</span> <span className="text-muted-foreground/40 mx-1">|</span> <span className="text-muted-foreground">A: {v.absent}</span></span>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="fees" className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Financial Snapshot</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-4">
                                            <div className="rounded-xl border-0 bg-muted p-5">
                                                <p className="text-sm font-medium text-muted-foreground mb-1">Pending Dues</p>
                                                <p className="text-3xl font-bold text-foreground">{pendingDue.toFixed(2)}</p>
                                            </div>
                                            <div className="rounded-xl border-0 bg-muted p-5">
                                                <p className="text-sm font-medium text-muted-foreground mb-1">Recent Payments</p>
                                                <p className="text-3xl font-bold text-foreground">{fees.length}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Fee Payment History</CardTitle></CardHeader>
                                        <CardContent className="space-y-3">
                                            {fees.length === 0 && <p className="text-sm text-muted-foreground">No fee history.</p>}
                                            {fees.map((f) => (
                                                <div key={f.receipt_number} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                                                    <div>
                                                        <p className="text-base font-semibold text-foreground">{f.fee_type}</p>
                                                        <p className="text-xs text-muted-foreground font-medium mt-0.5">{f.receipt_number}</p>
                                                    </div>
                                                    <div className="text-right text-sm">
                                                        <p className="font-bold text-foreground">Paid: {Number(f.amount_paid).toFixed(2)}</p>
                                                        <p className="text-xs text-muted-foreground font-medium mt-0.5">{f.payment_date || "-"}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="actions" className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Inline Update</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-4">
                                            <div className="space-y-1"><Label>Name</Label><Input value={actionForm.name} onChange={(e) => setActionForm((p) => ({ ...p, name: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Phone</Label><Input value={actionForm.phone} onChange={(e) => setActionForm((p) => ({ ...p, phone: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Father Name</Label><Input value={actionForm.father_name} onChange={(e) => setActionForm((p) => ({ ...p, father_name: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Mother Name</Label><Input value={actionForm.mother_name} onChange={(e) => setActionForm((p) => ({ ...p, mother_name: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Blood Group</Label><Input value={actionForm.blood_group} onChange={(e) => setActionForm((p) => ({ ...p, blood_group: e.target.value }))} /></div>
                                            <div className="md:col-span-2 space-y-1"><Label>Address</Label><Input value={actionForm.address} onChange={(e) => setActionForm((p) => ({ ...p, address: e.target.value }))} /></div>
                                            <div className="md:col-span-2 mt-2"><Button onClick={handleUpdateBasic} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button></div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Section Transfer Workflow</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-3 gap-4">
                                            <div className="space-y-1">
                                                <Label>Class</Label>
                                                <Select value={actionForm.transferClassId} onValueChange={(v) => setActionForm((p) => ({ ...p, transferClassId: v, transferSectionId: "" }))}>
                                                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                                                    <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label>Section</Label>
                                                <Select value={actionForm.transferSectionId} onValueChange={(v) => setActionForm((p) => ({ ...p, transferSectionId: v }))}>
                                                    <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                                                    <SelectContent>{transferSections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label>New Roll</Label>
                                                <Input value={actionForm.transferRoll} onChange={(e) => setActionForm((p) => ({ ...p, transferRoll: e.target.value }))} />
                                            </div>
                                            <div className="md:col-span-3 mt-2"><Button variant="outline" onClick={handleTransferInline} disabled={saving}>{saving ? "Processing..." : "Transfer Student"}</Button></div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-red-200 bg-red-50/30">
                                        <CardHeader><CardTitle className="text-sm text-red-600">Danger Zone</CardTitle></CardHeader>
                                        <CardContent className="flex gap-2">
                                            <Button variant="destructive" onClick={() => onRequestDelete?.(student)}><Trash2 className="h-4 w-4 mr-1" strokeWidth={1.2} />Delete Student</Button>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

