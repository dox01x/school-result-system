import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FEE_STRUCTURE_COLUMNS } from "@/lib/supabase/select-columns";
import { ApiResponse, FeeStructure } from "@/types/finance";

function errMessage(e: unknown): string {
    return e instanceof Error ? e.message : "Unknown error";
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const className = searchParams.get("class_name");
        const academicYear = searchParams.get("academic_year");

        const supabase = await createServerSupabaseClient();

        let query = supabase.from("fee_structure").select(FEE_STRUCTURE_COLUMNS).eq("is_active", true);

        if (className) query = query.eq("class_name", className);
        if (academicYear) query = query.eq("academic_year", academicYear);

        query = query.order("class_name").order("fee_type");

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ success: true, data } as ApiResponse<FeeStructure[]>);
    } catch (error: unknown) {
        return NextResponse.json({ success: false, error: errMessage(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { class_name, fee_type, amount, description, academic_year } = body;

        if (!class_name || !fee_type || typeof amount !== "number" || !academic_year) {
            return NextResponse.json({ success: false, error: "Missing required fields or invalid amount" }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();

        const { data: existing } = await supabase
            .from("fee_structure")
            .select("id")
            .match({ class_name, fee_type, academic_year })
            .maybeSingle();

        if (existing) {
            return NextResponse.json(
                { success: false, error: "Fee structure for this class and type already exists." },
                { status: 409 }
            );
        }

        const { data, error } = await supabase
            .from("fee_structure")
            .insert({ class_name, fee_type, amount, description, academic_year })
            .select(FEE_STRUCTURE_COLUMNS)
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, data } as ApiResponse<FeeStructure>);
    } catch (error: unknown) {
        return NextResponse.json({ success: false, error: errMessage(error) }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, amount, description } = body;

        if (!id || typeof amount !== "number") {
            return NextResponse.json({ success: false, error: "Missing required fields or invalid amount" }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();
        const { data, error } = await supabase
            .from("fee_structure")
            .update({ amount, description })
            .eq("id", id)
            .select(FEE_STRUCTURE_COLUMNS)
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, data } as ApiResponse<FeeStructure>);
    } catch (error: unknown) {
        return NextResponse.json({ success: false, error: errMessage(error) }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
        }

        const supabase = await createServerSupabaseClient();
        const { error } = await supabase.from("fee_structure").delete().eq("id", id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json({ success: false, error: errMessage(error) }, { status: 500 });
    }
}
