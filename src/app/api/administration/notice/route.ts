import { requireAuth, requireRole } from "@/lib/api-auth";
import { NOTICE_COLUMNS } from "@/lib/supabase/select-columns";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAuth();
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const { searchParams } = new URL(request.url);
        const audience = searchParams.get("audience");
        const isPublishedParam = searchParams.get("is_published");

        let query = supabase
            .from("notices")
            .select(NOTICE_COLUMNS)
            .order("created_at", { ascending: false });

        if (audience && audience !== "all") {
            if (["students", "parents", "teachers"].includes(audience)) {
                query = query.or(`audience.eq.${audience},audience.eq.all`);
            }
        }

        if (isPublishedParam !== null) {
            query = query.eq("is_published", isPublishedParam === "true");
        }

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await requireRole(["super_admin", "admin"]);
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const body = await request.json();
        const { title, content, audience, priority, is_published } = body;

        if (!title || !content) {
            return NextResponse.json({
                success: false,
                error: "Missing required fields: title, content",
            }, { status: 400 });
        }

        if (audience && !["all", "students", "parents", "teachers"].includes(audience)) {
            return NextResponse.json({ success: false, error: "audience must be: all, students, parents, or teachers" }, { status: 400 });
        }

        if (priority && !["low", "normal", "high", "urgent"].includes(priority)) {
            return NextResponse.json({ success: false, error: "priority must be: low, normal, high, or urgent" }, { status: 400 });
        }

        if (body.id) {
            const updatePayload: Record<string, unknown> = {
                title,
                content,
                ...(audience && { audience }),
                ...(priority && { priority }),
            };
            if (is_published !== undefined) {
                updatePayload.is_published = Boolean(is_published);
            }

            const { data, error } = await supabase
                .from("notices")
                .update(updatePayload)
                .eq("id", body.id)
                .select()
                .single();

            if (error) {
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }
            return NextResponse.json({ success: true, data });
        } else {
            const { data, error } = await supabase
                .from("notices")
                .insert({
                    title, content,
                    audience: audience || "all",
                    priority: priority || "normal",
                    is_published: is_published !== false,
                })
                .select()
                .single();

            if (error) {
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }
            return NextResponse.json({ success: true, data }, { status: 201 });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const auth = await requireRole(["super_admin", "admin"]);
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ success: false, error: "Missing id parameter" }, { status: 400 });
        }

        const { error } = await supabase.from("notices").delete().eq("id", id);

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: { id } });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
