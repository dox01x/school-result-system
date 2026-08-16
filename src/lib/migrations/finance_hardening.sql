-- ==============================================================================
-- FINANCE MODULE HARDENING & AUDIT TRAIL MIGRATION
-- Run this script in the Supabase SQL Editor to upgrade the finance schema.
-- ==============================================================================

-- 1. Add status and void tracking to tuition_payments
ALTER TABLE tuition_payments 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'void', 'refunded')),
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_tuition_payments_status ON tuition_payments(status);
CREATE INDEX IF NOT EXISTS idx_tuition_payments_student_year ON tuition_payments(student_id, year);

-- 2. Add structured reference tracking to income_entries and expense_entries
ALTER TABLE income_entries
  ADD COLUMN IF NOT EXISTS reference_type TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE INDEX IF NOT EXISTS idx_income_entries_ref ON income_entries(reference_type, reference_id);

ALTER TABLE expense_entries
  ADD COLUMN IF NOT EXISTS reference_type TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE INDEX IF NOT EXISTS idx_expense_entries_ref ON expense_entries(reference_type, reference_id);

-- Backfill reference_type for existing records
UPDATE income_entries 
SET reference_type = 'tuition_payment' 
WHERE reference_type = 'manual' AND description ILIKE 'Fees collected%';

UPDATE expense_entries 
SET reference_type = 'salary_payment' 
WHERE reference_type = 'manual' AND (description ILIKE 'Salary paid to%' OR description ILIKE 'Staff salary paid%');

-- 3. Create finance_audit_logs table
CREATE TABLE IF NOT EXISTS finance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  actor_name TEXT,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_audit_logs_target ON finance_audit_logs(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_finance_audit_logs_actor ON finance_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_finance_audit_logs_created ON finance_audit_logs(created_at DESC);

-- 4. Enable RLS on audit logs
ALTER TABLE finance_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_audit_logs_select" ON finance_audit_logs 
  FOR SELECT TO authenticated 
  USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'));

CREATE POLICY "finance_audit_logs_insert" ON finance_audit_logs 
  FOR INSERT TO authenticated 
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
