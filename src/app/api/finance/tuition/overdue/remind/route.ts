import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendOverdueReminderSms } from "@/lib/sms-gateway";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const supabase = await createServerSupabaseClient();
    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : null;
    const {
        data: { user },
    } = bearerToken
        ? await supabase.auth.getUser(bearerToken)
        : await supabase.auth.getUser();

    if (!user && process.env.AUTH_DISABLED !== "true") {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { studentId, outstanding, monthName } = body;

        if (!studentId || outstanding === undefined || !monthName) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        // Fetch student contact details
        const { data: student } = await supabase
            .from("students")
            .select("name, phone")
            .eq("id", studentId)
            .single();

        if (!student || !student.phone) {
            return NextResponse.json({ success: false, error: "Student or parent contact not found" }, { status: 404 });
        }

        const { data: schoolInfo } = await supabase.from("school_info").select("name").limit(1).maybeSingle();
        const schoolName = schoolInfo?.name || "School";

        const res = await sendOverdueReminderSms({
            phone: student.phone,
            studentName: student.name,
            outstanding,
            monthName,
            schoolName
        });

        if (res.success) {
            return NextResponse.json({ success: true, message: res.message });
        } else {
            return NextResponse.json({ success: false, error: res.message });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
