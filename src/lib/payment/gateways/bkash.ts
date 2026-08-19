/**
 * Official bKash Tokenized Checkout (v1.2.0-beta) Gateway Adapter
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

export class BkashGateway {
  private appKey: string;
  private appSecret: string;
  private username: string;
  private password: string;
  private baseUrl: string;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor() {
    this.appKey = process.env.BKASH_APP_KEY || "";
    this.appSecret = process.env.BKASH_APP_SECRET || "";
    this.username = process.env.BKASH_USERNAME || "";
    this.password = process.env.BKASH_PASSWORD || "";
    this.baseUrl =
      process.env.BKASH_BASE_URL || "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
  }

  public isConfigured(): boolean {
    return Boolean(this.appKey && this.appSecret && this.username && this.password);
  }

  /**
   * Retrieves or refreshes the bKash Grant Token with in-memory caching.
   */
  private async getGrantToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    if (!this.isConfigured()) {
      throw new Error("bKash credentials not configured");
    }

    const res = await fetch(`${this.baseUrl}/tokenized/checkout/token/grant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        username: this.username,
        password: this.password,
      },
      body: JSON.stringify({
        app_key: this.appKey,
        app_secret: this.appSecret,
      }),
    });

    const data = await res.json();
    if (data && data.id_token) {
      // bKash tokens expire in 3600 seconds, refresh 5 minutes early
      this.tokenCache = {
        token: data.id_token,
        expiresAt: Date.now() + (data.expires_in ? (data.expires_in - 300) * 1000 : 3300 * 1000),
      };
      return data.id_token;
    }

    throw new Error(`bKash Token Grant failed: ${data?.statusMessage || "Unknown error"}`);
  }

  /**
   * Initiates payment creation on bKash.
   */
  async createPayment(
    order: PaymentOrder,
    callbackUrl: string
  ): Promise<PaymentInitiationResult> {
    try {
      const idToken = await this.getGrantToken();

      const payload = {
        mode: "0011",
        payerReference: order.student_id,
        callbackURL: callbackUrl,
        amount: order.amount_paid.toFixed(2),
        currency: order.currency || "BDT",
        intent: "sale",
        merchantInvoiceNumber: order.order_id,
      };

      const res = await fetch(`${this.baseUrl}/tokenized/checkout/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-APP-Key": this.appKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data && data.paymentID && data.bkashURL) {
        return {
          success: true,
          order_id: order.order_id,
          gateway_payment_id: data.paymentID,
          redirect_url: data.bkashURL,
          status: "INITIATED",
          raw_response: data,
        };
      }

      return {
        success: false,
        order_id: order.order_id,
        status: "FAILED",
        message: data?.statusMessage || "bKash create payment failed",
        raw_response: data,
      };
    } catch (err: any) {
      return {
        success: false,
        order_id: order.order_id,
        status: "VERIFICATION_REQUIRED",
        message: err?.message || "Failed to communicate with bKash API",
      };
    }
  }

  /**
   * Executes payment on bKash after user PIN authorization.
   */
  async executePayment(paymentId: string): Promise<PaymentExecutionResult> {
    try {
      const idToken = await this.getGrantToken();

      const res = await fetch(`${this.baseUrl}/tokenized/checkout/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-APP-Key": this.appKey,
        },
        body: JSON.stringify({ paymentID: paymentId }),
      });

      const data = await res.json();

      if (data && data.statusCode === "0000" && data.trxID) {
        return {
          success: true,
          order_id: data.merchantInvoiceNumber,
          gateway_transaction_id: data.trxID,
          status: "SUCCESS",
          amount_paid: parseFloat(data.amount),
          currency: data.currency || "BDT",
          paid_at: data.paymentExecuteTime || new Date().toISOString(),
          raw_response: data,
        };
      }

      return {
        success: false,
        order_id: data?.merchantInvoiceNumber || "",
        status: "FAILED",
        amount_paid: 0,
        currency: "BDT",
        message: data?.statusMessage || "bKash payment execution failed",
        raw_response: data,
      };
    } catch (err: any) {
      return {
        success: false,
        order_id: "",
        status: "VERIFICATION_REQUIRED",
        amount_paid: 0,
        currency: "BDT",
        message: err?.message || "bKash execution timeout / error",
      };
    }
  }

  /**
   * Server-to-server query verification of payment status.
   */
  async queryPayment(paymentId: string): Promise<PaymentVerificationResult> {
    try {
      const idToken = await this.getGrantToken();

      const res = await fetch(`${this.baseUrl}/tokenized/checkout/payment/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-APP-Key": this.appKey,
        },
        body: JSON.stringify({ paymentID: paymentId }),
      });

      const data = await res.json();

      if (data && data.transactionStatus === "Completed" && data.trxID) {
        return {
          success: true,
          verified: true,
          status: "SUCCESS",
          gateway_transaction_id: data.trxID,
          amount_paid: parseFloat(data.amount),
          currency: data.currency || "BDT",
          payment_time: data.verificationTime || data.paymentExecuteTime,
          raw_response: data,
        };
      }

      return {
        success: true,
        verified: false,
        status: data?.transactionStatus === "Initiated" ? "PENDING" : "FAILED",
        message: data?.statusMessage || "Payment not settled",
        raw_response: data,
      };
    } catch (err: any) {
      return {
        success: false,
        verified: false,
        status: "VERIFICATION_REQUIRED",
        message: err?.message || "bKash status query failed",
      };
    }
  }

  /**
   * Issues refund via bKash.
   */
  async refundPayment(
    paymentId: string,
    trxId: string,
    payload: PaymentRefundPayload
  ): Promise<PaymentRefundResult> {
    try {
      const idToken = await this.getGrantToken();

      const res = await fetch(`${this.baseUrl}/tokenized/checkout/payment/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-APP-Key": this.appKey,
        },
        body: JSON.stringify({
          paymentID: paymentId,
          amount: payload.amount.toFixed(2),
          trxID: trxId,
          sku: "Tuition_Refund",
          reason: payload.reason,
        }),
      });

      const data = await res.json();

      if (data && data.statusCode === "0000" && data.refundTrxID) {
        return {
          success: true,
          refund_id: data.refundTrxID,
          gateway_refund_id: data.refundTrxID,
          amount: parseFloat(data.amount),
          status: "COMPLETED",
          raw_response: data,
        };
      }

      return {
        success: false,
        refund_id: "",
        amount: payload.amount,
        status: "FAILED",
        message: data?.statusMessage || "bKash refund failed",
        raw_response: data,
      };
    } catch (err: any) {
      return {
        success: false,
        refund_id: "",
        amount: payload.amount,
        status: "FAILED",
        message: err?.message || "Failed to process bKash refund",
      };
    }
  }

  /**
   * Validates webhook payload.
   */
  async verifyWebhook(payload: Record<string, any>): Promise<WebhookValidationResult> {
    const paymentId = payload.paymentID;
    const status = payload.status;

    if (!paymentId) {
      return { is_valid: false, error: "Missing paymentID in webhook payload" };
    }

    // Always query authoritative status from bKash server
    const queryResult = await this.queryPayment(paymentId);

    return {
      is_valid: queryResult.verified,
      event_id: payload.paymentID || payload.trxID,
      event_type: status || "PAYMENT_STATUS",
      order_id: payload.merchantInvoiceNumber,
      gateway_transaction_id: queryResult.gateway_transaction_id,
      status: queryResult.status,
      amount: queryResult.amount_paid,
      currency: queryResult.currency,
      raw_payload: payload,
    };
  }
}
