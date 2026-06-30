"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, UserCheck, AlertTriangle, Printer } from "lucide-react";

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
    const [dutyCounts, setDutyCounts] = useState<Record<string, number>>({});
    
    // Seat plan + schedule + class/section/subject data
    const [seatPlans, setSeatPlans] = useState<SeatPlanEntry[]>([]);
    const [examSchedules, setExamSchedules] = useState<ExamScheduleEntry[]>([]);
    const [classes, setClasses] = useState<ClassInfo[]>([]);
    const [sections, setSections] = useState<SectionInfo[]>([]);
    const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
    
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const selectKeyRef = useRef(0);

    const supabase = useMemo(() => createClient(), []);

    // Fetch base data
    useEffect(() => {
        const fetchBase = async () => {
            const [roomsRes, teachersRes, classesRes, sectionsRes, subjectsRes, schoolRes] = await Promise.all([
                supabase.from("rooms").select("id, name, order_index").order("order_index"),
                supabase.from("teachers").select("id, name, designation, phone").order("name"),
                supabase.from("classes").select("id, name, numeric_value").order("numeric_value"),
                supabase.from("sections").select("id, class_id, name"),
                supabase.from("subjects").select("id, class_id, name"),
                supabase.from("school_info").select("name, address, phone, logo_url").limit(1).single(),
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
            if (schoolRes.data) {
                setSchoolInfo(schoolRes.data);
            }
        };
        fetchBase();
    }, [supabase]);

    // Fetch schedules when exam selected
    useEffect(() => {
        if (!selectedExam) {
            setSchedules([]);
            setSelectedDate("");
            setSelectedShift("");
            return;
        }
        const fetchSchedules = async () => {
            const { data } = await supabase
                .from("exam_schedules")
                .select("exam_date, start_time, end_time")
                .eq("exam_id", selectedExam);
            setSchedules(data || []);
            setSelectedDate("");
            setSelectedShift("");
        };
        fetchSchedules();
    }, [selectedExam, supabase]);

    // Fetch seat plans when exam selected
    useEffect(() => {
        if (!selectedExam) {
            setSeatPlans([]);
            return;
        }
        const fetchSeatPlans = async () => {
            const { data } = await supabase
                .from("exam_seat_plans")
                .select("room_id, class_id, section_id, allocated_students")
                .eq("exam_id", selectedExam);
            setSeatPlans(data || []);
        };
        fetchSeatPlans();
    }, [selectedExam, supabase]);

    // Fetch exam schedules for specific date+shift to know subjects per class
    useEffect(() => {
        if (!selectedExam || !selectedDate || !selectedShift) {
            setExamSchedules([]);
            return;
        }
        const [start_time, end_time] = selectedShift.split("||");
        const fetchExamScheduleDetails = async () => {
            const { data } = await supabase
                .from("exam_schedules")
                .select("class_id, subject_id, exam_date, start_time, end_time")
                .eq("exam_id", selectedExam)
                .eq("exam_date", selectedDate)
                .eq("start_time", start_time)
                .eq("end_time", end_time);
            setExamSchedules(data || []);
        };
        fetchExamScheduleDetails();
    }, [selectedExam, selectedDate, selectedShift, supabase]);

    // Reset shift when date changes
    useEffect(() => {
        setSelectedShift("");
    }, [selectedDate]);

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
                    return {
                        class_id: es.class_id,
                        class_name: cls?.name || "Unknown",
                        subject_id: es.subject_id,
                        subject_name: sub?.name || "Unknown",
                    };
                });

            const roomDutiesList = duties.filter(d => d.room_id === room.id);
            const assignedTeachers = roomDutiesList.map(d => d.teacher_id);

            return { room, seatedClasses, examSubjects, assignedTeachers };
        }).filter(rd => rd.seatedClasses.length > 0 || rd.assignedTeachers.length > 0);
    }, [rooms, seatPlans, examSchedules, classes, sections, subjects, duties]);

    // Fetch current duties and global counts
    const fetchDuties = useCallback(async () => {
        if (!selectedExam || !selectedDate || !selectedShift) {
            setDuties([]);
            return;
        }
        setLoading(true);
        const [start_time, end_time] = selectedShift.split("||");
        try {
            const [currentDutiesRes, allDutiesRes] = await Promise.all([
                supabase.from("exam_duties").select("room_id, teacher_id")
                    .eq("exam_id", selectedExam)
                    .eq("exam_date", selectedDate)
                    .eq("start_time", start_time)
                    .eq("end_time", end_time),
                supabase.from("exam_duties").select("teacher_id")
            ]);

            setDuties((currentDutiesRes.data || []).map(d => ({
                room_id: d.room_id,
                teacher_id: d.teacher_id
            })));
            
            const counts: Record<string, number> = {};
            (allDutiesRes.data || []).forEach(d => {
                counts[d.teacher_id] = (counts[d.teacher_id] || 0) + 1;
            });
            setDutyCounts(counts);
        } catch {
            toast.error("Failed to load duties");
        } finally {
            setLoading(false);
        }
    }, [selectedExam, selectedDate, selectedShift, supabase]);

    useEffect(() => {
        fetchDuties();
    }, [fetchDuties]);

    const handleAssignTeacher = (roomId: string, teacherId: string) => {
        if (!teacherId) return;
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
        
        try {
            await supabase.from("exam_duties").delete()
                .eq("exam_id", selectedExam)
                .eq("exam_date", selectedDate)
                .eq("start_time", start_time)
                .eq("end_time", end_time);

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
            const [h, m] = t.split(":").map(Number);
            const ampm = h >= 12 ? "PM" : "AM";
            const h12 = h % 12 || 12;
            return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
        } catch { return t; }
    };

    const formatDate = (d: string) => {
        try {
            const date = new Date(d + "T00:00:00");
            return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        } catch { return d; }
    };

    const formatDateFull = (d: string) => {
        try {
            const date = new Date(d + "T00:00:00");
            return date.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
        } catch { return d; }
    };

    const getAvailableTeachers = (roomId: string) => {
        const assignedTeacherIds = new Set(duties.map(d => d.teacher_id));
        const inThisRoom = new Set(duties.filter(d => d.room_id === roomId).map(d => d.teacher_id));
        return teachers.filter(t => !assignedTeacherIds.has(t.id) || inThisRoom.has(t.id));
    };

    const shiftSubjectsSummary = useMemo(() => {
        const seen = new Set<string>();
        const result: { class_name: string; subject_name: string }[] = [];
        examSchedules.forEach(es => {
            const cls = classes.find(c => c.id === es.class_id);
            const sub = subjects.find(s => s.id === es.subject_id);
            const key = `${es.class_id}-${es.subject_id}`;
            if (!seen.has(key) && cls && sub) {
                seen.add(key);
                result.push({ class_name: cls.name, subject_name: sub.name });
            }
        });
        return result;
    }, [examSchedules, classes, subjects]);

    const handlePrint = () => {
        // Build subject summary text
        const subjectSummaryText = shiftSubjectsSummary
            .map(s => `${s.class_name}: ${s.subject_name}`)
            .join(", ");

        // Build table rows HTML
        let tableRowsHtml = "";
        if (printRows.length > 0) {
            printRows.forEach((row, roomIdx) => {
                row.teachers.forEach((teacher, tIdx) => {
                    tableRowsHtml += "<tr>";
                    if (tIdx === 0) {
                        tableRowsHtml += `<td style="border:1px solid #000;padding:4px 6px;text-align:center;vertical-align:top" rowspan="${row.teachers.length}">${roomIdx + 1}</td>`;
                        tableRowsHtml += `<td style="border:1px solid #000;padding:4px 6px;font-weight:bold;vertical-align:top" rowspan="${row.teachers.length}">${row.roomName}</td>`;
                        tableRowsHtml += `<td style="border:1px solid #000;padding:4px 6px;font-size:10px;vertical-align:top" rowspan="${row.teachers.length}">${row.classText}</td>`;
                        tableRowsHtml += `<td style="border:1px solid #000;padding:4px 6px;font-size:10px;vertical-align:top" rowspan="${row.teachers.length}">${row.subjectText}</td>`;
                    }
                    tableRowsHtml += `<td style="border:1px solid #000;padding:4px 6px;vertical-align:top">${teacher.name}</td>`;
                    tableRowsHtml += `<td style="border:1px solid #000;padding:4px 6px;vertical-align:top;width:80px"></td>`;
                    tableRowsHtml += "</tr>";
                });
            });
        } else {
            tableRowsHtml = `<tr><td colspan="6" style="border:1px solid #000;padding:4px 6px;text-align:center">No duties assigned</td></tr>`;
        }

        const thStyle = `border:1px solid #000;padding:5px 6px;text-align:center;font-weight:bold;background:#f0f0f0;font-size:11px`;

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Exam Hall Guard Duty List</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; color: #000; padding: 20px 40px; font-size: 12px; background: #fff; }
        @page { size: A4; margin: 10mm; }
        @media print { body { padding: 20px; } }
    </style>
</head>
<body>
    <!-- School Header -->
    <div style="text-align:center;margin-bottom:40px">
        <h2 style="font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin:0">${schoolInfo?.name || "School Name"}</h2>
        <p style="font-size:12px;color:#666;margin-top:4px">${schoolInfo?.address || ""} ${schoolInfo?.phone ? "• " + schoolInfo.phone : ""}</p>
    </div>

    <!-- Title -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e5e5e5">
        <div>
            <h1 style="font-size:28px;font-weight:900;letter-spacing:-1px;line-height:1;text-transform:uppercase;margin:0">Hall Guard Duty</h1>
            <p style="font-size:12px;font-weight:600;color:#666;letter-spacing:2px;text-transform:uppercase;margin-top:6px">${selectedExamName} &bull; ${formatTime(shiftTimes[0])} — ${formatTime(shiftTimes[1])}</p>
        </div>
        <div style="text-align:right">
            <div style="font-size:24px;font-weight:800">${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long' })}</div>
            <div style="font-size:12px;font-weight:600;color:#666;letter-spacing:2px;text-transform:uppercase">${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>
    </div>


    <!-- Duty Table -->
    <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
            <tr>
                <th style="${thStyle}">Sl. No.</th>
                <th style="${thStyle}">Hall / Room</th>
                <th style="${thStyle}">Class (Section) &amp; Students</th>
                <th style="${thStyle}">Subject</th>
                <th style="${thStyle}">Invigilator Name</th>
                <th style="${thStyle};width:80px">Signature</th>
            </tr>
        </thead>
        <tbody>${tableRowsHtml}</tbody>
    </table>

    <!-- Footer -->
    <div style="text-align:center;font-size:10px;color:#999;margin-top:40px;padding-top:20px;font-weight:600;letter-spacing:1px">
        <p>Computer generated on ${new Date().toLocaleDateString('en-GB')}. No signature required.</p>
    </div>
</body>
</html>`;

        const printWindow = window.open("", "_blank");
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 400);
        }
    };

    const selectedExamName = exams.find(e => e.id === selectedExam)?.name || "";
    const shiftTimes = selectedShift ? selectedShift.split("||") : ["", ""];

    // Print table styles (kept for potential future use)
    const thPrintStyle: React.CSSProperties = {
        border: "1px solid #000",
        padding: "5px 6px",
        textAlign: "center",
        fontWeight: "bold",
        backgroundColor: "#f0f0f0",
        fontSize: "11px",
    };

    const tdPrintStyle: React.CSSProperties = {
        border: "1px solid #000",
        padding: "4px 6px",
        verticalAlign: "top",
    };

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
                    `${sc.class_name}${sc.section_name ? ` (${sc.section_name})` : ""} — ${sc.allocated_students} students`
                ).join(", ")
                : "—";

            const subjectText = detail.examSubjects.length > 0
                ? detail.examSubjects.map(es => `${es.class_name}: ${es.subject_name}`).join(", ")
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
                <div className="flex items-center gap-3 flex-wrap bg-card p-4 rounded-2xl border border-border/50">
                    <Select value={selectedExam} onValueChange={setSelectedExam}>
                        <SelectTrigger className="w-[200px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                            <SelectValue placeholder="Select Exam" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border/50 shadow-md">
                            {exams.map(e => <SelectItem key={e.id} value={e.id} className="rounded-lg">{e.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={selectedDate} onValueChange={setSelectedDate} disabled={!selectedExam || availableDates.length === 0}>
                        <SelectTrigger className="w-[180px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                            <SelectValue placeholder="Select Date" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border/50 shadow-md">
                            {availableDates.map(d => (
                                <SelectItem key={d} value={d} className="rounded-lg">{formatDate(d)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedShift} onValueChange={setSelectedShift} disabled={!selectedDate || availableShifts.length === 0}>
                        <SelectTrigger className="w-[220px] h-11 rounded-xl border-0 bg-muted hover:bg-muted/80 transition-colors text-foreground font-semibold shadow-none focus:ring-1 focus:ring-ring/30">
                            <SelectValue placeholder="Select Shift" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border/50 shadow-md">
                            {availableShifts.map(s => {
                                const [start, end] = s.split("||");
                                return <SelectItem key={s} value={s} className="rounded-lg">{formatTime(start)} — {formatTime(end)}</SelectItem>;
                            })}
                        </SelectContent>
                    </Select>

                    <div className="ml-auto flex gap-2">
                        {selectedShift && duties.length > 0 && (
                            <Button
                                variant="outline"
                                onClick={handlePrint}
                                className="h-11 rounded-xl font-semibold shadow-none border-border/50 transition-all duration-200 gap-2"
                            >
                                <Printer className="h-4 w-4" /> Print Duty List
                            </Button>
                        )}
                        <Button 
                            onClick={handleSave} 
                            disabled={!selectedShift || saving}
                            className="h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-none transition-all duration-200"
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
                            <Card className="shadow-none border-border/50 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                                <CardContent className="py-3 px-4">
                                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">Subjects in this shift:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {shiftSubjectsSummary.map((s, idx) => (
                                            <Badge key={idx} variant="secondary" className="rounded-lg text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-0">
                                                {s.class_name}: {s.subject_name}
                                            </Badge>
                                        ))}
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
                                            <Card key={detail.room.id} className="shadow-none border-border/50 rounded-2xl">
                                                <CardHeader className="py-3 bg-muted/30 border-b border-border/50 rounded-t-2xl">
                                                    <CardTitle className="text-sm">{detail.room.name}</CardTitle>
                                                    {detail.seatedClasses.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {detail.seatedClasses.map((sc, idx) => (
                                                                <Badge key={idx} variant="outline" className="text-[10px] rounded-md border-border/50 font-normal px-1.5 py-0">
                                                                    {sc.class_name}{sc.section_name ? ` (${sc.section_name})` : ""} — {sc.allocated_students} students
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {detail.examSubjects.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {detail.examSubjects.map((es, idx) => (
                                                                <Badge key={idx} className="text-[10px] rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-0 font-normal px-1.5 py-0">
                                                                    📝 {es.class_name}: {es.subject_name}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </CardHeader>
                                                <CardContent className="pt-4 space-y-3">
                                                    <div className="flex flex-wrap gap-2 min-h-[28px]">
                                                        {roomDutiesList.map(d => {
                                                            const teacher = teachers.find(t => t.id === d.teacher_id);
                                                            return (
                                                                <Badge key={d.teacher_id} variant="secondary" className="flex items-center gap-1 pr-1 rounded-md">
                                                                    {teacher?.name || "Unknown"}
                                                                    <button 
                                                                        onClick={() => handleRemoveTeacher(detail.room.id, d.teacher_id)}
                                                                        className="ml-1 hover:bg-destructive hover:text-white rounded-full h-4 w-4 flex items-center justify-center text-xs transition-colors"
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
                                                                <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">No available teachers</div>
                                                            ) : (
                                                                availableForRoom.map(t => (
                                                                    <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                                                                ))
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
                                <Card className="shadow-none border-border/50 sticky top-4 rounded-2xl">
                                    <CardHeader className="py-3 bg-muted/30 border-b border-border/50 rounded-t-2xl">
                                        <CardTitle className="text-sm">Total Duty Counts</CardTitle>
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
                                                        <TableRow key={t.id}>
                                                            <TableCell className="text-xs">{t.name}</TableCell>
                                                            <TableCell className="text-right font-mono text-xs">
                                                                <Badge variant="outline" className="rounded-md">{dutyCounts[t.id] || 0}</Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </>
                )}
            </div>
    );
}
