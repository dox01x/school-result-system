/**
 * Core Types for School Payment, Fees Collection, State Machine & Gateways
 */

export type PaymentStatus =
  | 'CREATED'
  | 'INITIATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'VERIFICATION_REQUIRED'
  | 'REFUND_PENDING'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export type PaymentGatewayType = 'counter' | 'bkash' | 'sslcommerz' | 'nagad' | 'rocket' | 'bank_transfer' | 'mock_sandbox';

export type Currency = 'BDT';

export interface FeeItemDetail {
  type: string;
  amount: number;
  month?: number;
  year?: number;
  exam_name?: string;
  description?: string;
}

export interface PaymentOrder {
  id: string;
  order_id: string;
  student_id: string;
  student_name?: string;
  class_name: string;
  section?: string;
  roll?: string;
  amount_due: number;
  amount_paid: number;
  discount: number;
  fine: number;
  currency: Currency;
  fee_type: string;
  fee_details: FeeItemDetail[];
  year: number;
  month?: number;
  status: PaymentStatus;
  payment_method: string;
  gateway: PaymentGatewayType | string;
  gateway_payment_id?: string | null;
  gateway_transaction_id?: string | null;
  gateway_status?: string | null;
  gateway_response?: Record<string, unknown> | null;
  idempotency_key?: string | null;
  payer_id?: string | null;
  collected_by?: string | null;
  tuition_payment_id?: string | null;
  failure_reason?: string | null;
  note?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface CreatePaymentIntentPayload {
  student_id: string;
  fee_details: FeeItemDetail[];
  year: number;
  month?: number;
  payment_method: string;
  gateway?: PaymentGatewayType | string;
  note?: string;
  discount?: number;
  fine?: number;
  idempotency_key?: string;
  client_redirect_url?: string;
}

export interface PaymentInitiationResult {
  success: boolean;
  order_id: string;
  gateway_payment_id?: string;
  redirect_url?: string;
  status: PaymentStatus;
  message?: string;
  raw_response?: unknown;
}

export interface PaymentExecutionResult {
  success: boolean;
  order_id: string;
  gateway_transaction_id?: string;
  status: PaymentStatus;
  amount_paid: number;
  currency: string;
  paid_at?: string;
  message?: string;
  raw_response?: unknown;
}

export interface PaymentVerificationResult {
  success: boolean;
  verified: boolean;
  status: PaymentStatus;
  gateway_transaction_id?: string;
  amount_paid?: number;
  currency?: string;
  payment_time?: string;
  message?: string;
  raw_response?: unknown;
}

export interface PaymentRefundPayload {
  payment_order_id?: string;
  tuition_payment_id?: string;
  amount: number;
  reason: string;
  idempotency_key?: string;
  refunded_by?: string;
}

export interface PaymentRefundResult {
  success: boolean;
  refund_id: string;
  gateway_refund_id?: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  message?: string;
  raw_response?: unknown;
}

export interface WebhookValidationResult {
  is_valid: boolean;
  event_id?: string;
  event_type?: string;
  order_id?: string;
  gateway_transaction_id?: string;
  status?: PaymentStatus;
  amount?: number;
  currency?: string;
  error?: string;
  raw_payload?: unknown;
}

export interface IdempotencyRecord {
  key: string;
  scope: string;
  request_hash: string;
  user_id?: string | null;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  response_status?: number;
  response_body?: unknown;
  locked_at: string;
  expires_at: string;
}
