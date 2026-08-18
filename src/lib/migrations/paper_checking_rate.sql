-- Migration to add paper_checking_rate to school_info table
ALTER TABLE school_info 
ADD COLUMN IF NOT EXISTS paper_checking_rate NUMERIC DEFAULT 0;
