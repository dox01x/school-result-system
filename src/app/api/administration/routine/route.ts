import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CLASS_ROUTINE_COLUMNS } from "@/lib/supabase/select-columns";
import { timeToMinutes, timesOverlap } from "@/lib/conflict-detector";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
    try {
        const supabase = await createServerSupabaseClient();
        const { data, error } = await supabase
            .from("class_routines")
            .select(CLASS_ROUTINE_COLUMNS)
            .order("day_of_week")
            .order("start_time");

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { class_id, section_id, subject_id, teacher_id, room_id, day_of_week, start_time, end_time } = body;

        if (!class_id || !section_id || !subject_id || !teacher_id || day_of_week === undefined || !start_time || !end_time) {
            return NextResponse.json({ success: false, error: "Missing required fields: class_id, section_id, subject_id, teacher_id, day_of_week, start_time, end_time" }, { status: 400 });
        }

        if (day_of_week < 0 || day_of_week > 5) {
            return NextResponse.json({ success: false, error: "day_of_week must be between 0 (Saturday) and 5 (Thursday)" }, { status: 400 });
        }

        if (timeToMinutes(end_time) <= timeToMinutes(start_time)) {
            return NextResponse.json({ success: false, error: "end_time must be after start_time" }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();

        // Teacher conflict detection
        const { data: teacherSlots } = await supabase
            .from("class_routines")
            .select("id, start_time, end_time, class_id, section_id")
            .eq("teacher_id", teacher_id)
            .eq("day_of_week", day_of_week);

        if (teacherSlots && teacherSlots.length > 0) {
            for (const slot of teacherSlots) {
                if (body.id && slot.id === body.id) continue;
                if (timesOverlap(start_time, end_time, slot.start_time, slot.end_time)) {
                    return NextResponse.json({
                        success: false,
                        error: `Teacher conflict: This teacher is already assigned to another class at this time on this day.`,
                    }, { status: 409 });
                }
            }
        }

        // Room conflict detection
        if (room_id) {
            const { data: roomSlots } = await supabase
                .from("class_routines")
                .select("id, start_time, end_time, class_id, section_id")
                .eq("room_id", room_id)
                .eq("day_of_week", day_of_week);

            if (roomSlots && roomSlots.length > 0) {
                for (const slot of roomSlots) {
                    if (body.id && slot.id === body.id) continue;
                    if (timesOverlap(start_time, end_time, slot.start_time, slot.end_time)) {
                        return NextResponse.json({
                            success: false,
                            error: `Room conflict: This room is already booked for another class at this time on this day.`,
                        }, { status: 409 });
                    }
                }
            }
        }

        // If body.id exists, update; otherwise insert
        if (body.id) {
            const { data, error } = await supabase
                .from("class_routines")
                .update({ class_id, section_id, subject_id, teacher_id, room_id: room_id || null, day_of_week, start_time, end_time })
                .eq("id", body.id)
                .select(CLASS_ROUTINE_COLUMNS)
                .single();

            if (error) {
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }
            return NextResponse.json({ success: true, data });
        } else {
            const { data, error } = await supabase
                .from("class_routines")
                .insert({ class_id, section_id, subject_id, teacher_id, room_id: room_id || null, day_of_week, start_time, end_time })
                .select(CLASS_ROUTINE_COLUMNS)
                .single();

            if (error) {
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }
            return NextResponse.json({ success: true, data }, { status: 201 });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ success: false, error: "Missing id parameter" }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();
        const { error } = await supabase.from("class_routines").delete().eq("id", id);

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: { id } });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
