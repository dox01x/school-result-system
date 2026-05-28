import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const supabase = await createServerSupabaseClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user && process.env.AUTH_DISABLED !== "true") {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { data, error } = await supabase.rpc("preview_yearly_promotion");

        if (error) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        // data is the JSONB result from the function
        const result = data as Record<string, unknown>;

        if (result?.error) {
            return NextResponse.json(
                { success: false, error: result.error as string },
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
