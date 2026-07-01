"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { STAFF_COLUMNS } from "@/lib/supabase/select-columns";
import type { Staff } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import { StaffProfileSheet } from "@/components/staff/staff-profile-sheet";

export default function StaffPage() {
    const supabase = useMemo(() => createClient() as any, []);

    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);

    const [staffDialogOpen, setStaffDialogOpen] = useState(false);
    const [profileDialogOpen, setProfileDialogOpen] = useState(false);
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [staffForm, setStaffForm] = useState({ id: "", name: "", phone: "", email: "", designation: "" });

    const loadData = useCallback(async () => {
        const { data } = await supabase.from("staffs").select(STAFF_COLUMNS).order("name");
        setStaffList((data as any) || []);
        setLoading(false);
    }, [supabase]);

    useEffect(() => { loadData(); }, [loadData]);

    const filteredStaff = useMemo(() => {
        return staffList.filter(s =>
            (s.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.phone || "").includes(searchQuery)
        );
    }, [staffList, searchQuery]);

    const handleSaveStaff = async () => {
        if (!staffForm.name.trim()) { toast.error("Staff name is required"); return; }
        setSubmitting(true);
        try {
            if (staffForm.id) {
                const { error } = await supabase.from("staffs").update({
                    name: staffForm.name, phone: staffForm.phone, email: staffForm.email,
                    designation: staffForm.designation,
                }).eq("id", staffForm.id);
                if (error) { toast.error(error.message); return; }
                toast.success("Staff updated");
            } else {
                const { error } = await supabase.from("staffs").insert({
                    name: staffForm.name, phone: staffForm.phone, email: staffForm.email,
                    designation: staffForm.designation,
                });
                if (error) { toast.error(error.message); return; }
                toast.success("Staff added");
            }
            setStaffDialogOpen(false);
            loadData();
        } catch { toast.error("Failed to save staff"); }
        finally { setSubmitting(false); }
    };

    const handleDeleteStaff = async (id: string) => {
        const { error } = await supabase.from("staffs").delete().eq("id", id);
        if (error) { toast.error(error.message); return; }
        toast.success("Staff deleted");
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
                icon={Briefcase}
                title="General Staff"
                subtitle="Manage non-teaching staff members."
            />

            <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="relative w-full max-w-xs sm:w-56">
                    <Search size={16} strokeWidth={1.5} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search staff..."
                        className="pl-8 h-9 text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button className="bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all duration-200 btn-press" onClick={() => { setStaffForm({ id: "", name: "", phone: "", email: "", designation: "" }); setStaffDialogOpen(true); }}>
                    <Plus size={16} strokeWidth={1.5} className=" mr-1" /> Add Staff
                </Button>
            </div>

            {filteredStaff.length === 0 ? (
                <Card className="border-dashed border-2 border-border/50 bg-transparent shadow-none">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Briefcase size={48} strokeWidth={1.2} className=" text-muted-foreground/40 mb-4" />
                        <h3 className="font-semibold text-lg mb-1">No Staff Added</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">Click &quot;Add Staff&quot; to register a general staff member.</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                            <Briefcase size={16} strokeWidth={1.5} className=" text-muted-foreground" /> Staff List ({filteredStaff.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Staff Name</TableHead>
                                        <TableHead>Designation</TableHead>
                                        <TableHead>Phone Number</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredStaff.map((s) => (
                                        <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedStaffId(s.id); setProfileDialogOpen(true); }}>
                                            <TableCell className="font-medium">{s.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{s.designation || "—"}</TableCell>
                                            <TableCell className="text-muted-foreground">{s.phone || "—"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Staff Dialog */}
            <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{staffForm.id ? "Edit" : "Add"} Staff</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label>Name *</Label>
                            <Input value={staffForm.name} onChange={(e) => setStaffForm((p) => ({ ...p, name: e.target.value }))} placeholder="Staff member name" />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Designation / Role</Label>
                            <Input value={staffForm.designation} onChange={(e) => setStaffForm((p) => ({ ...p, designation: e.target.value }))} placeholder="e.g. Accountant, Guard, Peon" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label>Phone</Label>
                                <Input value={staffForm.phone} onChange={(e) => setStaffForm((p) => ({ ...p, phone: e.target.value }))} placeholder="01XXXXXXXXX" />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Email</Label>
                                <Input value={staffForm.email} onChange={(e) => setStaffForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
                            </div>
                        </div>
                        <Button onClick={handleSaveStaff} disabled={submitting} className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-none">
                            {submitting ? "Saving..." : staffForm.id ? "Update" : "Save"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <StaffProfileSheet
                open={profileDialogOpen}
                onOpenChange={setProfileDialogOpen}
                staffId={selectedStaffId}
                onStaffUpdated={loadData}
                onRequestEdit={(s) => {
                    setStaffForm({
                        id: s.id,
                        name: s.name || "",
                        phone: s.phone || "",
                        email: s.email || "",
                        designation: s.designation || "",
                    });
                    setStaffDialogOpen(true);
                }}
                onRequestDelete={(s) => handleDeleteStaff(s.id)}
            />
        </div>
    );
}
