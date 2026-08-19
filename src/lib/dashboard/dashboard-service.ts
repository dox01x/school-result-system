import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { roundCurrency } from "@/lib/finance-utils";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_week"
  | "this_month"
  | "prev_month"
  | "this_year"
  | "custom";

export interface DashboardFilters {
  range: DateRangePreset;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  academicYear?: string;
  classId?: string;
  sectionId?: string;
  paymentMethod?: string;
}

export interface UserRoleContext {
  role: "super_admin" | "admin" | "accountant" | "class_teacher" | "exam_controller";
  userId: string;
  assignedClasses?: { class_id: string; section_id: string; class_name?: string; section_name?: string }[];
}

export interface DateRangeBounds {
  current: { startIso: string; endIso: string; startDateStr: string; endDateStr: string };
  previous: { startIso: string; endIso: string; startDateStr: string; endDateStr: string } | null;
}

/**
 * Calculates start and end ISO dates for the current period and corresponding comparison previous period.
 */
export function calculateDateRangeBounds(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string,
  now: Date = new Date()
): DateRangeBounds {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let currentStart = new Date(now);
  let currentEnd = new Date(now);
  let prevStart: Date | null = null;
  let prevEnd: Date | null = null;

  switch (preset) {
    case "today": {
      currentStart.setHours(0, 0, 0, 0);
      currentEnd.setHours(23, 59, 59, 999);

      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(currentEnd);
      prevEnd.setDate(prevEnd.getDate() - 1);
      break;
    }
    case "yesterday": {
      currentStart.setDate(currentStart.getDate() - 1);
      currentStart.setHours(0, 0, 0, 0);
      currentEnd = new Date(currentStart);
      currentEnd.setHours(23, 59, 59, 999);

      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(currentEnd);
      prevEnd.setDate(prevEnd.getDate() - 1);
      break;
    }
    case "7d": {
      currentStart.setDate(currentStart.getDate() - 6);
      currentStart.setHours(0, 0, 0, 0);
      currentEnd.setHours(23, 59, 59, 999);

      prevEnd = new Date(currentStart);
      prevEnd.setMilliseconds(-1);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 6);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case "30d": {
      currentStart.setDate(currentStart.getDate() - 29);
      currentStart.setHours(0, 0, 0, 0);
      currentEnd.setHours(23, 59, 59, 999);

      prevEnd = new Date(currentStart);
      prevEnd.setMilliseconds(-1);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 29);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case "this_week": {
      // Assuming week starts on Saturday (BD school routine standard)
      const day = currentStart.getDay(); // 0 is Sun, 6 is Sat
      const diff = (day + 1) % 7; // days since Saturday
      currentStart.setDate(currentStart.getDate() - diff);
      currentStart.setHours(0, 0, 0, 0);
      currentEnd.setHours(23, 59, 59, 999);

      prevEnd = new Date(currentStart);
      prevEnd.setMilliseconds(-1);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 6);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case "this_month": {
      currentStart.setDate(1);
      currentStart.setHours(0, 0, 0, 0);
      currentEnd.setHours(23, 59, 59, 999);

      prevStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1, 0, 0, 0, 0);
      prevEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    case "prev_month": {
      currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      currentEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
      break;
    }
    case "this_year": {
      currentStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      currentEnd.setHours(23, 59, 59, 999);

      prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      break;
    }
    case "custom": {
      if (customStart && /^\d{4}-\d{2}-\d{2}$/.test(customStart)) {
        const [y, m, d] = customStart.split("-").map(Number);
        currentStart = new Date(y, m - 1, d, 0, 0, 0, 0);
      } else {
        currentStart.setDate(currentStart.getDate() - 29);
        currentStart.setHours(0, 0, 0, 0);
      }

      if (customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customEnd)) {
        const [y, m, d] = customEnd.split("-").map(Number);
        currentEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
      } else {
        currentEnd.setHours(23, 59, 59, 999);
      }

      const diffMs = currentEnd.getTime() - currentStart.getTime();
      if (diffMs > 0) {
        prevEnd = new Date(currentStart.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - diffMs);
      }
      break;
    }
  }

  return {
    current: {
      startIso: currentStart.toISOString(),
      endIso: currentEnd.toISOString(),
      startDateStr: toDateStr(currentStart),
      endDateStr: toDateStr(currentEnd),
    },
    previous: prevStart && prevEnd ? {
      startIso: prevStart.toISOString(),
      endIso: prevEnd.toISOString(),
      startDateStr: toDateStr(prevStart),
      endDateStr: toDateStr(prevEnd),
    } : null,
  };
}

