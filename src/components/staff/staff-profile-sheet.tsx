"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Staff } from "@/lib/database.types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, Shield, Trash2 } from "lucide-react";

type StaffProfileProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    staffId: string | null;
    onStaffUpdated?: () => void;
    onRequestEdit?: (staff: Staff) => void;
    onRequestDelete?: (staff: Staff) => void;
};

export function StaffProfileSheet({
    open,
    onOpenChange,
    staffId,
    onStaffUpdated,
    onRequestEdit,
    onRequestDelete,
}: StaffProfileProps) {
    const supabase = useMemo(() => createClient() as any, []);
    const [loading, setLoading] = useState(false);
    const [staff, setStaff] = useState<Staff | null>(null);
    const [salaryConfig, setSalaryConfig] = useState<any>(null);
    const [salaryPayments, setSalaryPayments] = useState<any[]>([]);
    const [actionForm, setActionForm] = useState({
        name: "",
        phone: "",
        email: "",
        designation: "",
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !staffId) return;
        let cancelled = false;
        setLoading(true);
        void (async () => {
            const { data: staffData, error } = await supabase
                .from("staffs")
                .select("id,name,phone,email,designation,created_at")
                .eq("id", staffId)
                .maybeSingle();
            if (cancelled) return;
            if (error || !staffData) {
                setLoading(false);
                return;
            }
            setStaff(staffData);
            setActionForm({
                name: staffData.name || "",
                phone: staffData.phone || "",
                email: staffData.email || "",
                designation: staffData.designation || "",
            });

            const [configRes, salaryRes] = await Promise.all([
                supabase.from("staff_salary_configs").select("id,basic_salary,allowances,deductions,effective_from,is_active").eq("staff_id", staffId).eq("is_active", true).maybeSingle(),
                supabase.from("staff_salary_payments").select("id,slip_number,month,year,net_salary,payment_date,payment_method").eq("staff_id", staffId).order("payment_date", { ascending: false }).limit(12),
            ]);

            if (cancelled) return;
            setSalaryConfig(configRes.data || null);
            setSalaryPayments(salaryRes.data || []);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [open, staffId, supabase]);

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
        if (!staff) return;
        setSaving(true);
        const { data, error } = await supabase
            .from("staffs")
            .update({
                name: actionForm.name.trim(),
                phone: actionForm.phone.trim(),
                email: actionForm.email.trim(),
                designation: actionForm.designation.trim(),
            })
            .eq("id", staff.id)
            .select("id,name,phone,email,designation,created_at")
            .single();
        setSaving(false);
        if (error) {
            toast.error(error.message);
            return;
        }
        setStaff(data);
        onStaffUpdated?.();
        toast.success("Staff profile updated");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[96vw] sm:max-w-[900px] p-0 gap-0 overflow-hidden bg-background">
                <DialogHeader className="border-b border-border/50 bg-muted/30 p-6">
                    <DialogTitle className="text-xl">Staff Profile</DialogTitle>
                    <DialogDescription>
                        Staff profile, payroll information and actions.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[80vh] h-[800px]">
                    {loading || !staff ? (
                        <div className="p-6 text-sm text-muted-foreground">Loading profile...</div>
                    ) : (
                        <div className="p-6 space-y-6">
                            {/* Header Card */}
                            <div className="rounded-2xl border-0 bg-muted/50 p-5">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-4">
                                        <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                            {staff.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-semibold text-foreground">{staff.name}</h3>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <Badge variant="secondary" className="bg-muted/80 text-foreground border-0 rounded-lg font-medium">{staff.designation || "Staff"}</Badge>
                                                <Badge variant="secondary" className="border-0 rounded-lg font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                                    STAFF
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => onRequestEdit?.(staff)}>
                                            <Pencil className="h-4 w-4 mr-1" strokeWidth={1.2} />Edit
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <Tabs defaultValue="overview" className="space-y-4">
                                <TabsList className="w-full justify-start overflow-x-auto bg-muted border-0 rounded-xl p-1">
                                    <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Overview</TabsTrigger>
                                    <TabsTrigger value="payroll" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Payroll</TabsTrigger>
                                    <TabsTrigger value="actions" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-none">Actions</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
                                            <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Phone</p><p className="font-medium">{staff.phone || "-"}</p></div>
                                            <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Email</p><p className="font-medium">{staff.email || "-"}</p></div>
                                            <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Designation</p><p className="font-medium">{staff.designation || "-"}</p></div>
                                            <div><p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Joined</p><p className="font-medium">{staff.created_at ? new Date(staff.created_at).toLocaleDateString("en-GB") : "-"}</p></div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="payroll" className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Current Salary Structure</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-4">
                                            <div className="rounded-xl border-0 bg-muted p-5">
                                                <p className="text-sm font-medium text-muted-foreground mb-1">Basic Salary</p>
                                                <p className="text-3xl font-bold text-foreground">{salaryNumbers.basic.toFixed(2)}</p>
                                            </div>
                                            <div className="rounded-xl border-0 bg-muted p-5">
                                                <p className="text-sm font-medium text-muted-foreground mb-1">Estimated Net</p>
                                                <p className="text-3xl font-bold text-foreground">{salaryNumbers.net.toFixed(2)}</p>
                                            </div>
                                            <div className="rounded-xl border-0 bg-muted p-5">
                                                <p className="text-sm font-medium text-muted-foreground mb-1">Allowances</p>
                                                <p className="text-3xl font-bold text-foreground">{salaryNumbers.allowances.toFixed(2)}</p>
                                            </div>
                                            <div className="rounded-xl border-0 bg-muted p-5">
                                                <p className="text-sm font-medium text-muted-foreground mb-1">Deductions</p>
                                                <p className="text-3xl font-bold text-foreground">{salaryNumbers.deductions.toFixed(2)}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Recent Payments</CardTitle></CardHeader>
                                        <CardContent className="space-y-3">
                                            {salaryPayments.length === 0 && <p className="text-sm text-muted-foreground font-medium">No salary history.</p>}
                                            {salaryPayments.map((s: any) => (
                                                <div key={s.id} className="flex items-center justify-between border-b border-border/40 pb-3 last:border-0 last:pb-0 text-sm">
                                                    <div className="flex flex-col gap-1">
                                                        <p className="font-semibold text-foreground">{s.month}/{s.year}</p>
                                                        <p className="text-xs font-mono text-muted-foreground">{s.slip_number}</p>
                                                    </div>
                                                    <div className="text-right flex flex-col gap-1">
                                                        <p className="font-semibold text-foreground">{Number(s.net_salary || 0).toFixed(2)}</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase">{s.payment_date || "-"}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="actions" className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Update Profile</CardTitle></CardHeader>
                                        <CardContent className="grid md:grid-cols-2 gap-4">
                                            <div className="space-y-1"><Label>Name</Label><Input value={actionForm.name} onChange={(e) => setActionForm((p) => ({ ...p, name: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Phone</Label><Input value={actionForm.phone} onChange={(e) => setActionForm((p) => ({ ...p, phone: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Email</Label><Input value={actionForm.email} onChange={(e) => setActionForm((p) => ({ ...p, email: e.target.value }))} /></div>
                                            <div className="space-y-1"><Label>Designation</Label><Input value={actionForm.designation} onChange={(e) => setActionForm((p) => ({ ...p, designation: e.target.value }))} /></div>
                                            <div className="md:col-span-2 mt-2">
                                                <Button onClick={handleSaveInline} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">System Access</CardTitle></CardHeader>
                                        <CardContent className="flex gap-2">
                                            <Button variant="outline"><Shield className="h-4 w-4 mr-2" strokeWidth={1.5} />Manage Access Controls</Button>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-red-200 bg-red-50/30">
                                        <CardHeader><CardTitle className="text-sm text-red-600">Danger Zone</CardTitle></CardHeader>
                                        <CardContent className="flex gap-2">
                                            <Button variant="destructive" onClick={() => onRequestDelete?.(staff)}><Trash2 className="h-4 w-4 mr-2" strokeWidth={1.5} />Delete Staff</Button>
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
