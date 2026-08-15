"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Wand2, AlertTriangle, Plus, Trash2, Printer, Tag, FileText, ChevronDown } from "lucide-react";
import { autoAllocateSeats, RoomCapacity, SectionDemand } from "@/lib/exam-seat-utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { printHtml } from "@/lib/print-utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

interface SchoolInfo {
    name: string;
    address: string;
    phone: string;
    email: string;
    logo_url?: string;
}

export function SeatPlanTab({ exams }: { exams: { id: string; name: string }[] }) {
    const [selectedExam, setSelectedExam] = useState<string>("");
    const [selectedShift, setSelectedShift] = useState<string>("");

    const [rooms, setRooms] = useState<RoomCapacity[]>([]);
    const [classes, setClasses] = useState<{ id: string; name: string; numeric_value?: number | null }[]>([]);
    const [sections, setSections] = useState<{ id: string; class_id: string; name: string }[]>([]);
    const [students, setStudents] = useState<{ id: string; class_id: string; section_id: string; roll?: string; name?: string }[]>([]);
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
    const [schedules, setSchedules] = useState<ExamScheduleEntry[]>([]);
    
    const [allocations, setAllocations] = useState<SeatAllocationLocal[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // States for Desk Slip Filter Dialog
    const [isPrintDeskStickersDialogOpen, setIsPrintDeskStickersDialogOpen] = useState(false);
    const [printClassFilter, setPrintClassFilter] = useState<string>("all");
    const [printSectionFilter, setPrintSectionFilter] = useState<string>("all");
    const [printRoomFilter, setPrintRoomFilter] = useState<string>("all");

    // States for manual seat allocation
    const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
    const [manualClassId, setManualClassId] = useState<string>("");
    const [manualSectionId, setManualSectionId] = useState<string>("");
    const [manualRoomId, setManualRoomId] = useState<string>("");
    const [manualStudentCount, setManualStudentCount] = useState<number>(0);

    // Custom demands state to allow specifying/editing student counts for auto seat planning
    const [customDemands, setCustomDemands] = useState<Record<string, number>>({});

    // All available classes for desk slips (sorted by numeric value)
    const deskSlipClasses = useMemo(() => {
        return [...classes].sort((a, b) => (a.numeric_value ?? 999) - (b.numeric_value ?? 999));
    }, [classes]);

    // All available sections for selected class or all sections
    const deskSlipSections = useMemo(() => {
        if (printClassFilter === "all") return sections;
        return sections.filter(s => s.class_id === printClassFilter);
    }, [sections, printClassFilter]);

    // Calculate matching slips count for dialog preview directly from students database
    const matchingDeskSlipsCount = useMemo(() => {
        return students.filter(s => {
            if (printClassFilter !== "all" && s.class_id !== printClassFilter) return false;
            if (printSectionFilter !== "all" && s.section_id !== printSectionFilter) return false;
            return true;
        }).length;
    }, [students, printClassFilter, printSectionFilter]);

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
            next[idx] = {
                ...next[idx],
                allocated_students: count
            };
            return next;
        });
    };

    const handleRemoveAllocation = (roomId: string, classId: string, sectionId: string) => {
        setAllocations(prev => prev.filter(
            a => !(a.room_id === roomId && a.class_id === classId && a.section_id === sectionId)
        ));
        toast.success("Allocation removed");
    };

    const supabase = useMemo(() => createClient(), []);

    const fetchBaseData = useCallback(async () => {
        setLoading(true);
        try {
            const [roomsRes, classesRes, sectionsRes, studentsRes, schoolRes] = await Promise.all([
                supabase.from("rooms").select("id, name, capacity, tables_count, seats_per_table, order_index").order("order_index", { ascending: true }),
                supabase.from("classes").select("id, name, numeric_value").order("numeric_value", { ascending: true }),
                supabase.from("sections").select("id, class_id, name"),
                supabase.from("students").select("id, class_id, section_id, roll, name"),
                (supabase as any).from("school_info").select("name, address, phone, email, logo_url").limit(1).single(),
            ]);

            if (schoolRes.data) {
                setSchoolInfo(schoolRes.data as SchoolInfo);
            }

            const parsedRooms: RoomCapacity[] = (roomsRes.data || []).map((r) => ({
                id: r.id,
                name: r.name,
                tables_count: r.tables_count ?? 0,
                seats_per_table: r.seats_per_table ?? 2,
                order_index: r.order_index ?? 0,
                capacity: (r.tables_count ?? 0) * (r.seats_per_table ?? 2) > 0 
                    ? (r.tables_count ?? 0) * (r.seats_per_table ?? 2) 
                    : (r.capacity ?? 0)
            }));

            let fetchedSections = sectionsRes.data || [];
            const classesWithNoSections = (classesRes.data || []).filter(
                (cls) => !fetchedSections.some((sec) => sec.class_id === cls.id)
            );

            if (classesWithNoSections.length > 0) {
                const inserts = classesWithNoSections.map((cls) => ({
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
        } catch {
            toast.error("Failed to load base data for seat plan");
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchBaseData();
    }, [fetchBaseData]);

    const [examConfig, setExamConfig] = useState<{
        shifts?: Array<{ id: string; name: string; start_time: string; end_time: string; class_ids?: string[] }>;
        dates?: string[];
        instructions?: any[];
    } | null>(null);

    // Fetch schedules and config when exam selected
    useEffect(() => {
        if (!selectedExam) {
            setSchedules([]);
            setSelectedShift("");
            setExamConfig(null);
            return;
        }

        let isCancelled = false;

        const fetchSchedules = async () => {
            const { data } = await supabase
                .from("exam_schedules")
                .select("class_id, subject_id, start_time, end_time")
                .eq("exam_id", selectedExam);
            if (!isCancelled) {
                setSchedules(data || []);
                setSelectedShift("");
            }
        };

        const fetchConfig = async () => {
            try {
                const res = await fetch(`/api/administration/exam-schedule/config?exam_id=${selectedExam}`);
                const result = await res.json();
                if (!isCancelled && result.success && result.data) {
                    setExamConfig(result.data);
                    return;
                }
            } catch {}

            if (!isCancelled) {
                try {
                    const saved = localStorage.getItem(`exam_config_${selectedExam}`);
                    if (saved) setExamConfig(JSON.parse(saved));
                } catch {}
            }
        };

        fetchSchedules();
        fetchConfig();

        return () => {
            isCancelled = true;
        };
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
            setAllocations((data || []).map((d) => ({
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

    const unconfiguredRooms = useMemo(() => rooms.filter(r => r.tables_count === 0 && r.capacity === 0), [rooms]);
    const configuredRooms = useMemo(() => rooms.filter(r => r.capacity > 0), [rooms]);

    const activeClassIds = useMemo(() => {
        return new Set(activeSchedules.map(s => s.class_id));
    }, [activeSchedules]);

    // Read shift configuration from examConfig (database API) with localStorage fallback
    const shiftClassIds = useMemo(() => {
        if (!selectedExam || !selectedShift) return new Set<string>();
        const [start, end] = selectedShift.split("||");
        const normTime = (t: string) => (t || "").substring(0, 5); // Normalise to HH:MM format

        // 1. Check in loaded examConfig from DB
        if (examConfig?.shifts) {
            const currentConfigShift = examConfig.shifts.find((s) => {
                return normTime(s.start_time) === normTime(start) && normTime(s.end_time) === normTime(end);
            });
            if (currentConfigShift?.class_ids && currentConfigShift.class_ids.length > 0) {
                return new Set<string>(currentConfigShift.class_ids);
            }
        }

        // 2. Fallback to localStorage
        try {
            const saved = localStorage.getItem(`exam_config_${selectedExam}`);
            if (saved) {
                const config = JSON.parse(saved);
                const currentConfigShift = (config.shifts || []).find((s: { start_time: string; end_time: string; class_ids?: string[] }) => {
                    return normTime(s.start_time) === normTime(start) && normTime(s.end_time) === normTime(end);
                });
                if (currentConfigShift?.class_ids && currentConfigShift.class_ids.length > 0) {
                    return new Set<string>(currentConfigShift.class_ids);
                }
            }
        } catch (err) {
            console.error("Error reading shift config from localStorage", err);
        }
        return new Set<string>();
    }, [selectedExam, selectedShift, examConfig]);

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
            
            const inserts = allocations
                .filter(a => a.allocated_students > 0)
                .map(a => ({
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

    // Calculate roll ranges per room allocation
    const calculateAllocatedRanges = useCallback(() => {
        const offsetMap = new Map<string, number>();
        const resultMap = new Map<string, { rollRange: string; count: number; startRoll: string; endRoll: string }>();

        allocations.forEach(alloc => {
            if (alloc.allocated_students <= 0) return;
            const key = `${alloc.class_id}||${alloc.section_id}`;
            const secStudents = students
                .filter(s => s.class_id === alloc.class_id && s.section_id === alloc.section_id)
                .sort((a, b) => {
                    const rA = parseInt(a.roll || "0", 10);
                    const rB = parseInt(b.roll || "0", 10);
                    if (!isNaN(rA) && !isNaN(rB) && rA !== 0 && rB !== 0) return rA - rB;
                    return (a.roll || "").localeCompare(b.roll || "", undefined, { numeric: true });
                });

            const offset = offsetMap.get(key) || 0;
            const count = alloc.allocated_students;
            const startIndex = offset;
            const endIndex = offset + count - 1;
            offsetMap.set(key, offset + count);

            let startRoll = "";
            let endRoll = "";

            if (secStudents.length > 0) {
                startRoll = startIndex < secStudents.length ? (secStudents[startIndex].roll || `Roll ${startIndex + 1}`) : `Roll ${startIndex + 1}`;
                endRoll = endIndex < secStudents.length ? (secStudents[endIndex].roll || `Roll ${endIndex + 1}`) : `Roll ${startIndex + count}`;
            } else {
                startRoll = `Roll ${startIndex + 1}`;
                endRoll = `Roll ${startIndex + count}`;
            }

            const rollRange = startRoll === endRoll ? startRoll : `${startRoll} – ${endRoll}`;
            resultMap.set(`${alloc.room_id}||${alloc.class_id}||${alloc.section_id}`, {
                rollRange,
                count,
                startRoll,
                endRoll
            });
        });

        return resultMap;
    }, [allocations, students]);

    // Helper to get shift name + time label
    const getShiftLabel = useCallback((shiftStr: string) => {
        if (!shiftStr) return "";
        const [startTime, endTime] = shiftStr.split("||");
        const formatTime = (t: string) => {
            try {
                const [h, m] = t.split(":").map(Number);
                const ampm = h >= 12 ? "PM" : "AM";
                const h12 = h % 12 || 12;
                return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
            } catch { return t; }
        };
        const timeText = startTime && endTime ? `${formatTime(startTime)} – ${formatTime(endTime)}` : "";
        
        let shiftName = "";
        const normTime = (t: string) => (t || "").substring(0, 5);

        if (examConfig?.shifts) {
            const found = examConfig.shifts.find((s) => 
                normTime(s.start_time) === normTime(startTime) && normTime(s.end_time) === normTime(endTime)
            );
            if (found?.name) {
                shiftName = found.name;
            }
        }

        if (!shiftName && selectedExam) {
            try {
                const saved = localStorage.getItem(`exam_config_${selectedExam}`);
                if (saved) {
                    const config = JSON.parse(saved);
                    const found = (config.shifts || []).find((s: any) => 
                        normTime(s.start_time) === normTime(startTime) && normTime(s.end_time) === normTime(endTime)
                    );
                    if (found?.name) {
                        shiftName = found.name;
                    }
                }
            } catch {}
        }

        if (shiftName && timeText) {
            return `${shiftName} (${timeText})`;
        }
        return shiftName || timeText;
    }, [selectedExam, examConfig]);

    // Print Handler 1: Door Notice Cards
    const handlePrintDoorNoticeCards = () => {
        if (allocations.length === 0) {
            toast.warning("No seat allocations found to print Door Notice Cards.");
            return;
        }

        const currentExam = exams.find(e => e.id === selectedExam);
        const examName = currentExam ? currentExam.name : "EXAM";
        const shiftText = getShiftLabel(selectedShift);

        const roomsMap = new Map<string, { room: RoomCapacity; items: { className: string; sectionName: string; count: number }[] }>();

        allocations.forEach(alloc => {
            if (alloc.allocated_students <= 0) return;
            const room = rooms.find(r => r.id === alloc.room_id);
            const cls = classes.find(c => c.id === alloc.class_id);
            const sec = sections.find(s => s.id === alloc.section_id);
            if (!room || !cls || !sec) return;

            const current = roomsMap.get(room.id) || { room, items: [] };
            current.items.push({
                className: cls.name,
                sectionName: sec.name,
                count: alloc.allocated_students
            });
            roomsMap.set(room.id, current);
        });

        const sName = schoolInfo?.name || "SCHOOL / COLLEGE NAME";
        const sAddr = schoolInfo?.address || "Institution Address";

        let cardsHtml = "";
        Array.from(roomsMap.values()).forEach(({ room, items }) => {
            const totalInRoom = items.reduce((sum, i) => sum + i.count, 0);
            cardsHtml += `
                <div class="door-card">
                    <div class="card-header">
                        <div class="school-title">${sName}</div>
                        <div class="school-sub">${sAddr}</div>
                        <div class="badge">EXAM HALL DOOR NOTICE</div>
                    </div>
                    <div class="meta-row">
                        <div><strong>EXAM:</strong> ${examName}</div>
                        <div><strong>SHIFT / TIME:</strong> ${shiftText}</div>
                    </div>
                    <div class="room-hero">
                        <div class="room-name">${room.name}</div>
                        <div class="room-cap">Total Capacity: ${room.capacity} | Allocated Students: ${totalInRoom}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Class</th>
                                <th>Section</th>
                                <th style="text-align:center;">Students</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => `
                                <tr>
                                    <td style="font-weight:700;">${item.className}</td>
                                    <td>${item.sectionName.replace(/^Section\s+/i, '')}</td>
                                    <td style="text-align:center; font-weight:800;">${item.count}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="card-footer">
                        <div>Printed Date: ${new Date().toLocaleDateString()}</div>
                        <div class="sig-box">
                            <div class="sig-line">Exam Controller / Headmaster</div>
                        </div>
                    </div>
                </div>
            `;
        });

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Exam Hall Door Notice Cards</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #000000; margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; }
                .door-card {
                    border: 3px double #000000;
                    border-radius: 12px;
                    padding: 24px;
                    margin-bottom: 24px;
                    box-sizing: border-box;
                    page-break-inside: avoid;
                    color: #000000;
                }
                .card-header { text-align: center; border-bottom: 2px solid #000000; padding-bottom: 12px; margin-bottom: 16px; }
                .school-title { font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; }
                .school-sub { font-size: 12px; color: #000000; margin-top: 2px; }
                .badge { display: inline-block; background: transparent; color: #000000; font-size: 13px; font-weight: 800; padding: 4px 14px; margin-top: 8px; letter-spacing: 1px; text-transform: uppercase; }
                .meta-row { display: flex; justify-content: space-between; font-size: 13px; background: transparent; padding: 10px 14px; border-radius: 8px; border: 1px solid #000000; margin-bottom: 16px; color: #000000; }
                .room-hero { text-align: center; background: transparent; border: 2px solid #000000; border-radius: 10px; padding: 12px; margin-bottom: 16px; color: #000000; }
                .room-name { font-size: 36px; font-weight: 900; color: #000000; }
                .room-cap { font-size: 12px; font-weight: 600; color: #000000; margin-top: 2px; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; color: #000000; }
                th, td { border: 1.5px solid #000000; padding: 10px 12px; font-size: 13px; text-align: left; color: #000000; }
                th { background: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 11px; color: #000000; }
                .card-footer { margin-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #000000; }
                .sig-box { text-align: center; }
                .sig-line { border-top: 1.5px dashed #000000; width: 180px; padding-top: 4px; font-weight: 600; color: #000000; }
            </style>
        </head>
        <body>
            ${cardsHtml}
        </body>
        </html>
        `;
        printHtml(html);
    };

    // Print Handler 2: Desk Stickers / Slips (Purely Class & Section based, No Shift dependency)
    const handlePrintDeskStickers = (
        filterClassId: string = "all",
        filterSectionId: string = "all"
    ) => {
        let targetStudents = students.filter(s => {
            if (filterClassId !== "all" && s.class_id !== filterClassId) return false;
            if (filterSectionId !== "all" && s.section_id !== filterSectionId) return false;
            return true;
        });

        if (targetStudents.length === 0) {
            toast.warning("No students found for the selected Class & Section.");
            return;
        }

        // Sort students by Class, Section, and Roll
        targetStudents.sort((a, b) => {
            const clsA = classes.find(c => c.id === a.class_id);
            const clsB = classes.find(c => c.id === b.class_id);
            const clsComp = (clsA?.numeric_value ?? 999) - (clsB?.numeric_value ?? 999);
            if (clsComp !== 0) return clsComp;

            const secA = sections.find(s => s.id === a.section_id);
            const secB = sections.find(s => s.id === b.section_id);
            const secComp = (secA?.name || "").localeCompare(secB?.name || "");
            if (secComp !== 0) return secComp;

            const rA = parseInt(a.roll || "0", 10);
            const rB = parseInt(b.roll || "0", 10);
            if (!isNaN(rA) && !isNaN(rB) && rA !== 0 && rB !== 0) return rA - rB;
            return (a.roll || "").localeCompare(b.roll || "", undefined, { numeric: true });
        });

        const currentExam = exams.find(e => e.id === selectedExam);
        const examName = currentExam ? currentExam.name : "EXAM";
        const sName = schoolInfo?.name || "SCHOOL NAME";

        interface DeskSlip {
            className: string;
            sectionName: string;
            studentRoll: string;
            studentName: string;
        }

        const deskSlips: DeskSlip[] = targetStudents.map(stud => {
            const cls = classes.find(c => c.id === stud.class_id);
            const sec = sections.find(s => s.id === stud.section_id);
            return {
                className: cls?.name || "",
                sectionName: sec?.name || "",
                studentRoll: stud.roll || "",
                studentName: stud.name || ""
            };
        });

        let pagesHtml = '';
        for (let i = 0; i < deskSlips.length; i += 10) {
            const pageSlips = deskSlips.slice(i, i + 10);
            const slipsInPageHtml = pageSlips.map(slip => `
                <div class="desk-slip">
                    <div class="slip-school">${sName}</div>
                    <div class="slip-exam">${examName}</div>
                    <div class="slip-line">
                        <span class="slip-label">Name:</span> <span class="slip-val">${slip.studentName ? slip.studentName : '___________________________'}</span>
                    </div>
                    <div class="slip-line">
                        <span class="slip-label">Class:</span> <span class="slip-val">${slip.className}</span>
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span class="slip-label">Section:</span> <span class="slip-val">${slip.sectionName}</span>
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <span class="slip-label">Roll:</span> <span class="slip-val">${slip.studentRoll}</span>
                    </div>
                </div>
            `).join('');

            pagesHtml += `
                <div class="page">
                    <div class="center-cut-line"><span class="scissor-center">✂</span></div>
                    <div class="row-cut-line row-cut-1"><span class="scissor-row">✂</span></div>
                    <div class="row-cut-line row-cut-2"><span class="scissor-row">✂</span></div>
                    <div class="row-cut-line row-cut-3"><span class="scissor-row">✂</span></div>
                    <div class="row-cut-line row-cut-4"><span class="scissor-row">✂</span></div>
                    <div class="grid">
                        ${slipsInPageHtml}
                    </div>
                </div>
            `;
        }

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Desk Stickers / Slips</title>
            <style>
                @page { size: A4 portrait; margin: 6mm; }
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; color: #000000; }
                .page { position: relative; page-break-after: always; page-break-inside: avoid; box-sizing: border-box; height: 285mm; overflow: hidden; }
                .page:last-child { page-break-after: auto; }
                .center-cut-line {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    border-left: 1.5px dashed #64748b;
                    z-index: 10;
                    pointer-events: none;
                }
                .scissor-center {
                    position: absolute;
                    top: 2px;
                    left: -7px;
                    background: #ffffff;
                    font-size: 13px;
                    color: #475569;
                    padding: 2px 0;
                    transform: rotate(-90deg);
                }
                .row-cut-line {
                    position: absolute;
                    left: 0;
                    right: 0;
                    border-top: 1.5px dashed #64748b;
                    z-index: 10;
                    pointer-events: none;
                }
                .scissor-row {
                    position: absolute;
                    left: 2px;
                    top: -9px;
                    background: #ffffff;
                    font-size: 13px;
                    color: #475569;
                    padding: 0 2px;
                }
                .row-cut-1 { top: 54.75mm; }
                .row-cut-2 { top: 113.25mm; }
                .row-cut-3 { top: 171.75mm; }
                .row-cut-4 { top: 230.25mm; }

                .grid { 
                    display: grid; 
                    grid-template-columns: repeat(2, 93mm); 
                    grid-template-rows: repeat(5, 51mm); 
                    gap: 7.5mm 10mm; 
                    height: 285mm;
                    box-sizing: border-box;
                    justify-content: center;
                }
                .desk-slip {
                    border: 1.5px dashed #64748b;
                    border-radius: 8px;
                    padding: 6px 12px;
                    text-align: left;
                    background: transparent;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-evenly;
                    height: 51mm;
                    overflow: hidden;
                }
                .slip-school { 
                    font-size: 14.5px; 
                    font-weight: 800; 
                    color: #000000; 
                    text-transform: uppercase; 
                    text-align: center; 
                    letter-spacing: 0.2px; 
                    line-height: 1.15;
                }
                .slip-exam { 
                    font-size: 12.5px; 
                    font-weight: 700; 
                    color: #000000; 
                    text-transform: uppercase; 
                    text-align: center; 
                    border-bottom: 1.5px solid #000000; 
                    padding-bottom: 3px; 
                    margin-bottom: 4px; 
                    letter-spacing: 0.4px;
                }
                .slip-line { 
                    font-size: 16px; 
                    color: #000000; 
                    margin-bottom: 2px; 
                    line-height: 1.5; 
                    white-space: nowrap; 
                    overflow: hidden; 
                    text-overflow: ellipsis; 
                }
                .slip-label { font-weight: 700; color: #000000; }
                .slip-val { font-weight: 900; color: #000000; font-size: 17px; }
            </style>
        </head>
        <body>
            ${pagesHtml}
        </body>
        </html>
        `;
        printHtml(html);
    };

    // Print Handler 3: Master Seat Plan Sheet
    const handlePrintMasterSeatPlan = () => {
        if (allocations.length === 0) {
            toast.warning("No seat allocations found to print Master Sheet.");
            return;
        }

        const currentExam = exams.find(e => e.id === selectedExam);
        const examName = currentExam ? currentExam.name : "EXAM";
        const shiftText = getShiftLabel(selectedShift);
        const rangesMap = calculateAllocatedRanges();

        const sName = schoolInfo?.name || "SCHOOL / COLLEGE NAME";
        const sAddr = schoolInfo?.address || "Institution Address";

        let totalAllocated = 0;

        const roomsMap = new Map<string, { room: RoomCapacity; items: { className: string; sectionName: string; count: number; rollRange: string }[] }>();

        allocations.forEach(alloc => {
            if (alloc.allocated_students <= 0) return;
            const room = rooms.find(r => r.id === alloc.room_id);
            const cls = classes.find(c => c.id === alloc.class_id);
            const sec = sections.find(s => s.id === alloc.section_id);
            if (!room || !cls || !sec) return;

            totalAllocated += alloc.allocated_students;
            const info = rangesMap.get(`${alloc.room_id}||${alloc.class_id}||${alloc.section_id}`);
            const current = roomsMap.get(room.id) || { room, items: [] };
            current.items.push({
                className: cls.name,
                sectionName: sec.name,
                count: alloc.allocated_students,
                rollRange: info?.rollRange || `Total: ${alloc.allocated_students}`
            });
            roomsMap.set(room.id, current);
        });

        const rowsHtml = Array.from(roomsMap.values()).map(({ room, items }) => {
            const roomTotal = items.reduce((sum, i) => sum + i.count, 0);
            const classesSummary = items.map(i => `${i.className} (${i.sectionName})`).join(", ");
            const rollRangesSummary = items.map(i => `${i.className}-${i.sectionName}: ${i.rollRange}`).join("<br/>");

            return `
                <tr>
                    <td style="font-weight:800; font-size:14px; color:#000000;">${room.name}</td>
                    <td style="text-align:center;">${room.capacity}</td>
                    <td style="text-align:center; font-weight:800;">${roomTotal}</td>
                    <td style="font-weight:600;">${classesSummary}</td>
                    <td class="roll-range">${rollRangesSummary}</td>
                </tr>
            `;
        }).join('');

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Master Exam Seat Plan Sheet</title>
            <style>
                @page { size: A4 portrait; margin: 12mm; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #000000; margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; }
                .header { text-align: center; border-bottom: 2px solid #000000; padding-bottom: 12px; margin-bottom: 16px; }
                .school-title { font-size: 24px; font-weight: 800; text-transform: uppercase; color: #000000; }
                .school-sub { font-size: 12px; color: #000000; margin-top: 2px; }
                .title-badge { display: inline-block; background: #000000; color: #fff; font-size: 13px; font-weight: 800; padding: 6px 20px; border-radius: 20px; margin-top: 10px; letter-spacing: 1px; }
                .meta-bar { display: flex; justify-content: space-between; background: #f1f5f9; padding: 10px 16px; border-radius: 8px; border: 1px solid #000000; margin-bottom: 16px; font-size: 13px; font-weight: 600; color: #000000; }
                table { width: 100%; border-collapse: collapse; margin-top: 12px; color: #000000; }
                th, td { border: 1.5px solid #000000; padding: 10px 12px; font-size: 12px; text-align: left; color: #000000; }
                th { background: #e2e8f0; font-weight: 700; text-transform: uppercase; font-size: 11px; color: #000000; }
                .roll-range { font-family: monospace; font-size: 12px; font-weight: 700; color: #000000; line-height: 1.4; }
                .footer-sig { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #000000; }
                .sig-line { border-top: 1.5px dashed #000000; width: 180px; text-align: center; padding-top: 4px; color: #000000; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="school-title">${sName}</div>
                <div class="school-sub">${sAddr}</div>
                <div class="title-badge">MASTER EXAM SEAT PLAN SHEET</div>
            </div>
            <div class="meta-bar">
                <div>EXAM: ${examName}</div>
                <div>SHIFT: ${shiftText}</div>
                <div>TOTAL SEATED STUDENTS: ${totalAllocated}</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Room / Hall Name</th>
                        <th style="text-align:center;">Capacity</th>
                        <th style="text-align:center;">Allocated</th>
                        <th>Classes & Sections</th>
                        <th>Roll Ranges</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
            <div class="footer-sig">
                <div>Printed Date: ${new Date().toLocaleDateString()}</div>
                <div class="sig-line">Exam Controller / Headmaster Signature</div>
            </div>
        </body>
        </html>
        `;
        printHtml(html);
    };

    // Print Handler 4: Student Seat Audit Sheet (for Invigilators / Verification)
    const handlePrintStudentSeatAuditSheet = () => {
        if (allocations.length === 0) {
            toast.warning("No seat allocations found to print Audit Sheet.");
            return;
        }

        const currentExam = exams.find(e => e.id === selectedExam);
        const examName = currentExam ? currentExam.name : "EXAM";
        const shiftText = getShiftLabel(selectedShift);

        const sName = schoolInfo?.name || "SCHOOL NAME";
        const sAddr = schoolInfo?.address || "Address";

        interface RoomAuditData {
            roomName: string;
            capacity: number;
            students: {
                benchNo: number;
                position: string;
                className: string;
                sectionName: string;
                roll: string;
                name: string;
            }[];
        }

        const roomAuditMap = new Map<string, RoomAuditData>();

        const roomAllocMap = new Map<string, { classId: string; sectionId: string; count: number }[]>();
        allocations.forEach(alloc => {
            if (alloc.allocated_students <= 0) return;
            const list = roomAllocMap.get(alloc.room_id) || [];
            list.push({ classId: alloc.class_id, sectionId: alloc.section_id, count: alloc.allocated_students });
            roomAllocMap.set(alloc.room_id, list);
        });

        roomAllocMap.forEach((allocsInRoom, roomId) => {
            const room = rooms.find(r => r.id === roomId);
            if (!room) return;

            const roomStudents: { className: string; sectionName: string; roll: string; name: string }[] = [];
            allocsInRoom.forEach(alloc => {
                const cls = classes.find(c => c.id === alloc.classId);
                const sec = sections.find(s => s.id === alloc.sectionId);
                if (!cls || !sec) return;

                const secStudents = students
                    .filter(s => s.class_id === alloc.classId && s.section_id === alloc.sectionId)
                    .sort((a, b) => {
                        const rA = parseInt(a.roll || "0", 10);
                        const rB = parseInt(b.roll || "0", 10);
                        if (!isNaN(rA) && !isNaN(rB) && rA !== 0 && rB !== 0) return rA - rB;
                        return (a.roll || "").localeCompare(b.roll || "", undefined, { numeric: true });
                    });

                for (let i = 0; i < alloc.count; i++) {
                    const stud = secStudents[i];
                    roomStudents.push({
                        className: cls.name,
                        sectionName: sec.name,
                        roll: stud?.roll || (i + 1).toString(),
                        name: stud?.name || "—"
                    });
                }
            });

            const totalBenches = room.tables_count > 0 ? room.tables_count : Math.ceil(roomStudents.length / 2);
            const seatsPerBench = room.seats_per_table > 0 ? room.seats_per_table : 2;

            const list: RoomAuditData["students"] = [];
            let studentIdx = 0;
            for (let b = 1; b <= totalBenches; b++) {
                for (let s = 1; s <= seatsPerBench; s++) {
                    if (studentIdx >= roomStudents.length) break;
                    const stud = roomStudents[studentIdx];
                    const posText = seatsPerBench === 2 ? (s === 1 ? "Left" : "Right") : `Seat ${s}`;
                    list.push({
                        benchNo: b,
                        position: posText,
                        className: stud.className,
                        sectionName: stud.sectionName,
                        roll: stud.roll,
                        name: stud.name
                    });
                    studentIdx++;
                }
            }

            roomAuditMap.set(room.id, {
                roomName: room.name,
                capacity: room.capacity,
                students: list
            });
        });

        let tablesHtml = "";
        roomAuditMap.forEach(audit => {
            const rowsHtml = audit.students.map(s => `
                <tr>
                    <td style="font-weight:700; text-align:center;">Bench #${s.benchNo} (${s.position})</td>
                    <td style="font-weight:700; color:#000000; text-align:center;">${s.roll}</td>
                    <td style="font-weight:700;">${s.name}</td>
                    <td style="text-align:center;">${s.className} (${s.sectionName})</td>
                    <td style="width:120px; border-bottom:1px dashed #000000;"></td>
                </tr>
            `).join('');

            tablesHtml += `
                <div class="room-page">
                    <div class="header">
                        <div class="school-name">${sName}</div>
                        <div class="sub-title">${sAddr}</div>
                        <div class="exam-title">${examName} — STUDENT SEAT AUDIT & VERIFICATION SHEET</div>
                    </div>

                    <div class="meta-row">
                        <div><strong>HALL / ROOM:</strong> ${audit.roomName}</div>
                        <div><strong>SHIFT:</strong> ${shiftText}</div>
                        <div><strong>TOTAL SEATED:</strong> ${audit.students.length} / ${audit.capacity}</div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="width:160px; text-align:center;">Bench & Position</th>
                                <th style="width:70px; text-align:center;">Roll</th>
                                <th>Student Name</th>
                                <th style="width:130px; text-align:center;">Class & Section</th>
                                <th style="width:120px;">Invigilator Sign</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    <div class="footer">
                        <div>Invigilator Signature: _______________________</div>
                        <div>Hall Controller Signature: _______________________</div>
                    </div>
                </div>
            `;
        });

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Student Seat Audit Sheet</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #000000; background: #fff; -webkit-print-color-adjust: exact; }
                .room-page { page-break-after: always; box-sizing: border-box; }
                .room-page:last-child { page-break-after: auto; }
                .header { text-align: center; border-bottom: 2px solid #000000; padding-bottom: 8px; margin-bottom: 12px; }
                .school-name { font-size: 18px; font-weight: 800; text-transform: uppercase; color: #000000; }
                .sub-title { font-size: 11px; color: #000000; }
                .exam-title { font-size: 13px; font-weight: 700; color: #000000; margin-top: 4px; text-transform: uppercase; }
                .meta-row { display: flex; justify-content: space-between; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #000000; font-size: 12px; margin-bottom: 12px; color: #000000; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; color: #000000; }
                th, td { border: 1px solid #000000; padding: 6px 8px; text-align: left; color: #000000; }
                th { background: #f1f5f9; font-weight: 700; text-transform: uppercase; font-size: 11px; color: #000000; }
                .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; padding-top: 12px; color: #000000; }
            </style>
        </head>
        <body>
            ${tablesHtml}
        </body>
        </html>
        `;

        printHtml(html);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                    <SelectTrigger className="w-full sm:w-[200px] h-11 rounded-xl border-0 bg-muted text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Select Exam" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border shadow-md">
                        {exams.map(e => <SelectItem key={e.id} value={e.id} className="rounded-lg">{e.name}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={selectedShift} onValueChange={setSelectedShift} disabled={!selectedExam || availableShifts.length === 0}>
                    <SelectTrigger className="w-full sm:w-[260px] h-11 rounded-xl border-0 bg-muted text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Select Shift" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border shadow-md">
                        {availableShifts.map((s, idx) => {
                            const label = getShiftLabel(s) || `Shift ${idx + 1}`;
                            return <SelectItem key={s} value={s} className="rounded-lg">{label}</SelectItem>;
                        })}
                    </SelectContent>
                </Select>

                <div className="w-full sm:w-auto flex gap-2 flex-wrap sm:ml-auto">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                variant="outline"
                                disabled={students.length === 0}
                                className="w-full sm:w-auto h-11 rounded-xl font-semibold border-border text-foreground bg-background hover:bg-muted shadow-none transition-all duration-200"
                            >
                                <Printer className="mr-2 h-4 w-4" /> Print Reports <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-60" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 rounded-xl border-border shadow-md">
                            <DropdownMenuItem onClick={handlePrintDoorNoticeCards} className="rounded-lg cursor-pointer py-2.5">
                                <Printer className="mr-2.5 h-4 w-4 text-primary" />
                                <div>
                                    <div className="font-semibold text-xs">Door Notice Cards</div>
                                    <div className="text-[10px] text-muted-foreground">Print room door cards</div>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsPrintDeskStickersDialogOpen(true)} className="rounded-lg cursor-pointer py-2.5">
                                <Tag className="mr-2.5 h-4 w-4 text-primary" />
                                <div>
                                    <div className="font-semibold text-xs">Desk Stickers / Slips</div>
                                    <div className="text-[10px] text-muted-foreground">Print bench seat slips by class/section</div>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handlePrintMasterSeatPlan} className="rounded-lg cursor-pointer py-2.5">
                                <FileText className="mr-2.5 h-4 w-4 text-primary" />
                                <div>
                                    <div className="font-semibold text-xs">Master Seat Plan Sheet</div>
                                    <div className="text-[10px] text-muted-foreground">Print notice board summary</div>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handlePrintStudentSeatAuditSheet} className="rounded-lg cursor-pointer py-2.5">
                                <Printer className="mr-2.5 h-4 w-4 text-emerald-600" />
                                <div>
                                    <div className="font-semibold text-xs text-emerald-700 dark:text-emerald-400">Student Seat Audit Sheet</div>
                                    <div className="text-[10px] text-muted-foreground">Print invigilator seat verification list</div>
                                </div>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button 
                        variant="outline" 
                        onClick={() => setIsManualDialogOpen(true)} 
                        disabled={!selectedShift || loading}
                        className="w-full sm:w-auto h-11 rounded-xl font-semibold border-border text-foreground bg-background hover:bg-muted shadow-none transition-all duration-200"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add Allocation
                    </Button>
                    
                    <Button 
                        onClick={handleSave} 
                        disabled={!selectedShift || saving || allocations.length === 0}
                        className="w-full sm:w-auto h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-none transition-all duration-200"
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
                        <Card className="border-border shadow-none rounded-xl">
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
                                                    className={`w-20 h-9 text-center font-semibold rounded-lg bg-background text-foreground border-border focus:ring-1 ${isScheduled ? 'border-primary/20 focus:ring-primary' : ''}`}
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
                            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 shadow-none rounded-xl">
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
                                    <Card key={room.id} className={`border-border shadow-none rounded-xl transition-colors ${isOver ? 'border-destructive' : ''} ${isUnconfigured ? 'opacity-50' : ''}`}>
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
                                                                    className="w-16 h-8 text-center font-mono font-bold rounded-lg border-border bg-background text-foreground"
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
                <DialogContent className="sm:max-w-md rounded-xl">
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

            {/* Dialog for Printing Desk Slips strictly by Class / Section */}
            <Dialog open={isPrintDeskStickersDialogOpen} onOpenChange={setIsPrintDeskStickersDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                            <Tag className="h-5 w-5 text-primary" /> Print Desk Stickers / Slips
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2 text-foreground">
                        <div className="grid gap-1.5">
                            <Label>Select Class</Label>
                            <Select 
                                value={printClassFilter} 
                                onValueChange={(v) => { 
                                    setPrintClassFilter(v); 
                                    setPrintSectionFilter("all"); 
                                }}
                            >
                                <SelectTrigger className="rounded-lg">
                                    <SelectValue placeholder="All Classes" />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg">
                                    <SelectItem value="all">All Classes</SelectItem>
                                    {deskSlipClasses.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="grid gap-1.5">
                            <Label>Select Section</Label>
                            <Select 
                                value={printSectionFilter} 
                                onValueChange={setPrintSectionFilter}
                            >
                                <SelectTrigger className="rounded-lg">
                                    <SelectValue placeholder="All Sections" />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg">
                                    <SelectItem value="all">All Sections</SelectItem>
                                    {deskSlipSections.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border/40 flex items-center justify-between">
                            <span>Matching Student Desk Slips:</span>
                            <Badge variant="secondary" className="font-mono font-bold text-sm px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary border-0">
                                {matchingDeskSlipsCount} Slips
                            </Badge>
                        </div>

                        <div className="flex gap-2 justify-end mt-2">
                            <Button 
                                variant="outline" 
                                onClick={() => setIsPrintDeskStickersDialogOpen(false)}
                                className="rounded-xl font-semibold"
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={() => {
                                    handlePrintDeskStickers(printClassFilter, printSectionFilter);
                                    setIsPrintDeskStickersDialogOpen(false);
                                }} 
                                disabled={matchingDeskSlipsCount === 0}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-none"
                            >
                                <Printer className="mr-2 h-4 w-4" /> Print Slips ({matchingDeskSlipsCount})
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
