import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type BatchRecord = {
    student_id: string;
    class_id: string;
    section_id: string;
    att_date: string;
    status: "P" | "A";
};

export async function POST(req: NextRequest) {
    const supabase = (await createServerSupabaseClient()) as any;

    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : null;
    const {
        data: { user },
    } = bearerToken
        ? await supabase.auth.getUser(bearerToken)
        : await supabase.auth.getUser();

    if (!user && process.env.AUTH_DISABLED !== "true") {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let body: { records: BatchRecord[] };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const { records } = body;
    if (!Array.isArray(records) || records.length === 0) {
        return NextResponse.json({ success: false, error: "records array is required" }, { status: 400 });
    }

    // Validate each record
    for (let i = 0; i < records.length; i++) {
        const r = records[i];
        if (!r.student_id || !r.class_id || !r.section_id || !r.att_date || !r.status) {
            return NextResponse.json(
                { success: false, error: `Record ${i}: missing required fields` },
                { status: 400 }
            );
        }
        if (r.status !== "P" && r.status !== "A") {
            return NextResponse.json(
                { success: false, error: `Record ${i}: status must be 'P' or 'A'` },
                { status: 400 }
            );
        }
    }

    // Upsert in chunks
    const chunkSize = 500;
    let total = 0;
    for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize).map((r) => ({
            student_id: r.student_id,
            class_id: r.class_id,
            section_id: r.section_id,
            att_date: r.att_date,
            status: r.status,
            source: "manual",
        }));
        const { error } = await supabase
            .from("attendance_records")
            .upsert(chunk, { onConflict: "student_id,att_date" });
        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        total += chunk.length;
    }

    return NextResponse.json({ success: true, data: { upserted: total } });
}
