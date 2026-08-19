"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { printHtml } from "@/lib/print-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, UserCheck, AlertTriangle, Printer, ExternalLink } from "lucide-react";

interface DutyLocal {
    room_id: string;
    teacher_id: string;
}

interface RoomInfo {
    id: string;
    name: string;
    order_index: number | null;
}

interface TeacherInfo {
    id: string;
    name: string;
    designation: string;
    phone: string;
}

interface SeatPlanEntry {
    room_id: string;
    class_id: string;
    section_id: string;
    allocated_students: number;
}

interface ExamScheduleEntry {
    class_id: string;
    subject_id: string;
    exam_date: string;
    start_time: string;
    end_time: string;
}

interface ClassInfo {
    id: string;
    name: string;
    numeric_value: number | null;
}

interface SectionInfo {
    id: string;
    class_id: string;
    name: string;
}

interface SubjectInfo {
    id: string;
    class_id: string;
    name: string;
}

interface SchoolInfo {
    name: string;
    address: string;
    phone: string;
    logo_url: string;
}

// What a room looks like after we combine all data
interface RoomDutyDetail {
    room: RoomInfo;
    seatedClasses: {
        class_id: string;
        class_name: string;
        section_id: string;
        section_name: string;
        allocated_students: number;
    }[];
    examSubjects: {
        class_id: string;
        class_name: string;
        subject_id: string;
        subject_name: string;
        teacher_names: string[];
    }[];
    assignedTeachers: string[];
}

