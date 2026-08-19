import assert from "node:assert";
import {
  calculateDateRangeBounds,
  calculateTrendPercentage,
  isPaymentVoid,
} from "../../src/lib/dashboard/dashboard-service";

console.log("▶ Running Unit Tests: Dashboard Calculator, Date Bounds & Safe Math...");

// 1. Test calculateTrendPercentage
{
  // Normal increase: from 100 to 125 (+25%)
  const up = calculateTrendPercentage(125, 100);
  assert.strictEqual(up?.pct, 25);
  assert.strictEqual(up?.direction, "up");
  assert.strictEqual(up?.text, "+25% vs prev");

  // Normal decrease: from 100 to 80 (-20%)
  const down = calculateTrendPercentage(80, 100);
  assert.strictEqual(down?.pct, 20);
  assert.strictEqual(down?.direction, "down");
  assert.strictEqual(down?.text, "-20% vs prev");

  // No change: from 100 to 100
  const neutral = calculateTrendPercentage(100, 100);
  assert.strictEqual(neutral?.pct, 0);
  assert.strictEqual(neutral?.direction, "neutral");
  assert.strictEqual(neutral?.text, "0% vs prev");

  // Previous was 0, current is 50 (+100% vs prev without dividing by zero)
  const zeroPrev = calculateTrendPercentage(50, 0);
  assert.strictEqual(zeroPrev?.pct, 100);
  assert.strictEqual(zeroPrev?.direction, "up");

  // Previous was 0, current is 0
  const zeroBoth = calculateTrendPercentage(0, 0);
  assert.strictEqual(zeroBoth?.pct, 0);
  assert.strictEqual(zeroBoth?.direction, "neutral");

  // Previous is null or undefined -> returns null (ZERO fake data)
  assert.strictEqual(calculateTrendPercentage(100, null), null);
  assert.strictEqual(calculateTrendPercentage(100, undefined), null);
}
console.log("✔ Trend percentage calculations passed (safe zero denominator & zero fake data enforced).");

// 2. Test calculateDateRangeBounds
{
  const fixedNow = new Date("2026-08-19T11:00:00.000Z");

  // Today
  const todayBounds = calculateDateRangeBounds("today", undefined, undefined, fixedNow);
  assert.strictEqual(todayBounds.current.startDateStr, "2026-08-19");
  assert.strictEqual(todayBounds.current.endDateStr, "2026-08-19");
  assert.strictEqual(todayBounds.previous?.startDateStr, "2026-08-18");
  assert.strictEqual(todayBounds.previous?.endDateStr, "2026-08-18");

  // 7 days
  const sevenDaysBounds = calculateDateRangeBounds("7d", undefined, undefined, fixedNow);
  assert.strictEqual(sevenDaysBounds.current.startDateStr, "2026-08-13");
  assert.strictEqual(sevenDaysBounds.current.endDateStr, "2026-08-19");

  // 30 days
  const thirtyDaysBounds = calculateDateRangeBounds("30d", undefined, undefined, fixedNow);
  assert.strictEqual(thirtyDaysBounds.current.startDateStr, "2026-07-21");
  assert.strictEqual(thirtyDaysBounds.current.endDateStr, "2026-08-19");

  // This Month
  const thisMonthBounds = calculateDateRangeBounds("this_month", undefined, undefined, fixedNow);
  assert.strictEqual(thisMonthBounds.current.startDateStr, "2026-08-01");
  assert.strictEqual(thisMonthBounds.previous?.startDateStr, "2026-07-01");

  // Custom
  const customBounds = calculateDateRangeBounds("custom", "2026-05-01", "2026-05-15", fixedNow);
  assert.strictEqual(customBounds.current.startDateStr, "2026-05-01");
  assert.strictEqual(customBounds.current.endDateStr, "2026-05-15");
}
console.log("✔ Date range bounds calculation passed for all standard and custom presets.");

// 3. Test isPaymentVoid
{
  assert.strictEqual(isPaymentVoid(null), false);
  assert.strictEqual(isPaymentVoid({ status: "completed" }), false);
  assert.strictEqual(isPaymentVoid({ status: "void" }), true);
  assert.strictEqual(isPaymentVoid({ status: "completed", note: "[VOIDED BY ADMIN] Duplicate receipt" }), true);
  assert.strictEqual(isPaymentVoid({ status: "completed", void_reason: "Entered by error" }), true);
}
console.log("✔ isPaymentVoid defense-in-depth checks passed.");

console.log("==============================================================================");
console.log("🎉 ALL DASHBOARD CALCULATOR UNIT TESTS PASSED SUCCESSFULLY!");
console.log("==============================================================================\n");
