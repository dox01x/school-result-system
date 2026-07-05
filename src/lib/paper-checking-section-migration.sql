-- Migration to add section_id and date_received_from_hall to exam_paper_distributions
ALTER TABLE exam_paper_distributions 
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS date_received_from_hall DATE;
