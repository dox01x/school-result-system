/**
 * Mock / Sandbox Gateway for Local Development, Automated Tests & Demos
 */

import {
  PaymentOrder,
  PaymentInitiationResult,
  PaymentExecutionResult,
  PaymentVerificationResult,
  PaymentRefundPayload,
  PaymentRefundResult,
  WebhookValidationResult,
} from "../types";

export class MockSandboxGateway {
  public shouldSimulateTimeout: boolean = false;
  public shouldSimulateDecline: boolean = false;

  async createPayment(
    order: PaymentOrder,
    callbackUrl: string
  ): Promise<PaymentInitiationResult> {
    if (this.shouldSimulateTimeout) {
      return {
        success: false,
        order_id: order.order_id,
        status: "VERIFICATION_REQUIRED",
        message: "Simulated gateway connection timeout",
      };
    }

    const mockPaymentId = `mock_pay_${Date.now()}`;
    const redirectUrl = `${callbackUrl}?paymentID=${mockPaymentId}&orderID=${order.order_id}&status=success`;

    return {
      success: true,
      order_id: order.order_id,
      gateway_payment_id: mockPaymentId,
      redirect_url: redirectUrl,
      status: "INITIATED",
      raw_response: { mock: true, paymentID: mockPaymentId },
    };
  }

  async executePayment(paymentId: string): Promise<PaymentExecutionResult> {
    if (this.shouldSimulateDecline) {
      return {
        success: false,
        order_id: "",
        status: "FAILED",
        amount_paid: 0,
        currency: "BDT",
        message: "Simulated payment decline by bank/wallet",
      };
    }

    const mockTrxId = `TRX_${Date.now().toString().slice(-8)}`;

    return {
      success: true,
      order_id: `ORD_${paymentId}`,
      gateway_transaction_id: mockTrxId,
      status: "SUCCESS",
      amount_paid: 500,
      currency: "BDT",
      paid_at: new Date().toISOString(),
      raw_response: { mock: true, trxID: mockTrxId },
    };
  }

  async queryPayment(paymentId: string): Promise<PaymentVerificationResult> {
    if (this.shouldSimulateTimeout) {
      return {
        success: false,
        verified: false,
        status: "VERIFICATION_REQUIRED",
        message: "Gateway query timeout",
      };
    }

    const mockTrxId = `TRX_${Date.now().toString().slice(-8)}`;

    return {
      success: true,
      verified: true,
      status: "SUCCESS",
      gateway_transaction_id: mockTrxId,
      amount_paid: 500,
      currency: "BDT",
      payment_time: new Date().toISOString(),
      raw_response: { mock: true, verified: true },
    };
  }

  async refundPayment(
    paymentId: string,
    trxId: string,
    payload: PaymentRefundPayload
  ): Promise<PaymentRefundResult> {
    const refundId = `MOCK_REF_${Date.now().toString().slice(-6)}`;

    return {
      success: true,
      refund_id: refundId,
      gateway_refund_id: refundId,
      amount: payload.amount,
      status: "COMPLETED",
      raw_response: { mock: true, refundId },
    };
  }

  async verifyWebhook(payload: Record<string, any>): Promise<WebhookValidationResult> {
    const isSuccess = payload.status !== "failed" && payload.status !== "cancelled";

    return {
      is_valid: true,
      event_id: payload.event_id || `evt_${Date.now()}`,
      event_type: payload.event_type || "PAYMENT_SUCCESS",
      order_id: payload.order_id,
      gateway_transaction_id: payload.trx_id || `TRX_${Date.now().toString().slice(-6)}`,
      status: isSuccess ? "SUCCESS" : "FAILED",
      amount: payload.amount ? parseFloat(payload.amount) : undefined,
      currency: payload.currency || "BDT",
      raw_payload: payload,
    };
  }
}
