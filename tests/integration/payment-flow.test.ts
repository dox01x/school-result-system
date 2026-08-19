/**
 * Integration Test Suite: Full Payment Lifecycle, Gateway Initiation, Execution & Verification
 */

import { MockSandboxGateway } from "../../src/lib/payment/gateways/mock-sandbox";
import { PaymentOrder } from "../../src/lib/payment/types";
import { isValidTransition } from "../../src/lib/payment/state-machine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

async function runPaymentFlowIntegrationTests() {
  console.log("▶ Running Integration Tests: Full Payment Flow & Gateway Simulation...");

  const gateway = new MockSandboxGateway();

  const mockOrder: PaymentOrder = {
    id: "ord_123456",
    order_id: "ORD-2026-000001",
    student_id: "std_789",
    student_name: "Tariqul Islam",
    class_name: "Class 10",
    amount_due: 1500,
    amount_paid: 1500,
    discount: 0,
    fine: 0,
    currency: "BDT",
    fee_type: "tuition",
    fee_details: [{ type: "tuition", amount: 1500, month: 1, year: 2026 }],
    year: 2026,
    month: 1,
    status: "CREATED",
    payment_method: "bkash",
    gateway: "mock_sandbox",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 1. Initiate Gateway Session
  const initResult = await gateway.createPayment(mockOrder, "https://school.local/api/finance/payment/callback");
  assert(initResult.success, "Gateway initiation should succeed");
  assert(Boolean(initResult.redirect_url), "Gateway initiation should return redirect_url");
  assert(initResult.status === "INITIATED", "Status should transition to INITIATED");
  assert(isValidTransition(mockOrder.status, initResult.status), "CREATED -> INITIATED must be valid");

  // 2. Execute Payment
  const execResult = await gateway.executePayment(initResult.gateway_payment_id!);
  assert(execResult.success, "Payment execution should succeed");
  assert(Boolean(execResult.gateway_transaction_id), "Execution must return transaction ID");
  assert(execResult.status === "SUCCESS", "Status must be SUCCESS upon execution");
  assert(isValidTransition("PROCESSING", execResult.status), "PROCESSING -> SUCCESS must be valid");

  // 3. Server-to-Server Query Verification
  const queryResult = await gateway.queryPayment(initResult.gateway_payment_id!);
  assert(queryResult.success && queryResult.verified, "Gateway query must verify settled transaction");
  assert(queryResult.status === "SUCCESS", "Queried status must be SUCCESS");
  assert(Boolean(queryResult.gateway_transaction_id), "Query result must contain transaction ID");

  // 4. Test Simulated Timeout
  gateway.shouldSimulateTimeout = true;
  const timeoutQuery = await gateway.queryPayment(initResult.gateway_payment_id!);
  assert(!timeoutQuery.verified, "Timeout simulation must not return verified true");
  assert(timeoutQuery.status === "VERIFICATION_REQUIRED", "Timeout must return VERIFICATION_REQUIRED state");
  gateway.shouldSimulateTimeout = false;

  // 5. Test Simulated Decline
  gateway.shouldSimulateDecline = true;
  const declineExec = await gateway.executePayment(initResult.gateway_payment_id!);
  assert(!declineExec.success, "Decline simulation must return success false");
  assert(declineExec.status === "FAILED", "Decline must return FAILED status");
  gateway.shouldSimulateDecline = false;

  console.log("✔ All Payment Flow integration tests passed successfully!\n");
}

runPaymentFlowIntegrationTests().catch((err) => {
  console.error("❌ Payment Flow Integration Test Failed:", err);
  process.exit(1);
});
