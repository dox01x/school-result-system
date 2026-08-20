import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get("exam_id");
    const subjectId = searchParams.get("subject_id");
    const academicYear = searchParams.get("academic_year");
    const studentId = searchParams.get("student_id");

    let query = supabase.from("marks").select("*, students(id, name, roll)");

    if (examId) query = query.eq("exam_id", examId);
    if (subjectId) query = query.eq("subject_id", subjectId);
    if (academicYear) query = query.eq("academic_year", academicYear);
    if (studentId) query = query.eq("student_id", studentId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
