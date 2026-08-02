import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const rawNext = searchParams.get("next") ?? "/dashboard";

    // Prevent open redirect: only allow safe relative paths
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\")
        ? rawNext
        : "/dashboard";

    if (code) {
        try {
            const supabase = await createServerSupabaseClient();
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
                return NextResponse.redirect(`${origin}${next}`);
            }
            console.error("[Auth Callback] exchangeCodeForSession error:", error.message);
        } catch (err: unknown) {
            console.error("[Auth Callback] Unexpected error:", err);
        }
    }

    return NextResponse.redirect(`${origin}/login?error=auth`);
}
