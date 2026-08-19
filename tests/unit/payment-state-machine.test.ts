/**
 * Unit Test Suite: Central Payment State Machine Transitions & Immutability
 */

import {
  isValidTransition,
  assertValidTransition,
  isTerminalStatus,
  getStatusDetails,
  ALLOWED_STATUS_TRANSITIONS,
} from "../../src/lib/payment/state-machine";
import { PaymentStatus } from "../../src/lib/payment/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

function runStateMachineTests() {
  console.log("▶ Running Unit Tests: Payment State Machine & Transitions...");

  // 1. Valid Lifecycle Transitions
  assert(isValidTransition("CREATED", "INITIATED"), "CREATED -> INITIATED must be valid");
  assert(isValidTransition("INITIATED", "PENDING"), "INITIATED -> PENDING must be valid");
  assert(isValidTransition("PENDING", "PROCESSING"), "PENDING -> PROCESSING must be valid");
  assert(isValidTransition("PROCESSING", "SUCCESS"), "PROCESSING -> SUCCESS must be valid");
  assert(isValidTransition("SUCCESS", "REFUND_PENDING"), "SUCCESS -> REFUND_PENDING must be valid");
  assert(isValidTransition("REFUND_PENDING", "REFUNDED"), "REFUND_PENDING -> REFUNDED must be valid");
  assert(isValidTransition("SUCCESS", "PARTIALLY_REFUNDED"), "SUCCESS -> PARTIALLY_REFUNDED must be valid");
  assert(isValidTransition("PARTIALLY_REFUNDED", "REFUNDED"), "PARTIALLY_REFUNDED -> REFUNDED must be valid");

  // 2. Timeout & Ambiguity Flow
  assert(isValidTransition("PROCESSING", "VERIFICATION_REQUIRED"), "PROCESSING -> VERIFICATION_REQUIRED must be valid");
  assert(isValidTransition("VERIFICATION_REQUIRED", "SUCCESS"), "VERIFICATION_REQUIRED -> SUCCESS must be valid");
  assert(isValidTransition("VERIFICATION_REQUIRED", "FAILED"), "VERIFICATION_REQUIRED -> FAILED must be valid");

  // 3. Same-State Idempotency
  assert(isValidTransition("SUCCESS", "SUCCESS"), "SUCCESS -> SUCCESS (idempotent) must be valid");
  assert(isValidTransition("PENDING", "PENDING"), "PENDING -> PENDING (idempotent) must be valid");

  // 4. Invalid Transitions (MUST BE BLOCKED)
  assert(!isValidTransition("SUCCESS", "FAILED"), "SUCCESS -> FAILED must be blocked!");
  assert(!isValidTransition("SUCCESS", "CREATED"), "SUCCESS -> CREATED must be blocked!");
  assert(!isValidTransition("FAILED", "SUCCESS"), "FAILED -> SUCCESS must be blocked!");
  assert(!isValidTransition("CANCELLED", "SUCCESS"), "CANCELLED -> SUCCESS must be blocked!");
  assert(!isValidTransition("EXPIRED", "SUCCESS"), "EXPIRED -> SUCCESS must be blocked!");
  assert(!isValidTransition("REFUNDED", "PENDING"), "REFUNDED -> PENDING must be blocked!");
  assert(!isValidTransition("CREATED", "REFUNDED"), "CREATED -> REFUNDED must be blocked!");

  // 5. assertValidTransition Error Throwing
  let threwForInvalid = false;
  try {
    assertValidTransition("SUCCESS", "FAILED");
  } catch {
    threwForInvalid = true;
  }
  assert(threwForInvalid, "assertValidTransition must throw error for SUCCESS -> FAILED");

  // 6. Terminal State Inspection
  assert(isTerminalStatus("FAILED"), "FAILED must be terminal");
  assert(isTerminalStatus("CANCELLED"), "CANCELLED must be terminal");
  assert(isTerminalStatus("EXPIRED"), "EXPIRED must be terminal");
  assert(isTerminalStatus("REFUNDED"), "REFUNDED must be terminal");
  assert(!isTerminalStatus("SUCCESS"), "SUCCESS allows refund transitions so is not strictly terminal");
  assert(!isTerminalStatus("PENDING"), "PENDING is not terminal");

  // 7. Human-friendly details
  const successDetails = getStatusDetails("SUCCESS");
  assert(successDetails.labelEn === "Completed", "SUCCESS labelEn must be 'Completed'");
  assert(successDetails.badgeVariant === "success", "SUCCESS badgeVariant must be 'success'");

  const failedDetails = getStatusDetails("FAILED");
  assert(failedDetails.labelEn === "Failed", "FAILED labelEn must be 'Failed'");

  console.log("✔ All Payment State Machine unit tests passed successfully!\n");
}

try {
  runStateMachineTests();
} catch (e: any) {
  console.error("❌ State Machine Test Failed:", e.message);
  process.exit(1);
}
