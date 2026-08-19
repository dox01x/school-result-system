/**
 * Payment Gateway Manager & Unified Registry
 */

import { PaymentGatewayType } from "./types";
import { BkashGateway } from "./gateways/bkash";
import { SSLCommerzGateway } from "./gateways/sslcommerz";
import { MockSandboxGateway } from "./gateways/mock-sandbox";

export class PaymentGatewayManager {
  private static bkashInstance: BkashGateway | null = null;
  private static sslInstance: SSLCommerzGateway | null = null;
  private static mockInstance: MockSandboxGateway | null = null;

  public static getBkash(): BkashGateway {
    if (!this.bkashInstance) {
      this.bkashInstance = new BkashGateway();
    }
    return this.bkashInstance;
  }

  public static getSSLCommerz(): SSLCommerzGateway {
    if (!this.sslInstance) {
      this.sslInstance = new SSLCommerzGateway();
    }
    return this.sslInstance;
  }

  public static getMockSandbox(): MockSandboxGateway {
    if (!this.mockInstance) {
      this.mockInstance = new MockSandboxGateway();
    }
    return this.mockInstance;
  }

  public static resolveGateway(gatewayType?: string) {
    const type = (gatewayType || "counter").toLowerCase().trim();

    if (type === "bkash") {
      const bkash = this.getBkash();
      if (bkash.isConfigured() || process.env.NODE_ENV === "production") {
        return { type: "bkash" as PaymentGatewayType, adapter: bkash };
      }
      return { type: "mock_sandbox" as PaymentGatewayType, adapter: this.getMockSandbox() };
    }

    if (type === "sslcommerz") {
      const ssl = this.getSSLCommerz();
      if (ssl.isConfigured() || process.env.NODE_ENV === "production") {
        return { type: "sslcommerz" as PaymentGatewayType, adapter: ssl };
      }
      return { type: "mock_sandbox" as PaymentGatewayType, adapter: this.getMockSandbox() };
    }

    if (type === "mock_sandbox" || type === "mock") {
      return { type: "mock_sandbox" as PaymentGatewayType, adapter: this.getMockSandbox() };
    }

    return { type: "counter" as PaymentGatewayType, adapter: this.getMockSandbox() };
  }
}
