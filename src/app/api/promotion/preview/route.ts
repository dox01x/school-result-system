import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
    const auth = await requireRole(["super_admin", "admin"]);
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    try {
        const { data, error } = await supabase.rpc("preview_yearly_promotion");

        if (error) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        const result = (data || {}) as Record<string, unknown>;

        if (result?.error) {
            return NextResponse.json(
                { success: false, error: String(result.error) },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true, data: result });
    } catch (err: unknown) {
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : "Preview failed" },
            { status: 500 }
        );
    }
}
