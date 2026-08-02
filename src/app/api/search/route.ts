import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import type { GlobalSearchHit } from "@/lib/global-search-types";

export const dynamic = "force-dynamic";

interface StudentSearchRow {
    id: string;
    name: string;
    roll: string | null;
    student_id: string | null;
}

interface TeacherSearchRow {
    id: string;
    name: string;
    email: string | null;
    subject_specialty: string | null;
}

interface StaffSearchRow {
    id: string;
    name: string;
    email: string | null;
    designation: string | null;
}

interface NamedRow {
    id: string;
    name: string;
}

interface ExamRow {
    id: string;
    name: string;
    exam_type: string | null;
}

interface NoticeRow {
    id: string;
    title: string;
}

function cleanQuery(q: string): string {
    return q.replace(/,/g, " ").replace(/"/g, "").trim();
}

function likePattern(q: string): string {
    const cleaned = cleanQuery(q);
    const escaped = cleaned.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    return `%${escaped}%`;
}

export async function GET(request: NextRequest) {
    const rawQ = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (rawQ.length < 1) {
        return NextResponse.json({ results: [] as GlobalSearchHit[] });
    }
    if (rawQ.length > 200) {
        return NextResponse.json({ error: "Query too long" }, { status: 400 });
    }

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const pat = likePattern(rawQ);
    const limit = 8;

    const [studentsRes, teachersRes, staffsRes, classesRes, subjectsRes, examsRes, noticesRes] =
        await Promise.all([
            supabase
                .from("students")
                .select("id, name, roll, student_id")
                .or(`name.ilike.${pat},roll.ilike.${pat},student_id.ilike.${pat}`)
                .limit(limit),
            supabase
                .from("teachers")
                .select("id, name, email, subject_specialty")
                .or(`name.ilike.${pat},email.ilike.${pat}`)
                .limit(6),
            supabase
                .from("staffs")
                .select("id, name, email, designation")
                .or(`name.ilike.${pat},email.ilike.${pat}`)
                .limit(6),
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

    const studentRows = (studentsRes.data || []) as unknown as StudentSearchRow[];
    for (const s of studentRows) {
        add({
            type: "student",
            id: s.id,
            title: s.name,
            subtitle: [s.roll && `Roll ${s.roll}`, s.student_id || null].filter(Boolean).join(" · ") || null,
            href: `/dashboard/students?studentId=${encodeURIComponent(s.id)}`,
        });
    }

    const teacherRows = (teachersRes.data || []) as unknown as TeacherSearchRow[];
    for (const t of teacherRows) {
        add({
            type: "teacher",
            id: t.id,
            title: t.name,
            subtitle: t.subject_specialty || t.email || null,
            href: "/dashboard/administration/teachers-rooms",
        });
    }

    const staffRows = (staffsRes.data || []) as unknown as StaffSearchRow[];
    for (const s of staffRows) {
        add({
            type: "staff",
            id: s.id,
            title: s.name,
            subtitle: s.designation || s.email || "Staff",
            href: "/dashboard/administration/staff",
        });
    }

    const classRows = (classesRes.data || []) as unknown as NamedRow[];
    for (const c of classRows) {
        add({
            type: "class",
            id: c.id,
            title: c.name,
            subtitle: "Class",
            href: "/dashboard/classes",
        });
    }

    const subjectRows = (subjectsRes.data || []) as unknown as NamedRow[];
    for (const s of subjectRows) {
        add({
            type: "subject",
            id: s.id,
            title: s.name,
            subtitle: "Subject",
            href: "/dashboard/subjects",
        });
    }

    const examRows = (examsRes.data || []) as unknown as ExamRow[];
    for (const e of examRows) {
        add({
            type: "exam",
            id: e.id,
            title: e.name,
            subtitle: e.exam_type || "Exam",
            href: "/dashboard/exams",
        });
    }

    const noticeRows = (noticesRes.data || []) as unknown as NoticeRow[];
    for (const n of noticeRows) {
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
