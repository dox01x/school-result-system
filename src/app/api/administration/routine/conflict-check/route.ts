// API route: POST conflict-check — checks teacher & room conflicts across all routines
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { timeToMinutes, timesOverlap } from "@/lib/conflict-detector";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { teacher_id, room_id, day_of_week, start_time, end_time, exclude_id } = body;

        if (!teacher_id || day_of_week === undefined || !start_time || !end_time) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();
        const conflicts: { type: string; message: string; entry: Record<string, unknown> }[] = [];

        // Teacher conflict check
        const { data: teacherSlots } = await supabase
            .from("class_routines")
            .select(`
                id, start_time, end_time, day_of_week,
                classes!class_routines_class_id_fkey(name),
                sections!class_routines_section_id_fkey(name),
                subjects!class_routines_subject_id_fkey(name)
            `)
            .eq("teacher_id", teacher_id)
            .eq("day_of_week", day_of_week);

        if (teacherSlots) {
            for (const slot of teacherSlots) {
                if (exclude_id && slot.id === exclude_id) continue;
                if (timesOverlap(start_time, end_time, slot.start_time, slot.end_time)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const s = slot as any;
                    conflicts.push({
                        type: "teacher",
                        message: `This teacher is already assigned to ${s.classes?.name || ""} (${s.sections?.name || ""}) at ${slot.start_time}-${slot.end_time}`,
                        entry: slot,
                    });
                }
            }
        }

        // Room conflict check
        if (room_id) {
            const { data: roomSlots } = await supabase
                .from("class_routines")
                .select(`
                    id, start_time, end_time, day_of_week,
                    classes!class_routines_class_id_fkey(name),
                    sections!class_routines_section_id_fkey(name),
                    subjects!class_routines_subject_id_fkey(name)
                `)
                .eq("room_id", room_id)
                .eq("day_of_week", day_of_week);

            if (roomSlots) {
                for (const slot of roomSlots) {
                    if (exclude_id && slot.id === exclude_id) continue;
                    if (timesOverlap(start_time, end_time, slot.start_time, slot.end_time)) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const s = slot as any;
                        conflicts.push({
                            type: "room",
                            message: `This room is already booked for ${s.classes?.name || ""} (${s.sections?.name || ""}) at ${slot.start_time}-${slot.end_time}`,
                            entry: slot,
                        });
                    }
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
