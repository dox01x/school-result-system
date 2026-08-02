import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendAbsenceAlertSms } from "@/lib/sms-gateway";

export const dynamic = "force-dynamic";

type ImportPayload = {
    class_id: string;
    section_id: string;
    sheet_id: string;
    range: string;
    year?: number;
    month?: number; // 1-12 (optional; used for date normalization when headers omit year/month)
};

type WarningItem = { row?: number; message: string };

function normalizeHeader(h: string): string {
    return (h || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function normRoll(r: string): string {
    return (r || "").toString().trim().replace(/^0+/, "") || "0";
}

function normPA(v: string): "P" | "A" | null {
    const raw = (v || "").toString().trim().toLowerCase();
    if (!raw) return null;
    // Remove punctuation/symbol noise like ".", "/", "-", "_" and spaces.
    const t = raw.replace(/[\s._\-\/\\]+/g, "");

    // Present variants
    if (
        t === "p" ||
        t === "present" ||
        t === "uposthit" ||
        t === "উপস্থিত" ||
        t === "presente" ||
        t === "1" ||
        t === "yes" ||
        t === "y"
    ) return "P";

    // Absent variants
    if (
        t === "a" ||
        t === "absent" ||
        t === "অনুপস্থিত" ||
        t === "onuposthit" ||
        t === "0" ||
        t === "no" ||
        t === "n"
    ) return "A";

    return null;
}

function pad2(n: number): string {
    return n.toString().padStart(2, "0");
}

function parseDateHeader(
    raw: string,
    defaults: { year?: number; month?: number }
): string | null {
    const s = (raw || "").toString().trim();
    if (!s) return null;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // ISO yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // dd/mm/yyyy or dd-mm-yyyy
    const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m1) {
        const d = Number(m1[1]);
        const mo = Number(m1[2]);
        const y = Number(m1[3]);
        if (y >= 1900 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${pad2(mo)}-${pad2(d)}`;
    }

    // dd/mm or dd-mm (use provided year/month or assume current year)
    const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (m2) {
        const d = Number(m2[1]);
        const mo = Number(m2[2]);
        const y = defaults.year || currentYear;
        if (y && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${pad2(mo)}-${pad2(d)}`;
    }

    // plain day number header e.g. "1".."31" (use defaults.year+defaults.month or current)
    if (/^\d{1,2}$/.test(s)) {
        const d = Number(s);
        const y = defaults.year || currentYear;
        const mo = defaults.month || currentMonth;
        if (y && mo && d >= 1 && d <= 31) return `${y}-${pad2(mo)}-${pad2(d)}`;
    }

    return null;
}

export async function POST(req: NextRequest) {
    const supabase = await createServerSupabaseClient();
    const authHeader = req.headers.get("authorization");
    const cookieHeader = req.headers.get("cookie");
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

    let payload: ImportPayload;
    try {
        payload = (await req.json()) as ImportPayload;
    } catch {
        return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const { class_id, section_id, sheet_id, range } = payload;
    const year = payload.year;
    const month = payload.month;

    if (!class_id || !section_id || !sheet_id || !range) {
        return NextResponse.json(
            { success: false, error: "class_id, section_id, sheet_id and range are required" },
            { status: 400 }
        );
    }

    // Fetch sheet values via Google Sheets endpoint (same project) forwarding auth headers
    const base = new URL(req.url);
    const sheetsRes = await fetch(new URL("/api/sheets", base), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(authHeader ? { Authorization: authHeader } : {}),
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body: JSON.stringify({ sheetId: sheet_id, range }),
    });
    const sheetsJson = await sheetsRes.json();
    if (!sheetsRes.ok) {
        return NextResponse.json(
            { success: false, error: sheetsJson.error || "Failed to fetch Google Sheet" },
            { status: sheetsRes.status }
        );
    }

    const rows: string[][] = sheetsJson.data || [];
    if (rows.length < 2) {
        return NextResponse.json({ success: false, error: "No data rows found in sheet" }, { status: 400 });
    }

    const header = rows[0].map((h) => normalizeHeader(h));
    const rollIdx = header.findIndex((h) => h === "roll");
    const nameIdx = header.findIndex((h) => h === "name" || h === "student name");
    const studentIdIdx = header.findIndex((h) => h === "student_id" || h === "student id" || h === "id");

    if (rollIdx < 0) {
        return NextResponse.json({ success: false, error: "Sheet must include a 'roll' column" }, { status: 400 });
    }

    // Determine date columns (anything that looks like a date, excluding known id/name columns)
    const dateCols: { idx: number; date: string }[] = [];
    for (let i = 0; i < header.length; i++) {
        if (i === rollIdx || i === nameIdx || i === studentIdIdx) continue;
        const raw = (rows[0][i] || "").toString().trim();
        const d = parseDateHeader(raw, { year, month });
        if (d) dateCols.push({ idx: i, date: d });
    }

    if (dateCols.length === 0) {
        return NextResponse.json(
            {
                success: false,
                error:
                    "No date columns detected. Use date headers like YYYY-MM-DD or DD/MM/YYYY (or day numbers with year+month provided).",
            },
            { status: 400 }
        );
    }

    // Load students for this class/section for roll matching (fast map with roll normalization)
    const { data: rawStudents, error: stuErr } = await supabase
        .from("students")
        .select("id, roll, student_id, name")
        .eq("class_id", class_id)
        .eq("section_id", section_id);
    if (stuErr) {
        return NextResponse.json({ success: false, error: stuErr.message }, { status: 500 });
    }

    type StudentRow = { id: string; roll: string; student_id: string | null; name: string };
    const students = (rawStudents || []) as StudentRow[];

    const byRoll = new Map<string, { id: string; name: string; roll: string; student_id: string | null }>();
    const byStudentId = new Map<string, { id: string; name: string; roll: string }>();
    students.forEach((s) => {
        byRoll.set(normRoll(String(s.roll)), { id: s.id, name: s.name, roll: s.roll, student_id: s.student_id });
        if (s.student_id) byStudentId.set(String(s.student_id).trim(), { id: s.id, name: s.name, roll: s.roll });
    });

    const warnings: WarningItem[] = [];
    const records: {
        student_id: string;
        class_id: string;
        section_id: string;
        att_date: string;
        status: "P" | "A";
        source: string;
    }[] = [];

    let skipped = 0;
    let matchedStudents = 0;

    for (let r = 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const rawRoll = (row[rollIdx] || "").toString().trim();
        const rollNormalized = normRoll(rawRoll);
        const sheetName = nameIdx >= 0 ? (row[nameIdx] || "").toString().trim() : "";
        const sheetStudentId = studentIdIdx >= 0 ? (row[studentIdIdx] || "").toString().trim() : "";

        if (!rawRoll && !sheetStudentId) {
            skipped++;
            continue;
        }

        let student: { id: string; name: string; roll?: string } | null = null;
        if (sheetStudentId && byStudentId.has(sheetStudentId)) {
            const s = byStudentId.get(sheetStudentId)!;
            student = { id: s.id, name: s.name, roll: s.roll };
        } else if (rawRoll && byRoll.has(rollNormalized)) {
            const s = byRoll.get(rollNormalized)!;
            student = { id: s.id, name: s.name, roll: s.roll || rawRoll };
        }

        if (!student) {
            skipped++;
            warnings.push({ row: r + 1, message: `Student not found for roll '${rawRoll}'${sheetStudentId ? ` / student_id '${sheetStudentId}'` : ""}` });
            continue;
        }

        matchedStudents++;
        if (sheetName && student.name && normalizeHeader(sheetName) !== normalizeHeader(student.name)) {
            warnings.push({ row: r + 1, message: `Name mismatch for roll '${rawRoll}': sheet '${sheetName}' vs DB '${student.name}'` });
        }

        for (const dc of dateCols) {
            const cell = row[dc.idx];
            const status = normPA(cell || "");
            if (!status) continue; // blank/unknown -> ignore
            records.push({
                student_id: student.id,
                class_id,
                section_id,
                att_date: dc.date,
                status,
                source: "google_sheets",
            });
        }
    }

    if (records.length === 0) {
        return NextResponse.json({
            success: true,
            data: {
                detected_dates: dateCols.map((d) => d.date),
                matched_students_rows: matchedStudents,
                imported_records: 0,
                skipped_rows: skipped,
                warnings: warnings.slice(0, 50),
                message: "Sheet configuration saved. No attendance values (P/A) found yet.",
            },
        });
    }

    // Upsert in chunks (avoid payload limits)
    let insertedOrUpdated = 0;
    const chunkSize = 1000;
    for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        const { error } = await supabase
            .from("attendance_records")
            .upsert(chunk, { onConflict: "student_id,att_date" });
        if (error) {
            return NextResponse.json({ success: false, error: error.message, warnings }, { status: 500 });
        }
        insertedOrUpdated += chunk.length;
    }

    // Asynchronously send absence SMS alerts in background (with deduplication)
    const absentRecords = records.filter(r => r.status === "A");
    if (absentRecords.length > 0) {
        void (async () => {
            try {
                const { data: schoolInfo } = await supabase.from("school_info").select("name").limit(1).maybeSingle();
                const schoolName = schoolInfo?.name || "School";
                
                const uniqueAbsentStudentIds = Array.from(new Set(absentRecords.map(r => r.student_id)));
                const { data: rawStudentsList } = await supabase
                    .from("students")
                    .select("id, name, phone")
                    .in("id", uniqueAbsentStudentIds);
                
                if (rawStudentsList) {
                    const studentMap = new Map<string, { name: string; phone: string | null }>(
                        (rawStudentsList as { id: string; name: string; phone: string | null }[]).map((s) => [s.id, { name: s.name, phone: s.phone }])
                    );
                    const sentKeys = new Set<string>();
                    for (const r of absentRecords) {
                        const key = `${r.student_id}__${r.att_date}`;
                        if (sentKeys.has(key)) continue;
                        sentKeys.add(key);

                        const s = studentMap.get(r.student_id);
                        if (s?.phone && s.phone.trim().length >= 8) {
                            await sendAbsenceAlertSms({
                                phone: s.phone,
                                studentName: s.name,
                                date: r.att_date,
                                schoolName
                            });
                        }
                    }
                }
            } catch (err) {
                console.error("[Import Absence SMS Send Error]", err);
            }
        })();
    }

    return NextResponse.json({
        success: true,
        data: {
            detected_dates: dateCols.map((d) => d.date),
            matched_students_rows: matchedStudents,
            imported_records: insertedOrUpdated,
            skipped_rows: skipped,
            warnings: warnings.slice(0, 50),
        },
    });
}

