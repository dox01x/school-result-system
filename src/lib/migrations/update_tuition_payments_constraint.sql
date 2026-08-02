-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Update tuition_payments constraints and columns
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Add student_name and roll columns to tuition_payments
ALTER TABLE tuition_payments 
  ADD COLUMN IF NOT EXISTS student_name TEXT,
  ADD COLUMN IF NOT EXISTS roll TEXT;

-- 2. Backfill existing payment records with student names and rolls
UPDATE tuition_payments tp
SET 
  student_name = s.name,
  roll = s.roll
FROM students s
WHERE tp.student_id = s.id AND (tp.student_name IS NULL OR tp.roll IS NULL);

-- 3. Modify the foreign key referencing students(id) to ON DELETE SET NULL instead of ON DELETE CASCADE
-- First, drop the existing constraint (either named tuition_payments_student_id_fkey or tuition_payments_student_id_fk)
ALTER TABLE tuition_payments 
  DROP CONSTRAINT IF EXISTS tuition_payments_student_id_fkey;

-- Add the new constraint with ON DELETE SET NULL
ALTER TABLE tuition_payments
  ADD CONSTRAINT tuition_payments_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