export function ExamDutiesTab({ exams }: { exams: { id: string; name: string }[] }) {
    const [selectedExam, setSelectedExam] = useState<string>("");
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [selectedShift, setSelectedShift] = useState<string>("");
    
    const [schedules, setSchedules] = useState<{ exam_date: string; start_time: string; end_time: string }[]>([]);
    const [rooms, setRooms] = useState<RoomInfo[]>([]);
    const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
    const [duties, setDuties] = useState<DutyLocal[]>([]);
    const [savedOtherShiftsCounts, setSavedOtherShiftsCounts] = useState<Record<string, number>>({});
    
    // Teacher duty inspector modal
    const [selectedTeacherForModal, setSelectedTeacherForModal] = useState<TeacherInfo | null>(null);
    const [allExamDuties, setAllExamDuties] = useState<{ id: string; room_id: string; teacher_id: string; exam_date: string; start_time: string; end_time: string }[]>([]);

    const liveDutyCounts = useMemo(() => {
        const counts: Record<string, number> = { ...savedOtherShiftsCounts };
        duties.forEach(d => {
            counts[d.teacher_id] = (counts[d.teacher_id] || 0) + 1;
        });
        return counts;
    }, [savedOtherShiftsCounts, duties]);
    
    // Seat plan + schedule + class/section/subject data
    const [seatPlans, setSeatPlans] = useState<SeatPlanEntry[]>([]);
    const [examSchedules, setExamSchedules] = useState<ExamScheduleEntry[]>([]);
    const [classes, setClasses] = useState<ClassInfo[]>([]);
    const [sections, setSections] = useState<SectionInfo[]>([]);
    const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
    const [routines, setRoutines] = useState<{ class_id: string; subject_id: string; teacher_id: string }[]>([]);
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
    
    const [saving, setSaving] = useState(false);

    const [examConfig, setExamConfig] = useState<{
        shifts?: Array<{ id: string; name: string; start_time: string; end_time: string; class_ids?: string[] }>;
        dates?: string[];
        instructions?: any[];
    } | null>(null);

    const selectKeyRef = useRef(0);

    const supabase = useMemo(() => createClient(), []);

    // Fetch base data
    useEffect(() => {
        const fetchBase = async () => {
            const [roomsRes, teachersRes, classesRes, sectionsRes, subjectsRes, schoolRes, routinesRes] = await Promise.all([
                supabase.from("rooms").select("id, name, order_index").order("order_index"),
                supabase.from("teachers").select("id, name, designation, phone").order("name"),
                supabase.from("classes").select("id, name, numeric_value").order("numeric_value"),
                supabase.from("sections").select("id, class_id, name"),
                supabase.from("subjects").select("id, class_id, name"),
                supabase.from("school_info").select("name, address, phone, logo_url").limit(1).single(),
                supabase.from("class_routines").select("class_id, subject_id, teacher_id")
            ]);
            setRooms(roomsRes.data || []);
            setTeachers((teachersRes.data || []).map(t => ({
                id: t.id,
                name: t.name,
                designation: t.designation || "",
                phone: t.phone || ""
            })));
            setClasses(classesRes.data || []);
            setSections(sectionsRes.data || []);
            setSubjects(subjectsRes.data || []);
            setRoutines(routinesRes.data || []);
            if (schoolRes.data) {
                setSchoolInfo(schoolRes.data);
            }
        };
        fetchBase();
    }, [supabase]);

    // Fetch schedules and routine config when exam selected
    useEffect(() => {
        if (!selectedExam) {
            setSchedules([]);
            setSelectedDate("");
            setSelectedShift("");
            setExamConfig(null);
            return;
        }

        let isCancelled = false;

        const fetchSchedules = async () => {
            const { data } = await supabase
                .from("exam_schedules")
                .select("exam_date, start_time, end_time")
                .eq("exam_id", selectedExam);
            if (!isCancelled) {
                setSchedules(data || []);
                setSelectedDate("");
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

    // Fetch seat plans when shift is selected
    useEffect(() => {
        if (!selectedExam || !selectedDate || !selectedShift) {
            setSeatPlans([]);
            return;
        }
        const [start, end] = selectedShift.split("||");
        const normStart = normalizeTime(start);
        const normEnd = normalizeTime(end);

        const fetchSeatPlans = async () => {
            const { data } = await supabase
                .from("exam_seat_plans")
                .select("room_id, class_id, section_id, allocated_students, start_time, end_time")
                .eq("exam_id", selectedExam);
            const filtered = (data || []).filter(sp =>
                normalizeTime(sp.start_time) === normStart &&
                normalizeTime(sp.end_time) === normEnd
            );
            setSeatPlans(filtered);
        };
        fetchSeatPlans();
    }, [selectedExam, selectedDate, selectedShift, supabase]);

    // Fetch exam schedules for specific date+shift to know subjects per class
    useEffect(() => {
        if (!selectedExam || !selectedDate || !selectedShift) {
            setExamSchedules([]);
            return;
        }
        const [start_time, end_time] = selectedShift.split("||");
        const normStart = normalizeTime(start_time);
        const normEnd = normalizeTime(end_time);

        const fetchExamScheduleDetails = async () => {
            const { data } = await supabase
                .from("exam_schedules")
                .select("class_id, subject_id, exam_date, start_time, end_time")
                .eq("exam_id", selectedExam)
                .eq("exam_date", selectedDate);
            const filtered = (data || []).filter(es =>
                normalizeTime(es.start_time) === normStart &&
                normalizeTime(es.end_time) === normEnd
            );
            setExamSchedules(filtered);
        };
        fetchExamScheduleDetails();
    }, [selectedExam, selectedDate, selectedShift, supabase]);

    // Derived Dates and Shifts
    const availableDates = useMemo(
        () => Array.from(new Set(schedules.map(s => s.exam_date))).sort(),
        [schedules]
    );

    const availableShifts = useMemo(() => {
        if (!selectedDate) return [];
        const shifts = schedules
            .filter(s => s.exam_date === selectedDate)
            .map(s => `${s.start_time}||${s.end_time}`);
        return Array.from(new Set(shifts)).sort();
    }, [schedules, selectedDate]);

    // Reset date & shift when exam changes
    useEffect(() => {
        setSelectedDate("");
        setSelectedShift("");
    }, [selectedExam]);

    // Auto-select first date when exam schedules load if none selected
    useEffect(() => {
        if (!selectedDate && availableDates.length > 0) {
            setSelectedDate(availableDates[0]);
        }
    }, [availableDates, selectedDate]);

    // Maintain current shift if available on new date, or auto-select first available shift
    useEffect(() => {
        if (!selectedDate) {
            setSelectedShift("");
            return;
        }
        const shifts = schedules
            .filter(s => s.exam_date === selectedDate)
            .map(s => `${s.start_time}||${s.end_time}`);
        const uniqueShifts = Array.from(new Set(shifts)).sort();

        if (uniqueShifts.length > 0) {
            setSelectedShift(prev => (prev && uniqueShifts.includes(prev) ? prev : uniqueShifts[0]));
        } else {
            setSelectedShift("");
        }
    }, [selectedDate, schedules]);

    // Build the enriched room duty details
    const roomDutyDetails: RoomDutyDetail[] = useMemo(() => {
        return rooms.map(room => {
            const roomSeatPlans = seatPlans.filter(sp => sp.room_id === room.id);
            const seatedClasses = roomSeatPlans.map(sp => {
                const cls = classes.find(c => c.id === sp.class_id);
                const sec = sections.find(s => s.id === sp.section_id);
                return {
                    class_id: sp.class_id,
                    class_name: cls?.name || "Unknown",
                    section_id: sp.section_id,
                    section_name: sec?.name || "",
                    allocated_students: sp.allocated_students,
                };
            });

            const classIdsInRoom = new Set(roomSeatPlans.map(sp => sp.class_id));
            const examSubjects = examSchedules
                .filter(es => classIdsInRoom.has(es.class_id))
                .map(es => {
                    const cls = classes.find(c => c.id === es.class_id);
                    const sub = subjects.find(s => s.id === es.subject_id);
                    const matchingRoutines = routines.filter(r => r.class_id === es.class_id && r.subject_id === es.subject_id);
                    const teacherIds = Array.from(new Set(matchingRoutines.map(r => r.teacher_id)));
                    const names = teacherIds
                        .map(tid => teachers.find(t => t.id === tid)?.name)
                        .filter((name): name is string => !!name);

                    return {
                        class_id: es.class_id,
                        class_name: cls?.name || "Unknown",
                        subject_id: es.subject_id,
                        subject_name: sub?.name || "Unknown",
                        teacher_names: names
                    };
                });

            const roomDutiesList = duties.filter(d => d.room_id === room.id);
            const assignedTeachers = roomDutiesList.map(d => d.teacher_id);

            return { room, seatedClasses, examSubjects, assignedTeachers };
        }).filter(rd => rd.seatedClasses.length > 0 || rd.assignedTeachers.length > 0);
    }, [rooms, seatPlans, examSchedules, classes, sections, subjects, duties, routines, teachers]);

    const normalizeTime = (t: string | undefined | null) => {
        if (!t) return "";
        const parts = t.trim().split(":");
        if (parts.length >= 2) {
            return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
        }
        return t.trim();
    };

    // Fetch current duties and global counts
    const fetchDuties = useCallback(async () => {
        if (!selectedExam) {
            setDuties([]);
            setSavedOtherShiftsCounts({});
            setAllExamDuties([]);
            return;
        }

        const [start_time, end_time] = selectedShift ? selectedShift.split("||") : ["", ""];
        const normSelectedStart = normalizeTime(start_time);
        const normSelectedEnd = normalizeTime(end_time);

        try {
            const { data: allDuties, error } = await supabase
                .from("exam_duties")
                .select("id, room_id, teacher_id, exam_date, start_time, end_time")
                .eq("exam_id", selectedExam)
                .order("exam_date", { ascending: true })
                .order("start_time", { ascending: true });

            if (error) throw error;

            setAllExamDuties(allDuties || []);

            if (!selectedDate || !selectedShift) {
                setDuties([]);
                const counts: Record<string, number> = {};
                (allDuties || []).forEach(d => {
                    counts[d.teacher_id] = (counts[d.teacher_id] || 0) + 1;
                });
                setSavedOtherShiftsCounts(counts);
                return;
            }

            const currentShiftDuties: DutyLocal[] = [];
            const otherCounts: Record<string, number> = {};

            (allDuties || []).forEach(d => {
                const isCurrentShift =
                    d.exam_date === selectedDate &&
                    normalizeTime(d.start_time) === normSelectedStart &&
                    normalizeTime(d.end_time) === normSelectedEnd;

                if (isCurrentShift) {
                    if (d.room_id && d.teacher_id) {
                        currentShiftDuties.push({
                            room_id: d.room_id,
                            teacher_id: d.teacher_id,
                        });
                    }
                } else {
                    otherCounts[d.teacher_id] = (otherCounts[d.teacher_id] || 0) + 1;
                }
            });

            setDuties(currentShiftDuties);
            setSavedOtherShiftsCounts(otherCounts);
        } catch {
            toast.error("Failed to load duties");
        }
    }, [selectedExam, selectedDate, selectedShift, supabase]);

    useEffect(() => {
        fetchDuties();
    }, [fetchDuties]);

    const getTeacherDuties = useCallback((teacherId: string) => {
        const [currStart, currEnd] = selectedShift ? selectedShift.split("||") : ["", ""];
        const normCurrStart = normalizeTime(currStart);
        const normCurrEnd = normalizeTime(currEnd);

        // 1. Duties from other shifts in DB
        const otherDuties = allExamDuties
            .filter(d => {
                if (d.teacher_id !== teacherId) return false;
                if (!selectedDate || !selectedShift) return true;
                const isCurrentShift =
                    d.exam_date === selectedDate &&
                    normalizeTime(d.start_time) === normCurrStart &&
                    normalizeTime(d.end_time) === normCurrEnd;
                return !isCurrentShift;
            })
            .map(d => ({
                id: d.id,
                date: d.exam_date,
                startTime: d.start_time,
                endTime: d.end_time,
                roomId: d.room_id,
                roomName: rooms.find(r => r.id === d.room_id)?.name || "Unknown Room",
            }));

        // 2. Local duties from current shift
        const localCurrentDuties: typeof otherDuties = [];
        if (selectedDate && selectedShift) {
            duties
                .filter(d => d.teacher_id === teacherId)
                .forEach((d, idx) => {
                    localCurrentDuties.push({
                        id: `local-${d.room_id}-${idx}`,
                        date: selectedDate,
                        startTime: currStart,
                        endTime: currEnd,
                        roomId: d.room_id,
                        roomName: rooms.find(r => r.id === d.room_id)?.name || "Unknown Room",
                    });
                });
        }

        const combined = [...otherDuties, ...localCurrentDuties];
        combined.sort((a, b) => {
            const dateCmp = (a.date || "").localeCompare(b.date || "");
            if (dateCmp !== 0) return dateCmp;
            return (a.startTime || "").localeCompare(b.startTime || "");
        });

        return combined.map((d, index) => ({
            sl: index + 1,
            ...d
        }));
    }, [allExamDuties, rooms, selectedDate, selectedShift, duties]);

    const handleAssignTeacher = (roomId: string, teacherId: string) => {
        if (!teacherId || teacherId === "_none") return;
        const existingRoom = duties.find(d => d.teacher_id === teacherId);
        if (existingRoom) {
            const roomName = rooms.find(r => r.id === existingRoom.room_id)?.name || "another room";
            toast.error(`This teacher is already assigned to ${roomName} in this shift!`);
            return;
        }
        const alreadyInRoom = duties.some(d => d.room_id === roomId && d.teacher_id === teacherId);
        if (alreadyInRoom) {
            toast.warning("Teacher is already assigned to this room");
            return;
        }
        setDuties(prev => [...prev, { room_id: roomId, teacher_id: teacherId }]);
        selectKeyRef.current += 1;
    };

    const handleRemoveTeacher = (roomId: string, teacherId: string) => {
        setDuties(prev => prev.filter(d => !(d.room_id === roomId && d.teacher_id === teacherId)));
    };

    const handleSave = async () => {
        if (!selectedExam || !selectedDate || !selectedShift) return;
        setSaving(true);
        const [start_time, end_time] = selectedShift.split("||");
        const normSelectedStart = normalizeTime(start_time);
        const normSelectedEnd = normalizeTime(end_time);
        
        try {
            const { data: existingDuties, error: fetchError } = await supabase
                .from("exam_duties")
                .select("id, start_time, end_time")
                .eq("exam_id", selectedExam)
                .eq("exam_date", selectedDate);

            if (fetchError) throw fetchError;

            const idsToDelete = (existingDuties || [])
                .filter(d => normalizeTime(d.start_time) === normSelectedStart && normalizeTime(d.end_time) === normSelectedEnd)
                .map(d => d.id);

            if (idsToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from("exam_duties")
                    .delete()
                    .in("id", idsToDelete);
                if (deleteError) throw deleteError;
            }

            const inserts = duties.map(d => ({
                exam_id: selectedExam,
                room_id: d.room_id,
                teacher_id: d.teacher_id,
                exam_date: selectedDate,
                start_time,
                end_time
            }));

            if (inserts.length > 0) {
                const { error } = await supabase.from("exam_duties").insert(inserts);
                if (error) throw error;
            }
            
            toast.success("Duties saved successfully");
            fetchDuties();
        } catch {
            toast.error("Failed to save duties");
        } finally {
            setSaving(false);
        }
    };

    const formatTime = (t: string) => {
        try {
            if (!t) return "";
            const [hStr, mStr] = t.split(":");
            const h = Number(hStr);
            const m = Number(mStr);
            if (isNaN(h) || isNaN(m)) return t;
            const ampm = h >= 12 ? "PM" : "AM";
            const h12 = h % 12 || 12;
            return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
        } catch { return t; }
    };

    const formatDate = (d: string) => {
        try {
            if (!d) return "";
            const date = new Date(d + "T00:00:00");
            if (isNaN(date.getTime())) return d;
            return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        } catch { return d; }
    };

    const getShiftName = useCallback((shiftStr: string, index?: number) => {
        if (!shiftStr) return "";
        const [startTime, endTime] = shiftStr.split("||");
        const normTime = (t: string) => (t || "").substring(0, 5);

        let shiftName = "";

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

        if (shiftName) {
            const cleanName = shiftName.replace(/\s*\([\d:APMapm\s\-–—to]+\)\s*$/i, "").trim();
            return cleanName || shiftName;
        }

        if (index !== undefined) {
            return `Shift ${index + 1}`;
        }
        const idx = availableShifts.indexOf(shiftStr);
        if (idx !== -1) {
            return `Shift ${idx + 1}`;
        }
        return "Shift";
    }, [selectedExam, examConfig, availableShifts]);

    const getAvailableTeachers = (roomId: string) => {
        const assignedTeacherIds = new Set(duties.map(d => d.teacher_id));
        const inThisRoom = new Set(duties.filter(d => d.room_id === roomId).map(d => d.teacher_id));
        return teachers.filter(t => !assignedTeacherIds.has(t.id) || inThisRoom.has(t.id));
    };

    const shiftSubjectsSummary = useMemo(() => {
        const seen = new Set<string>();
        const result: { class_name: string; subject_name: string; teacher_names: string[] }[] = [];
        examSchedules.forEach(es => {
            const cls = classes.find(c => c.id === es.class_id);
            const sub = subjects.find(s => s.id === es.subject_id);
            const key = `${es.class_id}-${es.subject_id}`;
            if (!seen.has(key) && cls && sub) {
                seen.add(key);

                const matchingRoutines = routines.filter(r => r.class_id === es.class_id && r.subject_id === es.subject_id);
                const teacherIds = Array.from(new Set(matchingRoutines.map(r => r.teacher_id)));
                const names = teacherIds
                    .map(tid => teachers.find(t => t.id === tid)?.name)
                    .filter((name): name is string => !!name);

                result.push({ 
                    class_name: cls.name, 
                    subject_name: sub.name,
                    teacher_names: names
                });
            }
        });
        return result;
    }, [examSchedules, classes, subjects, routines, teachers]);

    const handlePrint = () => {


        const totalRowsCount = printRows.reduce((acc, row) => acc + row.teachers.length, 0);

        // Calculate available printable space to maximize cell height while strictly keeping it to 1 page
        let rowHeight = 36;
        let fontSize = 12.5;
        let subFontSize = 11.5;
        let cellPaddingY = 5;
        let cellPaddingX = 8;
        let headerFontSize = 12.5;
        let headerPaddingY = 6;

        if (totalRowsCount <= 28) {
            // For <= 28 rows, maximize row height to fill ~870px table area on 1 A4 page
            const targetTableHeight = 870;
            const calculatedHeight = Math.floor(targetTableHeight / Math.max(1, totalRowsCount));
            rowHeight = Math.min(65, Math.max(29, calculatedHeight));

            if (rowHeight >= 52) {
                fontSize = 14;
                subFontSize = 13;
                cellPaddingY = 10;
                headerFontSize = 14;
                headerPaddingY = 9;
            } else if (rowHeight >= 42) {
                fontSize = 13.5;
                subFontSize = 12.5;
                cellPaddingY = 8;
                headerFontSize = 13.5;
                headerPaddingY = 8;
            } else if (rowHeight >= 34) {
                fontSize = 13;
                subFontSize = 12;
                cellPaddingY = 6;
                headerFontSize = 12.5;
                headerPaddingY = 7;
            } else {
                fontSize = 12;
                subFontSize = 11;
                cellPaddingY = 4;
                headerFontSize = 12;
                headerPaddingY = 5;
            }
        } else {
            // For 29+ rows that naturally span 2+ pages
            rowHeight = 36;
            fontSize = 12;
            subFontSize = 11;
            cellPaddingY = 5;
            headerFontSize = 12;
            headerPaddingY = 6;
        }

        const thStyle = `border:1.5px solid #000;padding:${headerPaddingY}px ${cellPaddingX}px;text-align:center;font-weight:800;background:#f8fafc;font-size:${headerFontSize}px`;
        const tdBaseStyle = `border:1px solid #000;padding:${cellPaddingY}px ${cellPaddingX}px;vertical-align:middle;font-size:${fontSize}px;line-height:1.3;`;
        const tdSubStyle = `border:1px solid #000;padding:${cellPaddingY}px ${cellPaddingX}px;vertical-align:middle;font-size:${subFontSize}px;line-height:1.35;`;

        // Build table rows HTML
        let tableRowsHtml = "";
        if (printRows.length > 0) {
            printRows.forEach((row, roomIdx) => {
                row.teachers.forEach((teacher, tIdx) => {
                    tableRowsHtml += "<tr>";
                    if (tIdx === 0) {
                        tableRowsHtml += `<td style="${tdBaseStyle};text-align:center;font-weight:700" rowspan="${row.teachers.length}">${roomIdx + 1}</td>`;
                        tableRowsHtml += `<td style="${tdBaseStyle};text-align:center;font-weight:800;font-size:${fontSize + 1}px" rowspan="${row.teachers.length}">${row.roomName}</td>`;
                        tableRowsHtml += `<td style="${tdSubStyle}" rowspan="${row.teachers.length}">${row.classText}</td>`;
                        tableRowsHtml += `<td style="${tdSubStyle}" rowspan="${row.teachers.length}">${row.subjectText}</td>`;
                    }
                    tableRowsHtml += `<td style="${tdBaseStyle};font-weight:600;height:${rowHeight}px">${teacher.name}</td>`;
                    tableRowsHtml += `<td style="border:1px solid #000;padding:${cellPaddingY}px ${cellPaddingX}px;vertical-align:middle;width:145px;height:${rowHeight}px"></td>`;
                    tableRowsHtml += "</tr>";
                });
            });
        } else {
            tableRowsHtml = `<tr><td colspan="6" style="border:1px solid #000;padding:12px;text-align:center;font-size:${fontSize}px">No duties assigned</td></tr>`;
        }

        const dateObj = new Date(selectedDate + 'T00:00:00');
        const dayName = !isNaN(dateObj.getTime())
            ? dateObj.toLocaleDateString('en-GB', { weekday: 'long' })
            : '';
        const formattedDateStr = !isNaN(dateObj.getTime())
            ? dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()
            : selectedDate;

        const currentShiftName = getShiftName(selectedShift);
        const shiftTimeFormatted = shiftTimes[0] && shiftTimes[1] ? `${formatTime(shiftTimes[0])} &mdash; ${formatTime(shiftTimes[1])}` : "";
        const subheaderParts = [
            selectedExamName,
            currentShiftName,
            shiftTimeFormatted
        ].filter(Boolean);
        const subheaderHtml = subheaderParts.join(" &bull; ");

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Exam Hall Guard Duty List</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #000;
            padding: 0;
            background: #fff;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        @page {
            size: A4 portrait;
            margin: 8mm 10mm 6mm 10mm;
        }
        @media print {
            body { padding: 0; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
    </style>
</head>
<body>
    <!-- School Header -->
    <div style="text-align:center;margin-bottom:8px">
        <h1 style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:0.6px;margin:0;line-height:1.2;color:#000">${schoolInfo?.name || "School Name"}</h1>
        <p style="font-size:11.5px;font-weight:500;color:#333;margin-top:2px">${schoolInfo?.address || ""} ${schoolInfo?.phone ? "• " + schoolInfo.phone : ""}</p>
    </div>

    <!-- Report Header Bar -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #000;padding-bottom:5px;margin-bottom:10px">
        <div>
            <div style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.2px;line-height:1.1;color:#000;margin-bottom:3px">HALL GUARD DUTY</div>
            <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000">${subheaderHtml}</div>
        </div>
        <div style="text-align:right">
            <div style="font-size:20px;font-weight:900;color:#000;line-height:1.1;margin-bottom:3px">${dayName}</div>
            <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#000">${formattedDateStr}</div>
        </div>
    </div>

    <!-- Duty Table -->
    <table>
        <thead>
            <tr>
                <th style="${thStyle};width:50px">Sl. No.</th>
                <th style="${thStyle};width:85px">Hall / Room</th>
                <th style="${thStyle}">Class (Section)</th>
                <th style="${thStyle}">Subject</th>
                <th style="${thStyle}">Invigilator Name</th>
                <th style="${thStyle};width:145px">Signature</th>
            </tr>
        </thead>
        <tbody>${tableRowsHtml}</tbody>
    </table>

    <!-- Footer -->
    <div style="text-align:center;font-size:10px;color:#333;margin-top:12px;font-weight:600;letter-spacing:0.5px">
        <p>Computer generated on ${new Date().toLocaleDateString('en-GB')}. No signature required.</p>
    </div>
</body>
</html>`;

        printHtml(html);
    };

    const handlePrintTotalDutyCounts = () => {
        if (!selectedExam) {
            toast.error("Please select an exam first");
            return;
        }

        const assignedTeachers = teachers.filter(t => (liveDutyCounts[t.id] || 0) > 0);
        const totalDuties = Object.values(liveDutyCounts).reduce((sum, c) => sum + (c || 0), 0);

        const examDateRangeText = availableDates.length > 0
            ? (availableDates.length === 1 
                ? formatDate(availableDates[0]) 
                : `${formatDate(availableDates[0])} — ${formatDate(availableDates[availableDates.length - 1])}`)
            : "";

        const tableRowsHtml = assignedTeachers.map((t, index) => {
            const count = liveDutyCounts[t.id] || 0;
            return `
                <tr>
                    <td class="text-center font-mono">${(index + 1).toString().padStart(2, "0")}</td>
                    <td class="font-bold teacher-name">${t.name}</td>
                    <td class="teacher-designation">${t.designation || "—"}</td>
                    <td class="text-center font-mono">${t.phone || "—"}</td>
                    <td class="text-center font-mono font-bold">${count}</td>
                    <td class="sig-cell"></td>
                </tr>
            `;
        }).join("");

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Total Duty Counts - ${selectedExamName}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #0f172a;
            background: #ffffff;
            font-size: 12px;
            line-height: 1.4;
            padding: 5mm 8mm;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        @page {
            size: A4 portrait;
            margin: 5mm 6mm;
        }
        
        .header-container {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            margin-bottom: 2px;
            padding-bottom: 2px;
            text-align: center;
        }
        .header-logo {
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            max-height: 48px;
            max-width: 48px;
            object-fit: contain;
        }
        .school-title {
            font-size: 21px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #0f172a;
            margin: 0;
            line-height: 1.2;
        }
        .school-subtitle {
            font-size: 11.5px;
            color: #475569;
            margin-top: 2px;
        }

        .report-header-center {
            text-align: center;
            margin: 3px 0 12px 0;
            border-bottom: 1.5px solid #0f172a;
            padding-bottom: 7px;
        }
        .report-exam-title {
            font-size: 16.5px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #0f172a;
            margin-bottom: 2px;
        }
        .report-exam-dates {
            font-size: 11.5px;
            font-weight: 600;
            color: #475569;
            margin-bottom: 3px;
        }
        .report-doc-title {
            font-size: 13.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.7px;
            color: #334155;
            margin-bottom: 3px;
        }
        .report-meta {
            font-size: 10px;
            color: #64748b;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11.5px;
            margin-bottom: 18px;
        }
        th {
            background: #f1f5f9;
            color: #0f172a;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 10.5px;
            letter-spacing: 0.5px;
            padding: 6px 7px;
            border: 1px solid #94a3b8;
            text-align: left;
            white-space: nowrap;
        }
        th.text-center, td.text-center {
            text-align: center;
            white-space: nowrap;
        }
        th.text-right, td.text-right {
            text-align: right;
            white-space: nowrap;
        }
        td {
            padding: 5px 7px;
            border: 1px solid #cbd5e1;
            vertical-align: middle;
            color: #1e293b;
            white-space: nowrap;
        }
        td.teacher-name {
            white-space: nowrap;
            font-weight: 600;
        }
        td.teacher-designation {
            white-space: nowrap;
        }
        tr:nth-child(even) td {
            background: #fbfcfe;
        }
        .font-mono {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .font-bold {
            font-weight: 600;
        }
        tr {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .footer-row td {
            background: #f1f5f9 !important;
            font-weight: 800;
            font-size: 12px;
            border-top: 2px solid #0f172a;
            color: #0f172a;
        }

        .signatures {
            width: 100%;
            margin-top: 30px;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .sig-table {
            width: 100%;
            border-collapse: collapse;
            border: none;
        }
        .sig-table td {
            border: none;
            background: transparent !important;
            text-align: center;
            padding: 0 15px;
            vertical-align: top;
        }
        .sig-line {
            width: 150px;
            margin: 0 auto;
            border-top: 1.5px solid #0f172a;
            padding-top: 5px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #0f172a;
        }

        .print-footer {
            margin-top: 12px;
            text-align: center;
            font-size: 8.5px;
            color: #94a3b8;
            border-top: 1px dashed #cbd5e1;
            padding-top: 5px;
            letter-spacing: 0.3px;
        }
    </style>
</head>
<body>
    <!-- School Header -->
    <div style="text-align:center;margin-bottom:14px">
        <h1 style="font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;margin:0;line-height:1.2;color:#000">${schoolInfo?.name || "School Name"}</h1>
        <p style="font-size:11px;font-weight:500;color:#222;margin-top:2px">${schoolInfo?.address || ""} ${schoolInfo?.phone ? "• " + schoolInfo.phone : ""}</p>
    </div>

    <!-- Report Header Bar -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5px solid #000;padding-bottom:8px;margin-bottom:16px">
        <div>
            <div style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:-0.3px;line-height:1.1;color:#000;margin-bottom:4px">TOTAL DUTY SUMMARY</div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#000">${selectedExamName}${examDateRangeText ? ` &bull; ${examDateRangeText}` : ""}</div>
        </div>
        <div style="text-align:right">
            <div style="font-size:22px;font-weight:900;color:#000;line-height:1.1;margin-bottom:4px">${new Date().toLocaleDateString('en-GB', { weekday: 'long' })}</div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#000">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</div>
        </div>
    </div>

    <!-- Duty Table -->
    <table>
        <thead>
            <tr>
                <th style="width: 36px" class="text-center">Sl.</th>
                <th style="white-space: nowrap;">Teacher Name</th>
                <th style="white-space: nowrap;">Designation</th>
                <th style="width: 100px" class="text-center">Contact</th>
                <th style="width: 95px" class="text-center">Total Duties</th>
                <th style="width: 125px" class="sig-cell text-center">Signature</th>
            </tr>
        </thead>
        <tbody>
            ${tableRowsHtml}
            <tr class="footer-row">
                <td colspan="4" class="text-right font-bold" style="padding-right: 12px;">GRAND TOTAL</td>
                <td class="text-center font-mono font-bold" style="font-size: 13px;">${totalDuties}</td>
                <td></td>
            </tr>
        </tbody>
    </table>

    <!-- Signature Block -->
    <div class="signatures">
        <table class="sig-table">
            <tr>
                <td><div class="sig-line">Prepared By</div></td>
                <td><div class="sig-line">Exam Controller</div></td>
                <td><div class="sig-line">Principal / Headmaster</div></td>
            </tr>
        </table>
    </div>

    <!-- Footer Note -->
    <div class="print-footer">
        Computer Generated Official Duty Report • ${schoolInfo?.name || "School"} Result & Exam Management System
    </div>
</body>
</html>`;

        printHtml(html);
    };

    // Print Individual Teacher Duty Slip
    const handlePrintTeacherDutySlip = (t: TeacherInfo) => {
        if (!selectedExam) return;
        const teacherDuties = getTeacherDuties(t.id);
        if (teacherDuties.length === 0) {
            toast.warning(`No duties found for ${t.name}`);
            return;
        }

        const examDateRangeText = availableDates.length > 0
            ? (availableDates.length === 1 
                ? formatDate(availableDates[0]) 
                : `${formatDate(availableDates[0])} — ${formatDate(availableDates[availableDates.length - 1])}`)
            : "";

        const dutyRowsHtml = teacherDuties.map((d) => {
            const dateObj = new Date(d.date + 'T00:00:00');
            const dayName = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('en-GB', { weekday: 'long' }) : '—';
            return `
                <tr>
                    <td style="border:1px solid #000;padding:6px 8px;text-align:center;font-family:monospace;font-weight:600">${d.sl.toString().padStart(2, '0')}</td>
                    <td style="border:1px solid #000;padding:6px 8px;font-weight:700">${formatDate(d.date)}</td>
                    <td style="border:1px solid #000;padding:6px 8px;text-align:center">${dayName}</td>
                    <td style="border:1px solid #000;padding:6px 8px;text-align:center">
                        <div style="font-weight:700">${getShiftName(d.startTime + '||' + d.endTime)}</div>
                        <div style="font-size:10px;color:#475569;font-family:monospace">(${formatTime(d.startTime)} — ${formatTime(d.endTime)})</div>
                    </td>
                    <td style="border:1px solid #000;padding:6px 8px;text-align:center;font-weight:700;font-size:13px">${d.roomName}</td>
                    <td style="border:1px solid #000;padding:6px 8px;width:120px"></td>
                </tr>
            `;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Teacher Duty Schedule - ${t.name}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #000;
            background: #fff;
            padding: 20px 40px;
            font-size: 12px;
            line-height: 1.4;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        @page { size: A4 portrait; margin: 10mm; }
        @media print { body { padding: 20px; } }
        .header-container {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 12px;
            position: relative;
        }
        .header-logo {
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            max-height: 48px;
            max-width: 48px;
            object-fit: contain;
        }
        .school-title {
            font-size: 18px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .school-subtitle {
            font-size: 11px;
            color: #333;
            margin-top: 2px;
        }
        .slip-title {
            text-align: center;
            font-size: 14px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            margin: 10px 0 14px 0;
            padding-bottom: 4px;
            border-bottom: 1.5px solid #000;
        }
        .meta-grid {
            display: flex;
            justify-content: space-between;
            margin-bottom: 14px;
            font-size: 11.5px;
            background: #f8fafc;
            padding: 8px 12px;
            border: 1px solid #000;
            border-radius: 4px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11.5px;
            margin-bottom: 20px;
        }
        th {
            background: #f1f5f9;
            padding: 7px 8px;
            border: 1px solid #000;
            font-size: 10.5px;
            text-transform: uppercase;
            font-weight: 700;
        }
        td {
            padding: 6px 8px;
            border: 1px solid #000;
        }
        .sig-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            padding: 0 10px;
        }
        .sig-box {
            text-align: center;
            width: 140px;
            border-top: 1.5px solid #000;
            padding-top: 4px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .print-footer {
            margin-top: 20px;
            text-align: center;
            font-size: 9.5px;
            color: #666;
            border-top: 1px dashed #999;
            padding-top: 6px;
        }
    </style>
</head>
<body>
    <!-- School Header -->
    <div style="text-align:center;margin-bottom:14px">
        <h1 style="font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;margin:0;line-height:1.2;color:#000">${schoolInfo?.name || "School Name"}</h1>
        <p style="font-size:11px;font-weight:500;color:#222;margin-top:2px">${schoolInfo?.address || ""} ${schoolInfo?.phone ? "• " + schoolInfo.phone : ""}</p>
    </div>

    <!-- Report Header Bar -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5px solid #000;padding-bottom:8px;margin-bottom:14px">
        <div>
            <div style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:-0.3px;line-height:1.1;color:#000;margin-bottom:4px">DUTY SCHEDULE</div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#000">${selectedExamName}${examDateRangeText ? ` &bull; ${examDateRangeText}` : ""}</div>
        </div>
        <div style="text-align:right">
            <div style="font-size:22px;font-weight:900;color:#000;line-height:1.1;margin-bottom:4px">${new Date().toLocaleDateString('en-GB', { weekday: 'long' })}</div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#000">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</div>
        </div>
    </div>

    <div class="meta-grid">
        <div>
            <div>Teacher Name: <strong>${t.name}</strong></div>
            <div>Designation: <strong>${t.designation || "—"}</strong></div>
            <div>Contact: <strong>${t.phone || "—"}</strong></div>
        </div>
        <div style="text-align:right">
            <div>Total Assigned Duties: <strong style="font-size:13px">${teacherDuties.length}</strong></div>
            <div>Report Date: <strong>${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width:40px;text-align:center">Sl.</th>
                <th style="width:110px">Exam Date</th>
                <th style="width:90px;text-align:center">Day</th>
                <th style="width:140px;text-align:center">Shift / Time</th>
                <th style="text-align:center">Assigned Hall / Room</th>
                <th style="width:110px;text-align:center">Signature</th>
            </tr>
        </thead>
        <tbody>
            ${dutyRowsHtml}
        </tbody>
    </table>

    <div class="sig-section">
        <div class="sig-box">Teacher's Signature</div>
        <div class="sig-box">Exam Controller</div>
        <div class="sig-box">Head of Institute</div>
    </div>

    <div class="print-footer">
        Official Teacher Duty Schedule • ${schoolInfo?.name || "School"}
    </div>
</body>
</html>`;

        printHtml(html);
    };

    const selectedExamName = exams.find(e => e.id === selectedExam)?.name || "";
    const shiftTimes = selectedShift ? selectedShift.split("||") : ["", ""];

    // Build print rows data
    const printRows = useMemo(() => {
        const rows: {
            roomName: string;
            classText: string;
            subjectText: string;
            teachers: { name: string; designation: string; phone: string }[];
        }[] = [];

        const detailsToShow = roomDutyDetails.length > 0 ? roomDutyDetails : rooms
            .filter(r => duties.some(d => d.room_id === r.id))
            .map(r => ({
                room: r,
                seatedClasses: [] as RoomDutyDetail["seatedClasses"],
                examSubjects: [] as RoomDutyDetail["examSubjects"],
                assignedTeachers: duties.filter(d => d.room_id === r.id).map(d => d.teacher_id),
            }));

        detailsToShow.forEach(detail => {
            if (detail.assignedTeachers.length === 0) return;

            const classText = detail.seatedClasses.length > 0
                ? detail.seatedClasses.map(sc =>
                    `${sc.class_name}${sc.section_name ? ` (${sc.section_name})` : ""}`
                ).join("<br />")
                : "—";

            const subjectText = detail.examSubjects.length > 0
                ? detail.examSubjects.map(es => {
                    return `${es.class_name}: ${es.subject_name}`;
                }).join("<br />")
                : "—";

            const teacherList = detail.assignedTeachers.map(tid => {
                const t = teachers.find(x => x.id === tid);
                return {
                    name: t?.name || "Unknown",
                    designation: t?.designation || "—",
                    phone: t?.phone || "—",
                };
            });

            rows.push({
                roomName: detail.room.name,
                classText,
                subjectText,
                teachers: teacherList,
            });
        });

        return rows;
    }, [roomDutyDetails, rooms, duties, teachers]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-card p-4 rounded-2xl border border-border">
                <Select value={selectedExam} onValueChange={setSelectedExam}>
                    <SelectTrigger className="w-full sm:w-[200px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Select Exam" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border shadow-md">
                        {exams.map(e => <SelectItem key={e.id} value={e.id} className="rounded-lg">{e.name}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={selectedDate} onValueChange={setSelectedDate} disabled={!selectedExam || availableDates.length === 0}>
                    <SelectTrigger className="w-full sm:w-[180px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Select Date" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border shadow-md">
                        {availableDates.map(d => (
                            <SelectItem key={d} value={d} className="rounded-lg">{formatDate(d)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={selectedShift} onValueChange={setSelectedShift} disabled={!selectedDate || availableShifts.length === 0}>
                    <SelectTrigger className="w-full sm:w-[260px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                        <SelectValue placeholder="Select Shift" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border shadow-md">
                        {availableShifts.map((s, idx) => {
                            const sTimes = s.split("||");
                            const timeStr = sTimes[0] && sTimes[1] ? ` (${formatTime(sTimes[0])} – ${formatTime(sTimes[1])})` : "";
                            return (
                                <SelectItem key={s} value={s} className="rounded-lg">
                                    {getShiftName(s, idx)}{timeStr}
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>

                <div className="w-full sm:w-auto sm:ml-auto flex flex-col sm:flex-row gap-2">
                    {selectedShift && duties.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={handlePrint}
                            className="w-full sm:w-auto h-11 rounded-xl font-semibold shadow-none border-border transition-all duration-200 gap-2"
                        >
                            <Printer className="h-4 w-4" /> Print Shift Duty List
                        </Button>
                    )}
                    {selectedExam && (
                        <Button
                            variant="outline"
                            onClick={handlePrintTotalDutyCounts}
                            className="w-full sm:w-auto h-11 rounded-xl font-semibold shadow-none border-border transition-all duration-200 gap-2"
                            title="Print Total Duty Counts Report"
                        >
                            <Printer className="h-4 w-4" /> Print Total Duties
                        </Button>
                    )}
                    <Button 
                        onClick={handleSave} 
                        disabled={!selectedShift || saving}
                        className="w-full sm:w-auto h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-none transition-all duration-200"
                    >
                        <Save className="mr-2 h-4 w-4" /> Save Duties
                    </Button>
                </div>
            </div>

            {selectedExam && availableDates.length === 0 && schedules.length === 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <span className="text-amber-700 dark:text-amber-300">
                        No exam schedule found for this exam. Please create an exam schedule with shifts first from 
                        <strong> Administration → Exam Schedule</strong>.
                    </span>
                </div>
            )}

            {selectedShift && (
                <>
                    {/* Subject summary for this shift */}
                    {shiftSubjectsSummary.length > 0 && (
                        <Card className="shadow-none border-border rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                            <CardContent className="py-3 px-4">
                                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">Subjects in this shift:</p>
                                <div className="flex flex-wrap gap-2">
                                    {shiftSubjectsSummary.map((s, idx) => {
                                        const teacherSuffix = s.teacher_names.length > 0 
                                            ? ` (${s.teacher_names.join(", ")})` 
                                            : "";
                                        return (
                                            <Badge key={idx} variant="secondary" className="rounded-lg text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-0">
                                                {s.class_name}: {s.subject_name}{teacherSuffix}
                                            </Badge>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <UserCheck className="h-5 w-5 text-primary" /> Assign Invigilators
                            </h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                                {(roomDutyDetails.length > 0 ? roomDutyDetails : rooms.map(r => ({
                                    room: r,
                                    seatedClasses: [] as RoomDutyDetail["seatedClasses"],
                                    examSubjects: [] as RoomDutyDetail["examSubjects"],
                                    assignedTeachers: duties.filter(d => d.room_id === r.id).map(d => d.teacher_id),
                                }))).map(detail => {
                                    const roomDutiesList = duties.filter(d => d.room_id === detail.room.id);
                                    const availableForRoom = getAvailableTeachers(detail.room.id)
                                        .filter(t => !roomDutiesList.some(d => d.teacher_id === t.id));
                                        
                                    return (
                                        <Card key={detail.room.id} className="shadow-none border-border rounded-xl">
                                            <CardHeader className="py-3 bg-muted/30 border-b border-border rounded-t-2xl">
                                                <CardTitle className="text-sm">{detail.room.name}</CardTitle>
                                                {detail.seatedClasses.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {detail.seatedClasses.map((sc, idx) => (
                                                            <Badge key={idx} variant="outline" className="text-[10px] rounded-md border-border font-normal px-1.5 py-0">
                                                                {sc.class_name}{sc.section_name ? ` (${sc.section_name})` : ""} — {sc.allocated_students} students
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                                {detail.examSubjects.length > 0 && (
                                                     <div className="flex flex-wrap gap-1 mt-1">
                                                         {detail.examSubjects.map((es, idx) => {
                                                             const teacherSuffix = es.teacher_names.length > 0 
                                                                 ? ` (${es.teacher_names.join(", ")})` 
                                                                 : "";
                                                             return (
                                                                 <Badge key={idx} className="text-[10px] rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-0 font-normal px-1.5 py-0">
                                                                     {es.class_name}: {es.subject_name}{teacherSuffix}
                                                                 </Badge>
                                                             );
                                                         })}
                                                     </div>
                                                 )}
                                            </CardHeader>
                                            <CardContent className="pt-4 space-y-3">
                                                <div className="flex flex-wrap gap-2 min-h-[28px]">
                                                    {roomDutiesList.map(d => {
                                                        const teacher = teachers.find(t => t.id === d.teacher_id);
                                                        const count = liveDutyCounts[d.teacher_id] || 0;
                                                        return (
                                                            <Badge key={d.teacher_id} variant="secondary" className="inline-flex items-center gap-1.5 py-1 pl-2.5 pr-1 rounded-md text-xs font-medium">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => teacher && setSelectedTeacherForModal(teacher)}
                                                                    className="text-left cursor-pointer"
                                                                    title="Click to view all duties for this teacher"
                                                                >
                                                                    {teacher?.name || "Unknown"}
                                                                </button>
                                                                <span 
                                                                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-background text-foreground border border-border shadow-xs cursor-pointer"
                                                                    onClick={() => teacher && setSelectedTeacherForModal(teacher)}
                                                                    title={`${count} total ${count === 1 ? "duty" : "duties"}. Click to view.`}
                                                                >
                                                                    {count}
                                                                </span>
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => handleRemoveTeacher(detail.room.id, d.teacher_id)}
                                                                    className="ml-0.5 hover:bg-destructive hover:text-destructive-foreground rounded-full h-4 w-4 inline-flex items-center justify-center text-xs transition-colors"
                                                                    title="Remove teacher from this room"
                                                                >
                                                                    ×
                                                                </button>
                                                            </Badge>
                                                        );
                                                    })}
                                                    {roomDutiesList.length === 0 && <span className="text-xs text-muted-foreground italic">No teachers assigned</span>}
                                                </div>
                                                
                                                <Select 
                                                    key={`${detail.room.id}-${selectKeyRef.current}`}
                                                    onValueChange={(val) => handleAssignTeacher(detail.room.id, val)}
                                                >
                                                    <SelectTrigger className="h-8 text-xs rounded-lg">
                                                        <SelectValue placeholder="Add Teacher..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        {availableForRoom.length === 0 ? (
                                                            <SelectItem value="_none" disabled className="text-xs text-muted-foreground">
                                                                No available teachers
                                                            </SelectItem>
                                                        ) : (
                                                            availableForRoom.map(t => {
                                                                const count = liveDutyCounts[t.id] || 0;
                                                                return (
                                                                    <SelectItem key={t.id} value={t.id} className="text-xs cursor-pointer">
                                                                        <div className="flex items-center justify-between w-full gap-3">
                                                                            <span>{t.name}</span>
                                                                            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/50">
                                                                                {count} {count === 1 ? "duty" : "duties"}
                                                                            </span>
                                                                        </div>
                                                                    </SelectItem>
                                                                );
                                                            })
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <Card className="shadow-none border-border sticky top-4 rounded-xl">
                                <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border rounded-t-2xl flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-sm font-semibold">Total Duty Counts</CardTitle>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handlePrintTotalDutyCounts}
                                        className="h-7 px-2.5 text-xs font-semibold gap-1.5 rounded-lg shadow-none border-border hover:bg-background transition-colors"
                                        title="Print Total Duty Counts"
                                    >
                                        <Printer className="h-3.5 w-3.5" />
                                        Print
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[500px] overflow-y-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Teacher</TableHead>
                                                    <TableHead className="text-right">Duties</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {teachers.map(t => (
                                                    <TableRow 
                                                        key={t.id}
                                                        onClick={() => setSelectedTeacherForModal(t)}
                                                        className="cursor-pointer hover:bg-muted/50 transition-colors group"
                                                        title="Click to view detailed duty schedule"
                                                    >
                                                        <TableCell className="text-xs font-medium group-hover:text-primary transition-colors">
                                                            {t.name}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-xs font-semibold">
                                                            {liveDutyCounts[t.id] || 0}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {teachers.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={2} className="text-center text-xs py-4 text-muted-foreground italic">
                                                            No teachers found
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                            <TableFooter>
                                                <TableRow className="bg-muted/50 border-t-2 border-border font-bold">
                                                    <TableCell className="text-xs font-bold">Grand Total</TableCell>
                                                    <TableCell className="text-right font-mono text-xs font-bold">
                                                        {Object.values(liveDutyCounts).reduce((sum, c) => sum + (c || 0), 0)}
                                                    </TableCell>
                                                </TableRow>
                                            </TableFooter>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </>
            )}

            {/* Individual Teacher Duty Schedule Modal */}
            <Dialog open={!!selectedTeacherForModal} onOpenChange={(open) => !open && setSelectedTeacherForModal(null)}>
                <DialogContent className="sm:max-w-3xl w-full p-0 gap-0 overflow-hidden rounded-2xl border-border shadow-2xl">
                    {selectedTeacherForModal && (() => {
                        const t = selectedTeacherForModal;
                        const tDuties = getTeacherDuties(t.id);
                        return (
                            <div className="flex flex-col max-h-[85vh]">
                                <DialogHeader className="p-5 pr-14 bg-muted/40 border-b border-border space-y-0">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <DialogTitle className="text-lg font-bold flex items-center gap-2">
                                                <span>{t.name}</span>
                                                <Badge variant="outline" className="text-xs font-medium border-border/80 bg-background/50">
                                                    {t.designation || "Teacher"}
                                                </Badge>
                                            </DialogTitle>
                                            <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                                <span>Exam: <strong className="text-foreground">{selectedExamName || "Selected Exam"}</strong></span>
                                                {t.phone && <span>• Phone: <strong className="text-foreground">{t.phone}</strong></span>}
                                            </DialogDescription>
                                        </div>
                                        <Badge className="text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground shrink-0 shadow-none">
                                            {tDuties.length} Total {tDuties.length === 1 ? "Duty" : "Duties"}
                                        </Badge>
                                    </div>
                                </DialogHeader>

                                <div className="p-0 overflow-y-auto flex-1">
                                    {tDuties.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground text-sm">
                                            No duties assigned for this teacher in <strong>{selectedExamName}</strong>.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
                                                        <TableHead className="w-12 text-center font-bold text-xs">#</TableHead>
                                                        <TableHead className="font-bold text-xs">Date &amp; Day</TableHead>
                                                        <TableHead className="font-bold text-xs">Shift &amp; Time</TableHead>
                                                        <TableHead className="text-center font-bold text-xs">Hall / Room</TableHead>
                                                        <TableHead className="text-right font-bold text-xs pr-5">Action</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {tDuties.map((d) => {
                                                        const dateObj = new Date(d.date + "T00:00:00");
                                                        const dayName = !isNaN(dateObj.getTime())
                                                            ? dateObj.toLocaleDateString("en-GB", { weekday: "short" })
                                                            : "";
                                                        return (
                                                            <TableRow key={d.id} className="hover:bg-muted/30 transition-colors border-b border-border/60">
                                                                <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground py-3">
                                                                    {d.sl}
                                                                </TableCell>
                                                                <TableCell className="text-xs py-3">
                                                                    <div className="font-semibold text-foreground">{formatDate(d.date)}</div>
                                                                    <span className="text-[11px] text-muted-foreground font-medium">
                                                                        {dayName}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-xs py-3">
                                                                    <div className="font-bold text-foreground">{getShiftName(d.startTime + "||" + d.endTime)}</div>
                                                                    <span className="text-[11px] text-muted-foreground font-mono">
                                                                        {formatTime(d.startTime)} — {formatTime(d.endTime)}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-center text-xs py-3">
                                                                    <Badge variant="secondary" className="font-bold text-xs px-2.5 py-0.5 rounded-lg border border-border/50">
                                                                        {d.roomName}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right py-3 pr-5">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            setSelectedDate(d.date);
                                                                            setSelectedShift(`${d.startTime}||${d.endTime}`);
                                                                            setSelectedTeacherForModal(null);
                                                                            toast.info(`Switched to ${formatDate(d.date)} (${getShiftName(d.startTime + "||" + d.endTime)})`);
                                                                        }}
                                                                        className="h-8 px-3 text-xs font-semibold gap-1.5 text-primary hover:text-primary hover:bg-primary/10 border-primary/20 rounded-lg shadow-none"
                                                                    >
                                                                        <ExternalLink className="h-3.5 w-3.5" /> Jump to Shift
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 px-5 bg-muted/40 border-t border-border flex items-center justify-between">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={tDuties.length === 0}
                                        onClick={() => handlePrintTeacherDutySlip(t)}
                                        className="rounded-xl font-semibold gap-2 shadow-none h-9 px-4"
                                    >
                                        <Printer className="h-4 w-4" /> Print Duty Slip
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setSelectedTeacherForModal(null)}
                                        className="rounded-xl px-5 font-semibold shadow-none h-9"
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
