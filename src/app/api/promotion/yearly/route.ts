import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const supabase = await createServerSupabaseClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user && process.env.AUTH_DISABLED !== "true") {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const targetYear = body.target_academic_year || null;

        const { data, error } = await supabase.rpc("perform_yearly_promotion", {
            p_target_year: targetYear,
        });

        if (error) {
            // Check for known error messages
            const msg = error.message || "";
            if (msg.includes("already completed")) {
                return NextResponse.json(
                    { success: false, error: msg },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                { success: false, error: msg || "Promotion failed" },
                { status: 500 }
            );
        }

        const result = data as Record<string, unknown>;

        return NextResponse.json({
            success: true,
            data: {
                promoted: result.promoted,
                archived: result.archived,
                new_examinee: result.new_examinee,
                academic_year_from: result.academic_year_from,
                academic_year_to: result.academic_year_to,
                promotion_log_id: result.promotion_log_id,
            },
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "Promotion failed" },
            { status: 500 }
        );
    }
}