/**
 * Calculates percentage change with zero/negative denominator safety.
 * Returns null if comparison is not meaningful or not available (ZERO fake data).
 */
export function calculateTrendPercentage(current: number, previous: number | null | undefined): {
  pct: number;
  direction: "up" | "down" | "neutral";
  text: string;
} | null {
  if (previous === null || previous === undefined || isNaN(previous)) {
    return null;
  }

  if (previous === 0) {
    if (current === 0) return { pct: 0, direction: "neutral", text: "0% vs prev" };
    return { pct: 100, direction: "up", text: "+100% vs prev" };
  }

  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100 * 10) / 10;

  if (pct > 0) {
    return { pct, direction: "up", text: `+${pct}% vs prev` };
  } else if (pct < 0) {
    return { pct: Math.abs(pct), direction: "down", text: `${pct}% vs prev` };
  } else {
    return { pct: 0, direction: "neutral", text: "0% vs prev" };
  }
}

/**
 * Filter out void payments in-memory using multiple criteria for defense-in-depth.
 */
export function isPaymentVoid(p: any): boolean {
  if (!p) return false;
  if (p.status === "void") return true;
  if (typeof p.note === "string" && p.note.startsWith("[VOIDED")) return true;
  if (typeof p.void_reason === "string" && p.void_reason.length > 0) return true;
  return false;
}

/**
 * Aggregates all Student statistics
 */
export async function getStudentMetrics(
  supabase: SupabaseClient<Database>,
  filters: DashboardFilters,
  roleContext: UserRoleContext
) {
  let query = supabase.from("students").select("id, class_id, section_id, gender, created_at, classes(name), sections(name)");

  if (roleContext.role === "class_teacher" && roleContext.assignedClasses && roleContext.assignedClasses.length > 0) {
    const classIds = roleContext.assignedClasses.map((a) => a.class_id);
    query = query.in("class_id", classIds);
  } else if (filters.classId) {
    query = query.eq("class_id", filters.classId);
    if (filters.sectionId) {
      query = query.eq("section_id", filters.sectionId);
    }
  }

  const { data: students, error } = await query;
  if (error || !students) {
    return {
      totalStudents: 0,
      activeStudents: 0,
      genderDistribution: { male: 0, female: 0, other: 0 },
      classDistribution: [],
    };
  }

  const total = students.length;
  let male = 0;
  let female = 0;
  let other = 0;
  let unspecified = 0;

  const classCountMap = new Map<string, { className: string; count: number }>();

  for (const s of students as any[]) {
    const rawGender = (s.gender || "").trim().toLowerCase();
    const sectionName = (s.sections?.name || "").trim().toLowerCase();

    if (rawGender === "male" || rawGender === "boy" || rawGender === "boys") {
      male++;
    } else if (rawGender === "female" || rawGender === "girl" || rawGender === "girls") {
      female++;
    } else if (rawGender === "other") {
      other++;
    } else if (sectionName.includes("boy") || sectionName === "b") {
      male++;
    } else if (sectionName.includes("girl") || sectionName === "g") {
      female++;
    } else if (rawGender) {
      other++;
    } else {
      unspecified++;
    }

    const cName = s.classes?.name || "Unassigned";
    const existing = classCountMap.get(cName) || { className: cName, count: 0 };
    existing.count++;
    classCountMap.set(cName, existing);
  }

  const classDistribution = Array.from(classCountMap.values()).sort((a, b) => b.count - a.count);

  return {
    totalStudents: total,
    activeStudents: total,
    genderDistribution: { male, female, other, unspecified },
    classDistribution,
  };
}

