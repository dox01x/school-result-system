-- ===================================================================
-- Migration: Add Paper Rechecking Support and Class Recheck Rates
-- ===================================================================

-- 1. Add paper_recheck_rate column to classes table
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS paper_recheck_rate NUMERIC DEFAULT 0;

-- Optional initial default recheck rates by class level (e.g. 50% of checking rate or 1-2 BDT)
UPDATE classes SET paper_recheck_rate = 1 WHERE numeric_value IN (-1, 0, 1, 2) AND (paper_recheck_rate IS NULL OR paper_recheck_rate = 0);
UPDATE classes SET paper_recheck_rate = 1.5 WHERE numeric_value IN (3, 4, 5) AND (paper_recheck_rate IS NULL OR paper_recheck_rate = 0);
UPDATE classes SET paper_recheck_rate = 2 WHERE numeric_value IN (6, 7, 8, 9, 10) AND (paper_recheck_rate IS NULL OR paper_recheck_rate = 0);

-- 2. Add recheck_teacher_id and recheck date tracking to exam_paper_distributions table
ALTER TABLE exam_paper_distributions 
ADD COLUMN IF NOT EXISTS recheck_teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS date_recheck_given DATE,
ADD COLUMN IF NOT EXISTS date_recheck_returned DATE,
ADD COLUMN IF NOT EXISTS recheck_status TEXT DEFAULT 'pending';

-- 3. Create index for fast lookups on recheck teacher
CREATE INDEX IF NOT EXISTS idx_exam_paper_distributions_recheck_teacher 
ON exam_paper_distributions(recheck_teacher_id);
