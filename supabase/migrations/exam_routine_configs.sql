-- Migration: Create exam_routine_configs table for persisting shifts, dates, and instructions
CREATE TABLE IF NOT EXISTS exam_routine_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    shifts JSONB DEFAULT '[]'::jsonb,
    dates JSONB DEFAULT '[]'::jsonb,
    instructions JSONB DEFAULT '[]'::jsonb,
    selected_shift_id TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(exam_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_routine_configs_exam ON exam_routine_configs(exam_id);

ALTER TABLE exam_routine_configs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'exam_routine_configs' AND policyname = 'exam_routine_configs_select'
    ) THEN
        CREATE POLICY "exam_routine_configs_select" ON exam_routine_configs FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'exam_routine_configs' AND policyname = 'exam_routine_configs_insert'
    ) THEN
        CREATE POLICY "exam_routine_configs_insert" ON exam_routine_configs FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'exam_routine_configs' AND policyname = 'exam_routine_configs_update'
    ) THEN
        CREATE POLICY "exam_routine_configs_update" ON exam_routine_configs FOR UPDATE TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'exam_routine_configs' AND policyname = 'exam_routine_configs_delete'
    ) THEN
        CREATE POLICY "exam_routine_configs_delete" ON exam_routine_configs FOR DELETE TO authenticated USING (true);
    END IF;
END $$;