/**
 * Aggregates Staff statistics
 */
export async function getStaffMetrics(supabase: SupabaseClient<Database>) {
  const [teachersRes, staffsRes] = await Promise.all([
    supabase.from("teachers").select("id", { count: "exact", head: true }),
    supabase.from("staffs").select("id", { count: "exact", head: true }),
  ]);

  const teacherCount = teachersRes.count ?? 0;
  const staffCount = staffsRes.count ?? 0;

  return {
    totalTeachers: teacherCount,
    totalGeneralStaff: staffCount,
    totalEmployees: teacherCount + staffCount,
  };
}

/**
 * Aggregates Attendance statistics and trends
 */
export async function getAttendanceMetrics(
  supabase: SupabaseClient<Database>,
  bounds: DateRangeBounds,
  filters: DashboardFilters,
  roleContext: UserRoleContext
) {
  const todayStr = bounds.current.endDateStr;

  // 1. Fetch today's records
  let todayQuery = supabase
    .from("attendance_records")
    .select("status, class_id, section_id, student_id, classes(name), sections(name)")
    .eq("att_date", todayStr);

  if (roleContext.role === "class_teacher" && roleContext.assignedClasses?.length) {
    const classIds = roleContext.assignedClasses.map((a) => a.class_id);
    todayQuery = todayQuery.in("class_id", classIds);
  } else if (filters.classId) {
    todayQuery = todayQuery.eq("class_id", filters.classId);
    if (filters.sectionId) {
      todayQuery = todayQuery.eq("section_id", filters.sectionId);
    }
  }

  let { data: todayRecords } = await todayQuery;

  // If historical range, use that date as label; if today, label as "Today"
  const pad = (n: number) => n.toString().padStart(2, "0");
  const now = new Date();
  const actualTodayDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const isActualToday = todayStr === actualTodayDateStr;
  const attendanceDateLabel = isActualToday
    ? "Today"
    : new Date(todayStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const rawToday = (todayRecords || []) as any[];
  const todayTotal = rawToday.length;
  const todayPresent = rawToday.filter((r) => (r.status || "").toUpperCase() === "P").length;
  const todayAbsent = rawToday.filter((r) => (r.status || "").toUpperCase() === "A").length;
  const todayRate = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 1000) / 10 : 0;

  // Class-wise attendance & anomaly detection (< 75% threshold)
  const classAttendanceMap = new Map<string, { className: string; present: number; total: number }>();
  for (const r of rawToday) {
    const cName = r.classes?.name || "Class";
    const existing = classAttendanceMap.get(cName) || { className: cName, present: 0, total: 0 };
    existing.total++;
    if ((r.status || "").toUpperCase() === "P") existing.present++;
    classAttendanceMap.set(cName, existing);
  }

  const classAttendance = Array.from(classAttendanceMap.values()).map((c) => ({
    className: c.className,
    rate: c.total > 0 ? Math.round((c.present / c.total) * 100) : 0,
    present: c.present,
    total: c.total,
  }));

  const lowAttendanceClasses = classAttendance.filter((c) => c.rate < 75 && c.total >= 3);

  // 2. Multi-day attendance trend over bounds.current
  let trendQuery = supabase
    .from("attendance_records")
    .select("att_date, status")
    .gte("att_date", bounds.current.startDateStr)
    .lte("att_date", bounds.current.endDateStr)
    .order("att_date", { ascending: true });

  if (roleContext.role === "class_teacher" && roleContext.assignedClasses?.length) {
    const classIds = roleContext.assignedClasses.map((a) => a.class_id);
    trendQuery = trendQuery.in("class_id", classIds);
  } else if (filters.classId) {
    trendQuery = trendQuery.eq("class_id", filters.classId);
    if (filters.sectionId) trendQuery = trendQuery.eq("section_id", filters.sectionId);
  }

  const { data: trendRecords } = await trendQuery;

  const dayMap = new Map<string, { date: string; present: number; absent: number; total: number }>();
  for (const r of (trendRecords || []) as any[]) {
    const dStr = r.att_date;
    const existing = dayMap.get(dStr) || { date: dStr, present: 0, absent: 0, total: 0 };
    existing.total++;
    if ((r.status || "").toUpperCase() === "P") existing.present++;
    else existing.absent++;
    dayMap.set(dStr, existing);
  }

  const attendanceTrend = Array.from(dayMap.values()).map((d) => ({
    date: d.date,
    formattedDate: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    present: d.present,
    absent: d.absent,
    rate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
  }));

  return {
    today: {
      dateLabel: attendanceDateLabel,
      present: todayPresent,
      absent: todayAbsent,
      total: todayTotal,
      rate: todayRate,
    },
    classAttendance,
    lowAttendanceClasses,
    attendanceTrend,
  };
}

