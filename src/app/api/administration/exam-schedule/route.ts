import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EXAM_SCHEDULE_COLUMNS } from "@/lib/supabase/select-columns";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
    try {
        const supabase = await createServerSupabaseClient();
        const { data, error } = await supabase
            .from("exam_schedules")
            .select(EXAM_SCHEDULE_COLUMNS)
            .order("exam_date")
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
        const { exam_id, class_id, subject_id, exam_date, start_time, end_time, room_id, invigilator_id } = body;

        if (!exam_id || !class_id || !subject_id || !exam_date || !start_time || !end_time) {
            return NextResponse.json({
                success: false,
                error: "Missing required fields: exam_id, class_id, subject_id, exam_date, start_time, end_time",
            }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();

        if (body.id) {
            const { data, error } = await supabase
                .from("exam_schedules")
                .update({
                    exam_id, class_id, subject_id, exam_date, start_time, end_time,
                    room_id: room_id || null,
                    invigilator_id: invigilator_id || null,
                })
                .eq("id", body.id)
                .select()
                .single();

            if (error) {
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }
            return NextResponse.json({ success: true, data });
        } else {
            const { data, error } = await supabase
                .from("exam_schedules")
                .insert({
                    exam_id, class_id, subject_id, exam_date, start_time, end_time,
                    room_id: room_id || null,
                    invigilator_id: invigilator_id || null,
                })
                .select()
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
        const { error } = await supabase.from("exam_schedules").delete().eq("id", id);

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: { id } });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
