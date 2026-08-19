import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  calculateDateRangeBounds,
  getFinanceMetrics,
  getAttendanceMetrics,
  getStudentMetrics,
  type DateRangePreset,
  type DashboardFilters,
  type UserRoleContext,
} from "@/lib/dashboard/dashboard-service";
import type { UserRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    let role: UserRole = "admin";
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role) {
      role = profile.role as UserRole;
    }

    const roleContext: UserRoleContext = { role, userId: user.id };

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const type = searchParams.get("type") || "finance"; // 'finance' | 'due' | 'attendance' | 'transactions'
    const range = (searchParams.get("range") || "30d") as DateRangePreset;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const filters: DashboardFilters = { range, startDate, endDate };
    const bounds = calculateDateRangeBounds(range, startDate, endDate);

    if (type === "transactions") {
      if (role === "class_teacher" || role === "exam_controller") {
        return NextResponse.json({ error: "Unauthorized to export financial transactions" }, { status: 403 });
      }

      const { data: rawPayments } = await (supabase as any)
        .from("tuition_payments")
        .select("receipt_number, student_name, roll, class_name, fee_type, amount_paid, payment_method, payment_date, status")
        .gte("payment_date", bounds.current.startIso)
        .lte("payment_date", bounds.current.endIso)
        .order("payment_date", { ascending: false });

      const payments = ((rawPayments || []) as any[]).filter((p) => p.status !== "void");

      if (format === "json") {
        return NextResponse.json({ success: true, data: payments });
      }

      // Generate CSV
      const headers = ["Receipt Number", "Student Name", "Roll", "Class", "Fee Type", "Amount (BDT)", "Payment Method", "Date"];
      const rows = payments.map((p) => [
        `"${p.receipt_number}"`,
        `"${(p.student_name || "").replace(/"/g, '""')}"`,
        `"${p.roll || ""}"`,
        `"${p.class_name}"`,
        `"${p.fee_type}"`,
        p.amount_paid,
        `"${(p.payment_method || "cash").toUpperCase()}"`,
        `"${new Date(p.payment_date).toISOString().slice(0, 10)}"`,
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="transactions_${bounds.current.startDateStr}_to_${bounds.current.endDateStr}.csv"`,
        },
      });
    } else if (type === "due") {
      if (role === "class_teacher" || role === "exam_controller") {
        return NextResponse.json({ error: "Unauthorized to export dues" }, { status: 403 });
      }

      const finance = await getFinanceMetrics(supabase, bounds, filters, roleContext);
      const dueList = finance?.dueByClass || [];

      if (format === "json") {
        return NextResponse.json({ success: true, data: dueList });
      }

      const headers = ["Class Name", "Expected Fees (BDT)", "Collected (BDT)", "Outstanding Due (BDT)"];
      const rows = dueList.map((d) => [`"${d.className}"`, d.expected, d.collected, d.due]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="outstanding_dues_${bounds.current.endDateStr}.csv"`,
        },
      });
    } else {
      // General summary export
      const [students, finance, attendance] = await Promise.all([
        getStudentMetrics(supabase, filters, roleContext),
        getFinanceMetrics(supabase, bounds, filters, roleContext),
        getAttendanceMetrics(supabase, bounds, filters, roleContext),
      ]);

      const summary = {
        generatedAt: new Date().toISOString(),
        dateRange: { start: bounds.current.startDateStr, end: bounds.current.endDateStr },
        students: { total: students.totalStudents, active: students.activeStudents },
        attendance: { todayRate: attendance.today.rate, present: attendance.today.present, absent: attendance.today.absent },
        finance: finance ? {
          totalCollection: finance.totalCollection,
          cashCollection: finance.cashCollection,
          onlineCollection: finance.onlineCollection,
          outstandingDue: finance.totalOutstandingDue,
        } : null,
      };

      if (format === "json") {
        return NextResponse.json({ success: true, data: summary });
      }

      const headers = ["Metric", "Value"];
      const rows = [
        ["Total Students", students.totalStudents],
        ["Today Attendance Rate", `${attendance.today.rate}%`],
        ["Today Present", attendance.today.present],
        ["Today Absent", attendance.today.absent],
      ];

      if (finance) {
        rows.push(["Period Total Collection (BDT)", finance.totalCollection]);
        rows.push(["Period Cash Collection (BDT)", finance.cashCollection]);
        rows.push(["Period Online Collection (BDT)", finance.onlineCollection]);
        rows.push(["Total Outstanding Due (BDT)", finance.totalOutstandingDue]);
      }

      const csvContent = [headers.join(","), ...rows.map((r) => [r[0], r[1]].join(","))].join("\n");
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="dashboard_summary_${bounds.current.startDateStr}_to_${bounds.current.endDateStr}.csv"`,
        },
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
