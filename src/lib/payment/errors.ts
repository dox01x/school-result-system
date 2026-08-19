/**
 * Centralized Payment Error Mapping & Recovery Taxonomy
 */

export type PaymentErrorCode =
  | "GATEWAY_TIMEOUT"
  | "GATEWAY_UNAVAILABLE"
  | "NETWORK_FAILURE"
  | "AMOUNT_MISMATCH"
  | "DUPLICATE_PAYMENT"
  | "UNAUTHORIZED_PAYMENT"
  | "INVALID_SIGNATURE"
  | "INVALID_STATE_TRANSITION"
  | "INSUFFICIENT_FUNDS"
  | "DECLINED"
  | "EXPIRED_SESSION"
  | "STUDENT_NOT_FOUND"
  | "OVERPAYMENT_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "REFUND_LIMIT_EXCEEDED"
  | "ALREADY_VOIDED"
  | "UNKNOWN_ERROR";

export interface MappedPaymentError {
  code: PaymentErrorCode;
  messageEn: string;
  messageBn: string;
  recoveryAction: "CHECK_STATUS" | "RETRY" | "CONTACT_SUPPORT" | "NEW_SESSION" | "NONE";
  recoveryLabelBn: string;
  httpStatus: number;
}

export class PaymentError extends Error {
  public readonly code: PaymentErrorCode;
  public readonly recoveryAction: MappedPaymentError["recoveryAction"];
  public readonly messageBn: string;
  public readonly httpStatus: number;

  constructor(code: PaymentErrorCode, customMessage?: string) {
    const mapped = getMappedPaymentError(code);
    super(customMessage || mapped.messageEn);
    this.name = "PaymentError";
    this.code = code;
    this.recoveryAction = mapped.recoveryAction;
    this.messageBn = mapped.messageBn;
    this.httpStatus = mapped.httpStatus;
  }
}

/**
 * Maps an internal or gateway error code to localized user guidance.
 */
export function getMappedPaymentError(code: PaymentErrorCode): MappedPaymentError {
  switch (code) {
    case "GATEWAY_TIMEOUT":
      return {
        code,
        messageEn: "Payment gateway timed out. Please check your payment status before attempting again.",
        messageBn: "Payment gateway timed out. Please verify payment status before retrying.",
        recoveryAction: "CHECK_STATUS",
        recoveryLabelBn: "Check Status",
        httpStatus: 504,
      };
    case "GATEWAY_UNAVAILABLE":
      return {
        code,
        messageEn: "Payment service is temporarily unavailable. Please try again later.",
        messageBn: "Payment service is temporarily unavailable. Please try again in a few moments.",
        recoveryAction: "RETRY",
        recoveryLabelBn: "Try Again",
        httpStatus: 503,
      };
    case "NETWORK_FAILURE":
      return {
        code,
        messageEn: "Network communication failed. If your money was deducted, it will be reflected shortly.",
        messageBn: "Network communication failed. If payment was deducted, it will update shortly.",
        recoveryAction: "CHECK_STATUS",
        recoveryLabelBn: "Check Status",
        httpStatus: 502,
      };
    case "AMOUNT_MISMATCH":
      return {
        code,
        messageEn: "Payment amount does not match authoritative fee records. Calculation rejected.",
        messageBn: "Payment amount does not match authoritative fee records. Calculation rejected.",
        recoveryAction: "NEW_SESSION",
        recoveryLabelBn: "Start New Session",
        httpStatus: 400,
      };
    case "DUPLICATE_PAYMENT":
    case "OVERPAYMENT_CONFLICT":
      return {
        code,
        messageEn: "This fee item has already been paid in full.",
        messageBn: "This fee item has already been paid in full.",
        recoveryAction: "NONE",
        recoveryLabelBn: "View Receipt",
        httpStatus: 409,
      };
    case "IDEMPOTENCY_CONFLICT":
      return {
        code,
        messageEn: "A payment request is already processing for this action.",
        messageBn: "A payment request is currently being processed. Please wait a moment.",
        recoveryAction: "CHECK_STATUS",
        recoveryLabelBn: "Please Wait",
        httpStatus: 409,
      };
    case "UNAUTHORIZED_PAYMENT":
      return {
        code,
        messageEn: "You are not authorized to view or pay this invoice.",
        messageBn: "You are not authorized to view or pay this invoice.",
        recoveryAction: "CONTACT_SUPPORT",
        recoveryLabelBn: "Contact Support",
        httpStatus: 403,
      };
    case "INVALID_SIGNATURE":
      return {
        code,
        messageEn: "Webhook or callback signature verification failed.",
        messageBn: "Security signature verification failed. Request rejected.",
        recoveryAction: "NONE",
        recoveryLabelBn: "Rejected",
        httpStatus: 401,
      };
    case "INSUFFICIENT_FUNDS":
    case "DECLINED":
      return {
        code,
        messageEn: "Payment was declined by your bank or mobile wallet.",
        messageBn: "Payment was declined by your wallet or bank. Please check your balance.",
        recoveryAction: "RETRY",
        recoveryLabelBn: "Try Again",
        httpStatus: 400,
      };
    case "EXPIRED_SESSION":
      return {
        code,
        messageEn: "Payment session has expired. Please initiate a new payment.",
        messageBn: "Payment session has expired. Please initiate a new checkout.",
        recoveryAction: "NEW_SESSION",
        recoveryLabelBn: "New Checkout",
        httpStatus: 400,
      };
    case "REFUND_LIMIT_EXCEEDED":
      return {
        code,
        messageEn: "Refund amount cannot exceed the collected amount.",
        messageBn: "Refund amount cannot exceed the original paid amount.",
        recoveryAction: "NONE",
        recoveryLabelBn: "Error",
        httpStatus: 400,
      };
    case "ALREADY_VOIDED":
      return {
        code,
        messageEn: "This payment has already been voided or refunded.",
        messageBn: "This payment has already been voided or refunded.",
        recoveryAction: "NONE",
        recoveryLabelBn: "Voided",
        httpStatus: 400,
      };
    default:
      return {
        code: "UNKNOWN_ERROR",
        messageEn: "An unexpected payment error occurred. Please verify your payment status.",
        messageBn: "An unexpected payment error occurred. Please check payment status.",
        recoveryAction: "CHECK_STATUS",
        recoveryLabelBn: "Check Status",
        httpStatus: 500,
      };
  }
}

/**
 * Maps raw gateway error strings to standard PaymentErrorCode.
 */
export function mapGatewayRawError(rawError: string): PaymentErrorCode {
  const err = (rawError || "").toLowerCase();
  if (err.includes("timeout") || err.includes("econnreset") || err.includes("etimedout")) {
    return "GATEWAY_TIMEOUT";
  }
  if (err.includes("network") || err.includes("fetch failed") || err.includes("econnrefused")) {
    return "NETWORK_FAILURE";
  }
  if (err.includes("insufficient") || err.includes("balance")) {
    return "INSUFFICIENT_FUNDS";
  }
  if (err.includes("cancel") || err.includes("declined") || err.includes("reject")) {
    return "DECLINED";
  }
  if (err.includes("signature") || err.includes("unauthorized") || err.includes("hash")) {
    return "INVALID_SIGNATURE";
  }
  if (err.includes("duplicate") || err.includes("already paid")) {
    return "DUPLICATE_PAYMENT";
  }
  return "UNKNOWN_ERROR";
}
