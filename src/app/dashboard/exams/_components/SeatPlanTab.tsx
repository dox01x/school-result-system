"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Wand2, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { autoAllocateSeats, RoomCapacity, SectionDemand } from "@/lib/exam-seat-utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
    const [classes, setClasses] = useState<{ id: string; name: string; numeric_value?: number | null }[]>([]);
    const [sections, setSections] = useState<{ id: string; class_id: string; name: string }[]>([]);
    const [students, setStudents] = useState<{ id: string; class_id: string; section_id: string }[]>([]);
    const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
    const [schedules, setSchedules] = useState<ExamScheduleEntry[]>([]);
    
    const [allocations, setAllocations] = useState<SeatAllocationLocal[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // States for manual seat allocation
    const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
    const [manualClassId, setManualClassId] = useState<string>("");
    const [manualSectionId, setManualSectionId] = useState<string>("");
    const [manualRoomId, setManualRoomId] = useState<string>("");
    const [manualStudentCount, setManualStudentCount] = useState<number>(0);

    // Custom demands state to allow specifying/editing student counts for auto seat planning
    const [customDemands, setCustomDemands] = useState<Record<string, number>>({});

    // Automatically calculate and prefill manual student count based on selection
    useEffect(() => {
        if (manualClassId && manualSectionId) {
            const total = students.filter(s => s.class_id === manualClassId && s.section_id === manualSectionId).length;
            const allocated = allocations
                .filter(a => a.class_id === manualClassId && a.section_id === manualSectionId)
                .reduce((sum, a) => sum + a.allocated_students, 0);
            setManualStudentCount(Math.max(0, total - allocated));
        } else {
            setManualStudentCount(0);
        }
    }, [manualClassId, manualSectionId, students, allocations]);

    const handleAddManualAllocation = () => {
        if (!selectedExam || !selectedShift) {
            toast.warning("Please select exam and shift first");
            return;
        }
        if (!manualClassId || !manualSectionId || !manualRoomId) {
            toast.error("Please select class, section, and room");
            return;
        }
        if (manualStudentCount <= 0) {
            toast.error("Number of students must be greater than 0");
            return;
        }

        const room = rooms.find(r => r.id === manualRoomId);
        if (!room) return;

        const otherAllocatedInRoom = allocations
            .filter(a => a.room_id === manualRoomId && !(a.class_id === manualClassId && a.section_id === manualSectionId))
            .reduce((sum, a) => sum + a.allocated_students, 0);
        
        if (otherAllocatedInRoom + manualStudentCount > room.capacity) {
            toast.warning(`Warning: Total allocations (${otherAllocatedInRoom + manualStudentCount}) exceed room capacity (${room.capacity})`);
        }

        setAllocations(prev => {
            const existingIdx = prev.findIndex(
                a => a.room_id === manualRoomId && a.class_id === manualClassId && a.section_id === manualSectionId
            );
            if (existingIdx > -1) {
                const next = [...prev];
                next[existingIdx] = {
                    ...next[existingIdx],
                    allocated_students: manualStudentCount
                };
                return next;
            } else {
                return [...prev, {
                    room_id: manualRoomId,
                    class_id: manualClassId,
                    section_id: manualSectionId,
                    allocated_students: manualStudentCount
                }];
            }
        });

        toast.success("Seat allocation added/updated");
        setIsManualDialogOpen(false);
        setManualClassId("");
        setManualSectionId("");
        setManualRoomId("");
        setManualStudentCount(0);
    };

    const handleUpdateAllocationCount = (roomId: string, classId: string, sectionId: string, count: number) => {
        if (count < 0) return;
        
        setAllocations(prev => {
            const idx = prev.findIndex(a => a.room_id === roomId && a.class_id === classId && a.section_id === sectionId);
            if (idx === -1) return prev;

            const next = [...prev];
            if (count === 0) {
                next.splice(idx, 1);
            } else {
                next[idx] = {
                    ...next[idx],
                    allocated_students: count
                };
            }
            return next;
        });
    };

    const handleRemoveAllocation = (roomId: string, classId: string, sectionId: string) => {
        setAllocations(prev => prev.filter(
            a => !(a.room_id === roomId && a.class_id === classId && a.section_id === sectionId)
        ));
        toast.success("Allocation removed");
    };

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

            let fetchedSections = sectionsRes.data || [];
            const classesWithNoSections = (classesRes.data || []).filter(
                (cls: any) => !fetchedSections.some((sec: any) => sec.class_id === cls.id)
            );

            if (classesWithNoSections.length > 0) {
                const inserts = classesWithNoSections.map((cls: any) => ({
                    class_id: cls.id,
                    name: "A"
                }));
                const { data: newSecs, error: insertErr } = await supabase
                    .from("sections")
                    .insert(inserts)
                    .select("id, class_id, name");
                
                if (!insertErr && newSecs) {
                    fetchedSections = [...fetchedSections, ...newSecs];
                }
            }

            setRooms(parsedRooms);
            setClasses(classesRes.data || []);
            setSections(fetchedSections);
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

    const activeClassIds = useMemo(() => {
        return new Set(activeSchedules.map(s => s.class_id));
    }, [activeSchedules]);

    // Read shift configuration from localStorage
    const shiftClassIds = useMemo(() => {
        if (!selectedExam || !selectedShift) return new Set<string>();
        const [start, end] = selectedShift.split("||");
        try {
            const saved = localStorage.getItem(`exam_config_${selectedExam}`);
            if (saved) {
                const config = JSON.parse(saved);
                const currentConfigShift = config.shifts?.find((s: any) => {
                    const normTime = (t: string) => t.substring(0, 5); // Normalise to HH:MM format
                    return normTime(s.start_time) === normTime(start) && normTime(s.end_time) === normTime(end);
                });
                if (currentConfigShift) {
                    return new Set<string>(currentConfigShift.class_ids || []);
                }
            }
        } catch (err) {
            console.error("Error reading shift config from localStorage", err);
        }
        return new Set<string>();
    }, [selectedExam, selectedShift]);

    // Use shifts config class list if present, otherwise fallback to database schedules
    const allowedClassIds = useMemo(() => {
        if (shiftClassIds.size > 0) return shiftClassIds;
        return activeClassIds;
    }, [shiftClassIds, activeClassIds]);

    // Generate demands list containing only classes & sections in this shift, sorted by class numeric_value
    const classDemands = useMemo(() => {
        const list: { class_id: string; section_id: string; class_name: string; section_name: string; db_count: number; numeric_value: number }[] = [];
        
        sections.forEach(sec => {
            if (allowedClassIds.has(sec.class_id)) {
                const cls = classes.find(c => c.id === sec.class_id);
                if (cls) {
                    const dbCount = students.filter(s => s.class_id === sec.class_id && s.section_id === sec.id).length;
                    list.push({
                        class_id: sec.class_id,
                        section_id: sec.id,
                        class_name: cls.name,
                        section_name: sec.name,
                        db_count: dbCount,
                        numeric_value: cls.numeric_value ?? 999
                    });
                }
            }
        });
        
        return list.sort((a, b) => {
            const classCompare = (a.numeric_value ?? 0) - (b.numeric_value ?? 0);
            if (classCompare !== 0) return classCompare;
            return a.section_name.localeCompare(b.section_name, undefined, { numeric: true });
        });
    }, [classes, sections, students, allowedClassIds]);

    // Populate custom demands: prefill database counts for the visible classes
    useEffect(() => {
        const initialDemands: Record<string, number> = {};
        classDemands.forEach(d => {
            const key = `${d.class_id}||${d.section_id}`;
            initialDemands[key] = d.db_count;
        });
        setCustomDemands(initialDemands);
    }, [classDemands]);

    const handleUpdateCustomDemand = (classId: string, sectionId: string, count: number) => {
        const key = `${classId}||${sectionId}`;
        setCustomDemands(prev => ({
            ...prev,
            [key]: Math.max(0, count)
        }));
    };

    const handleAutoAllocate = () => {
        if (!selectedExam || !selectedShift) {
            toast.warning("Please select exam and shift first");
            return;
        }

        if (configuredRooms.length === 0) {
            toast.error("No rooms with table configuration found. Please set tables_count for rooms first.");
            return;
        }

        // Convert customDemands record to SectionDemand array
        const demands: SectionDemand[] = Object.entries(customDemands)
            .map(([key, count]) => {
                const [class_id, section_id] = key.split("||");
                return { class_id, section_id, student_count: count };
            })
            .filter(d => d.student_count > 0);

        if (demands.length === 0) {
            toast.warning("Please specify student counts for at least one class/section");
            return;
        }

        const newAllocations = autoAllocateSeats(demands, configuredRooms);
        setAllocations(newAllocations);

        const totalStudents = demands.reduce((sum, d) => sum + d.student_count, 0);
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
        const util = new Map<string, { used: number; sections: { name: string; count: number; class_id: string; section_id: string }[] }>();
        allocations.forEach(a => {
            const current = util.get(a.room_id) || { used: 0, sections: [] };
            current.used += a.allocated_students;
            
            const cls = classes.find(c => c.id === a.class_id);
            const sec = sections.find(s => s.id === a.section_id);

            if (cls && sec) {
                current.sections.push({
                    name: `${cls.name} - ${sec.name}`,
                    count: a.allocated_students,
                    class_id: a.class_id,
                    section_id: a.section_id
                });
            }
            util.set(a.room_id, current);
        });
        return util;
    }, [allocations, classes, sections]);

    const unallocatedDemands = useMemo(() => {
        const demands = new Map<string, number>();
        
        Object.entries(customDemands).forEach(([key, count]) => {
            demands.set(key, count);
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
    }, [customDemands, allocations, classes, sections]);

    const sectionTotalStudents = useMemo(() => {
        if (!manualClassId || !manualSectionId) return 0;
        return students.filter(s => s.class_id === manualClassId && s.section_id === manualSectionId).length;
    }, [students, manualClassId, manualSectionId]);

    const sectionAllocatedStudents = useMemo(() => {
        if (!manualClassId || !manualSectionId) return 0;
        return allocations
            .filter(a => a.class_id === manualClassId && a.section_id === manualSectionId)
            .reduce((sum, a) => sum + a.allocated_students, 0);
    }, [allocations, manualClassId, manualSectionId]);

    const sectionRemainingStudents = Math.max(0, sectionTotalStudents - sectionAllocatedStudents);

    const selectedRoom = rooms.find(r => r.id === manualRoomId);
    const roomCapacity = selectedRoom ? selectedRoom.capacity : 0;
    const roomAllocated = allocations
        .filter(a => a.room_id === manualRoomId)
        .reduce((sum, a) => sum + a.allocated_students, 0);
    const roomRemainingCapacity = Math.max(0, roomCapacity - roomAllocated);

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
                        variant="outline" 
                        onClick={() => setIsManualDialogOpen(true)} 
                        disabled={!selectedShift || loading}
                        className="h-11 rounded-xl font-semibold border-border/50 text-foreground bg-background hover:bg-muted shadow-none transition-all duration-200"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add Allocation
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

            {selectedShift && (
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left Column: Student Demands box */}
                    <div className="w-full lg:w-80 shrink-0">
                        <Card className="border-border/50 shadow-none rounded-2xl">
                            <CardHeader className="pb-3 border-b border-border/30">
                                <CardTitle className="text-base font-bold text-foreground">Student Demands</CardTitle>
                                <p className="text-xs text-muted-foreground">Specify total student counts for each class/section in this shift.</p>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                                    {classDemands.map(d => {
                                        const key = `${d.class_id}||${d.section_id}`;
                                        const value = customDemands[key] ?? 0;
                                        const isScheduled = activeClassIds.has(d.class_id);
                                        return (
                                            <div key={key} className={`flex items-center justify-between gap-3 text-sm py-1.5 px-2 rounded-xl border border-transparent transition-colors ${isScheduled ? 'bg-primary/5 border-primary/10' : ''}`}>
                                                <div className="flex flex-col">
                                                    <span className={`font-semibold text-foreground ${isScheduled ? 'text-primary' : ''}`}>
                                                        {d.class_name} - {d.section_name}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                        DB Count: {d.db_count}
                                                        {isScheduled && (
                                                            <Badge variant="outline" className="text-[8px] h-4 px-1 rounded bg-primary/10 text-primary border-0 font-medium uppercase tracking-wider scale-90 origin-left">
                                                                Scheduled
                                                            </Badge>
                                                        )}
                                                    </span>
                                                </div>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={value || ""}
                                                    onChange={(e) => handleUpdateCustomDemand(d.class_id, d.section_id, parseInt(e.target.value) || 0)}
                                                    className={`w-20 h-9 text-center font-semibold rounded-lg bg-background text-foreground border-border/50 focus:ring-1 ${isScheduled ? 'border-primary/20 focus:ring-primary' : ''}`}
                                                    placeholder="0"
                                                />
                                            </div>
                                        );
                                    })}
                                    {classDemands.length === 0 && (
                                        <div className="text-sm italic text-muted-foreground text-center py-4">No classes found in the system.</div>
                                    )}
                                </div>
                                
                                <Button 
                                    onClick={handleAutoAllocate} 
                                    disabled={loading || classDemands.length === 0}
                                    className="w-full h-11 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold shadow-none transition-all duration-200"
                                >
                                    <Wand2 className="mr-2 h-4 w-4" /> Auto Allocate
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Rooms Grid and Unallocated Students list */}
                    <div className="flex-1 space-y-4">
                        {unallocatedDemands.length > 0 && (
                            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 shadow-none rounded-2xl">
                                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-base font-semibold text-amber-700 dark:text-amber-300">Unallocated Students</CardTitle>
                                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">These students could not be placed due to insufficient room capacity.</p>
                                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                                        {unallocatedDemands.map((u, idx) => (
                                            <div key={idx} className="flex justify-between text-sm bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800">
                                                <span className="text-amber-800 dark:text-amber-200 font-medium">{u.name}</span>
                                                <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300">{u.count} Left</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

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
                                                <div className="space-y-2">
                                                    {util.sections.map((s, idx) => (
                                                        <div key={idx} className="flex items-center justify-between gap-2 text-sm bg-muted/50 pl-3 pr-2 py-1.5 rounded-xl border border-border/30">
                                                            <span className="font-semibold text-foreground truncate">{s.name}</span>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    value={s.count}
                                                                    onChange={(e) => {
                                                                        const count = parseInt(e.target.value) || 0;
                                                                        handleUpdateAllocationCount(room.id, s.class_id, s.section_id, count);
                                                                    }}
                                                                    className="w-16 h-8 text-center font-mono font-bold rounded-lg border-border/50 bg-background text-foreground"
                                                                />
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg"
                                                                    onClick={() => handleRemoveAllocation(room.id, s.class_id, s.section_id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
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
                    </div>
                </div>
            )}
            <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Add Seat Allocation</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2 text-foreground">
                        <div className="grid gap-1.5">
                            <Label>Class</Label>
                            <Select value={manualClassId} onValueChange={(v) => { setManualClassId(v); setManualSectionId(""); }}>
                                <SelectTrigger className="rounded-lg">
                                    <SelectValue placeholder="Select Class" />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg">
                                    {classes.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="grid gap-1.5">
                            <Label>Section</Label>
                            <Select value={manualSectionId} onValueChange={setManualSectionId} disabled={!manualClassId}>
                                <SelectTrigger className="rounded-lg">
                                    <SelectValue placeholder="Select Section" />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg">
                                    {sections.filter(s => s.class_id === manualClassId).map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {manualClassId && manualSectionId && (
                            <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border/30 -mt-1">
                                Registered students in database: <span className="font-semibold text-foreground">{sectionTotalStudents}</span> 
                                {` `}(Remaining unallocated: <span className="font-semibold text-foreground">{sectionRemainingStudents}</span>)
                            </div>
                        )}

                        <div className="grid gap-1.5">
                            <Label>Room / Hall</Label>
                            <Select value={manualRoomId} onValueChange={setManualRoomId}>
                                <SelectTrigger className="rounded-lg">
                                    <SelectValue placeholder="Select Room" />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg">
                                    {rooms.map(r => (
                                        <SelectItem key={r.id} value={r.id}>{r.name} (Cap: {r.capacity})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {manualRoomId && (
                            <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border/30 -mt-1">
                                Room capacity: <span className="font-semibold text-foreground">{roomCapacity}</span> 
                                {` `}(Remaining: <span className="font-semibold text-foreground">{roomRemainingCapacity}</span>)
                            </div>
                        )}

                        <div className="grid gap-1.5">
                            <Label>Number of Students</Label>
                            <Input
                                type="number"
                                min="1"
                                value={manualStudentCount || ""}
                                onChange={(e) => setManualStudentCount(parseInt(e.target.value) || 0)}
                                placeholder="e.g. 25"
                                className="rounded-lg"
                            />
                        </div>

                        <Button 
                            onClick={handleAddManualAllocation} 
                            className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-none"
                        >
                            Add Allocation
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
