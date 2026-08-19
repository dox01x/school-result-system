/**
 * Central Payment State Machine & Deterministic Transition Validator
 */

import { PaymentStatus } from "./types";

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "CREATED",
  "INITIATED",
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "VERIFICATION_REQUIRED",
  "REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;

export const TERMINAL_STATUSES: readonly PaymentStatus[] = [
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
] as const;

/**
 * Deterministic Transition Rules
 * Maps each state to its allowed direct next states.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  CREATED: ["INITIATED", "CANCELLED", "EXPIRED"],
  INITIATED: [
    "PENDING",
    "PROCESSING",
    "SUCCESS",
    "FAILED",
    "CANCELLED",
    "EXPIRED",
    "VERIFICATION_REQUIRED",
  ],
  PENDING: [
    "PROCESSING",
    "SUCCESS",
    "FAILED",
    "CANCELLED",
    "EXPIRED",
    "VERIFICATION_REQUIRED",
  ],
  PROCESSING: ["SUCCESS", "FAILED", "VERIFICATION_REQUIRED"],
  VERIFICATION_REQUIRED: [
    "SUCCESS",
    "FAILED",
    "CANCELLED",
    "EXPIRED",
    "PROCESSING",
  ],
  SUCCESS: ["REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED"],
  REFUND_PENDING: ["REFUNDED", "PARTIALLY_REFUNDED", "SUCCESS"],
  PARTIALLY_REFUNDED: ["REFUND_PENDING", "REFUNDED"],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
  REFUNDED: [],
};

/**
 * Checks if a status transition is valid according to the state machine.
 */
export function isValidTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return true; // Idempotent same-state check
  const allowed = ALLOWED_STATUS_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

/**
 * Asserts that a status transition is valid. Throws error if invalid.
 */
export function assertValidTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!isValidTransition(from, to)) {
    throw new Error(
      `Invalid payment status transition from "${from}" to "${to}". Allowed targets from "${from}": [${ALLOWED_STATUS_TRANSITIONS[from].join(", ")}]`
    );
  }
}

/**
 * Returns true if the status is a terminal state where no further processing can occur.
 */
export function isTerminalStatus(status: PaymentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Returns human-friendly status label and descriptions in English.
 */
export function getStatusDetails(status: PaymentStatus): {
  labelBn: string;
  labelEn: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  userMessageBn: string;
  actionableStepBn: string;
} {
  switch (status) {
    case "CREATED":
    case "INITIATED":
      return {
        labelBn: "Initiated",
        labelEn: "Initiated",
        badgeVariant: "secondary",
        userMessageBn: "Payment session initiated. Please complete the checkout.",
        actionableStepBn: "Complete Payment",
      };
    case "PENDING":
    case "PROCESSING":
      return {
        labelBn: "Processing",
        labelEn: "Processing",
        badgeVariant: "warning",
        userMessageBn: "Payment is being verified with the payment gateway.",
        actionableStepBn: "Check Status in a moment",
      };
    case "SUCCESS":
      return {
        labelBn: "Completed",
        labelEn: "Completed",
        badgeVariant: "success",
        userMessageBn: "Payment completed successfully. Receipt has been generated.",
        actionableStepBn: "Print Receipt",
      };
    case "FAILED":
      return {
        labelBn: "Failed",
        labelEn: "Failed",
        badgeVariant: "destructive",
        userMessageBn: "Payment could not be completed. Any deducted funds will be refunded automatically.",
        actionableStepBn: "Try Again",
      };
    case "CANCELLED":
      return {
        labelBn: "Cancelled",
        labelEn: "Cancelled",
        badgeVariant: "outline",
        userMessageBn: "Payment session was cancelled by the user.",
        actionableStepBn: "Start New Payment",
      };
    case "EXPIRED":
      return {
        labelBn: "Expired",
        labelEn: "Expired",
        badgeVariant: "outline",
        userMessageBn: "Payment session has expired.",
        actionableStepBn: "Initiate New Session",
      };
    case "VERIFICATION_REQUIRED":
      return {
        labelBn: "Verification Required",
        labelEn: "Verification Required",
        badgeVariant: "warning",
        userMessageBn: "Transaction status is pending confirmation from gateway.",
        actionableStepBn: "Verify Status",
      };
    case "REFUND_PENDING":
      return {
        labelBn: "Refund Pending",
        labelEn: "Refund Pending",
        badgeVariant: "warning",
        userMessageBn: "Refund request is being processed.",
        actionableStepBn: "Check Refund History",
      };
    case "PARTIALLY_REFUNDED":
      return {
        labelBn: "Partially Refunded",
        labelEn: "Partially Refunded",
        badgeVariant: "secondary",
        userMessageBn: "Payment has been partially refunded.",
        actionableStepBn: "View Refund Details",
      };
    case "REFUNDED":
      return {
        labelBn: "Refunded",
        labelEn: "Refunded",
        badgeVariant: "destructive",
        userMessageBn: "Payment has been fully refunded.",
        actionableStepBn: "View Refund Voucher",
      };
    default:
      return {
        labelBn: status,
        labelEn: status,
        badgeVariant: "outline",
        userMessageBn: "Updating payment status...",
        actionableStepBn: "Refresh",
      };
  }
}
