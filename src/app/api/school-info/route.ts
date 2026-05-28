import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from("school_info")
        .select("name,address,phone,email,logo_url,current_academic_year,last_promotion_year")
        .limit(1)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
}

