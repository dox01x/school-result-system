import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getSchoolSummaryMetrics } from "@/features/reports/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireRole(["super_admin", "admin", "exam_controller", "accountant"]);
    if (auth instanceof NextResponse) return auth;

    const metrics = await getSchoolSummaryMetrics();
    return NextResponse.json({ data: metrics });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
