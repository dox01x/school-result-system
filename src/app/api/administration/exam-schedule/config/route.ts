import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EXAM_ROUTINE_CONFIG_COLUMNS, EXAM_SCHEDULE_COLUMNS } from "@/lib/supabase/select-columns";
import { NextRequest, NextResponse } from "next/server";

function formatTime12(t: string): string {
    try {
        const [h, m] = t.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
    } catch {
        return t;
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const examId = searchParams.get("exam_id");

        if (!examId) {
            return NextResponse.json({ success: false, error: "Missing exam_id parameter" }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();

        // 1. Try reading from exam_routine_configs
        try {
            const { data: configRow, error: configError } = await (supabase as any)
                .from("exam_routine_configs")
                .select(EXAM_ROUTINE_CONFIG_COLUMNS)
                .eq("exam_id", examId)
                .maybeSingle();

            if (!configError && configRow) {
                const shifts = Array.isArray(configRow.shifts) ? configRow.shifts : [];
                const dates = Array.isArray(configRow.dates) ? configRow.dates : [];
                const instructions = Array.isArray(configRow.instructions) ? configRow.instructions : [];
                const selectedShiftId = configRow.selected_shift_id || (shifts.length > 0 ? shifts[0].id : "");

                return NextResponse.json({
                    success: true,
                    data: {
                        id: configRow.id,
                        exam_id: configRow.exam_id,
                        shifts,
                        dates,
                        instructions,
                        selectedShiftId,
                    },
                });
            }
        } catch {
            // If table does not exist or fails, proceed to fallback inference
        }

        // 2. Auto-infer fallback from exam_schedules if no config row exists yet
        const { data: schedules, error: schedError } = await supabase
            .from("exam_schedules")
            .select(EXAM_SCHEDULE_COLUMNS)
            .eq("exam_id", examId)
            .order("exam_date");

        if (schedError) {
            return NextResponse.json({ success: false, error: schedError.message }, { status: 500 });
        }

        if (schedules && schedules.length > 0) {
            // Extract distinct dates sorted chronologically
            const dates = Array.from(new Set(schedules.map((s) => s.exam_date))).sort();

            // Group by distinct (start_time, end_time) to form shifts
            const shiftMap = new Map<string, { start_time: string; end_time: string; class_ids: Set<string> }>();
            for (const s of schedules) {
                const key = `${s.start_time}||${s.end_time}`;
                if (!shiftMap.has(key)) {
                    shiftMap.set(key, {
                        start_time: s.start_time,
                        end_time: s.end_time,
                        class_ids: new Set<string>(),
                    });
                }
                shiftMap.get(key)!.class_ids.add(s.class_id);
            }

            const shifts = Array.from(shiftMap.entries()).map(([_, info], idx) => ({
                id: `shift_${idx + 1}_${Date.now()}`,
                name: `Shift ${idx + 1} (${formatTime12(info.start_time)} - ${formatTime12(info.end_time)})`,
                start_time: info.start_time,
                end_time: info.end_time,
                class_ids: Array.from(info.class_ids),
            }));

            const inferredData = {
                exam_id: examId,
                shifts,
                dates,
                instructions: [],
                selectedShiftId: shifts.length > 0 ? shifts[0].id : "",
            };

            // Attempt to persist the inferred config into the database
            try {
                await (supabase as any).from("exam_routine_configs").upsert({
                    exam_id: examId,
                    shifts,
                    dates,
                    instructions: [],
                    selected_shift_id: inferredData.selectedShiftId,
                    updated_at: new Date().toISOString(),
                }, { onConflict: "exam_id" });
            } catch {}

            return NextResponse.json({
                success: true,
                data: inferredData,
                inferred: true,
            });
        }

        // 3. No config and no schedules found
        return NextResponse.json({
            success: true,
            data: {
                exam_id: examId,
                shifts: [],
                dates: [],
                instructions: [],
                selectedShiftId: "",
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { exam_id, shifts, dates, instructions, selectedShiftId } = body;

        if (!exam_id) {
            return NextResponse.json({ success: false, error: "Missing exam_id in request body" }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();

        const payload = {
            exam_id,
            shifts: Array.isArray(shifts) ? shifts : [],
            dates: Array.isArray(dates) ? dates : [],
            instructions: Array.isArray(instructions) ? instructions : [],
            selected_shift_id: selectedShiftId || "",
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await (supabase as any)
            .from("exam_routine_configs")
            .upsert(payload, { onConflict: "exam_id" })
            .select(EXAM_ROUTINE_CONFIG_COLUMNS)
            .single();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            data: {
                id: data.id,
                exam_id: data.exam_id,
                shifts: data.shifts,
                dates: data.dates,
                instructions: data.instructions,
                selectedShiftId: data.selected_shift_id,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const examId = searchParams.get("exam_id");

        if (!examId) {
            return NextResponse.json({ success: false, error: "Missing exam_id parameter" }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();
        const { error } = await (supabase as any)
            .from("exam_routine_configs")
            .delete()
            .eq("exam_id", examId);

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: { exam_id: examId } });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
