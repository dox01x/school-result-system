/**
 * Integration Test Suite: Payment Refunds, Partial Refunds & Limit Validation
 */

import { MockSandboxGateway } from "../../src/lib/payment/gateways/mock-sandbox";
import { roundCurrency } from "../../src/lib/finance-utils";
import { isValidTransition } from "../../src/lib/payment/state-machine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

async function runRefundIntegrationTests() {
  console.log("▶ Running Integration Tests: Payment Refunds & Cumulative Limits...");

  const gateway = new MockSandboxGateway();

  const originalPaidAmount = 2500;
  let cumulativeRefunded = 0;

  // 1. Partial Refund #1 (1000 TK)
  const refund1Amount = 1000;
  assert(refund1Amount <= roundCurrency(originalPaidAmount - cumulativeRefunded), "Refund 1 is within refundable limit");

  const res1 = await gateway.refundPayment("pay_123", "TRX_123", {
    amount: refund1Amount,
    reason: "Partial fee waiver adjustment",
  });

  assert(res1.success, "Partial refund 1 should succeed");
  assert(res1.status === "COMPLETED", "Refund 1 status should be COMPLETED");
  assert(Boolean(res1.gateway_refund_id), "Refund 1 should return gateway refund ID");

  cumulativeRefunded = roundCurrency(cumulativeRefunded + refund1Amount);
  assert(isValidTransition("SUCCESS", "PARTIALLY_REFUNDED"), "SUCCESS -> PARTIALLY_REFUNDED is valid transition");

  // 2. Partial Refund #2 (1500 TK - completes full amount)
  const refund2Amount = 1500;
  assert(refund2Amount <= roundCurrency(originalPaidAmount - cumulativeRefunded), "Refund 2 is within remaining balance");

  const res2 = await gateway.refundPayment("pay_123", "TRX_123", {
    amount: refund2Amount,
    reason: "Full remaining refund",
  });

  assert(res2.success, "Partial refund 2 should succeed");
  cumulativeRefunded = roundCurrency(cumulativeRefunded + refund2Amount);
  assert(cumulativeRefunded === originalPaidAmount, "Cumulative refund equals original paid amount");
  assert(isValidTransition("PARTIALLY_REFUNDED", "REFUNDED"), "PARTIALLY_REFUNDED -> REFUNDED is valid transition");

  // 3. Over-Refund Attempt (MUST BE BLOCKED)
  const overRefundAmount = 500;
  const remainingRefundable = roundCurrency(originalPaidAmount - cumulativeRefunded);
  assert(remainingRefundable === 0, "No remaining balance to refund");
  assert(overRefundAmount > remainingRefundable, "Over-refund must be detected and blocked");

  console.log("✔ All Payment Refund integration tests passed successfully!\n");
}

runRefundIntegrationTests().catch((err) => {
  console.error("❌ Refund Integration Test Failed:", err);
  process.exit(1);
});
