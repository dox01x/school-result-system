-- 1. Add new columns to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS tables_count INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS seats_per_table INTEGER DEFAULT 2;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- 2. Create exam_seat_plans table
CREATE TABLE IF NOT EXISTS exam_seat_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    allocated_students INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_seat_plans_exam ON exam_seat_plans(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_seat_plans_room ON exam_seat_plans(room_id);
-- Prevent duplicate allocation for the same shift+class+section+room
CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_seat_plans_unique 
    ON exam_seat_plans(exam_id, start_time, end_time, class_id, section_id, room_id);

-- RLS Policies for exam_seat_plans
ALTER TABLE exam_seat_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_seat_plans_select" ON exam_seat_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "exam_seat_plans_insert" ON exam_seat_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "exam_seat_plans_update" ON exam_seat_plans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "exam_seat_plans_delete" ON exam_seat_plans FOR DELETE TO authenticated USING (true);

-- 3. Create exam_duties table
CREATE TABLE IF NOT EXISTS exam_duties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    exam_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_duties_teacher ON exam_duties(teacher_id);
CREATE INDEX IF NOT EXISTS idx_exam_duties_room ON exam_duties(room_id);
CREATE INDEX IF NOT EXISTS idx_exam_duties_exam ON exam_duties(exam_id);

-- Prevent assigning the same teacher to two rooms in the same shift on the same date
CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_duties_teacher_shift_unique
    ON exam_duties(teacher_id, exam_date, start_time, end_time);

-- RLS Policies for exam_duties
ALTER TABLE exam_duties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_duties_select" ON exam_duties FOR SELECT TO authenticated USING (true);
CREATE POLICY "exam_duties_insert" ON exam_duties FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "exam_duties_update" ON exam_duties FOR UPDATE TO authenticated USING (true);
CREATE POLICY "exam_duties_delete" ON exam_duties FOR DELETE TO authenticated USING (true);
