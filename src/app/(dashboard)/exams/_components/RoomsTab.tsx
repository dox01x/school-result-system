"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Search, Trash2 as Trash, Pencil, Users, Hash } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Room = {
    id: string;
    name: string;
    capacity: number;
    tables_count: number;
    seats_per_table: number;
    order_index: number;
};

export function RoomsTab() {
    const supabase = useMemo(() => createClient(), []);

    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);

    const [roomDialogOpen, setRoomDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [roomForm, setRoomForm] = useState({
        id: "",
        name: "",
        capacity: 40,
        tables_count: 20,
        seats_per_table: 2,
        order_index: 0,
    });
    const [formError, setFormError] = useState("");

    const [confirmDeleteState, setConfirmDeleteState] = useState<{
        open: boolean;
        room: Room | null;
    }>({ open: false, room: null });

    const loadData = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from("rooms")
                .select("id, name, capacity, tables_count, seats_per_table, order_index")
                .order("order_index");
            if (error) throw error;
            const r = (data || []).map((row) => ({
                id: row.id,
                name: row.name,
                capacity: row.capacity,
                tables_count: row.tables_count ?? 0,
                seats_per_table: row.seats_per_table ?? 2,
                order_index: row.order_index ?? 0,
            }));
            setRooms(r);
        } catch {
            toast.error("Failed to load rooms");
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredRooms = useMemo(() => {
        return rooms.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [rooms, searchQuery]);

    const metrics = useMemo(() => {
        const totalCapacity = rooms.reduce(
            (acc, r) => acc + (r.tables_count * r.seats_per_table > 0 ? r.tables_count * r.seats_per_table : r.capacity),
            0
        );
        const totalTables = rooms.reduce((acc, r) => acc + (r.tables_count || 0), 0);
        return {
            totalRooms: rooms.length,
            totalCapacity,
            totalTables,
        };
    }, [rooms]);

    const validateForm = () => {
        if (!roomForm.name.trim()) {
            setFormError("Room name is required");
            return false;
        }
        if (roomForm.tables_count < 0) {
            setFormError("Number of tables cannot be negative");
            return false;
        }
        if (roomForm.seats_per_table < 1) {
            setFormError("Seats per table must be at least 1");
            return false;
        }
        setFormError("");
        return true;
    };

    const handleSaveRoom = async () => {
        if (!validateForm()) return;
        setSubmitting(true);
        try {
            const calculatedCap =
                roomForm.tables_count > 0
                    ? roomForm.tables_count * roomForm.seats_per_table
                    : roomForm.capacity;

            const payload = {
                name: roomForm.name.trim(),
                capacity: calculatedCap,
                tables_count: roomForm.tables_count,
                seats_per_table: roomForm.seats_per_table,
                order_index: roomForm.order_index,
            };

            if (roomForm.id) {
                const { error } = await supabase.from("rooms").update(payload).eq("id", roomForm.id);
                if (error) throw error;
                toast.success("Room updated successfully");
            } else {
                const { error } = await supabase.from("rooms").insert(payload);
                if (error) throw error;
                toast.success("Room added successfully");
            }
            setRoomDialogOpen(false);
            loadData();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save room");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteRoom = async () => {
        const room = confirmDeleteState.room;
        if (!room) return;

        try {
            const { error } = await supabase.from("rooms").delete().eq("id", room.id);
            if (error) throw error;
            toast.success(`Room "${room.name}" deleted`);
            setConfirmDeleteState({ open: false, room: null });
            loadData();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to delete room");
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border">
                <div className="relative w-full max-w-xs sm:w-64">
                    <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search rooms..."
                        className="pl-9 h-9.5 text-xs rounded-xl bg-muted/40 border-border/80"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                        className="bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 h-9.5 px-4 shadow-none gap-1.5"
                        onClick={() => {
                            setRoomForm({
                                id: "",
                                name: "",
                                capacity: 40,
                                tables_count: 20,
                                seats_per_table: 2,
                                order_index: rooms.length + 1,
                            });
                            setFormError("");
                            setRoomDialogOpen(true);
                        }}
                    >
                        <Plus size={15} /> Add Room
                    </Button>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card className="bg-card rounded-2xl border-border shadow-none">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Configured Rooms</p>
                            <p className="text-xl font-black text-foreground">{metrics.totalRooms}</p>
                            <p className="text-[11px] text-muted-foreground font-medium">Classrooms &amp; Halls</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <Building2 size={18} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card rounded-2xl border-border shadow-none">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Seating Capacity</p>
                            <p className="text-xl font-black text-foreground">{metrics.totalCapacity}</p>
                            <p className="text-[11px] text-muted-foreground font-medium">Examinees capacity</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <Users size={18} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card rounded-2xl border-border shadow-none col-span-2 md:col-span-1">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Tables</p>
                            <p className="text-xl font-black text-foreground">{metrics.totalTables}</p>
                            <p className="text-[11px] text-muted-foreground font-medium">Benches &amp; Desks</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Hash size={18} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {filteredRooms.length === 0 ? (
                <Card className="border-dashed border-2 border-border bg-transparent shadow-none rounded-2xl">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                        <Building2 size={40} strokeWidth={1.2} className="text-muted-foreground/40" />
                        <h3 className="font-semibold text-lg text-foreground">No Rooms Configured</h3>
                        <p className="text-xs text-muted-foreground max-w-sm">
                            Click &quot;Add Room&quot; to configure classrooms and examination halls with seating tables.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="rounded-2xl shadow-none border-border bg-card overflow-hidden">
                    <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Building2 size={14} className="text-primary" /> Exam Halls &amp; Classrooms
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                            {filteredRooms.length} Rooms
                        </Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                                        <TableHead className="text-xs font-bold">Room Name / No.</TableHead>
                                        <TableHead className="text-center text-xs font-bold">Tables Count</TableHead>
                                        <TableHead className="text-center text-xs font-bold">Seats Per Table</TableHead>
                                        <TableHead className="text-center text-xs font-bold">Total Capacity</TableHead>
                                        <TableHead className="text-right text-xs font-bold">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRooms.map((r) => (
                                        <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                                            <TableCell className="font-bold text-xs text-foreground">
                                                {r.name}
                                                <div className="text-[10px] text-muted-foreground font-normal">
                                                    Order Priority: {r.order_index}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center text-xs text-muted-foreground font-mono">
                                                {r.tables_count || "—"}
                                            </TableCell>
                                            <TableCell className="text-center text-xs text-muted-foreground font-mono">
                                                {r.seats_per_table}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className="font-mono font-bold text-xs rounded-lg border-primary/30 text-primary bg-primary/10">
                                                    {r.tables_count * r.seats_per_table > 0
                                                        ? r.tables_count * r.seats_per_table
                                                        : r.capacity}{" "}
                                                    Seats
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setRoomForm(r);
                                                            setFormError("");
                                                            setRoomDialogOpen(true);
                                                        }}
                                                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                                                    >
                                                        <Pencil size={13} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setConfirmDeleteState({ open: true, room: r })}
                                                        className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20"
                                                    >
                                                        <Trash size={13} />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Dialog: Add/Edit Room */}
            <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <Building2 size={18} className="text-primary" />
                            {roomForm.id ? "Edit Room" : "Add Room"}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Define hall name, table count, and seating arrangement.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveRoom();
                        }}
                        className="space-y-4 py-2"
                    >
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Room Name / Number *</Label>
                            <Input
                                value={roomForm.name}
                                onChange={(e) => {
                                    setRoomForm((p) => ({ ...p, name: e.target.value }));
                                    if (formError) setFormError("");
                                }}
                                placeholder="e.g. Room 101, Main Auditorium, Hall A"
                                className="rounded-xl h-10 text-xs font-medium"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Number of Tables</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={roomForm.tables_count}
                                    onChange={(e) =>
                                        setRoomForm((p) => ({
                                            ...p,
                                            tables_count: parseInt(e.target.value, 10) || 0,
                                        }))
                                    }
                                    placeholder="20"
                                    className="rounded-xl h-10 text-xs font-medium"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Seats per Table</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={roomForm.seats_per_table}
                                    onChange={(e) =>
                                        setRoomForm((p) => ({
                                            ...p,
                                            seats_per_table: parseInt(e.target.value, 10) || 1,
                                        }))
                                    }
                                    placeholder="2"
                                    className="rounded-xl h-10 text-xs font-medium"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Total Capacity</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={
                                        roomForm.tables_count > 0
                                            ? roomForm.tables_count * roomForm.seats_per_table
                                            : roomForm.capacity
                                    }
                                    onChange={(e) =>
                                        setRoomForm((p) => ({
                                            ...p,
                                            capacity: parseInt(e.target.value, 10) || 0,
                                        }))
                                    }
                                    disabled={roomForm.tables_count > 0}
                                    className={`rounded-xl h-10 text-xs font-medium ${
                                        roomForm.tables_count > 0 ? "bg-muted text-muted-foreground font-bold" : ""
                                    }`}
                                />
                                {roomForm.tables_count > 0 && (
                                    <span className="text-[10px] text-muted-foreground italic">
                                        Calculated: {roomForm.tables_count} × {roomForm.seats_per_table}
                                    </span>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Sort Order</Label>
                                <Input
                                    type="number"
                                    value={roomForm.order_index}
                                    onChange={(e) =>
                                        setRoomForm((p) => ({
                                            ...p,
                                            order_index: parseInt(e.target.value, 10) || 0,
                                        }))
                                    }
                                    placeholder="1"
                                    className="rounded-xl h-10 text-xs font-medium"
                                />
                            </div>
                        </div>

                        {formError && (
                            <p className="text-xs text-destructive font-medium">{formError}</p>
                        )}

                        <DialogFooter className="gap-2 pt-2">
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl text-xs font-semibold"
                                >
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold text-xs shadow-none"
                            >
                                {submitting ? "Saving..." : roomForm.id ? "Update Room" : "Save Room"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirm Delete Dialog */}
            <ConfirmDialog
                open={confirmDeleteState.open}
                onOpenChange={(open) => {
                    if (!open) setConfirmDeleteState({ open: false, room: null });
                }}
                title={`Delete Room "${confirmDeleteState.room?.name}"?`}
                description="This room will be removed. Existing seat plans or invigilation duties scheduled for this room may be affected."
                confirmLabel="Delete Room"
                variant="destructive"
                onConfirm={handleDeleteRoom}
            />
        </div>
    );
}
