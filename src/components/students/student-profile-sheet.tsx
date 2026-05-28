"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AttendanceRecord, Class, Exam, Result, Section, Student } from "@/lib/database.types";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-[96vw] sm:max-w-[980px] p-0 bg-slate-50">
                <SheetHeader className="border-b bg-white">
                    <SheetTitle>Student Profile</SheetTitle>
                    <SheetDescription>Detailed profile, academics, attendance and actions.</SheetDescription>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-80px)]">
                    {loading || !student ? (
                        <div className="p-6 text-sm text-muted-foreground">Loading profile...</div>
                    ) : (
                        <div className="p-6 space-y-5">
                            <div className="rounded-xl border border-slate-100 bg-white shadow-sm p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-14 w-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold border border-blue-100">
                                            {student.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-semibold text-slate-800">{student.name}</h3>
                                            <div className="mt-1 flex flex-wrap gap-2">
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-700">Roll {student.roll}</Badge>
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-700">{currentClass?.name || "-"}</Badge>
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-700">{currentSection?.name || "-"}</Badge>
                                                {student.student_id && <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-100">{student.student_id}</Badge>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" className="border-slate-200"><Printer className="h-4 w-4 mr-1" />Print ID</Button>
                                        <Button size="sm" variant="outline" className="border-slate-200" onClick={() => onRequestTransfer?.(student)}><MoveRight className="h-4 w-4 mr-1" />Transfer</Button>
                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onRequestEdit?.(student)}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
                                    </div>
                                </div>
                            </div>

                            <Tabs defaultValue="overview" className="space-y-4">
                                <TabsList className="w-full justify-start overflow-x-auto bg-white border border-slate-100 shadow-sm rounded-xl p-1">
                                    <TabsTrigger value="overview">Overview</TabsTrigger>
                                    <TabsTrigger value="academic">Academic</TabsTrigger>
                                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                                    <TabsTrigger value="fees">Fees</TabsTrigger>
                                    <TabsTrigger value="actions">Actions</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Card className="border-slate-100 shadow-sm">
                                            <CardHeader><CardTitle className="text-sm">Personal & Parent Info</CardTitle></CardHeader>
                                            <CardContent className="grid grid-cols-2 gap-3 text-sm">
                                                <div><p className="text-muted-foreground text-xs">Gender</p><p>{student.gender || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs">DOB</p><p>{student.date_of_birth || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs">Father</p><p>{student.father_name || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs">Mother</p><p>{student.mother_name || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs">Phone</p><p>{student.phone || "-"}</p></div>
                                                <div><p className="text-muted-foreground text-xs">Blood Group</p><p>{student.blood_group || "-"}</p></div>
                                                <div className="col-span-2"><p className="text-muted-foreground text-xs">Address</p><p>{student.address || "-"}</p></div>
                                            </CardContent>
                                        </Card>
                                        <div className="grid gap-4">
                                            <Card className="border-slate-100 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Attendance %</p><p className="text-2xl font-bold text-blue-700">{attendanceSummary.percentage}%</p></CardContent></Card>
                                            <Card className="border-slate-100 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Current GPA</p><p className="text-2xl font-bold text-indigo-700">{currentGpa}</p></CardContent></Card>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="academic" className="space-y-4">
                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">Performance Trend</CardTitle></CardHeader>
                                        <CardContent className="h-64">
                                            {trendData.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">No results found.</p>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={trendData}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis dataKey="exam" />
                                                        <YAxis domain={[0, 100]} />
                                                        <Tooltip />
                                                        <Bar dataKey="percentage" fill="#2563eb" radius={[6, 6, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </CardContent>
                                    </Card>
                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">Exam History</CardTitle></CardHeader>
                                        <CardContent className="space-y-2">
                                            {results.length === 0 && <p className="text-sm text-muted-foreground">No exam records.</p>}
                                            {results.map((r) => (
                                                <div key={r.id} className="flex items-center justify-between border rounded-lg p-3">
                                                    <div>
                                                        <p className="font-medium">{exams.find((e) => e.id === r.exam_id)?.name || r.exam_id}</p>
                                                        <p className="text-xs text-muted-foreground">Year {r.academic_year}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-semibold">{Number(r.percentage).toFixed(2)}%</p>
                                                        <p className="text-xs text-muted-foreground">GPA {Number(r.gpa).toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="attendance" className="space-y-4">
                                    <div className="grid md:grid-cols-3 gap-3">
                                        <Card className="border-slate-100 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Present</p><p className="text-xl font-semibold text-emerald-600">{attendanceSummary.present}</p></CardContent></Card>
                                        <Card className="border-slate-100 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Absent</p><p className="text-xl font-semibold text-red-600">{attendanceSummary.absent}</p></CardContent></Card>
                                        <Card className="border-slate-100 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Rate</p><p className="text-xl font-semibold text-blue-700">{attendanceSummary.percentage}%</p></CardContent></Card>
                                    </div>
                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">Monthly Breakdown</CardTitle></CardHeader>
                                        <CardContent className="space-y-2">
                                            {Object.entries(attendanceSummary.monthly).sort((a, b) => b[0].localeCompare(a[0])).map(([month, v]) => (
                                                <div key={month} className="flex items-center justify-between border rounded-lg p-2">
                                                    <span>{month}</span>
                                                    <span className="text-sm"><span className="text-emerald-600">P: {v.present}</span> / <span className="text-red-600">A: {v.absent}</span></span>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="fees" className="space-y-4">
                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">Financial Snapshot</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-4">
                                            <div className="rounded-lg border p-3">
                                                <p className="text-xs text-muted-foreground">Pending Dues</p>
                                                <p className="text-xl font-semibold">{pendingDue.toFixed(2)}</p>
                                            </div>
                                            <div className="rounded-lg border p-3">
                                                <p className="text-xs text-muted-foreground">Recent Payments</p>
                                                <p className="text-xl font-semibold">{fees.length}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">Fee Payment History</CardTitle></CardHeader>
                                        <CardContent className="space-y-2">
                                            {fees.length === 0 && <p className="text-sm text-muted-foreground">No fee history.</p>}
                                            {fees.map((f) => (
                                                <div key={f.receipt_number} className="flex items-center justify-between border rounded-lg p-2">
                                                    <div>
                                                        <p className="text-sm font-medium">{f.fee_type}</p>
                                                        <p className="text-xs text-muted-foreground">{f.receipt_number}</p>
                                                    </div>
                                                    <div className="text-right text-sm">
                                                        <p>Paid: {Number(f.amount_paid).toFixed(2)}</p>
                                                        <p className="text-xs text-muted-foreground">{f.payment_date || "-"}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="actions" className="space-y-4">
                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">Inline Update</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-3">
                                            <div><Label>Name</Label><Input value={actionForm.name} onChange={(e) => setActionForm((p) => ({ ...p, name: e.target.value }))} /></div>
                                            <div><Label>Phone</Label><Input value={actionForm.phone} onChange={(e) => setActionForm((p) => ({ ...p, phone: e.target.value }))} /></div>
                                            <div><Label>Father Name</Label><Input value={actionForm.father_name} onChange={(e) => setActionForm((p) => ({ ...p, father_name: e.target.value }))} /></div>
                                            <div><Label>Mother Name</Label><Input value={actionForm.mother_name} onChange={(e) => setActionForm((p) => ({ ...p, mother_name: e.target.value }))} /></div>
                                            <div><Label>Blood Group</Label><Input value={actionForm.blood_group} onChange={(e) => setActionForm((p) => ({ ...p, blood_group: e.target.value }))} /></div>
                                            <div className="md:col-span-2"><Label>Address</Label><Input value={actionForm.address} onChange={(e) => setActionForm((p) => ({ ...p, address: e.target.value }))} /></div>
                                            <div className="md:col-span-2"><Button onClick={handleUpdateBasic} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button></div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-slate-100 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm">Section Transfer Workflow</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-3 gap-3">
                                            <div>
                                                <Label>Class</Label>
                                                <Select value={actionForm.transferClassId} onValueChange={(v) => setActionForm((p) => ({ ...p, transferClassId: v, transferSectionId: "" }))}>
                                                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                                                    <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>Section</Label>
                                                <Select value={actionForm.transferSectionId} onValueChange={(v) => setActionForm((p) => ({ ...p, transferSectionId: v }))}>
                                                    <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                                                    <SelectContent>{transferSections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>New Roll</Label>
                                                <Input value={actionForm.transferRoll} onChange={(e) => setActionForm((p) => ({ ...p, transferRoll: e.target.value }))} />
                                            </div>
                                            <div className="md:col-span-3"><Button variant="outline" onClick={handleTransferInline} disabled={saving}>{saving ? "Processing..." : "Transfer Student"}</Button></div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-red-200 shadow-sm">
                                        <CardHeader><CardTitle className="text-sm text-red-600">Danger Zone</CardTitle></CardHeader>
                                        <CardContent className="flex gap-2">
                                            <Button variant="destructive" onClick={() => onRequestDelete?.(student)}><Trash2 className="h-4 w-4 mr-1" />Delete Student</Button>
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

