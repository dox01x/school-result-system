"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { TEACHER_COLUMNS } from "@/lib/supabase/select-columns";
import type { Teacher } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TeacherProfileSheet } from "@/components/teachers/teacher-profile-sheet";

type Employee = {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    subject_specialty: string | null;
    designation: string | null;
    employee_type: string;
    proxy_count: number;
};

export default function TeachersPage() {
    const supabase = useMemo(() => createClient(), []);

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
    const [profileDialogOpen, setProfileDialogOpen] = useState(false);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [teacherForm, setTeacherForm] = useState({ id: "", name: "", phone: "", email: "", subject_specialty: "", designation: "", employee_type: "teacher" });

    const loadData = useCallback(async () => {
        const { data } = await supabase.from("teachers").select(TEACHER_COLUMNS).order("name");
        setEmployees((data as any) || []);
        setLoading(false);
    }, [supabase]);

    useEffect(() => { loadData(); }, [loadData]);

    const filteredEmployees = useMemo(() => {
        return employees.filter(e => 
            (e.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
            (e.phone || "").includes(searchQuery)
        );
    }, [employees, searchQuery]);

    const handleSaveTeacher = async () => {
        if (!teacherForm.name.trim()) { toast.error("Teacher name is required"); return; }
        setSubmitting(true);
        try {
            if (teacherForm.id) {
                const { error } = await supabase.from("teachers").update({
                    name: teacherForm.name, phone: teacherForm.phone, email: teacherForm.email,
                    subject_specialty: teacherForm.subject_specialty, designation: teacherForm.designation,
                    employee_type: teacherForm.employee_type
                }).eq("id", teacherForm.id);
                if (error) { toast.error(error.message); return; }
                toast.success("Employee updated");
            } else {
                const { error } = await supabase.from("teachers").insert({
                    name: teacherForm.name, phone: teacherForm.phone, email: teacherForm.email,
                    subject_specialty: teacherForm.subject_specialty, designation: teacherForm.designation,
                    employee_type: teacherForm.employee_type
                });
                if (error) { toast.error(error.message); return; }
                toast.success("Employee added");
            }
            setTeacherDialogOpen(false);
            loadData();
        } catch { toast.error("Failed to save teacher"); }
        finally { setSubmitting(false); }
    };

    const handleDeleteTeacher = async (id: string) => {
        const { error } = await supabase.from("teachers").delete().eq("id", id);
        if (error) { toast.error(error.message); return; }
        toast.success("Teacher deleted");
        loadData();
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
            <PageHeader
                icon={Users}
                title="Employees"
                subtitle="Manage teacher and staff profiles."
            />

        <Tabs defaultValue="teachers" className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
                <TabsList className="bg-muted/80 rounded-xl p-1 h-auto">
                    <TabsTrigger value="teachers" className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">Teachers ({filteredEmployees.filter(e => e.employee_type === 'teacher' || !e.employee_type).length})</TabsTrigger>
                    <TabsTrigger value="staff" className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">General Staff ({filteredEmployees.filter(e => e.employee_type === 'staff').length})</TabsTrigger>
                </TabsList>
                <div className="flex gap-2 items-center flex-wrap">
                    <div className="relative w-full max-w-xs sm:w-56">
                        <Search size={16} strokeWidth={1.5} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search..."
                            className="pl-8 h-9 text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button className="bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all duration-200 btn-press" onClick={() => { setTeacherForm({ id: "", name: "", phone: "", email: "", subject_specialty: "", designation: "", employee_type: "teacher" }); setTeacherDialogOpen(true); }}>
                        <Plus size={16} strokeWidth={1.5} className=" mr-1" /> Add Teacher
                    </Button>
                    <Button variant="outline" className="border-border/50 text-foreground font-semibold rounded-xl hover:bg-muted transition-all duration-200" onClick={() => { setTeacherForm({ id: "", name: "", phone: "", email: "", subject_specialty: "", designation: "", employee_type: "staff" }); setTeacherDialogOpen(true); }}>
                        <Plus size={16} strokeWidth={1.5} className=" mr-1" /> Add Staff
                    </Button>
                </div>
            </div>

            <TabsContent value="teachers" className="m-0">
            {filteredEmployees.filter(e => e.employee_type === 'teacher' || !e.employee_type).length === 0 ? (
                <Card className="border-dashed border-2 border-border/50 bg-transparent shadow-none">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Users size={48} strokeWidth={1.2} className=" text-muted-foreground/40 mb-4" />
                        <h3 className="font-semibold text-lg mb-1">No Teachers Added</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">Click &quot;Add Teacher&quot; to register a teacher.</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                            <Users size={16} strokeWidth={1.5} className=" text-muted-foreground" /> Teacher List
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Teacher Name</TableHead>
                                        <TableHead>Phone Number</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredEmployees.filter(e => e.employee_type === 'teacher' || !e.employee_type).map((t) => (
                                        <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedTeacherId(t.id); setProfileDialogOpen(true); }}>
                                            <TableCell className="font-medium">
                                                {t.name}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{t.phone || "—"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
            </TabsContent>

            <TabsContent value="staff" className="m-0">
            {filteredEmployees.filter(e => e.employee_type === 'staff').length === 0 ? (
                <Card className="border-dashed border-2 border-border/50 bg-transparent shadow-none">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Users size={48} strokeWidth={1.2} className=" text-muted-foreground/40 mb-4" />
                        <h3 className="font-semibold text-lg mb-1">No Staff Added</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">Click &quot;Add Staff&quot; to register general staff.</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                            <Users size={16} strokeWidth={1.5} className=" text-muted-foreground" /> Staff List
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Staff Name</TableHead>
                                        <TableHead>Phone Number</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredEmployees.filter(e => e.employee_type === 'staff').map((t) => (
                                        <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedTeacherId(t.id); setProfileDialogOpen(true); }}>
                                            <TableCell className="font-medium">
                                                {t.name}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{t.phone || "—"}</TableCell>
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

            {/* Teacher Dialog */}
            <Dialog open={teacherDialogOpen} onOpenChange={setTeacherDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{teacherForm.id ? "Edit" : "Add"} {teacherForm.employee_type === 'teacher' ? 'Teacher' : 'Staff'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label>Name *</Label>
                            <Input value={teacherForm.name} onChange={(e) => setTeacherForm((p) => ({ ...p, name: e.target.value }))} placeholder="Teacher name" />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Designation / Role</Label>
                            <Input value={teacherForm.designation} onChange={(e) => setTeacherForm((p) => ({ ...p, designation: e.target.value }))} placeholder={teacherForm.employee_type === 'teacher' ? "e.g. Senior Teacher" : "e.g. Accountant, Guard"} />
                        </div>
                        {teacherForm.employee_type === 'teacher' && (
                            <div className="grid gap-1.5">
                                <Label>Subject Specialty</Label>
                                <Input value={teacherForm.subject_specialty} onChange={(e) => setTeacherForm((p) => ({ ...p, subject_specialty: e.target.value }))} placeholder="e.g. Mathematics" />
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label>Phone</Label>
                                <Input value={teacherForm.phone} onChange={(e) => setTeacherForm((p) => ({ ...p, phone: e.target.value }))} placeholder="01XXXXXXXXX" />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Email</Label>
                                <Input value={teacherForm.email} onChange={(e) => setTeacherForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
                            </div>
                        </div>
                        <Button onClick={handleSaveTeacher} disabled={submitting} className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-none">
                            {submitting ? "Saving..." : teacherForm.id ? "Update" : "Save"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <TeacherProfileSheet
                open={profileDialogOpen}
                onOpenChange={setProfileDialogOpen}
                teacherId={selectedTeacherId}
                onTeacherUpdated={loadData}
                onRequestEdit={(t) => {
                    setTeacherForm({
                        id: t.id,
                        name: t.name || "",
                        phone: t.phone || "",
                        email: t.email || "",
                        subject_specialty: t.subject_specialty || "",
                        designation: t.designation || "",
                        employee_type: t.employee_type || "teacher",
                    });
                    setTeacherDialogOpen(true);
                }}
                onRequestDelete={(t) => handleDeleteTeacher(t.id)}
            />
        </div>
    );
}
