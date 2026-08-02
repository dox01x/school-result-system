// API route: POST conflict-check — checks teacher, room & section conflicts across all routines
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { timesOverlap } from "@/lib/conflict-detector";
import { NextRequest, NextResponse } from "next/server";

interface RoutineSlotRecord {
    id: string;
    start_time: string;
    end_time: string;
    day_of_week: number;
    class_id: string;
    section_id?: string;
    classes?: { name: string } | null;
    sections?: { name: string } | null;
    subjects?: { name: string } | null;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { teacher_id, room_id, day_of_week, start_time, end_time, exclude_id, class_id, section_id } = body;

        if (!teacher_id || day_of_week === undefined || !start_time || !end_time) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();
        const conflicts: { type: "teacher" | "room" | "section"; message: string; entry: Record<string, unknown> }[] = [];

        // 1. Section conflict check (if section_id provided)
        if (class_id && section_id) {
            const { data: rawSectionSlots } = await supabase
                .from("class_routines")
                .select(`
                    id, start_time, end_time, day_of_week, class_id, section_id,
                    classes!class_routines_class_id_fkey(name),
                    sections!class_routines_section_id_fkey(name),
                    subjects!class_routines_subject_id_fkey(name)
                `)
                .eq("class_id", class_id)
                .eq("section_id", section_id)
                .eq("day_of_week", day_of_week);

            const sectionSlots = (rawSectionSlots || []) as unknown as RoutineSlotRecord[];
            for (const slot of sectionSlots) {
                if (exclude_id && slot.id === exclude_id) continue;
                if (timesOverlap(start_time, end_time, slot.start_time, slot.end_time)) {
                    conflicts.push({
                        type: "section",
                        message: `This section already has ${slot.subjects?.name || "a class"} scheduled at ${slot.start_time}-${slot.end_time}`,
                        entry: slot as unknown as Record<string, unknown>,
                    });
                }
            }
        }

        // 2. Teacher conflict check
        const { data: rawTeacherSlots } = await supabase
            .from("class_routines")
            .select(`
                id, start_time, end_time, day_of_week, class_id,
                classes!class_routines_class_id_fkey(name),
                sections!class_routines_section_id_fkey(name),
                subjects!class_routines_subject_id_fkey(name)
            `)
            .eq("teacher_id", teacher_id)
            .eq("day_of_week", day_of_week);

        const teacherSlots = (rawTeacherSlots || []) as unknown as RoutineSlotRecord[];
        for (const slot of teacherSlots) {
            if (exclude_id && slot.id === exclude_id) continue;
            if (timesOverlap(start_time, end_time, slot.start_time, slot.end_time)) {
                conflicts.push({
                    type: "teacher",
                    message: `This teacher is already assigned to ${slot.classes?.name || "another class"} (${slot.sections?.name || ""}) at ${slot.start_time}-${slot.end_time}`,
                    entry: slot as unknown as Record<string, unknown>,
                });
            }
        }

        // 3. Room conflict check
        if (room_id) {
            const { data: rawRoomSlots } = await supabase
                .from("class_routines")
                .select(`
                    id, start_time, end_time, day_of_week, class_id,
                    classes!class_routines_class_id_fkey(name),
                    sections!class_routines_section_id_fkey(name),
                    subjects!class_routines_subject_id_fkey(name)
                `)
                .eq("room_id", room_id)
                .eq("day_of_week", day_of_week);

            const roomSlots = (rawRoomSlots || []) as unknown as RoutineSlotRecord[];
            for (const slot of roomSlots) {
                if (exclude_id && slot.id === exclude_id) continue;
                if (timesOverlap(start_time, end_time, slot.start_time, slot.end_time)) {
                    conflicts.push({
                        type: "room",
                        message: `This room is already booked for ${slot.classes?.name || "another class"} (${slot.sections?.name || ""}) at ${slot.start_time}-${slot.end_time}`,
                        entry: slot as unknown as Record<string, unknown>,
                    });
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                has_conflict: conflicts.length > 0,
                conflicts,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
