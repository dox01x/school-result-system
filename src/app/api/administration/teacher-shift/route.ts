import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LEAVE_REQUEST_COLUMNS, TEACHER_SHIFT_COLUMNS } from "@/lib/supabase/select-columns";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");
        const supabase = (await createServerSupabaseClient()) as any;

        if (type === "leave") {
            const { data, error } = await supabase
                .from("leave_requests")
                .select(LEAVE_REQUEST_COLUMNS)
                .order("created_at", { ascending: false });

            if (error) {
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }
            return NextResponse.json({ success: true, data });
        }

        // Default: return teacher shifts
        const { data, error } = await supabase
            .from("teacher_shifts")
            .select(TEACHER_SHIFT_COLUMNS)
            .order("shift_date")
            .order("start_time");

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type } = body;
        const supabase = (await createServerSupabaseClient()) as any;

        if (type === "leave") {
            const { teacher_id, start_date, end_date, reason, proxies } = body;

            if (!teacher_id || !start_date || !end_date) {
                return NextResponse.json({
                    success: false,
                    error: "Missing required fields: teacher_id, start_date, end_date",
                }, { status: 400 });
            }

            if (new Date(end_date) < new Date(start_date)) {
                return NextResponse.json({ success: false, error: "end_date must be on or after start_date" }, { status: 400 });
            }

            const { data, error } = await supabase
                .from("leave_requests")
                .insert({ teacher_id, start_date, end_date, reason: reason || "" })
                .select()
                .single();

            if (error) {
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }

            // Insert proxy assignments if any
            if (proxies && proxies.length > 0) {
                const proxyRecords = proxies.map((p: any) => ({
                    leave_request_id: data.id,
                    routine_id: p.routine_id,
                    assignment_date: p.date,
                    original_teacher_id: teacher_id,
                    proxy_teacher_id: p.proxy_teacher_id,
                }));

                const { error: proxyError } = await supabase.from("proxy_assignments").insert(proxyRecords);
                if (proxyError) {
                    console.error("Failed to insert proxy assignments", proxyError);
                } else {
                    // Update proxy counts for the substitute teachers
                    const proxyCounts: Record<string, number> = {};
                    for (const p of proxies) {
                        proxyCounts[p.proxy_teacher_id] = (proxyCounts[p.proxy_teacher_id] || 0) + 1;
                    }
                    for (const pid of Object.keys(proxyCounts)) {
                        const { data: t } = await supabase.from("teachers").select("proxy_count").eq("id", pid).single();
                        if (t) {
                            await supabase.from("teachers").update({ proxy_count: (t.proxy_count || 0) + proxyCounts[pid] }).eq("id", pid);
                        }
                    }
                }
            }

            return NextResponse.json({ success: true, data }, { status: 201 });
        }

        if (type === "leave_update") {
            const { id, status } = body;

            if (!id || !status) {
                return NextResponse.json({ success: false, error: "Missing required fields: id, status" }, { status: 400 });
            }

            if (!["pending", "approved", "rejected"].includes(status)) {
                return NextResponse.json({ success: false, error: "status must be: pending, approved, or rejected" }, { status: 400 });
            }

            const { data, error } = await supabase
                .from("leave_requests")
                .update({ status })
                .eq("id", id)
                .select()
                .single();

            if (error) {
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }
            return NextResponse.json({ success: true, data });
        }

        // Default: create teacher shift
        const { teacher_id, shift_date, start_time, end_time, duty_type, notes } = body;

        if (!teacher_id || !shift_date || !start_time || !end_time) {
            return NextResponse.json({
                success: false,
                error: "Missing required fields: teacher_id, shift_date, start_time, end_time",
            }, { status: 400 });
        }

        if (body.id) {
            const { data, error } = await supabase
                .from("teacher_shifts")
                .update({
                    teacher_id, shift_date, start_time, end_time,
                    duty_type: duty_type || "regular",
                    notes: notes || "",
                })
                .eq("id", body.id)
                .select()
                .single();

            if (error) {
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }
            return NextResponse.json({ success: true, data });
        } else {
            const { data, error } = await supabase
                .from("teacher_shifts")
                .insert({
                    teacher_id, shift_date, start_time, end_time,
                    duty_type: duty_type || "regular",
                    notes: notes || "",
                })
                .select()
                .single();

            if (error) {
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }
            return NextResponse.json({ success: true, data }, { status: 201 });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        const type = searchParams.get("type");

        if (!id) {
            return NextResponse.json({ success: false, error: "Missing id parameter" }, { status: 400 });
        }

        const supabase = (await createServerSupabaseClient()) as any;
        const table = type === "leave" ? "leave_requests" : "teacher_shifts";
        const { error } = await supabase.from(table).delete().eq("id", id);

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: { id } });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
