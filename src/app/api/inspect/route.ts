import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/inspect — debug endpoint (super_admin only)
 * Returns column names for students and teachers tables.
 */
export async function GET() {
    const auth = await requireRole("super_admin");
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    try {
        const { data: student } = await supabase.from("students").select("*").limit(1).maybeSingle();
        const { data: teacher } = await supabase.from("teachers").select("*").limit(1).maybeSingle();
        return NextResponse.json({
            studentKeys: student ? Object.keys(student) : null,
            teacherKeys: teacher ? Object.keys(teacher) : null,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
