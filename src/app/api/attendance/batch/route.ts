import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendAbsenceAlertSms } from "@/lib/sms-gateway";

export const dynamic = "force-dynamic";

type BatchRecord = {
    student_id: string;
    class_id: string;
    section_id: string;
    att_date: string;
    status: "P" | "A";
};

export async function POST(req: NextRequest) {
    const supabase = await createServerSupabaseClient();

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
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.att_date)) {
            return NextResponse.json(
                { success: false, error: `Record ${i}: att_date must be in YYYY-MM-DD format` },
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

    // Asynchronously fetch and send absence SMS alerts in background using correct individual record dates
    const absentRecords = records.filter((r) => r.status === "A");
    if (absentRecords.length > 0) {
        void (async () => {
            try {
                const { data: schoolInfo } = await supabase.from("school_info").select("name").limit(1).maybeSingle();
                const schoolName = schoolInfo?.name || "School";

                const absentStudentIds = Array.from(new Set(absentRecords.map((r) => r.student_id)));
                const { data: students } = await supabase
                    .from("students")
                    .select("id, name, phone")
                    .in("id", absentStudentIds);

                if (students) {
                    const studentMap = new Map<string, { name: string; phone: string | null }>(
                        students.map((s: { id: string; name: string; phone: string | null }) => [s.id, { name: s.name, phone: s.phone }])
                    );
                    for (const r of absentRecords) {
                        const s = studentMap.get(r.student_id);
                        if (s?.phone && s.phone.trim().length >= 8) {
                            await sendAbsenceAlertSms({
                                phone: s.phone,
                                studentName: s.name,
                                date: r.att_date,
                                schoolName,
                            });
                        }
                    }
                }
            } catch (err) {
                console.error("[Absence SMS Send Error]", err);
            }
        })();
    }

    return NextResponse.json({ success: true, data: { upserted: total } });
}
