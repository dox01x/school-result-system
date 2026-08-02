import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SCHOOL_INFO_COLUMNS } from "@/lib/supabase/select-columns";
import { requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const supabase = await createServerSupabaseClient();

        const { data, error } = await supabase
            .from("school_info")
            .select(SCHOOL_INFO_COLUMNS)
            .limit(1)
            .maybeSingle();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const auth = await requireRole(["super_admin", "admin"]);
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const body = await request.json();
        const {
            name,
            address,
            phone,
            email,
            logo_url,
            principal_name,
            established_year,
            current_academic_year,
            detailed_marks,
            gender_split_class_id,
        } = body;

        const { data: existing } = await supabase
            .from("school_info")
            .select("id")
            .limit(1)
            .maybeSingle();

        let result;
        if (existing?.id) {
            const { data, error } = await supabase
                .from("school_info")
                .update({
                    name,
                    address,
                    phone,
                    email,
                    logo_url,
                    principal_name,
                    established_year,
                    current_academic_year,
                    detailed_marks,
                    gender_split_class_id,
                })
                .eq("id", existing.id)
                .select(SCHOOL_INFO_COLUMNS)
                .single();
            if (error) throw error;
            result = data;
        } else {
            const { data, error } = await supabase
                .from("school_info")
                .insert({
                    name,
                    address,
                    phone,
                    email,
                    logo_url,
                    principal_name,
                    established_year,
                    current_academic_year,
                    detailed_marks,
                    gender_split_class_id,
                })
                .select(SCHOOL_INFO_COLUMNS)
                .single();
            if (error) throw error;
            result = data;
        }

        return NextResponse.json({ success: true, data: result });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

