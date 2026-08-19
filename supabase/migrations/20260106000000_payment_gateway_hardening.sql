-- ==============================================================================
-- PAYMENT GATEWAY HARDENING, STATE MACHINE, IDEMPOTENCY & REFUND SCHEMA
-- Migration: 20260106000000_payment_gateway_hardening.sql
-- Run this in your Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure columns and unique index on tuition_payments
ALTER TABLE tuition_payments 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'void', 'refunded')),
  ADD COLUMN IF NOT EXISTS student_name TEXT,
  ADD COLUMN IF NOT EXISTS roll TEXT,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tuition_payments_receipt_uniq 
  ON tuition_payments(receipt_number);

CREATE INDEX IF NOT EXISTS idx_tuition_payments_status ON tuition_payments(status);
CREATE INDEX IF NOT EXISTS idx_tuition_payments_student_year ON tuition_payments(student_id, year);

-- 2. Create payment_orders table for managing online & counter payment intents
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL UNIQUE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  class_name TEXT NOT NULL,
  section TEXT,
  amount_due NUMERIC(12, 2) NOT NULL CHECK (amount_due >= 0),
  amount_paid NUMERIC(12, 2) NOT NULL CHECK (amount_paid >= 0),
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  fine NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (fine >= 0),
  currency TEXT NOT NULL DEFAULT 'BDT',
  fee_type TEXT NOT NULL,
  fee_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  year INTEGER NOT NULL,
  month INTEGER,
  status TEXT NOT NULL DEFAULT 'CREATED' 
    CHECK (status IN (
      'CREATED', 'INITIATED', 'PENDING', 'PROCESSING', 
      'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED', 
      'VERIFICATION_REQUIRED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'
    )),
  payment_method TEXT NOT NULL,
  gateway TEXT NOT NULL DEFAULT 'counter',
  gateway_payment_id TEXT,
  gateway_transaction_id TEXT,
  gateway_status TEXT,
  gateway_response JSONB,
  idempotency_key TEXT UNIQUE,
  payer_id UUID REFERENCES auth.users(id),
  collected_by UUID REFERENCES auth.users(id),
  tuition_payment_id UUID REFERENCES tuition_payments(id) ON DELETE SET NULL,
  failure_reason TEXT,
  note TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_student ON payment_orders(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_gateway ON payment_orders(gateway, gateway_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_trx ON payment_orders(gateway_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created ON payment_orders(created_at DESC);

-- 3. Create payment_idempotency_keys table for atomic deduplication and locking
CREATE TABLE IF NOT EXISTS payment_idempotency_keys (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'tuition_payment',
  request_hash TEXT NOT NULL,
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  response_status INTEGER,
  response_body JSONB,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_idempotency_expires ON payment_idempotency_keys(expires_at);

-- 4. Create payment_refunds table
CREATE TABLE IF NOT EXISTS payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id TEXT NOT NULL UNIQUE,
  payment_order_id UUID REFERENCES payment_orders(id) ON DELETE SET NULL,
  tuition_payment_id UUID REFERENCES tuition_payments(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  gateway TEXT NOT NULL DEFAULT 'counter',
  gateway_refund_id TEXT,
  gateway_response JSONB,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  refunded_by UUID REFERENCES auth.users(id),
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_order ON payment_refunds(payment_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_tuition ON payment_refunds(tuition_payment_id);

-- 5. Create payment_webhook_events table for deduplicating incoming IPN/webhook deliveries
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature TEXT,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT uq_payment_webhook_event UNIQUE (gateway, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_processed ON payment_webhook_events(processed, received_at DESC);

-- 6. Enable Row Level Security
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- 7. Drop existing policies before creating to allow multiple runs cleanly
DROP POLICY IF EXISTS "payment_orders_staff_all" ON payment_orders;
DROP POLICY IF EXISTS "payment_orders_payer_select" ON payment_orders;
DROP POLICY IF EXISTS "payment_refunds_staff_all" ON payment_refunds;
DROP POLICY IF EXISTS "payment_idempotency_staff_all" ON payment_idempotency_keys;
DROP POLICY IF EXISTS "payment_webhook_staff_all" ON payment_webhook_events;

-- Staff access to payment_orders
CREATE POLICY "payment_orders_staff_all" ON payment_orders
  FOR ALL TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));

-- Payer read access to own payment orders
CREATE POLICY "payment_orders_payer_select" ON payment_orders
  FOR SELECT TO authenticated
  USING (payer_id = auth.uid());

-- Staff access to refunds
CREATE POLICY "payment_refunds_staff_all" ON payment_refunds
  FOR ALL TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));

-- Idempotency keys staff access
CREATE POLICY "payment_idempotency_staff_all" ON payment_idempotency_keys
  FOR ALL TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));

-- Webhook events staff access
CREATE POLICY "payment_webhook_staff_all" ON payment_webhook_events
  FOR ALL TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
