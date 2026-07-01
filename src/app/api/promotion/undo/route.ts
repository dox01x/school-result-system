import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const supabase = (await createServerSupabaseClient()) as any;

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user && process.env.AUTH_DISABLED !== "true") {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const logId = body.promotion_log_id;

        if (!logId) {
            return NextResponse.json(
                { success: false, error: "promotion_log_id is required" },
                { status: 400 }
            );
        }

        const { data, error } = await supabase.rpc("undo_yearly_promotion", {
            p_log_id: logId,
        });

        if (error) {
            const msg = error.message || "";
            if (msg.includes("already been undone")) {
                return NextResponse.json(
                    { success: false, error: msg },
                    { status: 409 }
                );
            }
            if (msg.includes("window expired")) {
                return NextResponse.json(
                    { success: false, error: msg },
                    { status: 410 }
                );
            }
            return NextResponse.json(
                { success: false, error: msg || "Undo failed" },
                { status: 500 }
            );
        }

        const result = data as Record<string, unknown>;

        return NextResponse.json({
            success: true,
            data: {
                restored: result.restored,
                academic_year_restored: result.academic_year_restored,
            },
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "Undo failed" },
            { status: 500 }
        );
    }
}
