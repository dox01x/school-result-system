import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("class_id");
    const sectionId = searchParams.get("section_id");

    let query = supabase
      .from("students")
      .select("*, classes(id, name), sections(id, name)")
      .order("roll", { ascending: true });

    if (classId) query = query.eq("class_id", classId);
    if (sectionId) query = query.eq("section_id", sectionId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
