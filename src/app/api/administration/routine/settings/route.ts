// API route: GET/PUT routine_settings — manage working days, periods, and timing configuration
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROUTINE_SETTINGS_COLUMNS } from "@/lib/supabase/select-columns";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
    try {
        const supabase = await createServerSupabaseClient();
        const { data, error } = await supabase
            .from("routine_settings")
            .select(ROUTINE_SETTINGS_COLUMNS)
            .limit(1)
            .maybeSingle();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({
                success: true,
                data: {
                    working_days: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
                    periods_per_day: 7,
                    period_duration_minutes: 45,
                    period_durations: [45, 45, 45, 45, 45, 45, 45],
                    break_after_period: 3,
                    break_duration_minutes: 20,
                    class_start_time: "08:00",
                },
            });
        }

        return NextResponse.json({ success: true, data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { working_days, periods_per_day, period_duration_minutes, period_durations, break_after_period, break_duration_minutes, class_start_time } = body;

        const supabase = await createServerSupabaseClient();

        // Check if a settings row exists
        const { data: existing } = await supabase
            .from("routine_settings")
            .select("id")
            .limit(1)
            .maybeSingle();

        const updateData = {
            ...(working_days !== undefined && { working_days }),
            ...(periods_per_day !== undefined && { periods_per_day }),
            ...(period_duration_minutes !== undefined && { period_duration_minutes }),
            ...(period_durations !== undefined && { period_durations }),
            ...(break_after_period !== undefined && { break_after_period }),
            ...(break_duration_minutes !== undefined && { break_duration_minutes }),
            ...(class_start_time !== undefined && { class_start_time }),
            updated_at: new Date().toISOString(),
        };

        let result;
        if (existing) {
            const { data, error } = await supabase
                .from("routine_settings")
                .update(updateData)
                .eq("id", existing.id)
                .select(ROUTINE_SETTINGS_COLUMNS)
                .single();
            if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            result = data;
        } else {
            const { data, error } = await supabase
                .from("routine_settings")
                .insert(updateData)
                .select(ROUTINE_SETTINGS_COLUMNS)
                .single();
            if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            result = data;
        }

        return NextResponse.json({ success: true, data: result });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
