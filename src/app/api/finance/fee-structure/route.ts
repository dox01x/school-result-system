import { NextResponse } from "next/server";
import { FEE_STRUCTURE_COLUMNS } from "@/lib/supabase/select-columns";
import { ApiResponse, FeeStructure } from "@/types/finance";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { roundCurrency } from "@/lib/finance-utils";

function errMessage(e: unknown): string {
    return e instanceof Error ? e.message : "Unknown error";
}

export async function GET(request: Request) {
    try {
        const auth = await requireAuth();
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const { searchParams } = new URL(request.url);
        const className = searchParams.get("class_name");
        const academicYear = searchParams.get("academic_year");

        let query = supabase.from("fee_structure").select(FEE_STRUCTURE_COLUMNS).eq("is_active", true);

        if (className && className !== "all") query = query.eq("class_name", className);
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
        const auth = await requireRole(['super_admin', 'admin', 'accountant']);
        if (auth instanceof NextResponse) return auth;
        const { user, supabase } = auth;

        const body = await request.json();
        const { class_name, fee_type, amount, description, academic_year } = body;
        const parsedAmount = roundCurrency(amount);

        if (!class_name || !fee_type || parsedAmount < 0 || !academic_year) {
            return NextResponse.json({ success: false, error: "Missing required fields or invalid amount" }, { status: 400 });
        }

        const { data: existing } = await supabase
            .from("fee_structure")
            .select("id")
            .match({ class_name, fee_type, academic_year })
            .maybeSingle();

        if (existing) {
            return NextResponse.json(
                { success: false, error: "Fee structure for this class and fee type already exists for academic year " + academic_year },
                { status: 409 }
            );
        }

        const { data, error } = await supabase
            .from("fee_structure")
            .insert({ 
                class_name, 
                fee_type: fee_type.toLowerCase().trim(), 
                amount: parsedAmount, 
                description: description ? description.trim() : null, 
                academic_year 
            })
            .select(FEE_STRUCTURE_COLUMNS)
            .single();

        if (error) throw error;

        // Audit Log
        try {
            await supabase.from('finance_audit_logs').insert({
                actor_id: user.id,
                actor_name: user.email || 'Staff',
                action: 'CREATE_FEE_STRUCTURE',
                target_table: 'fee_structure',
                target_id: data.id,
                details: { class_name, fee_type, amount: parsedAmount, academic_year }
            });
        } catch {
            // Non-blocking
        }

        return NextResponse.json({ success: true, data } as ApiResponse<FeeStructure>);
    } catch (error: unknown) {
        return NextResponse.json({ success: false, error: errMessage(error) }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const auth = await requireRole(['super_admin', 'admin', 'accountant']);
        if (auth instanceof NextResponse) return auth;
        const { user, supabase } = auth;

        const body = await request.json();
        const { id, amount, description } = body;
        const parsedAmount = roundCurrency(amount);

        if (!id || parsedAmount < 0) {
            return NextResponse.json({ success: false, error: "Missing required fields or invalid amount" }, { status: 400 });
        }

        const { data: oldData } = await supabase.from('fee_structure').select('*').eq('id', id).single();

        const { data, error } = await supabase
            .from("fee_structure")
            .update({ 
                amount: parsedAmount, 
                description: description !== undefined ? description?.trim() : undefined 
            })
            .eq("id", id)
            .select(FEE_STRUCTURE_COLUMNS)
            .single();

        if (error) throw error;

        // Audit Log
        try {
            await supabase.from('finance_audit_logs').insert({
                actor_id: user.id,
                actor_name: user.email || 'Staff',
                action: 'UPDATE_FEE_STRUCTURE',
                target_table: 'fee_structure',
                target_id: id,
                details: { 
                    old_amount: oldData?.amount, 
                    new_amount: parsedAmount, 
                    class_name: oldData?.class_name, 
                    fee_type: oldData?.fee_type 
                }
            });
        } catch {
            // Non-blocking
        }

        return NextResponse.json({ success: true, data } as ApiResponse<FeeStructure>);
    } catch (error: unknown) {
        return NextResponse.json({ success: false, error: errMessage(error) }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await requireRole(['super_admin', 'admin', 'accountant']);
        if (auth instanceof NextResponse) return auth;
        const { user, supabase } = auth;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
        }

        const { data: oldData } = await supabase.from('fee_structure').select('*').eq('id', id).single();

        const { error } = await supabase.from("fee_structure").delete().eq("id", id);
        if (error) throw error;

        // Audit Log
        try {
            await supabase.from('finance_audit_logs').insert({
                actor_id: user.id,
                actor_name: user.email || 'Staff',
                action: 'DELETE_FEE_STRUCTURE',
                target_table: 'fee_structure',
                target_id: id,
                details: { class_name: oldData?.class_name, fee_type: oldData?.fee_type, amount: oldData?.amount }
            });
        } catch {
            // Non-blocking
        }

        return NextResponse.json({ success: true, message: "Fee structure deleted successfully" });
    } catch (error: unknown) {
        return NextResponse.json({ success: false, error: errMessage(error) }, { status: 500 });
    }
}
