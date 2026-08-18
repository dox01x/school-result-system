-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Separate Staff from Teachers
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Create the new 'staffs' table
CREATE TABLE IF NOT EXISTS staffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Migrate existing staff records from teachers → staffs
INSERT INTO staffs (id, name, phone, email, designation, created_at)
SELECT id, name, phone, email, designation, created_at
FROM teachers
WHERE employee_type = 'staff';

-- 3. Create staff_salary_config_v2 for staffs (separate from teacher salary config)
--    The old staff_salary_config referenced teachers(id). We keep it for teachers only.
--    We create a new table for staff salary configs.
CREATE TABLE IF NOT EXISTS staff_salary_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID UNIQUE REFERENCES staffs(id) ON DELETE CASCADE,
  basic_salary NUMERIC NOT NULL,
  allowances JSONB DEFAULT '{}'::jsonb,
  deductions JSONB DEFAULT '{}'::jsonb,
  effective_from DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create staff_salary_payments for staffs
CREATE TABLE IF NOT EXISTS staff_salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_number TEXT UNIQUE NOT NULL,
  staff_id UUID REFERENCES staffs(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  basic_salary NUMERIC NOT NULL,
  allowances JSONB DEFAULT '{}'::jsonb,
  deductions JSONB DEFAULT '{}'::jsonb,
  gross_salary NUMERIC,
  net_salary NUMERIC,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank', 'mobile_banking')),
  paid_by UUID REFERENCES auth.users(id),
  payment_date TIMESTAMPTZ DEFAULT now(),
  note TEXT,
  is_printed BOOLEAN DEFAULT false,
  CONSTRAINT unique_staff_salary_payment UNIQUE (staff_id, month, year)
);

-- 5. Migrate existing salary configs for staff members
INSERT INTO staff_salary_configs (id, staff_id, basic_salary, allowances, deductions, effective_from, is_active, created_at)
SELECT sc.id, sc.staff_id, sc.basic_salary, sc.allowances, sc.deductions, sc.effective_from, sc.is_active, sc.created_at
FROM staff_salary_config sc
INNER JOIN teachers t ON sc.staff_id = t.id
WHERE t.employee_type = 'staff';

-- 6. Migrate existing salary payments for staff members
INSERT INTO staff_salary_payments (id, slip_number, staff_id, month, year, basic_salary, allowances, deductions, gross_salary, net_salary, payment_method, paid_by, payment_date, note, is_printed)
SELECT sp.id, sp.slip_number, sp.staff_id, sp.month, sp.year, sp.basic_salary, sp.allowances, sp.deductions, sp.gross_salary, sp.net_salary, sp.payment_method, sp.paid_by, sp.payment_date, sp.note, sp.is_printed
FROM salary_payments sp
INNER JOIN teachers t ON sp.staff_id = t.id
WHERE t.employee_type = 'staff';

-- 7. Delete migrated staff salary payments from the old table
DELETE FROM salary_payments
WHERE staff_id IN (SELECT id FROM teachers WHERE employee_type = 'staff');

-- 8. Delete migrated staff salary configs from the old table
DELETE FROM staff_salary_config
WHERE staff_id IN (SELECT id FROM teachers WHERE employee_type = 'staff');

-- 9. Delete staff records from the teachers table
DELETE FROM teachers WHERE employee_type = 'staff';

-- 10. (Optional) Remove the employee_type column from teachers
-- ALTER TABLE teachers DROP COLUMN IF EXISTS employee_type;
-- NOTE: We keep it for now to avoid breaking anything during rollout.
-- You can drop it later once everything is confirmed working.

-- 11. Enable RLS on the new tables (match your existing policy strategy)
ALTER TABLE staffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_salary_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_salary_payments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to access these tables
CREATE POLICY "Allow authenticated access to staffs" ON staffs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access to staff_salary_configs" ON staff_salary_configs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access to staff_salary_payments" ON staff_salary_payments FOR ALL USING (auth.role() = 'authenticated');