/**
 * Authoritative Financial Metrics Calculation
 * Single source of truth from tuition_payments, payment_orders, fee_structure, and refunds.
 */
export async function getFinanceMetrics(
  supabase: SupabaseClient<Database>,
  bounds: DateRangeBounds,
  filters: DashboardFilters,
  roleContext: UserRoleContext
) {
  // If role is class teacher or exam controller with no finance authorization, return empty redacted
  if (roleContext.role === "class_teacher" || roleContext.role === "exam_controller") {
    return null;
  }

  const pad = (n: number) => n.toString().padStart(2, "0");
  const now = new Date();
  const actualTodayDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const todayIsoStart = `${actualTodayDateStr}T00:00:00.000Z`;
  const todayIsoEnd = `${actualTodayDateStr}T23:59:59.999Z`;

  const [
    periodTuitionRes,
    prevTuitionRes,
    todayTuitionRes,
    allCompletedTuitionRes,
    feeStructureRes,
    studentsRes,
    paymentOrdersRes,
    refundsRes,
    recentPaymentsRes,
  ] = await Promise.all([
    // 1. Period tuition payments
    (supabase as any)
      .from("tuition_payments")
      .select("id, receipt_number, student_id, student_name, roll, class_name, fee_type, amount_paid, payment_method, payment_date, status, note, void_reason")
      .gte("payment_date", bounds.current.startIso)
      .lte("payment_date", bounds.current.endIso),

    // 2. Previous period tuition for comparison
    bounds.previous
      ? (supabase as any)
          .from("tuition_payments")
          .select("amount_paid, status, note, void_reason")
          .gte("payment_date", bounds.previous.startIso)
          .lte("payment_date", bounds.previous.endIso)
      : Promise.resolve({ data: [] }),

    // 3. Today's collections
    (supabase as any)
      .from("tuition_payments")
      .select("amount_paid, payment_method, status, note, void_reason")
      .gte("payment_date", todayIsoStart)
      .lte("payment_date", todayIsoEnd),

    // 4. All active tuition payments for academic year (for outstanding due calculation)
    (supabase as any)
      .from("tuition_payments")
      .select("amount_paid, class_name, status, note, void_reason, year"),

    // 5. Active Fee structure
    (supabase as any)
      .from("fee_structure")
      .select("class_name, amount, fee_type, is_active, academic_year")
      .eq("is_active", true),

    // 6. Student roster for due projection
    (supabase as any)
      .from("students")
      .select("id, class_id, classes(name)"),

    // 7. Payment orders (online gateway breakdown)
    (supabase as any)
      .from("payment_orders")
      .select("id, order_id, status, gateway, payment_method, amount_paid, created_at")
      .gte("created_at", bounds.current.startIso)
      .lte("created_at", bounds.current.endIso),

    // 8. Refunds
    (supabase as any)
      .from("payment_refunds")
      .select("id, amount, status, created_at")
      .gte("created_at", bounds.current.startIso)
      .lte("created_at", bounds.current.endIso),

    // 9. Recent payments for list
    (supabase as any)
      .from("tuition_payments")
      .select("id, receipt_number, student_id, student_name, roll, class_name, fee_type, amount_paid, payment_method, payment_date, status, note, void_reason")
      .order("payment_date", { ascending: false })
      .limit(10),
  ]);

  const activePeriodTuitions = ((periodTuitionRes.data || []) as any[]).filter((p) => !isPaymentVoid(p));
  const activePrevTuitions = ((prevTuitionRes.data || []) as any[]).filter((p) => !isPaymentVoid(p));
  const activeTodayTuitions = ((todayTuitionRes.data || []) as any[]).filter((p) => !isPaymentVoid(p));
  const activeAllTuitions = ((allCompletedTuitionRes.data || []) as any[]).filter((p) => !isPaymentVoid(p));

  // Collections calculation
  let totalPeriodCollection = 0;
  let cashCollection = 0;
  let onlineCollection = 0;
  let cashCount = 0;
  let onlineCount = 0;

  const trendMap = new Map<string, { date: string; cash: number; online: number; total: number }>();

  // If the range is within 60 days, populate continuous dates for time-series integrity
  const startD = new Date(bounds.current.startDateStr);
  const endD = new Date(bounds.current.endDateStr);
  const daysDiff = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff >= 0 && daysDiff <= 60) {
    for (let i = 0; i <= daysDiff; i++) {
      const cur = new Date(startD);
      cur.setDate(cur.getDate() + i);
      const dKey = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
      trendMap.set(dKey, { date: dKey, cash: 0, online: 0, total: 0 });
    }
  }

  for (const p of activePeriodTuitions) {
    const amt = roundCurrency(Number(p.amount_paid || 0));
    totalPeriodCollection = roundCurrency(totalPeriodCollection + amt);

    const method = (p.payment_method || "cash").toLowerCase().trim();
    const isCash = method === "cash" || method === "counter" || method === "cash_counter";
    const isOnline = !isCash;

    if (isOnline) {
      onlineCollection = roundCurrency(onlineCollection + amt);
      onlineCount++;
    } else {
      cashCollection = roundCurrency(cashCollection + amt);
      cashCount++;
    }

    const dateKey = (p.payment_date || "").slice(0, 10);
    if (dateKey) {
      const existing = trendMap.get(dateKey) || { date: dateKey, cash: 0, online: 0, total: 0 };
      existing.total = roundCurrency(existing.total + amt);
      if (isOnline) existing.online = roundCurrency(existing.online + amt);
      else existing.cash = roundCurrency(existing.cash + amt);
      trendMap.set(dateKey, existing);
    }
  }

  // Previous period total
  const prevPeriodCollection = activePrevTuitions.reduce(
    (sum, p) => roundCurrency(sum + Number(p.amount_paid || 0)),
    0
  );
  const collectionTrendPct = calculateTrendPercentage(totalPeriodCollection, bounds.previous ? prevPeriodCollection : null);

  // Today's collections
  let todayCash = 0;
  let todayOnline = 0;
  let todayTotal = 0;
  for (const p of activeTodayTuitions) {
    const amt = roundCurrency(Number(p.amount_paid || 0));
    todayTotal = roundCurrency(todayTotal + amt);
    const method = (p.payment_method || "cash").toLowerCase().trim();
    const isCash = method === "cash" || method === "counter" || method === "cash_counter";
    if (!isCash) {
      todayOnline = roundCurrency(todayOnline + amt);
    } else {
      todayCash = roundCurrency(todayCash + amt);
    }
  }

  // Outstanding Due Calculation
  // Sum up expected tuition fee per active student based on fee_structure for current session minus active payments
  const currentYearNum = new Date().getFullYear();
  const feeStructure = (feeStructureRes.data || []) as any[];
  const students = (studentsRes.data || []) as any[];

  const classFeeMap = new Map<string, number>();
  for (const fs of feeStructure) {
    if (fs.fee_type === "tuition") {
      classFeeMap.set(fs.class_name, Number(fs.amount || 0));
    }
  }

  let totalExpectedFees = 0;
  const expectedByClass = new Map<string, number>();
  for (const s of students) {
    const cName = s.classes?.name;
    if (cName) {
      const fee = classFeeMap.get(cName) || 0;
      totalExpectedFees = roundCurrency(totalExpectedFees + fee);
      expectedByClass.set(cName, roundCurrency((expectedByClass.get(cName) || 0) + fee));
    }
  }

  const collectedByClass = new Map<string, number>();
  let totalAllCollected = 0;
  for (const p of activeAllTuitions) {
    const amt = Number(p.amount_paid || 0);
    totalAllCollected = roundCurrency(totalAllCollected + amt);
    const cName = p.class_name;
    if (cName) {
      collectedByClass.set(cName, roundCurrency((collectedByClass.get(cName) || 0) + amt));
    }
  }

  const totalOutstandingDue = roundCurrency(Math.max(0, totalExpectedFees - totalAllCollected));

  const dueByClass: { className: string; due: number; expected: number; collected: number }[] = [];
  expectedByClass.forEach((expected, cName) => {
    const col = collectedByClass.get(cName) || 0;
    const due = roundCurrency(Math.max(0, expected - col));
    dueByClass.push({ className: cName, due, expected, collected: col });
  });
  dueByClass.sort((a, b) => b.due - a.due);

  // Online Payment Orders & Gateways
  const paymentOrders = (paymentOrdersRes.data || []) as any[];
  const onlineSuccess = paymentOrders.filter((o) => o.status === "SUCCESS").length;
  const onlinePending = paymentOrders.filter((o) => ["PENDING", "INITIATED", "PROCESSING", "VERIFICATION_REQUIRED"].includes(o.status)).length;
  const onlineFailed = paymentOrders.filter((o) => ["FAILED", "CANCELLED", "EXPIRED"].includes(o.status)).length;

  // Refunds
  const refunds = (refundsRes.data || []) as any[];
  const totalRefunded = refunds
    .filter((r) => r.status === "COMPLETED")
    .reduce((sum, r) => roundCurrency(sum + Number(r.amount || 0)), 0);

  // Collection Trend Sorted
  const collectionTrend = Array.from(trendMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      date: item.date,
      formattedDate: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      cash: item.cash,
      online: item.online,
      total: item.total,
    }));

  // Method Breakdown
  const methodTotal = cashCollection + onlineCollection;
  const methodDistribution = [
    { name: "Cash", value: cashCollection, percentage: methodTotal > 0 ? Math.round((cashCollection / methodTotal) * 100) : 0, count: cashCount, color: "#10B981" },
    { name: "Online / Bank", value: onlineCollection, percentage: methodTotal > 0 ? Math.round((onlineCollection / methodTotal) * 100) : 0, count: onlineCount, color: "#3B82F6" },
  ];

  // Recent Transactions
  const recentTransactions = ((recentPaymentsRes.data || []) as any[])
    .filter((p) => !isPaymentVoid(p))
    .map((p) => {
      const method = (p.payment_method || "cash").toLowerCase().trim();
      const isCash = method === "cash" || method === "counter" || method === "cash_counter";
      const isOnline = !isCash;
      return {
        id: p.id,
        receiptNumber: p.receipt_number,
        studentName: p.student_name || "Student",
        roll: p.roll || null,
        className: p.class_name,
        feeType: p.fee_type,
        amount: Number(p.amount_paid),
        method: (isOnline ? "ONLINE" : "CASH") as "ONLINE" | "CASH",
        rawMethod: p.payment_method,
        status: p.status || "completed",
        date: p.payment_date,
        formattedDate: new Date(p.payment_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      };
    });

  return {
    totalCollection: totalPeriodCollection,
    collectionTrendPct,
    cashCollection,
    onlineCollection,
    todayCollection: {
      total: todayTotal,
      cash: todayCash,
      online: todayOnline,
    },
    totalOutstandingDue,
    dueByClass,
    totalRefunded,
    onlineGateways: {
      successCount: onlineSuccess,
      pendingCount: onlinePending,
      failedCount: onlineFailed,
    },
    collectionTrend,
    methodDistribution,
    recentTransactions,
  };
}

