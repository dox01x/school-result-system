"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Room = {
    id: string;
    name: string;
    capacity: number;
    tables_count: number;
    seats_per_table: number;
    order_index: number;
};

export function RoomsTab() {
    const supabase = useMemo(() => createClient() as any, []);

    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);

    const [roomDialogOpen, setRoomDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [roomForm, setRoomForm] = useState({ id: "", name: "", capacity: 0, tables_count: 0, seats_per_table: 2, order_index: 0 });

    const loadData = useCallback(async () => {
        const { data, error } = await supabase.from("rooms").select("id, name, capacity, tables_count, seats_per_table, order_index").order("order_index");
        if (error) {
            toast.error("Failed to load rooms");
        } else {
            const r = ((data || []) as any[]).map((row: any) => ({
                id: row.id,
                name: row.name,
                capacity: row.capacity,
                tables_count: row.tables_count ?? 0,
                seats_per_table: row.seats_per_table ?? 2,
                order_index: row.order_index ?? 0
            }));
            setRooms(r);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => { loadData(); }, [loadData]);

    const filteredRooms = useMemo(() => {
        return rooms.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [rooms, searchQuery]);

    const handleSaveRoom = async () => {
        if (!roomForm.name.trim()) { toast.error("Room name is required"); return; }
        setSubmitting(true);
        try {
            const payload = {
                name: roomForm.name,
                capacity: roomForm.capacity,
                tables_count: roomForm.tables_count,
                seats_per_table: roomForm.seats_per_table,
                order_index: roomForm.order_index
            };
            
            if (roomForm.id) {
                const { error } = await supabase.from("rooms").update(payload).eq("id", roomForm.id);
                if (error) { toast.error(error.message); return; }
                toast.success("Room updated");
            } else {
                const { error } = await supabase.from("rooms").insert(payload);
                if (error) { toast.error(error.message); return; }
                toast.success("Room added");
            }
            setRoomDialogOpen(false);
            loadData();
        } catch { toast.error("Failed to save room"); }
        finally { setSubmitting(false); }
    };

    const handleDeleteRoom = async (id: string) => {
        if (!confirm("Are you sure you want to delete this room? It may affect schedules and seat plans.")) return;
        const { error } = await supabase.from("rooms").delete().eq("id", id);
        if (error) { toast.error(error.message); return; }
        toast.success("Room deleted");
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
        <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="relative w-full max-w-xs sm:w-64">
                    <Search size={16} strokeWidth={1.5} className="absolute left-3 top-2.5 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search rooms..."
                        className="pl-9 h-10 rounded-xl"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button 
                    className="bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all duration-200 h-10 px-4" 
                    onClick={() => { setRoomForm({ id: "", name: "", capacity: 0, tables_count: 0, seats_per_table: 2, order_index: rooms.length + 1 }); setRoomDialogOpen(true); }}
                >
                    <Plus size={16} strokeWidth={1.5} className="mr-1.5" /> Add Room
                </Button>
            </div>

            {filteredRooms.length === 0 ? (
                <Card className="border-dashed border-2 border-border/50 bg-transparent shadow-none rounded-2xl">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Building2 size={48} strokeWidth={1.2} className=" text-muted-foreground/40 mb-4" />
                        <h3 className="font-semibold text-lg mb-1">No Rooms Added</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">Click "Add Room" to configure classrooms and exam halls.</p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="rounded-2xl shadow-none border-border/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                            <Building2 size={16} strokeWidth={1.5} className=" text-muted-foreground" /> Exam Halls & Rooms
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Room Name</TableHead>
                                        <TableHead className="text-center">Tables</TableHead>
                                        <TableHead className="text-center">Seats per Table</TableHead>
                                        <TableHead className="text-center">Total Capacity</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRooms.map((r) => (
                                        <TableRow key={r.id} className="hover:bg-muted/50">
                                            <TableCell className="font-medium">
                                                {r.name}
                                                <div className="text-[10px] text-muted-foreground font-normal mt-0.5">Order Index: {r.order_index}</div>
                                            </TableCell>
                                            <TableCell className="text-center">{r.tables_count || "Not set"}</TableCell>
                                            <TableCell className="text-center">{r.seats_per_table}</TableCell>
                                            <TableCell className="text-center font-bold text-primary">
                                                {r.tables_count * r.seats_per_table > 0 ? r.tables_count * r.seats_per_table : r.capacity}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => { setRoomForm(r); setRoomDialogOpen(true); }}
                                                    className="h-8 px-2 mr-1"
                                                >
                                                    Edit
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => handleDeleteRoom(r.id)}
                                                    className="h-8 w-8 p-0 text-destructive hover:text-white hover:bg-destructive rounded-lg"
                                                >
                                                    <Trash2 size={14} />
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

            <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>{roomForm.id ? "Edit Room" : "Add Room"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleSaveRoom(); }} className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label>Room Name / Number *</Label>
                            <Input value={roomForm.name} onChange={(e) => setRoomForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Room 101, Exam Hall A" className="rounded-lg" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label>Number of Tables</Label>
                                <Input type="number" min="0" value={roomForm.tables_count} onChange={(e) => setRoomForm((p) => ({ ...p, tables_count: parseInt(e.target.value) || 0 }))} placeholder="e.g. 20" className="rounded-lg" />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Seats per Table</Label>
                                <Input type="number" min="1" value={roomForm.seats_per_table} onChange={(e) => setRoomForm((p) => ({ ...p, seats_per_table: parseInt(e.target.value) || 1 }))} placeholder="e.g. 2" className="rounded-lg" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label>Total Capacity</Label>
                                <Input type="number" min="0" value={roomForm.tables_count > 0 ? roomForm.tables_count * roomForm.seats_per_table : roomForm.capacity} onChange={(e) => setRoomForm((p) => ({ ...p, capacity: parseInt(e.target.value) || 0 }))} disabled={roomForm.tables_count > 0} className={`rounded-lg ${roomForm.tables_count > 0 ? "bg-muted text-muted-foreground" : ""}`} />
                                {roomForm.tables_count > 0 && <span className="text-[10px] text-muted-foreground italic -mt-1">Auto-calculated</span>}
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Sort Order Index</Label>
                                <Input type="number" value={roomForm.order_index} onChange={(e) => setRoomForm((p) => ({ ...p, order_index: parseInt(e.target.value) || 0 }))} placeholder="e.g. 1" className="rounded-lg" />
                            </div>
                        </div>
                        <Button type="submit" disabled={submitting} className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-none">
                            {submitting ? "Saving..." : roomForm.id ? "Update Room" : "Save Room"}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
