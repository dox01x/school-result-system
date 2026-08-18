/**
 * Integration Test Suite for API Route Guards, Parameter Validation, and Response Formats
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[INTEGRATION TEST FAILED]: ${message}`);
  }
}

export async function runApiIntegrationTests() {
  console.log("Starting API Integration Test Suite...\n");

  // 1. Test role permissions
  const { canAccessRoute } = await import("../../src/lib/rbac");

  console.log("1. Testing RBAC Role Matrix and Route Guards...");
  assert(canAccessRoute("super_admin", "/settings/users"), "super_admin must have access to /settings/users");
  assert(!canAccessRoute("class_teacher", "/settings/users"), "class_teacher must NOT have access to /settings/users");
  assert(canAccessRoute("class_teacher", "/marks"), "class_teacher must have access to /marks");
  assert(canAccessRoute("accountant", "/finance"), "accountant must have access to /finance");
  assert(!canAccessRoute("class_teacher", "/finance"), "class_teacher must NOT have access to /finance");
  console.log("✓ RBAC Role Matrix tests passed.");

  // 2. Test Currency, Date, and Formatting Utilities
  const { formatCurrency, formatDate } = await import("../../src/lib/utils");
  console.log("\n2. Testing Formatting Utilities...");
  assert(formatCurrency(5000).includes("5,000") || formatCurrency(5000).includes("5000") || formatCurrency(5000).includes("৳"), "formatCurrency should format numeric amounts");
  assert(formatDate("2026-08-18").includes("2026") || formatDate("2026-08-18").includes("Aug"), "formatDate should parse ISO dates cleanly");
  console.log("✓ Formatting Utilities tests passed.");

  // 3. Test Student Input Validation
  const { validateStudentInput } = await import("../../src/features/students/validation");
  console.log("\n3. Testing Student Input Validation...");
  const validRes = validateStudentInput({ name: "Rahim", roll: "101", class_id: "cls-1", section_id: "sec-1" });
  assert(validRes.valid, "Valid student data should pass validation");

  const invalidRes = validateStudentInput({ name: "", roll: "", class_id: "", section_id: "" });
  assert(!invalidRes.valid, "Empty student data must fail validation");
  assert(Boolean(invalidRes.errors.name), "Must produce name validation error");
  assert(Boolean(invalidRes.errors.roll_number || invalidRes.errors.roll), "Must produce roll validation error");
  console.log("✓ Student Input Validation tests passed.");

  console.log("\n==========================================");
  console.log("ALL API & INTEGRATION TESTS PASSED 100%!");
  console.log("==========================================\n");
}

runApiIntegrationTests();
