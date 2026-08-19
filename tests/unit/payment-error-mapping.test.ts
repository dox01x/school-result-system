/**
 * Unit Test Suite: Payment Error Taxonomy, Gateway Error Mapping & Recovery Guidance
 */

import {
  getMappedPaymentError,
  mapGatewayRawError,
  PaymentError,
} from "../../src/lib/payment/errors";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

function runErrorMappingTests() {
  console.log("▶ Running Unit Tests: Payment Error Mapping & Recovery Taxonomy...");

  // 1. Gateway Timeout
  const timeoutError = getMappedPaymentError("GATEWAY_TIMEOUT");
  assert(timeoutError.httpStatus === 504, "GATEWAY_TIMEOUT httpStatus should be 504");
  assert(timeoutError.recoveryAction === "CHECK_STATUS", "GATEWAY_TIMEOUT recoveryAction should be CHECK_STATUS");
  assert(timeoutError.messageEn.includes("timed out"), "GATEWAY_TIMEOUT messageEn should mention timed out");

  // 2. Amount Mismatch
  const mismatchError = getMappedPaymentError("AMOUNT_MISMATCH");
  assert(mismatchError.httpStatus === 400, "AMOUNT_MISMATCH httpStatus should be 400");
  assert(mismatchError.recoveryAction === "NEW_SESSION", "AMOUNT_MISMATCH recoveryAction should be NEW_SESSION");

  // 3. Raw String Mapping
  assert(mapGatewayRawError("ETIMEDOUT: gateway connect failed") === "GATEWAY_TIMEOUT", "ETIMEDOUT maps to GATEWAY_TIMEOUT");
  assert(mapGatewayRawError("insufficient wallet balance") === "INSUFFICIENT_FUNDS", "insufficient balance maps to INSUFFICIENT_FUNDS");
  assert(mapGatewayRawError("user declined transaction") === "DECLINED", "declined maps to DECLINED");
  assert(mapGatewayRawError("invalid signature hash") === "INVALID_SIGNATURE", "signature maps to INVALID_SIGNATURE");
  assert(mapGatewayRawError("already paid receipt conflict") === "DUPLICATE_PAYMENT", "already paid maps to DUPLICATE_PAYMENT");

  // 4. PaymentError Exception class
  const customErr = new PaymentError("UNAUTHORIZED_PAYMENT");
  assert(customErr.code === "UNAUTHORIZED_PAYMENT", "PaymentError code is UNAUTHORIZED_PAYMENT");
  assert(customErr.httpStatus === 403, "PaymentError httpStatus is 403");
  assert(customErr.recoveryAction === "CONTACT_SUPPORT", "PaymentError recoveryAction is CONTACT_SUPPORT");

  console.log("✔ All Payment Error Mapping unit tests passed successfully!\n");
}

try {
  runErrorMappingTests();
} catch (e: any) {
  console.error("❌ Error Mapping Test Failed:", e.message);
  process.exit(1);
}
