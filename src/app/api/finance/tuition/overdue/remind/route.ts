import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { sendOverdueReminderSms } from "@/lib/sms-gateway";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const auth = await requireRole(['super_admin', 'admin', 'accountant']);
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const body = await req.json();
        const { studentId, outstanding, monthName } = body;

        if (!studentId || outstanding === undefined || !monthName) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        // Fetch student contact details
        const { data: student, error: stdError } = await supabase
            .from("students")
            .select("name, phone")
            .eq("id", studentId)
            .single();

        if (stdError || !student || !student.phone) {
            return NextResponse.json({ success: false, error: "Student or parent contact phone number not found" }, { status: 404 });
        }

        const { data: schoolInfo } = await supabase.from("school_info").select("name").limit(1).maybeSingle();
        const schoolName = schoolInfo?.name || "School";

        const res = await sendOverdueReminderSms({
            phone: student.phone,
            studentName: student.name,
            outstanding: Number(outstanding),
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
