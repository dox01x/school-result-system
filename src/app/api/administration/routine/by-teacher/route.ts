// API route: GET teacher schedule — fetches all routine entries for a specific teacher
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TEACHER_COLUMNS } from "@/lib/supabase/select-columns";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const teacherId = searchParams.get("teacher_id");

        if (!teacherId) {
            return NextResponse.json({ success: false, error: "Missing teacher_id parameter" }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();

        // Get teacher info
        const { data: teacher, error: teacherError } = await supabase
            .from("teachers")
            .select(TEACHER_COLUMNS)
            .eq("id", teacherId)
            .single();

        if (teacherError || !teacher) {
            return NextResponse.json({ success: false, error: "Teacher not found" }, { status: 404 });
        }

        // Get all routine entries for this teacher
        const { data: entries, error: entriesError } = await supabase
            .from("class_routines")
            .select(`
                id, day_of_week, start_time, end_time, room_id,
                classes!class_routines_class_id_fkey(id, name),
                sections!class_routines_section_id_fkey(id, name),
                subjects!class_routines_subject_id_fkey(id, name),
                rooms!class_routines_room_id_fkey(id, name)
            `)
            .eq("teacher_id", teacherId)
            .order("day_of_week")
            .order("start_time");

        if (entriesError) {
            return NextResponse.json({ success: false, error: entriesError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            data: {
                teacher,
                entries: entries || [],
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
