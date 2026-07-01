import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GlobalSearchHit } from "@/lib/global-search-types";

export const dynamic = "force-dynamic";

function likePattern(q: string): string {
    const escaped = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    return `%${escaped}%`;
}

export async function GET(request: NextRequest) {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 1) {
        return NextResponse.json({ results: [] as GlobalSearchHit[] });
    }

    const supabase = (await createServerSupabaseClient()) as any;
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user && process.env.AUTH_DISABLED !== "true") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pat = likePattern(q);
    const limit = 8;

    const [studentsName, studentsRoll, studentsId, teachers, teachersEmail, staffs, staffsEmail, classes, subjects, exams, notices] =
        await Promise.all([
        supabase.from("students").select("id, name, roll, student_id").ilike("name", pat).limit(limit),
        supabase.from("students").select("id, name, roll, student_id").ilike("roll", pat).limit(limit),
        supabase.from("students").select("id, name, roll, student_id").ilike("student_id", pat).limit(limit),
        supabase.from("teachers").select("id, name, email, subject_specialty").ilike("name", pat).limit(6),
        supabase.from("teachers").select("id, name, email, subject_specialty").ilike("email", pat).limit(6),
        supabase.from("staffs").select("id, name, email, designation").ilike("name", pat).limit(6),
        supabase.from("staffs").select("id, name, email, designation").ilike("email", pat).limit(6),
        supabase.from("classes").select("id, name").ilike("name", pat).limit(6),
        supabase.from("subjects").select("id, name").ilike("name", pat).limit(6),
        supabase.from("exams").select("id, name, exam_type").ilike("name", pat).limit(6),
        supabase.from("notices").select("id, title").ilike("title", pat).limit(6),
    ]);

    const byId = new Map<string, GlobalSearchHit>();

    const add = (item: GlobalSearchHit) => {
        const key = `${item.type}:${item.id}`;
        if (!byId.has(key)) byId.set(key, item);
    };

    const studentRows = [...(studentsName.data ?? []), ...(studentsRoll.data ?? []), ...(studentsId.data ?? [])];
    for (const s of studentRows) {
        add({
            type: "student",
            id: s.id,
            title: s.name,
            subtitle: [s.roll && `Roll ${s.roll}`, s.student_id || null].filter(Boolean).join(" · ") || null,
            href: `/dashboard/students?studentId=${encodeURIComponent(s.id)}`,
        });
    }

    const teacherRows = [...(teachers.data ?? []), ...(teachersEmail.data ?? [])];
    for (const t of teacherRows) {
        add({
            type: "teacher",
            id: t.id,
            title: t.name,
            subtitle: t.subject_specialty || t.email || null,
            href: "/dashboard/administration/teachers-rooms",
        });
    }
    const staffRows = [...(staffs.data ?? []), ...(staffsEmail.data ?? [])];
    for (const s of staffRows) {
        add({
            type: "staff",
            id: s.id,
            title: s.name,
            subtitle: s.designation || s.email || "Staff",
            href: "/dashboard/administration/staff",
        });
    }

    for (const c of classes.data ?? []) {
        add({
            type: "class",
            id: c.id,
            title: c.name,
            subtitle: "Class",
            href: "/dashboard/classes",
        });
    }

    for (const s of subjects.data ?? []) {
        add({
            type: "subject",
            id: s.id,
            title: s.name,
            subtitle: "Subject",
            href: "/dashboard/subjects",
        });
    }

    for (const e of exams.data ?? []) {
        add({
            type: "exam",
            id: e.id,
            title: e.name,
            subtitle: e.exam_type || "Exam",
            href: "/dashboard/exams",
        });
    }

    for (const n of notices.data ?? []) {
        add({
            type: "notice",
            id: n.id,
            title: n.title,
            subtitle: "Notice",
            href: "/dashboard/administration/notice",
        });
    }

    const results = [...byId.values()].slice(0, 24);

    return NextResponse.json({ results });
}
