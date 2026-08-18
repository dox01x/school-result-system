import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SheetConfigRecord {
    id: string;
    class_id: string;
    section_id: string;
    sheet_id: string;
    sheet_range: string;
    type: string;
}

interface StudentGroupRecord {
    roll: string;
    group_name: string | null;
}

function normRoll(r: string): string {
    return (r || "").toString().trim().replace(/^0+/, "") || "0";
}

function normalizeGroupName(val: string): string | null {
    const s = (val || "").toString().trim().toLowerCase();
    if (!s) return null;

    if (s === "science" || s === "বিজ্ঞান") return "Science";
    if (s === "arts" || s === "humanities" || s === "মানবিক") return "Arts";
    if (
        s === "commerce" ||
        s === "business" ||
        s === "ব্যবসায়" ||
        s === "ব্যবসায় শিক্ষা" ||
        s === "ব্যবসায় শাখা"
    ) return "Commerce";

    return null;
}

export async function GET(req: NextRequest) {
    // API Key / Secret validation (supports query parameter, Bearer token, or x-cron-secret header)
    const { searchParams } = new URL(req.url);
    const secretParam = searchParams.get("secret");
    const authHeader = req.headers.get("authorization");
    const bearerSecret = authHeader?.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : null;
    const headerSecret = req.headers.get("x-cron-secret");

    const providedSecret = secretParam || bearerSecret || headerSecret;

    const supabase = await createServerSupabaseClient();

    if (process.env.CRON_SECRET) {
        if (providedSecret !== process.env.CRON_SECRET) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
    } else if (process.env.AUTH_DISABLED !== "true") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ success: false, error: "Unauthorized - CRON_SECRET or Admin session required" }, { status: 401 });
        }
    }

    try {
        // Fetch all student sheet configurations
        const { data: rawConfigs, error: configError } = await supabase
            .from("sheet_configs")
            .select("*")
            .eq("type", "students");

        if (configError) {
            return NextResponse.json({ success: false, error: configError.message }, { status: 500 });
        }

        const configs = (rawConfigs || []) as SheetConfigRecord[];

        if (configs.length === 0) {
            return NextResponse.json({ success: true, message: "No active sheet configurations found" });
        }

        const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: "GOOGLE_SHEETS_API_KEY is not configured" }, { status: 500 });
        }

        let totalUpserted = 0;
        const syncResults: { config_id: string; success: boolean; count?: number; error?: string }[] = [];

        for (const config of configs) {
            try {
                // Fetch sheet data
                const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.sheet_id)}/values/${encodeURIComponent(config.sheet_range)}?key=${apiKey}`;
                const res = await fetch(url);
                if (!res.ok) {
                    syncResults.push({ config_id: config.id, success: false, error: `Failed to fetch Google Sheet: status ${res.status}` });
                    continue;
                }

                const json = await res.json();
                const rows: string[][] = json.values || [];
                if (rows.length < 2) {
                    syncResults.push({ config_id: config.id, success: false, error: "No data rows found" });
                    continue;
                }

                const headers = rows[0].map((h: string) => h.toLowerCase().trim());
                const rollIdx = headers.findIndex((h) => h === "roll");
                const nameIdx = headers.findIndex((h) => h === "name" || h === "student name");
                const grpIdx = headers.findIndex((h) => h === "group" || h === "group_name" || h === "group name" || h === "विभाग");

                if (rollIdx < 0 || nameIdx < 0) {
                    syncResults.push({ config_id: config.id, success: false, error: "Missing 'roll' or 'name' columns in headers" });
                    continue;
                }

                // Fetch existing groups for this section to maintain them
                const { data: rawExistingStudents } = await supabase
                    .from("students")
                    .select("roll, group_name")
                    .eq("class_id", config.class_id)
                    .eq("section_id", config.section_id);

                const existingStudents = (rawExistingStudents || []) as StudentGroupRecord[];
                const existingGroups = new Map<string, string | null>(
                    existingStudents.map((s) => [normRoll(s.roll), s.group_name])
                );

                const toUpsertMap = new Map<string, { class_id: string; section_id: string; roll: string; name: string; group_name: string | null }>();

                for (let i = 1; i < rows.length; i++) {
                    const rawRoll = (rows[i][rollIdx] || "").toString().trim();
                    const name = (rows[i][nameIdx] || "").toString().trim();

                    if (!rawRoll || !name) continue;

                    let group_name: string | null = null;
                    if (grpIdx >= 0 && rows[i][grpIdx]) {
                        group_name = normalizeGroupName(rows[i][grpIdx]);
                    }

                    if (!group_name && existingGroups.has(normRoll(rawRoll))) {
                        group_name = existingGroups.get(normRoll(rawRoll)) || null;
                    }

                    toUpsertMap.set(normRoll(rawRoll), {
                        class_id: config.class_id,
                        section_id: config.section_id,
                        roll: rawRoll,
                        name,
                        group_name,
                    });
                }

                const toUpsert = Array.from(toUpsertMap.values());

                if (toUpsert.length > 0) {
                    const { error } = await supabase
                        .from("students")
                        .upsert(toUpsert, { onConflict: "class_id,section_id,roll" });

                    if (error) {
                        syncResults.push({ config_id: config.id, success: false, error: `Database upsert error: ${error.message}` });
                    } else {
                        syncResults.push({ config_id: config.id, success: true, count: toUpsert.length });
                        totalUpserted += toUpsert.length;
                    }
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Internal error";
                syncResults.push({ config_id: config.id, success: false, error: message });
            }
        }

        return NextResponse.json({ success: true, total_upserted: totalUpserted, results: syncResults });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
