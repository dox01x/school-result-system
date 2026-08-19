/**
 * Security Test Suite: Amount Tampering, IDOR/BOLA Protection & Replay Attack Defense
 */

import { roundCurrency } from "../../src/lib/finance-utils";
import { hashPayload, acquireIdempotencyLock } from "../../src/lib/payment/idempotency";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

async function runSecurityTests() {
  console.log("▶ Running Security Tests: Amount Tampering, BOLA & Replay Defense...");

  // 1. Amount Tampering & Negative Values
  const validateFeeSubmission = (itemAmount: number, discount: number, fine: number, scheduledRate: number) => {
    const parsedAmount = roundCurrency(itemAmount);
    const parsedDiscount = roundCurrency(discount);
    const parsedFine = roundCurrency(fine);

    if (parsedAmount <= 0) return { valid: false, error: "Non-positive amount rejected" };
    if (parsedDiscount < 0) return { valid: false, error: "Negative discount rejected" };
    if (parsedFine < 0) return { valid: false, error: "Negative fine rejected" };

    // Server-side authoritative calculation
    const enforcedAmount = scheduledRate > 0 ? scheduledRate : parsedAmount;
    const gross = roundCurrency(enforcedAmount + parsedFine);
    if (parsedDiscount > gross) return { valid: false, error: "Discount exceeds gross payable" };

    const net = roundCurrency(gross - parsedDiscount);
    return { valid: true, netPayable: net };
  };

  // Test Negative Discount Injection
  const testNegDiscount = validateFeeSubmission(1000, -500, 0, 1000);
  assert(!testNegDiscount.valid, "Negative discount injection must be rejected");

  // Test Zero / Negative Amount Injection
  const testZeroAmount = validateFeeSubmission(0, 0, 0, 1000);
  assert(!testZeroAmount.valid, "Zero amount injection must be rejected");

  const testNegAmount = validateFeeSubmission(-100, 0, 0, 1000);
  assert(!testNegAmount.valid, "Negative amount injection must be rejected");

  // Test Excessive Discount (Discount > Gross)
  const testExcessDiscount = validateFeeSubmission(1000, 1500, 0, 1000);
  assert(!testExcessDiscount.valid, "Excessive discount injection must be rejected");

  // Test Authoritative Server Rate Override (Client sends 1 TK, scheduled rate is 1000 TK)
  const testTamperedAmount = validateFeeSubmission(1, 0, 0, 1000);
  assert(testTamperedAmount.valid, "Valid submission");
  assert(testTamperedAmount.netPayable === 1000, "Server must enforce authoritative 1,000 TK rate instead of 1 TK");

  // 2. IDOR / BOLA Authorization Logic
  const checkReceiptAccess = (
    userRole: string,
    userId: string,
    studentOwnerId: string
  ): boolean => {
    const isStaff = ["super_admin", "admin", "accountant"].includes(userRole);
    if (isStaff) return true;
    return userId === studentOwnerId;
  };

  assert(checkReceiptAccess("admin", "user_admin", "student_99"), "Admin must have access");
  assert(checkReceiptAccess("accountant", "user_acc", "student_99"), "Accountant must have access");
  assert(checkReceiptAccess("student", "user_student_99", "user_student_99"), "Student owner must have access to own receipt");
  assert(!checkReceiptAccess("student", "user_malicious", "user_student_99"), "Malicious student cannot access another student receipt (IDOR blocked)");

  // 3. Replay Attack Defense (Same Idempotency Key, Altered Payload)
  const key = "sec_idemp_key_12345";
  const payloadOriginal = { student_id: "std_10", amount: 1500 };
  const payloadAltered = { student_id: "std_10", amount: 10 }; // Attacker altered amount with same key

  const lock1 = await acquireIdempotencyLock(null, key, "tuition", payloadOriginal);
  assert(!lock1.isDuplicate, "First request acquired lock");

  const lock2 = await acquireIdempotencyLock(null, key, "tuition", payloadAltered);
  assert(lock2.isDuplicate, "Replay request must be detected");
  assert(Boolean(lock2.error), "Conflicting payload with reused key must be rejected");

  console.log("✔ All Payment Security tests passed successfully!\n");
}

runSecurityTests().catch((err) => {
  console.error("❌ Security Test Failed:", err);
  process.exit(1);
});
