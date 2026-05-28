"use client";

import { useEffect, useState, useCallback } from "react";
import type { Notice } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, Plus, Trash2, Pencil, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";

const AUDIENCES = [
    { value: "all", label: "All" },
    { value: "students", label: "Students" },
    { value: "parents", label: "Parents" },
    { value: "teachers", label: "Teachers" },
];

const PRIORITIES = [
    { value: "low", label: "Low" },
    { value: "normal", label: "Normal" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" },
];

export default function NoticeBoardPage() {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [filterAudience, setFilterAudience] = useState("all");

    const [formData, setFormData] = useState({
        id: "",
        title: "",
        content: "",
        audience: "all",
        priority: "normal",
    });

    const loadNotices = useCallback(async () => {
        try {
            const url = filterAudience !== "all"
                ? `/api/administration/notice?audience=${filterAudience}`
                : "/api/administration/notice";
            const res = await fetch(url);
            const result = await res.json();
            if (result.success) setNotices(result.data || []);
        } catch {
            toast.error("Failed to load notices");
        } finally {
            setLoading(false);
        }
    }, [filterAudience]);

    useEffect(() => { loadNotices(); }, [loadNotices]);

    const openAddDialog = () => {
        setFormData({ id: "", title: "", content: "", audience: "all", priority: "normal" });
        setDialogOpen(true);
    };

    const openEditDialog = (n: Notice) => {
        setFormData({ id: n.id, title: n.title, content: n.content, audience: n.audience, priority: n.priority });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.title.trim() || !formData.content.trim()) {
            toast.error("Title and content are required");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/administration/notice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const result = await res.json();
            if (!result.success) { toast.error(result.error); return; }
            toast.success(formData.id ? "Notice updated" : "Notice created");
            setDialogOpen(false);
            loadNotices();
        } catch {
            toast.error("Failed to save notice");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/administration/notice?id=${id}`, { method: "DELETE" });
            const result = await res.json();
            if (!result.success) { toast.error(result.error); return; }
            toast.success("Notice deleted");
            loadNotices();
        } catch {
            toast.error("Failed to delete notice");
        }
    };

    const handlePrintNotice = (n: Notice) => {
        void (async () => {
        let school: { name?: string; address?: string; phone?: string; email?: string } | null = null;
        try {
            const res = await fetch("/api/school-info");
            const json = await res.json();
            if (json?.success && json.data) school = json.data;
        } catch {
            school = null;
        }

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${n.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4 portrait;margin:15mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Poppins',sans-serif;color:#1a202c;line-height:1.7}
.school{text-align:center;border-bottom:2px solid #1a365d;padding-bottom:10px;margin-bottom:14px}
.school .name{font-size:18px;color:#0f172a;font-weight:800;letter-spacing:.2px}
.school .line{font-size:11px;color:#475569;margin-top:2px}
.header{text-align:center;margin:10px 0 16px 0}
.header h1{font-size:16px;color:#1a365d;letter-spacing:2px}
.meta{display:flex;justify-content:space-between;font-size:11px;color:#718096;margin-bottom:16px}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600}
.title{font-size:20px;font-weight:700;margin-bottom:12px;color:#2d3748}
.content{font-size:13px;white-space:pre-wrap;color:#4a5568}
.footer{margin-top:40px;border-top:1px solid #e2e8f0;padding-top:12px;text-align:center;font-size:10px;color:#a0aec0}
</style></head><body>
<div class="school">
  <div class="name">${school?.name ? school.name : "School"}</div>
  ${school?.address ? `<div class="line">${school.address}</div>` : ``}
  <div class="line">
    ${school?.phone ? `Phone: ${school.phone}` : ``}
    ${school?.phone && school?.email ? ` &nbsp; • &nbsp; ` : ``}
    ${school?.email ? `Email: ${school.email}` : ``}
  </div>
</div>
<div class="header"><h1>NOTICE</h1></div>
<div class="meta"><span>Date: ${(() => { const _d = new Date(n.created_at); return `${_d.getDate().toString().padStart(2,'0')}/${(_d.getMonth()+1).toString().padStart(2,'0')}/${_d.getFullYear()}`; })()}</span><span>Audience: ${n.audience.charAt(0).toUpperCase() + n.audience.slice(1)}</span></div>
<div class="title">${n.title}</div>
<div class="content">${n.content}</div>
<div class="footer">This is a system-generated notice.</div>
</body></html>`;

        const w = window.open("", "_blank", "width=800,height=900");
        if (w) { w.document.write(html); w.document.close(); w.onload = () => { setTimeout(() => w.print(), 500); }; }
        })();
    };

    const priorityColor = (p: string) => {
        const map: Record<string, string> = {
            low: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400",
            normal: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
            high: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
            urgent: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
        };
        return map[p] || "";
    };

    const audienceColor = (a: string) => {
        const map: Record<string, string> = {
            all: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
            students: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
            parents: "bg-emerald-100 text-primary dark:bg-emerald-500/10 dark:text-emerald-400",
            teachers: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
        };
        return map[a] || "";
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                icon={Megaphone}
                iconBg="bg-purple-50"
                iconColor="text-purple-600"
                title="Notice Board"
                subtitle="Create and manage notices for students, parents, and teachers."
                actions={
                    <Button size="sm" onClick={openAddDialog} className="bg-blue-600 text-white rounded-xl hover:bg-blue-700 btn-press">
                        <Plus className="h-4 w-4 mr-1" /> New Notice
                    </Button>
                }
            />

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center gap-3">
                    <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Audience</p>
                        <Select value={filterAudience} onValueChange={setFilterAudience}>
                            <SelectTrigger className="w-[160px] h-9 rounded-lg border-slate-200 bg-white text-sm"><SelectValue placeholder="Filter by audience" /></SelectTrigger>
                            <SelectContent>{AUDIENCES.map((a) => (<SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>))}</SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {notices.length === 0 ? (
                <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-semibold text-lg mb-1">No Notices</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">Click &quot;New Notice&quot; to create an announcement.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {notices.map((n) => (
                        <Card key={n.id} className="group">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                                    <span className="flex-1 min-w-0 truncate">{n.title}</span>
                                    <Badge className={priorityColor(n.priority)}>{n.priority}</Badge>
                                    <Badge className={audienceColor(n.audience)}>{n.audience}</Badge>
                                    <span className="text-[11px] text-muted-foreground font-normal">
                                        {(() => { const _d = new Date(n.created_at); return `${_d.getDate().toString().padStart(2,'0')}/${(_d.getMonth()+1).toString().padStart(2,'0')}/${_d.getFullYear()}`; })()}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <p className="text-[13px] text-muted-foreground whitespace-pre-wrap line-clamp-3">{n.content}</p>
                                <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEditDialog(n)}>
                                        <Pencil className="h-3 w-3 mr-1" /> Edit
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handlePrintNotice(n)}>
                                        <Printer className="h-3 w-3 mr-1" /> Print
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400" onClick={() => handleDelete(n.id)}>
                                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (open) setTimeout(() => document.getElementById("notice-title")?.focus(), 100); }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{formData.id ? "Edit" : "Create"} Notice</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label>Title *</Label>
                            <Input id="notice-title" value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} placeholder="Notice title" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("notice-content")?.focus(); }}} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Content *</Label>
                            <Textarea id="notice-content" value={formData.content} onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))} placeholder="Write the notice content..." rows={5} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleSave(); }}} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label>Audience</Label>
                                <Select value={formData.audience} onValueChange={(v) => setFormData((p) => ({ ...p, audience: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{AUDIENCES.map((a) => (<SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Priority</Label>
                                <Select value={formData.priority} onValueChange={(v) => setFormData((p) => ({ ...p, priority: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{PRIORITIES.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Button onClick={handleSave} disabled={submitting} className="mt-2">
                            {submitting ? "Saving..." : formData.id ? "Update Notice" : "Create Notice"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