/**
 * Aggregates Academic & Examination Metrics
 */
export async function getAcademicMetrics(
  supabase: SupabaseClient<Database>,
  bounds: DateRangeBounds,
  roleContext: UserRoleContext
) {
  const todayIso = bounds.current.endDateStr;

  const [examsRes, schedulesRes, resultsRes, pendingMarksRes] = await Promise.all([
    // 1. Total configured exams
    supabase.from("exams").select("id, name, exam_type, term"),

    // 2. Upcoming exam schedules within next 30 days
    supabase
      .from("exam_schedules")
      .select("exam_date, start_time, end_time, class_id, subject_id, classes(name), subjects(name)")
      .gte("exam_date", todayIso)
      .order("exam_date", { ascending: true })
      .limit(6),

    // 3. Results count
    supabase.from("results").select("id, gpa, grade"),

    // 4. Check missing marks entries
    supabase.from("exam_subject_config").select("exam_id, subject_id, exams(name), subjects(name, class_id, classes(name))"),
  ]);

  const exams = (examsRes.data || []) as any[];
  const schedules = (schedulesRes.data || []) as any[];
  const results = (resultsRes.data || []) as any[];
  const examConfigs = (pendingMarksRes.data || []) as any[];

  const upcomingExams = schedules.map((s) => ({
    subject: s.subjects?.name || "Subject",
    className: s.classes?.name || "Class",
    date: s.exam_date,
    formattedDate: new Date(s.exam_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: s.start_time || null,
  }));

  // GPA Distribution
  let gpa5 = 0; // A+ (GPA 5.0)
  let gpa4 = 0; // A (GPA 4.0 - 4.99)
  let gpa3 = 0; // B/A- (GPA 3.0 - 3.99)
  let gpaPass = 0; // C/D (GPA 1.0 - 2.99)
  let gpaFail = 0; // F (GPA 0)

  for (const r of results) {
    const gpa = Number(r.gpa || 0);
    if (gpa >= 5.0) gpa5++;
    else if (gpa >= 4.0) gpa4++;
    else if (gpa >= 3.0) gpa3++;
    else if (gpa >= 1.0) gpaPass++;
    else gpaFail++;
  }

  const gpaDistribution = [
    { grade: "A+ (5.0)", count: gpa5, color: "#10B981" },
    { grade: "A (4.0-4.9)", count: gpa4, color: "#3B82F6" },
    { grade: "B/A- (3.0-3.9)", count: gpa3, color: "#8B5CF6" },
    { grade: "Pass (1.0-2.9)", count: gpaPass, color: "#F59E0B" },
    { grade: "F (0.0)", count: gpaFail, color: "#EF4444" },
  ];

  return {
    totalExams: exams.length,
    upcomingExams,
    totalResultsPublished: results.length,
    gpaDistribution,
    configuredSubjectsCount: examConfigs.length,
  };
}

/**
 * Chronological Activity Feed
 */
export async function getActivityFeed(
  supabase: SupabaseClient<Database>,
  roleContext: UserRoleContext,
  limit = 8
) {
  const [paymentsRes, noticesRes, studentsRes] = await Promise.all([
    // 1. Recent payments (if authorized)
    roleContext.role !== "class_teacher"
      ? supabase
          .from("tuition_payments")
          .select("id, receipt_number, student_name, amount_paid, payment_method, payment_date, status, void_reason")
          .order("payment_date", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] }),

    // 2. Recent notices
    supabase
      .from("notices")
      .select("id, title, priority, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(limit),

    // 3. Recent admissions
    supabase
      .from("students")
      .select("id, name, roll, created_at, classes(name)")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const activities: {
    id: string;
    type: "payment" | "notice" | "admission";
    title: string;
    description: string;
    timestamp: string;
    formattedTime: string;
    badgeVariant?: "success" | "warning" | "default" | "destructive";
  }[] = [];

  for (const p of (paymentsRes.data || []) as any[]) {
    if (isPaymentVoid(p)) continue;
    activities.push({
      id: `pay-${p.id}`,
      type: "payment",
      title: "Fee Payment Received",
      description: `${p.student_name || "Student"} paid ৳${Number(p.amount_paid).toLocaleString()} via ${(p.payment_method || "cash").toUpperCase()} (Receipt: ${p.receipt_number})`,
      timestamp: p.payment_date,
      formattedTime: formatActivityTime(p.payment_date),
      badgeVariant: "success",
    });
  }

  for (const n of (noticesRes.data || []) as any[]) {
    activities.push({
      id: `not-${n.id}`,
      type: "notice",
      title: "Notice Published",
      description: n.title,
      timestamp: n.created_at,
      formattedTime: formatActivityTime(n.created_at),
      badgeVariant: n.priority === "urgent" || n.priority === "high" ? "destructive" : "default",
    });
  }

  for (const s of (studentsRes.data || []) as any[]) {
    activities.push({
      id: `stu-${s.id}`,
      type: "admission",
      title: "New Student Admitted",
      description: `${s.name} enrolled in ${s.classes?.name || "Class"}${s.roll ? ` (Roll: ${s.roll})` : ""}`,
      timestamp: s.created_at,
      formattedTime: formatActivityTime(s.created_at),
      badgeVariant: "default",
    });
  }

  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 2) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/**
 * Actionable Alerts & Attention Center
 */
export async function getAttentionAlerts(
  supabase: SupabaseClient<Database>,
  financeMetrics: any,
  attendanceMetrics: any,
  academicMetrics: any,
  roleContext: UserRoleContext
) {
  const alerts: {
    id: string;
    priority: "critical" | "warning" | "info";
    title: string;
    description: string;
    actionLabel: string;
    actionHref: string;
  }[] = [];

  // 1. Finance Alerts (Super Admin / Admin / Accountant)
  if (financeMetrics && (roleContext.role === "super_admin" || roleContext.role === "admin" || roleContext.role === "accountant")) {
    if (financeMetrics.onlineGateways?.pendingCount > 0) {
      alerts.push({
        id: "alert-pending-payments",
        priority: "critical",
        title: `${financeMetrics.onlineGateways.pendingCount} Online Payment(s) Need Verification`,
        description: "Transactions are currently pending or requiring payment reconciliation.",
        actionLabel: "Verify Payments",
        actionHref: "/finance/daily-closing",
      });
    }

    if (financeMetrics.totalOutstandingDue > 0 && financeMetrics.dueByClass?.length > 0) {
      const topDueClass = financeMetrics.dueByClass[0];
      if (topDueClass.due > 0) {
        alerts.push({
          id: "alert-high-due",
          priority: "warning",
          title: `৳${financeMetrics.totalOutstandingDue.toLocaleString()} Total Outstanding Tuition`,
          description: `${topDueClass.className} has the highest due of ৳${topDueClass.due.toLocaleString()}.`,
          actionLabel: "View Overdue List",
          actionHref: "/finance/tuition/overdue",
        });
      }
    }
  }

  // 2. Attendance Alerts (Admin / Class Teacher)
  if (attendanceMetrics?.lowAttendanceClasses?.length > 0) {
    for (const c of attendanceMetrics.lowAttendanceClasses.slice(0, 2)) {
      alerts.push({
        id: `alert-att-${c.className}`,
        priority: "warning",
        title: `Low Attendance in ${c.className} (${c.rate}%)`,
        description: `Attendance is below normal institution threshold (75%).`,
        actionLabel: "View Attendance",
        actionHref: "/attendance",
      });
    }
  }

  if (attendanceMetrics?.today?.total === 0) {
    alerts.push({
      id: "alert-missing-att-today",
      priority: "info",
      title: "No Attendance Recorded Today",
      description: "Class attendance has not yet been submitted for today's session.",
      actionLabel: "Take Attendance",
      actionHref: "/attendance",
    });
  }

  // 3. Academic Alerts (Admin / Exam Controller / Teacher)
  if (academicMetrics?.upcomingExams?.length > 0) {
    const nextExam = academicMetrics.upcomingExams[0];
    alerts.push({
      id: "alert-upcoming-exam",
      priority: "info",
      title: `Upcoming Exam: ${nextExam.subject} (${nextExam.className})`,
      description: `Scheduled for ${nextExam.formattedDate}${nextExam.time ? ` at ${nextExam.time}` : ""}.`,
      actionLabel: "View Exam Routine",
      actionHref: "/administration/exam-schedule",
    });
  }

  return alerts;
}
