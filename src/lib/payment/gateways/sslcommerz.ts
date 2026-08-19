/**
 * Official SSLCOMMERZ Hosted Checkout (v4) Gateway Adapter
 */

import {
  PaymentOrder,
  PaymentInitiationResult,
  PaymentVerificationResult,
  PaymentRefundPayload,
  PaymentRefundResult,
  WebhookValidationResult,
} from "../types";

export class SSLCommerzGateway {
  private storeId: string;
  private storePass: string;
  private isSandbox: boolean;
  private baseUrl: string;

  constructor() {
    this.storeId = process.env.SSLCOMMERZ_STORE_ID || "";
    this.storePass = process.env.SSLCOMMERZ_STORE_PASSWORD || "";
    this.isSandbox = process.env.SSLCOMMERZ_IS_SANDBOX !== "false";
    this.baseUrl = this.isSandbox
      ? "https://sandbox.sslcommerz.com"
      : "https://securepay.sslcommerz.com";
  }

  public isConfigured(): boolean {
    return Boolean(this.storeId && this.storePass);
  }

  /**
   * Initializes hosted session with SSLCOMMERZ.
   */
  async createPayment(
    order: PaymentOrder,
    successUrl: string,
    failUrl: string,
    cancelUrl: string,
    ipnUrl: string
  ): Promise<PaymentInitiationResult> {
    try {
      if (!this.isConfigured()) {
        throw new Error("SSLCOMMERZ store credentials not configured");
      }

      const params = new URLSearchParams({
        store_id: this.storeId,
        store_passwd: this.storePass,
        total_amount: order.amount_paid.toFixed(2),
        currency: order.currency || "BDT",
        tran_id: order.order_id,
        success_url: successUrl,
        fail_url: failUrl,
        cancel_url: cancelUrl,
        ipn_url: ipnUrl,
        cus_name: order.student_name || "Student",
        cus_email: "student@school.local",
        cus_add1: "School Campus",
        cus_city: "Dhaka",
        cus_country: "Bangladesh",
        cus_phone: "01700000000",
        shipping_method: "NO",
        product_name: `Tuition Fees (${order.fee_type})`,
        product_category: "Education",
        product_profile: "non-physical-goods",
      });

      const res = await fetch(`${this.baseUrl}/gwprocess/v4/api.php`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      const data = await res.json();

      if (data && data.status === "SUCCESS" && data.GatewayPageURL) {
        return {
          success: true,
          order_id: order.order_id,
          gateway_payment_id: data.sessionkey,
          redirect_url: data.GatewayPageURL,
          status: "INITIATED",
          raw_response: data,
        };
      }

      return {
        success: false,
        order_id: order.order_id,
        status: "FAILED",
        message: data?.failedreason || "Failed to initialize SSLCOMMERZ session",
        raw_response: data,
      };
    } catch (err: any) {
      return {
        success: false,
        order_id: order.order_id,
        status: "VERIFICATION_REQUIRED",
        message: err?.message || "Failed to connect to SSLCOMMERZ gateway",
      };
    }
  }

  /**
   * Server-to-server Order Validation API.
   * Mandated by SSLCOMMERZ documentation to prevent forged IPN/callbacks.
   */
  async validateOrder(valId: string): Promise<PaymentVerificationResult> {
    try {
      const url = `${this.baseUrl}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(
        valId
      )}&store_id=${encodeURIComponent(this.storeId)}&store_passwd=${encodeURIComponent(
        this.storePass
      )}&format=json`;

      const res = await fetch(url);
      const data = await res.json();

      if (data && (data.status === "VALID" || data.status === "VALIDATED")) {
        return {
          success: true,
          verified: true,
          status: "SUCCESS",
          gateway_transaction_id: data.bank_tran_id || data.tran_id,
          amount_paid: parseFloat(data.amount),
          currency: data.currency || "BDT",
          payment_time: data.tran_date,
          raw_response: data,
        };
      }

      return {
        success: true,
        verified: false,
        status: "FAILED",
        message: data?.error || `Order validation returned status: ${data?.status}`,
        raw_response: data,
      };
    } catch (err: any) {
      return {
        success: false,
        verified: false,
        status: "VERIFICATION_REQUIRED",
        message: err?.message || "SSLCOMMERZ validation API failed",
      };
    }
  }

  /**
   * Initiates refund via SSLCOMMERZ merchantTransID validation/refund API.
   */
  async refundPayment(
    bankTranId: string,
    payload: PaymentRefundPayload
  ): Promise<PaymentRefundResult> {
    try {
      const url = `${this.baseUrl}/validator/api/merchantTransIDvalidationAPI.php?bank_tran_id=${encodeURIComponent(
        bankTranId
      )}&refund_amount=${payload.amount.toFixed(2)}&refund_remarks=${encodeURIComponent(
        payload.reason
      )}&store_id=${encodeURIComponent(this.storeId)}&store_passwd=${encodeURIComponent(
        this.storePass
      )}&format=json`;

      const res = await fetch(url);
      const data = await res.json();

      if (data && data.status === "success") {
        return {
          success: true,
          refund_id: data.refund_ref_id || `ref_${Date.now()}`,
          gateway_refund_id: data.refund_ref_id,
          amount: payload.amount,
          status: "COMPLETED",
          raw_response: data,
        };
      }

      return {
        success: false,
        refund_id: "",
        amount: payload.amount,
        status: "FAILED",
        message: data?.errorReason || "SSLCOMMERZ refund failed",
        raw_response: data,
      };
    } catch (err: any) {
      return {
        success: false,
        refund_id: "",
        amount: payload.amount,
        status: "FAILED",
        message: err?.message || "Error processing SSLCOMMERZ refund",
      };
    }
  }

  /**
   * Validates IPN webhook by executing Order Validation API with received `val_id`.
   */
  async verifyWebhook(payload: Record<string, any>): Promise<WebhookValidationResult> {
    const valId = payload.val_id;
    const tranId = payload.tran_id;

    if (!valId) {
      return { is_valid: false, error: "Missing val_id in SSLCOMMERZ IPN payload" };
    }

    // Server-to-server Order Validation (Required for truth)
    const valResult = await this.validateOrder(valId);

    return {
      is_valid: valResult.verified,
      event_id: valId,
      event_type: "IPN_PAYMENT_VALIDATION",
      order_id: tranId,
      gateway_transaction_id: valResult.gateway_transaction_id,
      status: valResult.status,
      amount: valResult.amount_paid,
      currency: valResult.currency,
      raw_payload: payload,
    };
  }
}
