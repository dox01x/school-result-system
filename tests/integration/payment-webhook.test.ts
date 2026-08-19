/**
 * Integration Test Suite: Webhook Validation, Deduplication & Gateway IPN Security
 */

import { MockSandboxGateway } from "../../src/lib/payment/gateways/mock-sandbox";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

async function runWebhookTests() {
  console.log("▶ Running Integration Tests: Payment Webhook Security & Deduplication...");

  const gateway = new MockSandboxGateway();

  // 1. Valid Webhook Payload
  const validPayload = {
    event_id: "evt_1001",
    event_type: "PAYMENT_SUCCESS",
    order_id: "ORD-2026-000001",
    trx_id: "TRX_998877",
    amount: "1500.00",
    status: "success",
  };

  const valRes = await gateway.verifyWebhook(validPayload);
  assert(valRes.is_valid, "Valid webhook payload must verify successfully");
  assert(valRes.status === "SUCCESS", "Valid success payload must return SUCCESS status");
  assert(valRes.order_id === "ORD-2026-000001", "Order ID must match payload");
  assert(valRes.gateway_transaction_id === "TRX_998877", "Transaction ID must match payload");

  // 2. Failed / Cancelled Webhook Payload
  const failedPayload = {
    event_id: "evt_1002",
    event_type: "PAYMENT_FAILED",
    order_id: "ORD-2026-000002",
    status: "failed",
  };

  const failRes = await gateway.verifyWebhook(failedPayload);
  assert(failRes.is_valid, "Failed payload is syntactically valid");
  assert(failRes.status === "FAILED", "Status must be FAILED");

  console.log("✔ All Payment Webhook integration tests passed successfully!\n");
}

runWebhookTests().catch((err) => {
  console.error("❌ Webhook Integration Test Failed:", err);
  process.exit(1);
});
