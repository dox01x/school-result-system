import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const auth = await requireRole(["super_admin", "admin"]);
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    try {
        const body = await request.json().catch(() => ({}));
        const targetYear = body.target_academic_year || null;

        const { data, error } = await supabase.rpc("perform_yearly_promotion", {
            p_target_year: targetYear,
        });

        if (error) {
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

        const result = (data || {}) as Record<string, unknown>;

        return NextResponse.json({
            success: true,
            data: {
                promoted: result.promoted ?? 0,
                archived: result.archived ?? 0,
                new_examinee: result.new_examinee ?? 0,
                academic_year_from: result.academic_year_from ?? null,
                academic_year_to: result.academic_year_to ?? null,
                promotion_log_id: result.promotion_log_id ?? null,
            },
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "Promotion failed" },
            { status: 500 }
        );
    }
}
