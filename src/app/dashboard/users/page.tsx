"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { ALL_ROLES, ROLE_LABELS_EN, ROLE_COLORS, isSuperAdmin } from "@/lib/rbac";
import type { UserRole } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    Shield, Plus, Trash2, UserCog, Loader2, Mail, KeyRound,
    Users, AlertTriangle, CheckCircle2
} from "lucide-react";

type UserData = {
    id: string;
    email: string;
    role: UserRole;
    full_name: string;
    created_at: string;
    last_sign_in_at: string | null;
    assignments: { class_id: string; section_id: string; class_name: string; section_name: string }[];
};

type ClassSection = {
    class_id: string;
    class_name: string;
    section_id: string;
    section_name: string;
};

export default function UsersPage() {
    const { role } = useUserRole();
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [editUser, setEditUser] = useState<UserData | null>(null);
    const [deleteUser, setDeleteUser] = useState<UserData | null>(null);
    const [classSections, setClassSections] = useState<ClassSection[]>([]);
    const [actionLoading, setActionLoading] = useState(false);

    // Create form state
    const [createEmail, setCreateEmail] = useState("");
    const [createPassword, setCreatePassword] = useState("");
    const [createRole, setCreateRole] = useState<UserRole>("admin");
    const [createFullName, setCreateFullName] = useState("");
    const [createAssignments, setCreateAssignments] = useState<{ class_id: string; section_id: string }[]>([]);

    // Edit form state
    const [editRole, setEditRole] = useState<UserRole>("admin");
    const [editFullName, setEditFullName] = useState("");
    const [editAssignments, setEditAssignments] = useState<{ class_id: string; section_id: string }[]>([]);

    const supabase = useMemo(() => createClient(), []);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/users");
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            } else {
                const err = await res.json();
                toast.error(err.error || "Failed to load users");
            }
        } catch {
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchClassSections = useCallback(async () => {
        const { data: classes } = await supabase.from("classes").select("id, name").order("numeric_value");
        const { data: sections } = await supabase.from("sections").select("id, name, class_id").order("name");

        if (classes && sections) {
            const classMap = new Map(classes.map(c => [c.id, c.name]));
            const result: ClassSection[] = sections.map(s => ({
                class_id: s.class_id,
                class_name: classMap.get(s.class_id) || "",
                section_id: s.id,
                section_name: s.name,
            }));
            setClassSections(result);
        }
    }, [supabase]);

    useEffect(() => {
        void fetchUsers();
        void fetchClassSections();
    }, [fetchUsers, fetchClassSections]);

    async function handleCreateUser(e: React.FormEvent) {
        e.preventDefault();
        setActionLoading(true);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: createEmail.trim(),
                    password: createPassword,
                    role: createRole,
                    full_name: createFullName.trim(),
                    assignments: createRole === "class_teacher" ? createAssignments : [],
                }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`User ${data.email} created successfully`);
                setShowCreateDialog(false);
                resetCreateForm();
                void fetchUsers();
            } else {
                toast.error(data.error || "Failed to create user");
            }
        } catch {
            toast.error("Failed to create user");
        } finally {
            setActionLoading(false);
        }
    }

    async function handleUpdateUser(e: React.FormEvent) {
        e.preventDefault();
        if (!editUser) return;
        setActionLoading(true);
        try {
            const res = await fetch("/api/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: editUser.id,
                    role: editRole,
                    full_name: editFullName.trim(),
                    assignments: editRole === "class_teacher" ? editAssignments : [],
                }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("User updated successfully");
                setShowEditDialog(false);
                void fetchUsers();
            } else {
                toast.error(data.error || "Failed to update user");
            }
        } catch {
            toast.error("Failed to update user");
        } finally {
            setActionLoading(false);
        }
    }

    async function handleDeleteUser() {
        if (!deleteUser) return;
        setActionLoading(true);
        try {
            const res = await fetch("/api/users", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: deleteUser.id }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("User deleted");
                setShowDeleteDialog(false);
                setDeleteUser(null);
                void fetchUsers();
            } else {
                toast.error(data.error || "Failed to delete user");
            }
        } catch {
            toast.error("Failed to delete user");
        } finally {
            setActionLoading(false);
        }
    }

    function resetCreateForm() {
        setCreateEmail("");
        setCreatePassword("");
        setCreateRole("admin");
        setCreateFullName("");
        setCreateAssignments([]);
    }

    function openEdit(user: UserData) {
        setEditUser(user);
        setEditRole(user.role);
        setEditFullName(user.full_name);
        setEditAssignments(user.assignments.map(a => ({ class_id: a.class_id, section_id: a.section_id })));
        setShowEditDialog(true);
    }

    function toggleAssignment(list: { class_id: string; section_id: string }[], cs: ClassSection) {
        const exists = list.find(a => a.class_id === cs.class_id && a.section_id === cs.section_id);
        if (exists) return list.filter(a => !(a.class_id === cs.class_id && a.section_id === cs.section_id));
        return [...list, { class_id: cs.class_id, section_id: cs.section_id }];
    }

    if (!isSuperAdmin(role)) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle size={32} strokeWidth={1.5} className="text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
                <p className="text-muted-foreground text-sm">Only Super Admin can access User Management.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Shield size={22} strokeWidth={1.5} className="text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground font-heading">User Management</h2>
                        <p className="text-xs text-muted-foreground">{users.length} users registered</p>
                    </div>
                </div>
                <Button
                    onClick={() => { resetCreateForm(); setShowCreateDialog(true); }}
                    className="gap-2"
                >
                    <Plus size={16} strokeWidth={2.5} />
                    Add User
                </Button>
            </div>

            {/* Users Table */}
            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Users size={40} strokeWidth={1} className="text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No users found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-[11px] text-muted-foreground/70 border-b border-border/40 uppercase tracking-wider bg-muted/20">
                                    <th className="text-left py-3 px-5 font-semibold">User</th>
                                    <th className="text-left py-3 px-5 font-semibold">Role</th>
                                    <th className="text-left py-3 px-5 font-semibold hidden md:table-cell">Last Sign In</th>
                                    <th className="text-left py-3 px-5 font-semibold hidden lg:table-cell">Assignments</th>
                                    <th className="text-right py-3 px-5 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {users.map(user => (
                                    <tr key={user.id} className="group hover:bg-muted/30 transition-colors">
                                        <td className="py-4 px-5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary text-xs font-bold">
                                                    {(user.full_name || user.email)?.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-foreground truncate">
                                                        {user.full_name || "—"}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-5">
                                            <span className={cn(
                                                "inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-lg",
                                                ROLE_COLORS[user.role]
                                            )}>
                                                {ROLE_LABELS_EN[user.role]}
                                            </span>
                                        </td>
                                        <td className="py-4 px-5 hidden md:table-cell">
                                            <span className="text-xs text-muted-foreground">
                                                {user.last_sign_in_at
                                                    ? new Date(user.last_sign_in_at).toLocaleDateString("en-GB", {
                                                        day: "2-digit", month: "short", year: "numeric",
                                                        hour: "2-digit", minute: "2-digit",
                                                    })
                                                    : "Never"}
                                            </span>
                                        </td>
                                        <td className="py-4 px-5 hidden lg:table-cell">
                                            {user.role === "class_teacher" && user.assignments.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {user.assignments.map((a, i) => (
                                                        <span key={i} className="text-[10px] font-semibold text-muted-foreground px-1 py-0.5">
                                                            {a.class_name} - {a.section_name}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/50">—</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => openEdit(user)}
                                                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
                                                    title="Edit user"
                                                >
                                                    <UserCog size={16} strokeWidth={2} />
                                                </button>
                                                {user.role !== "super_admin" && (
                                                    <button
                                                        onClick={() => { setDeleteUser(user); setShowDeleteDialog(true); }}
                                                        className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                                                        title="Delete user"
                                                    >
                                                        <Trash2 size={16} strokeWidth={2} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create User Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-heading">
                            <Plus size={20} strokeWidth={2} className="text-primary" />
                            Create New User
                        </DialogTitle>
                        <DialogDescription>
                            Add a new user to the system. They can sign in with these credentials.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateUser} className="space-y-4 mt-2">
                        <div className="space-y-2">
                            <Label htmlFor="create-name">Full Name</Label>
                            <Input
                                id="create-name"
                                value={createFullName}
                                onChange={(e) => setCreateFullName(e.target.value)}
                                placeholder="Muhammad Ali"
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-email">
                                <span className="flex items-center gap-1.5"><Mail size={14} /> Email</span>
                            </Label>
                            <Input
                                id="create-email"
                                type="email"
                                required
                                value={createEmail}
                                onChange={(e) => setCreateEmail(e.target.value)}
                                placeholder="user@school.edu"
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-password">
                                <span className="flex items-center gap-1.5"><KeyRound size={14} /> Password</span>
                            </Label>
                            <Input
                                id="create-password"
                                type="password"
                                required
                                minLength={6}
                                value={createPassword}
                                onChange={(e) => setCreatePassword(e.target.value)}
                                placeholder="Min 6 characters"
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={createRole} onValueChange={(v) => setCreateRole(v as UserRole)}>
                                <SelectTrigger className="h-10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ALL_ROLES.map(r => (
                                        <SelectItem key={r} value={r}>
                                            <span className="flex items-center gap-2">
                                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", ROLE_COLORS[r])}>
                                                    {ROLE_LABELS_EN[r]}
                                                </span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {createRole === "class_teacher" && (
                            <div className="space-y-2">
                                <Label>Class Assignments</Label>
                                <p className="text-xs text-muted-foreground">Select which class/section this teacher manages</p>
                                <div className="max-h-[200px] overflow-y-auto border border-border rounded-xl p-2 space-y-1">
                                    {classSections.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-4">No classes found. Create classes first.</p>
                                    ) : classSections.map(cs => {
                                        const selected = createAssignments.some(a => a.class_id === cs.class_id && a.section_id === cs.section_id);
                                        return (
                                            <button
                                                key={cs.section_id}
                                                type="button"
                                                onClick={() => setCreateAssignments(toggleAssignment(createAssignments, cs))}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                                                    selected
                                                        ? "bg-primary/10 text-primary font-semibold"
                                                        : "hover:bg-muted/80 text-muted-foreground"
                                                )}
                                            >
                                                <span>{cs.class_name} — {cs.section_name}</span>
                                                {selected && <CheckCircle2 size={16} strokeWidth={2.5} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={actionLoading} className="gap-2">
                                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={16} />}
                                Create User
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-heading">
                            <UserCog size={20} strokeWidth={2} className="text-primary" />
                            Edit User
                        </DialogTitle>
                        <DialogDescription>
                            {editUser?.email}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateUser} className="space-y-4 mt-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Full Name</Label>
                            <Input
                                id="edit-name"
                                value={editFullName}
                                onChange={(e) => setEditFullName(e.target.value)}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                                <SelectTrigger className="h-10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ALL_ROLES.map(r => (
                                        <SelectItem key={r} value={r}>
                                            <span className="flex items-center gap-2">
                                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", ROLE_COLORS[r])}>
                                                    {ROLE_LABELS_EN[r]}
                                                </span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {editRole === "class_teacher" && (
                            <div className="space-y-2">
                                <Label>Class Assignments</Label>
                                <div className="max-h-[200px] overflow-y-auto border border-border rounded-xl p-2 space-y-1">
                                    {classSections.map(cs => {
                                        const selected = editAssignments.some(a => a.class_id === cs.class_id && a.section_id === cs.section_id);
                                        return (
                                            <button
                                                key={cs.section_id}
                                                type="button"
                                                onClick={() => setEditAssignments(toggleAssignment(editAssignments, cs))}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                                                    selected
                                                        ? "bg-primary/10 text-primary font-semibold"
                                                        : "hover:bg-muted/80 text-muted-foreground"
                                                )}
                                            >
                                                <span>{cs.class_name} — {cs.section_name}</span>
                                                {selected && <CheckCircle2 size={16} strokeWidth={2.5} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={actionLoading} className="gap-2">
                                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg text-red-600">
                            <AlertTriangle size={20} strokeWidth={2} />
                            Delete User
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{deleteUser?.email}</strong>?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => setShowDeleteDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => void handleDeleteUser()}
                            disabled={actionLoading}
                            className="gap-2"
                        >
                            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={16} />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
