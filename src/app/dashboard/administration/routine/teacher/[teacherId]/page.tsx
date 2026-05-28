// Teacher-specific weekly routine view page
"use client";

import { useEffect, useState, useMemo, use } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Teacher, Room } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Printer, ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";

const DAY_NAMES_EN = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

interface TeacherRoutineEntry {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    room_id: string | null;
    classes: { id: string; name: string } | null;
    sections: { id: string; name: string } | null;
    subjects: { id: string; name: string } | null;
    rooms: { id: string; name: string } | null;
}

function timeToMinutes(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

export default function TeacherRoutinePage({ params }: { params: Promise<{ teacherId: string }> }) {
    const { teacherId } = use(params);
    const supabase = useMemo(() => createClient(), []);

    const [teacher, setTeacher] = useState<Teacher | null>(null);
    const [entries, setEntries] = useState<TeacherRoutineEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const res = await fetch(`/api/administration/routine/by-teacher?teacher_id=${teacherId}`);
            const result = await res.json();
            if (result.success) {
                setTeacher(result.data.teacher);
                setEntries(result.data.entries || []);
            }
            setLoading(false);
        })();
    }, [teacherId, supabase]);

    // Detect conflicts within this teacher's schedule
    const conflicts = useMemo(() => {
        const found: Set<string> = new Set();
        for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
                if (entries[i].day_of_week !== entries[j].day_of_week) continue;
                const aS = timeToMinutes(entries[i].start_time), aE = timeToMinutes(entries[i].end_time);
                const bS = timeToMinutes(entries[j].start_time), bE = timeToMinutes(entries[j].end_time);
                if (aS < bE && bS < aE) {
                    found.add(entries[i].id);
                    found.add(entries[j].id);
                }
            }
        }
        return found;
    }, [entries]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
            </div>
        );
    }

    if (!teacher) {
        return (
            <div className="text-center py-16">
                <p className="text-muted-foreground">Teacher not found</p>
                <Link href="/dashboard/administration/routine">
                    <Button variant="outline" className="mt-4">Back to Routine</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 mb-1 print:hidden">
                        <Link href="/dashboard/administration/routine">
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <span className="text-sm text-muted-foreground">Teacher Routine</span>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">{teacher.name}</h1>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                        {teacher.designation || "Teacher"}
                        {teacher.subject_specialty && ` · ${teacher.subject_specialty}`}
                        {teacher.phone && ` · ${teacher.phone}`}
                    </p>
                </div>
                <div className="flex items-center gap-2 no-print">
                    <Badge variant="secondary">{entries.length} classes/week</Badge>
                    {conflicts.size > 0 && (
                        <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {conflicts.size} conflicts
                        </Badge>
                    )}
                    <Button variant="outline" size="sm" onClick={() => {
                        document.body.classList.add("printing-routine");
                        setTimeout(() => { window.print(); document.body.classList.remove("printing-routine"); }, 100);
                    }} className="gap-1.5">
                        <Printer className="h-4 w-4" />
                        Print
                    </Button>
                </div>
            </div>

            {/* Print header */}
            <div className="print-header">
                <div className="text-center border-b-2 border-black pb-3 mb-3">
                    <h2 className="text-lg font-bold">{teacher.name} — Weekly Routine</h2>
                    <p className="text-sm">{teacher.designation} · {teacher.subject_specialty}</p>
                </div>
            </div>

            {/* Day-by-day schedule */}
            <div className="space-y-3">
                {DAY_NAMES_EN.map((dayName, dayIndex) => {
                    const dayEntries = entries.filter((e) => e.day_of_week === dayIndex);
                    if (dayEntries.length === 0) return null;
                    return (
                        <Card key={dayIndex}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                                    {dayName}
                                    <Badge variant="secondary" className="text-[10px] px-1.5">{dayEntries.length} classes</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                    {dayEntries.map((e) => {
                                        const hasConflict = conflicts.has(e.id);
                                        return (
                                            <div
                                                key={e.id}
                                                className={`rounded-lg p-2.5 transition-colors ${
                                                    hasConflict
                                                        ? "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30"
                                                        : "bg-accent/50"
                                                }`}
                                            >
                                                {hasConflict && (
                                                    <div className="flex items-center gap-1 mb-1">
                                                        <AlertTriangle className="h-3 w-3 text-red-500" />
                                                        <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">Time Conflict</span>
                                                    </div>
                                                )}
                                                <div className="text-[11px] text-muted-foreground font-medium">
                                                    {e.start_time} — {e.end_time}
                                                </div>
                                                <div className="text-[13px] font-medium mt-0.5 truncate">
                                                    {e.classes?.name || "—"} — {e.sections?.name || "—"}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground truncate">
                                                    {e.subjects?.name || "—"}
                                                    {e.rooms?.name && ` · ${e.rooms.name}`}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {entries.length === 0 && (
                    <Card className="border-dashed border-2">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <CalendarClock className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="font-semibold text-lg mb-1">No Schedule</h3>
                            <p className="text-sm text-muted-foreground max-w-sm">This teacher has no classes assigned yet.</p>
                        </CardContent>
                    </Card>
                )}
            </div>


        </div>
    );
}
