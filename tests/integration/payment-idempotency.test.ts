/**
 * Integration Test Suite: Idempotency Key Locking, Deduplication & Conflict Protection
 */

import {
  generateIdempotencyKey,
  hashPayload,
  acquireIdempotencyLock,
  completeIdempotencyLock,
} from "../../src/lib/payment/idempotency";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

async function runIdempotencyTests() {
  console.log("▶ Running Integration Tests: Payment Idempotency & Deduplication...");

  // 1. Hash Consistency
  const payloadA = { student_id: "std_1", amount: 1000, month: 1 };
  const payloadB = { student_id: "std_1", amount: 1000, month: 1 };
  const payloadC = { student_id: "std_1", amount: 2000, month: 1 };

  assert(hashPayload(payloadA) === hashPayload(payloadB), "Identical payloads must produce identical hashes");
  assert(hashPayload(payloadA) !== hashPayload(payloadC), "Different amounts must produce different hashes");

  // 2. Fresh Key Acquisition
  const key1 = generateIdempotencyKey("test_flow");
  const lock1 = await acquireIdempotencyLock(null, key1, "test_scope", payloadA);
  assert(!lock1.isDuplicate, "Fresh key must not be considered duplicate");
  assert(!lock1.inProgress, "Fresh key must not be in-progress");

  // 3. Concurrent / In-Flight Duplicate Check
  const lock2 = await acquireIdempotencyLock(null, key1, "test_scope", payloadA);
  assert(lock2.isDuplicate, "Subsequent request with same key must be duplicate");
  assert(lock2.inProgress, "Uncompleted request must be detected as in-progress");

  // 4. Conflicting Payload with Reused Key (Security Attack / Bug)
  const lock3 = await acquireIdempotencyLock(null, key1, "test_scope", payloadC);
  assert(lock3.isDuplicate, "Reused key with altered payload must be rejected");
  assert(Boolean(lock3.error), "Must return conflict error message");

  // 5. Complete Lock & Return Cached Response
  const mockResponse = { success: true, receipt_number: "RCP-2026-000001", amount: 1000 };
  await completeIdempotencyLock(null, key1, 200, mockResponse);

  const lock4 = await acquireIdempotencyLock(null, key1, "test_scope", payloadA);
  assert(lock4.isDuplicate, "Completed key must be recognized as duplicate");
  assert(!lock4.inProgress, "Completed key must no longer be in-progress");
  assert(lock4.cachedResponse?.status === 200, "Cached response status must be 200");
  assert(
    (lock4.cachedResponse?.body as any)?.receipt_number === "RCP-2026-000001",
    "Cached response body must match original result"
  );

  console.log("✔ All Payment Idempotency integration tests passed successfully!\n");
}

runIdempotencyTests().catch((err) => {
  console.error("❌ Idempotency Integration Test Failed:", err);
  process.exit(1);
});
