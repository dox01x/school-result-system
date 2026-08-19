import assert from "node:assert";
import {
  getStudentMetrics,
  getStaffMetrics,
  getAttendanceMetrics,
  getFinanceMetrics,
  getAcademicMetrics,
  calculateDateRangeBounds,
  type DashboardFilters,
  type UserRoleContext,
} from "../../src/lib/dashboard/dashboard-service";

console.log("▶ Running Integration Tests: Dashboard RBAC, Aggregators & Data Scoping...");

// Mock Supabase Query Builder
function createMockSupabase(dataMap: Record<string, any[]>) {
  return {
    from: (table: string) => {
      let data = dataMap[table] ? [...dataMap[table]] : [];
      let isCount = false;

      const builder: any = {
        select: (columns: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact") {
            isCount = true;
          }
          return builder;
        },
        eq: (col: string, val: any) => {
          data = data.filter((item) => item[col] === val);
          return builder;
        },
        neq: (col: string, val: any) => {
          data = data.filter((item) => item[col] !== val);
          return builder;
        },
        in: (col: string, vals: any[]) => {
          data = data.filter((item) => vals.includes(item[col]));
          return builder;
        },
        gte: (col: string, val: any) => {
          data = data.filter((item) => item[col] >= val);
          return builder;
        },
        lte: (col: string, val: any) => {
          data = data.filter((item) => item[col] <= val);
          return builder;
        },
        order: (col: string, opts?: { ascending?: boolean }) => {
          return builder;
        },
        limit: (n: number) => {
          data = data.slice(0, n);
          return builder;
        },
        maybeSingle: async () => {
          return { data: data[0] || null, error: null };
        },
        then: (resolve: any) => {
          if (isCount) {
            resolve({ count: data.length, data: null, error: null });
          } else {
            resolve({ data, error: null });
          }
        },
      };
      return builder;
    },
  } as any;
}

