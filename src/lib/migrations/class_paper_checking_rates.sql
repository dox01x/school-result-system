-- Migration to add paper_checking_rate to classes table
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS paper_checking_rate NUMERIC DEFAULT 0;

-- Optional initial default rates by class level
UPDATE classes SET paper_checking_rate = 2 WHERE numeric_value IN (-1, 0, 1, 2) AND (paper_checking_rate IS NULL OR paper_checking_rate = 0);
UPDATE classes SET paper_checking_rate = 3 WHERE numeric_value IN (3, 4, 5) AND (paper_checking_rate IS NULL OR paper_checking_rate = 0);
UPDATE classes SET paper_checking_rate = 4 WHERE numeric_value IN (6, 7, 8, 9, 10) AND (paper_checking_rate IS NULL OR paper_checking_rate = 0);
