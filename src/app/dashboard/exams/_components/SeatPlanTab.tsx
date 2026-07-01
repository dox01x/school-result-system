"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Wand2, AlertTriangle } from "lucide-react";
import { autoAllocateSeats, RoomCapacity, SectionDemand } from "@/lib/exam-seat-utils";

interface SeatAllocationLocal {
    room_id: string;
    class_id: string;
    section_id: string;
    allocated_students: number;
}

interface ExamScheduleEntry {
    class_id: string;
    subject_id: string;
    start_time: string;
    end_time: string;
}

export function SeatPlanTab({ exams }: { exams: { id: string; name: string }[] }) {
    const [selectedExam, setSelectedExam] = useState<string>("");
    const [selectedShift, setSelectedShift] = useState<string>("");

    const [rooms, setRooms] = useState<RoomCapacity[]>([]);
    const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
    const [sections, setSections] = useState<{ id: string; class_id: string; name: string }[]>([]);
    const [students, setStudents] = useState<{ id: string; class_id: string; section_id: string }[]>([]);
    const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
    const [schedules, setSchedules] = useState<ExamScheduleEntry[]>([]);
    
    const [allocations, setAllocations] = useState<SeatAllocationLocal[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const supabase = useMemo(() => createClient() as any, []);

    const fetchBaseData = useCallback(async () => {
        setLoading(true);
        try {
            const [roomsRes, classesRes, sectionsRes, studentsRes, subjectsRes] = await Promise.all([
                supabase.from("rooms").select("id, name, capacity, tables_count, seats_per_table, order_index").order("order_index", { ascending: true }),
                supabase.from("classes").select("id, name, numeric_value").order("numeric_value", { ascending: true }),
                supabase.from("sections").select("id, class_id, name"),
                supabase.from("students").select("id, class_id, section_id"),
                supabase.from("subjects").select("id, name")
            ]);

            const parsedRooms: RoomCapacity[] = ((roomsRes.data || []) as any[]).map((r: any) => ({
                id: r.id,
                name: r.name,
                tables_count: r.tables_count ?? 0,
                seats_per_table: r.seats_per_table ?? 2,
                order_index: r.order_index ?? 0,
                capacity: (r.tables_count ?? 0) * (r.seats_per_table ?? 2)
            }));

            setRooms(parsedRooms);
            setClasses(classesRes.data || []);
            setSections(sectionsRes.data || []);
            setStudents(studentsRes.data || []);
            setSubjects(subjectsRes.data || []);
        } catch {
            toast.error("Failed to load base data for seat plan");
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchBaseData();
    }, [fetchBaseData]);

    // Fetch schedules when exam selected
    useEffect(() => {
        if (!selectedExam) {
            setSchedules([]);
            setSelectedShift("");
            return;
        }
        const fetchSchedules = async () => {
            const { data } = await supabase
                .from("exam_schedules")
                .select("class_id, subject_id, start_time, end_time")
                .eq("exam_id", selectedExam);
            setSchedules(data || []);
            setSelectedShift("");
        };
        fetchSchedules();
    }, [selectedExam, supabase]);

    // Derived Shifts
    const availableShifts = useMemo(() => {
        const shifts = schedules.map(s => `${s.start_time}||${s.end_time}`);
        // Sort the shifts chronologically
        return Array.from(new Set(shifts)).sort();
    }, [schedules]);

    const activeSchedules = useMemo(() => {
        if (!selectedShift) return [];
        const [start, end] = selectedShift.split("||");
        return schedules.filter(s => s.start_time === start && s.end_time === end);
    }, [schedules, selectedShift]);

    const fetchAllocations = useCallback(async () => {
        if (!selectedExam || !selectedShift) {
            setAllocations([]);
            return;
        }
        const [start, end] = selectedShift.split("||");
        try {
            const { data, error } = await supabase.from("exam_seat_plans")
                .select("id, class_id, section_id, room_id, allocated_students")
                .eq("exam_id", selectedExam)
                .eq("start_time", start)
                .eq("end_time", end);
            if (error) throw error;
            setAllocations(((data || []) as any[]).map((d: any) => ({
                room_id: d.room_id,
                class_id: d.class_id,
                section_id: d.section_id,
                allocated_students: d.allocated_students
            })));
        } catch {
            toast.error("Failed to load existing seat allocations");
        }
    }, [selectedExam, selectedShift, supabase]);

    useEffect(() => {
        fetchAllocations();
    }, [fetchAllocations]);

    const unconfiguredRooms = useMemo(() => rooms.filter(r => r.tables_count === 0), [rooms]);
    const configuredRooms = useMemo(() => rooms.filter(r => r.tables_count > 0), [rooms]);

    // Generate demands from active students whose class is in the active schedule
    const activeDemands = useMemo(() => {
        const activeClassIds = new Set(activeSchedules.map(s => s.class_id));
        const demandsMap = new Map<string, number>();
        students.forEach(s => {
            if (activeClassIds.has(s.class_id)) {
                const key = `${s.class_id}||${s.section_id}`;
                demandsMap.set(key, (demandsMap.get(key) || 0) + 1);
            }
        });

        const demands: SectionDemand[] = [];
        demandsMap.forEach((count, key) => {
            const [class_id, section_id] = key.split("||");
            demands.push({ class_id, section_id, student_count: count });
        });
        return demands;
    }, [students, activeSchedules]);

    const handleAutoAllocate = () => {
        if (!selectedExam || !selectedShift) {
            toast.warning("Please select exam and shift first");
            return;
        }

        if (configuredRooms.length === 0) {
            toast.error("No rooms with table configuration found. Please set tables_count for rooms first.");
            return;
        }

        const newAllocations = autoAllocateSeats(activeDemands, configuredRooms);
        setAllocations(newAllocations);

        const totalStudents = activeDemands.reduce((sum, d) => sum + d.student_count, 0);
        const placedStudents = newAllocations.reduce((sum, a) => sum + a.allocated_students, 0);
        
        if (placedStudents < totalStudents) {
            toast.warning(`Auto-allocation complete but ${totalStudents - placedStudents} students could not be placed (insufficient room capacity). Please save to apply.`);
        } else {
            toast.success("Auto-allocation complete. Please save to apply changes.");
        }
    };

    const handleSave = async () => {
        if (!selectedExam || !selectedShift) return;
        setSaving(true);
        const [start_time, end_time] = selectedShift.split("||");
        try {
            await supabase.from("exam_seat_plans").delete()
                .eq("exam_id", selectedExam)
                .eq("start_time", start_time)
                .eq("end_time", end_time);
            
            const inserts = allocations.map(a => ({
                exam_id: selectedExam,
                start_time,
                end_time,
                room_id: a.room_id,
                class_id: a.class_id,
                section_id: a.section_id,
                allocated_students: a.allocated_students
            }));

            if (inserts.length > 0) {
                const { error } = await supabase.from("exam_seat_plans").insert(inserts);
                if (error) throw error;
            }
            
            toast.success("Seat plan saved successfully");
            fetchAllocations();
        } catch {
            toast.error("Failed to save seat plan");
        } finally {
            setSaving(false);
        }
    };

    const roomUtilization = useMemo(() => {
        const util = new Map<string, { used: number; sections: { name: string; count: number }[] }>();
        allocations.forEach(a => {
            const current = util.get(a.room_id) || { used: 0, sections: [] };
            current.used += a.allocated_students;
            
            const cls = classes.find(c => c.id === a.class_id);
            const sec = sections.find(s => s.id === a.section_id);

            if (cls && sec) {
                current.sections.push({
                    name: `${cls.name} - ${sec.name}`,
                    count: a.allocated_students
                });
            }
            util.set(a.room_id, current);
        });
        return util;
    }, [allocations, classes, sections]);

    const unallocatedDemands = useMemo(() => {
        const demands = new Map<string, number>();
        activeDemands.forEach(d => {
            const key = `${d.class_id}||${d.section_id}`;
            demands.set(key, d.student_count);
        });

        allocations.forEach(a => {
            const key = `${a.class_id}||${a.section_id}`;
            demands.set(key, (demands.get(key) || 0) - a.allocated_students);
        });

        const unallocated: { name: string; count: number }[] = [];
        demands.forEach((count, key) => {
            if (count > 0) {
                const [class_id, section_id] = key.split("||");
                const cls = classes.find(c => c.id === class_id);
                const sec = sections.find(s => s.id === section_id);
                if (cls && sec) {
                    unallocated.push({
                        name: `${cls.name} - ${sec.name}`,
                        count
                    });
                }
            }
        });
        return unallocated;
    }, [activeDemands, allocations, classes, sections]);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                    <SelectTrigger className="w-[200px] h-11 rounded-xl border-0 bg-muted text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Select Exam" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50 shadow-md">
                        {exams.map(e => <SelectItem key={e.id} value={e.id} className="rounded-lg">{e.name}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={selectedShift} onValueChange={setSelectedShift} disabled={!selectedExam || availableShifts.length === 0}>
                    <SelectTrigger className="w-[200px] h-11 rounded-xl border-0 bg-muted text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Select Shift" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50 shadow-md">
                        {availableShifts.map((s, idx) => {
                            return <SelectItem key={s} value={s} className="rounded-lg">Shift {idx + 1}</SelectItem>;
                        })}
                    </SelectContent>
                </Select>

                <div className="ml-auto flex gap-2">
                    <Button 
                        variant="secondary" 
                        onClick={handleAutoAllocate} 
                        disabled={!selectedShift || loading}
                        className="h-11 rounded-xl font-semibold shadow-none transition-all duration-200"
                    >
                        <Wand2 className="mr-2 h-4 w-4" /> Auto Allocate
                    </Button>
                    
                    <Button 
                        onClick={handleSave} 
                        disabled={!selectedShift || saving || allocations.length === 0}
                        className="h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-none transition-all duration-200"
                    >
                        <Save className="mr-2 h-4 w-4" /> Save Seat Plan
                    </Button>
                </div>
            </div>

            {selectedExam && availableShifts.length === 0 && schedules.length === 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 text-sm mb-4">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <span className="text-amber-700 dark:text-amber-300">
                        No exam schedule found for this exam. Please create an exam schedule with shifts first from 
                        <strong> Administration → Exam Schedule</strong>.
                    </span>
                </div>
            )}

            {unconfiguredRooms.length > 0 && selectedShift && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 text-sm mb-4">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div>
                        <span className="font-semibold text-amber-700 dark:text-amber-300">
                            {unconfiguredRooms.length} room(s) have no table configuration:
                        </span>{" "}
                        <span className="text-amber-600 dark:text-amber-400">
                            {unconfiguredRooms.map(r => r.name).join(", ")}. 
                            Set <code className="text-xs bg-amber-200/50 dark:bg-amber-800/50 px-1 rounded">tables_count</code> and <code className="text-xs bg-amber-200/50 dark:bg-amber-800/50 px-1 rounded">seats_per_table</code> in the rooms settings.
                        </span>
                    </div>
                </div>
            )}

            {unallocatedDemands.length > 0 && selectedShift && (
                <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 shadow-none rounded-2xl mb-4">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-base font-semibold text-amber-700 dark:text-amber-300">Unallocated Students</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">These students could not be placed due to insufficient room capacity.</p>
                        <div className="space-y-1">
                            {unallocatedDemands.map((u, idx) => (
                                <div key={idx} className="flex justify-between text-sm bg-white/50 dark:bg-black/20 px-2 py-1 rounded-md">
                                    <span className="text-amber-800 dark:text-amber-200 font-medium">{u.name}</span>
                                    <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300">{u.count} Left</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {selectedShift && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {rooms.map(room => {
                        const util = roomUtilization.get(room.id);
                        const used = util?.used || 0;
                        const isFull = room.capacity > 0 && used >= room.capacity;
                        const isOver = room.capacity > 0 && used > room.capacity;
                        const isUnconfigured = room.tables_count === 0;

                        return (
                            <Card key={room.id} className={`border-border/50 shadow-none rounded-2xl transition-colors ${isOver ? 'border-destructive' : ''} ${isUnconfigured ? 'opacity-50' : ''}`}>
                                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-base font-semibold">{room.name}</CardTitle>
                                    <Badge variant={isOver ? 'destructive' : isFull ? 'default' : 'secondary'} className="rounded-md">
                                        {used} / {room.capacity}
                                    </Badge>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-muted-foreground mb-3">
                                        {isUnconfigured 
                                            ? "Not configured" 
                                            : `${room.tables_count} Tables × ${room.seats_per_table} Seats`
                                        }
                                    </div>
                                    {util?.sections && util.sections.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {util.sections.map((s, idx) => (
                                                <div key={idx} className="flex flex-col text-sm bg-muted/50 px-2 py-1.5 rounded-md border border-border/30">
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-medium">{s.name}</span>
                                                        <span className="font-mono text-xs font-bold">{s.count}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm italic text-muted-foreground">Empty</div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