async function runDashboardIntegrationTests() {
  const mockDbData = {
    students: [
      { id: "s1", class_id: "c1", section_id: "sec1", gender: "Male", classes: { name: "Class 8" } },
      { id: "s2", class_id: "c1", section_id: "sec1", gender: "Female", classes: { name: "Class 8" } },
      { id: "s3", class_id: "c2", section_id: "sec2", gender: "Female", classes: { name: "Class 9" } },
    ],
    teachers: [
      { id: "t1", name: "Rahim Sir" },
      { id: "t2", name: "Karim Sir" },
    ],
    staffs: [
      { id: "st1", name: "Abdul Accountant" },
    ],
    attendance_records: [
      { student_id: "s1", class_id: "c1", section_id: "sec1", att_date: "2026-08-19", status: "P", classes: { name: "Class 8" } },
      { student_id: "s2", class_id: "c1", section_id: "sec1", att_date: "2026-08-19", status: "P", classes: { name: "Class 8" } },
      { student_id: "s3", class_id: "c2", section_id: "sec2", att_date: "2026-08-19", status: "A", classes: { name: "Class 9" } },
    ],
    tuition_payments: [
      { id: "p1", receipt_number: "REC-001", student_id: "s1", class_name: "Class 8", amount_paid: 2000, payment_method: "cash", payment_date: "2026-08-19T10:00:00Z", status: "completed" },
      { id: "p2", receipt_number: "REC-002", student_id: "s2", class_name: "Class 8", amount_paid: 1500, payment_method: "bkash", payment_date: "2026-08-19T10:30:00Z", status: "completed" },
      { id: "p3", receipt_number: "REC-003", student_id: "s3", class_name: "Class 9", amount_paid: 1000, payment_method: "cash", payment_date: "2026-08-19T11:00:00Z", status: "void", void_reason: "Mistake" },
    ],
    fee_structure: [
      { class_name: "Class 8", fee_type: "tuition", amount: 2000, is_active: true },
      { class_name: "Class 9", fee_type: "tuition", amount: 2500, is_active: true },
    ],
    payment_orders: [
      { id: "po1", status: "SUCCESS", gateway: "bkash", payment_method: "bkash", amount_paid: 1500, created_at: "2026-08-19T10:30:00Z" },
    ],
    payment_refunds: [],
    exams: [
      { id: "ex1", name: "Annual Exam 2026" },
    ],
    exam_schedules: [],
    results: [
      { id: "r1", gpa: 5.0, grade: "A+" },
      { id: "r2", gpa: 4.0, grade: "A" },
    ],
    exam_subject_config: [],
  };

  const mockSupabase = createMockSupabase(mockDbData);
  const bounds = calculateDateRangeBounds("today", undefined, undefined, new Date("2026-08-19T12:00:00Z"));
  const filters: DashboardFilters = { range: "today" };

  // 1. Test Super Admin access to Finance Metrics
  const adminRoleContext: UserRoleContext = { role: "admin", userId: "u1" };
  const adminFinance = await getFinanceMetrics(mockSupabase, bounds, filters, adminRoleContext);
  assert(adminFinance !== null, "Admin must receive finance metrics");
  assert.strictEqual(adminFinance?.cashCollection, 2000, "Cash collection should be 2000 (voided payment REC-003 excluded)");
  assert.strictEqual(adminFinance?.onlineCollection, 1500, "Online collection should be 1500");
  assert.strictEqual(adminFinance?.totalCollection, 3500, "Total collection must be cash + online (3500)");
  console.log("✔ Admin authoritative finance metrics calculation & void filtering passed.");

  // 2. Test Class Teacher Financial Data Redaction (Security & Least Privilege)
  const teacherRoleContext: UserRoleContext = {
    role: "class_teacher",
    userId: "u2",
    assignedClasses: [{ class_id: "c1", section_id: "sec1", class_name: "Class 8" }],
  };
  const teacherFinance = await getFinanceMetrics(mockSupabase, bounds, filters, teacherRoleContext);
  assert.strictEqual(teacherFinance, null, "Class Teacher must NOT receive financial dashboard metrics (zero data leak)");
  console.log("✔ Class teacher financial data scoping & authorization verified.");

  // 3. Test Student & Staff counts
  const studentMetrics = await getStudentMetrics(mockSupabase, filters, adminRoleContext);
  assert.strictEqual(studentMetrics.totalStudents, 3, "Total students should be 3");
  assert.strictEqual(studentMetrics.genderDistribution.male, 1);
  assert.strictEqual(studentMetrics.genderDistribution.female, 2);

  const staffMetrics = await getStaffMetrics(mockSupabase);
  assert.strictEqual(staffMetrics.totalTeachers, 2);
  assert.strictEqual(staffMetrics.totalGeneralStaff, 1);
  assert.strictEqual(staffMetrics.totalEmployees, 3);
  console.log("✔ Student & staff aggregation verified.");

  // 4. Test Attendance Rates & Anomaly Detection
  const attendanceMetrics = await getAttendanceMetrics(mockSupabase, bounds, filters, adminRoleContext);
  assert.strictEqual(attendanceMetrics.today.total, 3);
  assert.strictEqual(attendanceMetrics.today.present, 2);
  assert.strictEqual(attendanceMetrics.today.absent, 1);
  assert.strictEqual(attendanceMetrics.today.rate, 66.7);
  console.log("✔ Attendance rates and daily breakdown verified.");

  // 5. Test Teacher Class Scoping
  const teacherStudents = await getStudentMetrics(mockSupabase, filters, teacherRoleContext);
  assert.strictEqual(teacherStudents.totalStudents, 2, "Teacher must only see students from assigned Class 8");
  console.log("✔ Teacher student roster scoping verified.");

  // 6. Test Continuous Date Range in Collection Trend
  const sevenDayBounds = calculateDateRangeBounds("7d", undefined, undefined, new Date("2026-08-19T12:00:00Z"));
  const sevenDayFinance = await getFinanceMetrics(mockSupabase, sevenDayBounds, { range: "7d" }, adminRoleContext);
  assert(sevenDayFinance !== null);
  assert.strictEqual(sevenDayFinance.collectionTrend.length, 7, "7-day collection trend should have exactly 7 continuous date points");
  console.log("✔ Continuous 7-day time series timeline verification passed.");

  // 7. Test Class-wise Outstanding Due Calculation
  // Expected: Class 8 (2 students * 2000 = 4000 expected, paid: 2000 cash + 1500 online = 3500, due = 500)
  // Expected: Class 9 (1 student * 2500 = 2500 expected, paid: 0 (void excluded), due = 2500)
  const class8Due = sevenDayFinance.dueByClass.find((d) => d.className === "Class 8");
  const class9Due = sevenDayFinance.dueByClass.find((d) => d.className === "Class 9");
  assert.strictEqual(class8Due?.due, 500, "Class 8 due should be 500");
  assert.strictEqual(class9Due?.due, 2500, "Class 9 due should be 2500");
  assert.strictEqual(sevenDayFinance.totalOutstandingDue, 3000, "Total outstanding due should be 3000");
  console.log("✔ Class-wise due calculations & partial payment math verified.");

  // 8. Test Zero Attendance Handling When No Attendance Taken Today (Zero Fake Data)
  const emptyAttendanceDb = { ...mockDbData, attendance_records: [] };
  const mockSupabaseEmptyAtt = createMockSupabase(emptyAttendanceDb);
  const emptyAttendanceMetrics = await getAttendanceMetrics(mockSupabaseEmptyAtt, bounds, filters, adminRoleContext);
  assert.strictEqual(emptyAttendanceMetrics.today.total, 0, "When no attendance is taken, total must be 0");
  assert.strictEqual(emptyAttendanceMetrics.today.present, 0, "Present must be 0");
  assert.strictEqual(emptyAttendanceMetrics.today.absent, 0, "Absent must be 0");
  assert.strictEqual(emptyAttendanceMetrics.today.rate, 0, "Rate must be 0%");
  assert.strictEqual(emptyAttendanceMetrics.today.dateLabel, "Today");
  console.log("✔ Unrecorded today attendance handling verified (100% zero fake data).");

  console.log("==============================================================================");
  console.log("🎉 ALL DASHBOARD INTEGRATION TESTS PASSED 100%!");
}

export default runDashboardIntegrationTests;

runDashboardIntegrationTests().catch((err) => {
  console.error("❌ Dashboard Integration Test Failed:", err);
  process.exit(1);
});
