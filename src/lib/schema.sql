-- ===================================================
-- School Result Management System - Complete Schema
-- Run this ENTIRE file in Supabase SQL Editor
-- ===================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- DROP everything
DROP FUNCTION IF EXISTS preview_yearly_promotion() CASCADE;
DROP FUNCTION IF EXISTS perform_yearly_promotion(TEXT) CASCADE;
DROP FUNCTION IF EXISTS undo_yearly_promotion(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.profile_role() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP TABLE IF EXISTS promotion_logs CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS proxy_assignments CASCADE;
DROP TABLE IF EXISTS staff_salary_config CASCADE;
DROP TABLE IF EXISTS expense_entries CASCADE;
DROP TABLE IF EXISTS income_entries CASCADE;
DROP TABLE IF EXISTS salary_payments CASCADE;
DROP TABLE IF EXISTS tuition_payments CASCADE;
DROP TABLE IF EXISTS fee_structure CASCADE;
DROP TABLE IF EXISTS routine_settings CASCADE;
DROP TABLE IF EXISTS notices CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS teacher_shifts CASCADE;
DROP TABLE IF EXISTS exam_schedules CASCADE;
DROP TABLE IF EXISTS class_routines CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS sheet_configs CASCADE;
DROP TABLE IF EXISTS archived_students CASCADE;
DROP TABLE IF EXISTS final_result_details CASCADE;
DROP TABLE IF EXISTS final_results CASCADE;
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS marks CASCADE;
DROP TABLE IF EXISTS exam_subject_config CASCADE;
DROP TABLE IF EXISTS grading_rules CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS school_info CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS ai_progress_snapshots CASCADE;
DROP TABLE IF EXISTS ai_quiz_results CASCADE;
DROP TABLE IF EXISTS ai_quizzes CASCADE;
DROP TABLE IF EXISTS ai_weak_topics CASCADE;
DROP TABLE IF EXISTS ai_curriculum_suggestions CASCADE;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- CORE TABLES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  numeric_value INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO classes (name, numeric_value) VALUES
  ('Play', -1), ('Nursery', 0), ('One', 1), ('Two', 2), ('Three', 3),
  ('Four', 4), ('Five', 5), ('Six', 6), ('Seven', 7), ('Eight', 8),
  ('Nine', 9), ('Ten', 10)
ON CONFLICT (name) DO UPDATE SET numeric_value = EXCLUDED.numeric_value;

CREATE TABLE school_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  principal_name TEXT DEFAULT '',
  established_year TEXT DEFAULT '',
  current_academic_year TEXT DEFAULT '',
  last_promotion_year TEXT DEFAULT '',
  detailed_marks BOOLEAN DEFAULT false,
  gender_split_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, name)
);

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  full_marks INTEGER NOT NULL DEFAULT 100,
  pass_marks INTEGER NOT NULL DEFAULT 33,
  has_theory BOOLEAN DEFAULT TRUE,
  has_mcq BOOLEAN DEFAULT FALSE,
  has_practical BOOLEAN DEFAULT FALSE,
  theory_marks INTEGER DEFAULT 100,
  mcq_marks INTEGER DEFAULT 0,
  practical_marks INTEGER DEFAULT 0,
  is_optional BOOLEAN DEFAULT FALSE,
  group_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, name)
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id TEXT UNIQUE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  roll TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT DEFAULT '' CHECK (gender IN ('', 'Male', 'Female')),
  father_name TEXT DEFAULT '',
  mother_name TEXT DEFAULT '',
  date_of_birth TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  blood_group TEXT DEFAULT '',
  group_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, section_id, roll)
);

CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  exam_type TEXT NOT NULL DEFAULT 'semester'
    CHECK (exam_type IN ('mct', 'semester', 'standalone')),
  term INTEGER DEFAULT 1
    CHECK ((exam_type = 'standalone' AND term IS NULL) OR (term >= 1 AND term <= 3)),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE grading_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marks_category INTEGER NOT NULL DEFAULT 100,
  min_marks NUMERIC NOT NULL,
  max_marks NUMERIC NOT NULL,
  grade TEXT NOT NULL,
  grade_point NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE exam_subject_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  full_marks INTEGER NOT NULL DEFAULT 100,
  weight_percent NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, subject_id)
);

CREATE TABLE marks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL DEFAULT '',
  theory NUMERIC, mcq NUMERIC, practical NUMERIC,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id, exam_id, academic_year)
);

CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL DEFAULT '',
  total_marks NUMERIC NOT NULL DEFAULT 0,
  total_full_marks NUMERIC NOT NULL DEFAULT 0,
  percentage NUMERIC NOT NULL DEFAULT 0,
  gpa NUMERIC NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, exam_id, academic_year)
);

CREATE TABLE final_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL DEFAULT '',
  total_marks NUMERIC NOT NULL DEFAULT 0,
  total_full_marks NUMERIC NOT NULL DEFAULT 0,
  percentage NUMERIC NOT NULL DEFAULT 0,
  gpa NUMERIC NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT '',
  position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id, academic_year)
);

CREATE TABLE final_result_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  final_result_id UUID NOT NULL REFERENCES final_results(id) ON DELETE CASCADE,
  term INTEGER NOT NULL CHECK (term >= 1 AND term <= 3),
  percentage NUMERIC NOT NULL DEFAULT 0,
  raw_marks NUMERIC NOT NULL DEFAULT 0,
  raw_full_marks NUMERIC NOT NULL DEFAULT 0,
  raw_gpa NUMERIC NOT NULL DEFAULT 0,
  weighted_marks NUMERIC NOT NULL DEFAULT 0,
  weighted_gpa NUMERIC NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(final_result_id, term)
);

CREATE TABLE archived_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_student_id UUID,
  student_id_text TEXT,
  class_name TEXT NOT NULL,
  section_name TEXT NOT NULL,
  roll TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT DEFAULT '',
  father_name TEXT DEFAULT '',
  mother_name TEXT DEFAULT '',
  date_of_birth TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  blood_group TEXT DEFAULT '',
  group_name TEXT,
  final_total_marks NUMERIC DEFAULT 0,
  final_total_full_marks NUMERIC DEFAULT 0,
  final_gpa NUMERIC DEFAULT 0,
  final_grade TEXT DEFAULT '',
  final_position INTEGER,
  marks_snapshot JSONB DEFAULT '[]'::jsonb,
  old_class_id UUID,
  old_section_id UUID,
  archived_year TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sheet_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('students', 'marks')),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  sheet_id TEXT NOT NULL,
  sheet_range TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- ADMINISTRATION TABLES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  subject_specialty TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  employee_type TEXT DEFAULT 'teacher' CHECK (employee_type IN ('teacher', 'staff')),
  proxy_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  capacity INTEGER DEFAULT 40,
  room_type TEXT DEFAULT 'classroom' CHECK (room_type IN ('classroom', 'lab', 'auditorium', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE class_routines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 5),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE exam_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  exam_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  invigilator_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teacher_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duty_type TEXT NOT NULL DEFAULT 'regular' CHECK (duty_type IN ('regular', 'exam_duty', 'extra')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'students', 'parents', 'teachers')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE routine_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  working_days TEXT[] DEFAULT ARRAY['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday'],
  periods_per_day INTEGER DEFAULT 7,
  period_duration_minutes INTEGER DEFAULT 45,
  period_durations integer[] DEFAULT '{}'::integer[],
  break_after_period INTEGER DEFAULT 3,
  break_duration_minutes INTEGER DEFAULT 20,
  class_start_time TEXT DEFAULT '08:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO routine_settings (working_days, periods_per_day, period_duration_minutes, break_after_period, break_duration_minutes, class_start_time)
SELECT ARRAY['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday'], 7, 45, 3, 20, '08:00'
WHERE NOT EXISTS (SELECT 1 FROM routine_settings);

CREATE TABLE proxy_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leave_request_id UUID REFERENCES leave_requests(id) ON DELETE CASCADE,
  routine_id UUID REFERENCES class_routines(id) ON DELETE CASCADE,
  assignment_date DATE NOT NULL,
  original_teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  proxy_teacher_id UUID REFERENCES teachers(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(routine_id, assignment_date)
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- FINANCE TABLES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE fee_structure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name text NOT NULL,
  fee_type text NOT NULL,
  amount numeric NOT NULL,
  description text,
  academic_year text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_fee_structure UNIQUE (class_name, fee_type, academic_year)
);

CREATE TABLE tuition_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  class_name text NOT NULL,
  section text,
  fee_type text NOT NULL,
  fee_details jsonb DEFAULT '[]'::jsonb,
  month integer,
  year integer NOT NULL,
  amount_due numeric NOT NULL,
  amount_paid numeric NOT NULL,
  discount numeric DEFAULT 0,
  fine numeric DEFAULT 0,
  payment_method text CHECK (payment_method IN ('cash', 'bank', 'mobile_banking')),
  collected_by uuid REFERENCES auth.users(id),
  payment_date timestamptz DEFAULT now(),
  note text,
  is_printed boolean DEFAULT false
);

CREATE TABLE salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_number text UNIQUE NOT NULL,
  staff_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  staff_type text CHECK (staff_type IN ('teacher', 'staff')),
  month integer NOT NULL,
  year integer NOT NULL,
  basic_salary numeric NOT NULL,
  allowances jsonb DEFAULT '{}'::jsonb,
  deductions jsonb DEFAULT '{}'::jsonb,
  gross_salary numeric,
  net_salary numeric,
  payment_method text CHECK (payment_method IN ('cash', 'bank', 'mobile_banking')),
  paid_by uuid REFERENCES auth.users(id),
  payment_date timestamptz DEFAULT now(),
  note text,
  is_printed boolean DEFAULT false,
  CONSTRAINT unique_salary_payment UNIQUE (staff_id, month, year)
);

CREATE TABLE income_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  amount numeric NOT NULL,
  description text NOT NULL,
  received_from text,
  payment_method text CHECK (payment_method IN ('cash', 'bank', 'mobile_banking')),
  received_by uuid REFERENCES auth.users(id),
  income_date date NOT NULL,
  academic_year text,
  month integer,
  year integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE expense_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  amount numeric NOT NULL,
  description text NOT NULL,
  vendor text,
  payment_method text CHECK (payment_method IN ('cash', 'bank', 'mobile_banking')),
  paid_by uuid REFERENCES auth.users(id),
  expense_date date NOT NULL,
  receipt_url text,
  month integer,
  year integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE staff_salary_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid UNIQUE REFERENCES teachers(id) ON DELETE CASCADE,
  basic_salary numeric NOT NULL,
  allowances jsonb DEFAULT '{}'::jsonb,
  deductions jsonb DEFAULT '{}'::jsonb,
  effective_from date NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- AUTH & PROFILES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'exam_controller', 'accountant', 'class_teacher')),
  full_name TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (NEW.id, 'admin', COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.profile_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE TABLE class_teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, section_id)
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- ATTENDANCE
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
  att_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('P','A')),
  source TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- PROMOTION
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE promotion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_from TEXT NOT NULL,
  academic_year_to TEXT NOT NULL,
  promoted_count INTEGER DEFAULT 0,
  archived_count INTEGER DEFAULT 0,
  examinee_count INTEGER DEFAULT 0,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  is_undone BOOLEAN DEFAULT FALSE,
  undone_at TIMESTAMPTZ
);
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- INDEXES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE INDEX idx_sections_class_id ON sections(class_id);
CREATE INDEX idx_subjects_class_id ON subjects(class_id);
CREATE INDEX idx_students_class_id ON students(class_id);
CREATE INDEX idx_students_section_id ON students(section_id);
CREATE INDEX idx_students_roll_section ON students(section_id, roll);
CREATE INDEX idx_exams_type_term ON exams(exam_type, term);
CREATE INDEX idx_marks_student_id ON marks(student_id);
CREATE INDEX idx_marks_exam_id ON marks(exam_id);
CREATE INDEX idx_marks_subject_id ON marks(subject_id);
CREATE INDEX idx_marks_academic_year ON marks(academic_year);
CREATE INDEX idx_marks_exam_year ON marks(exam_id, academic_year);
CREATE INDEX idx_results_student_id ON results(student_id);
CREATE INDEX idx_results_exam_id ON results(exam_id);
CREATE INDEX idx_results_academic_year ON results(academic_year);
CREATE INDEX idx_results_exam_year ON results(exam_id, academic_year);
CREATE INDEX idx_exam_subject_config_exam ON exam_subject_config(exam_id, subject_id);
CREATE INDEX idx_grading_rules_category ON grading_rules(marks_category);
CREATE INDEX idx_final_results_student ON final_results(student_id);
CREATE INDEX idx_final_results_class ON final_results(class_id);
CREATE INDEX idx_final_result_details_final ON final_result_details(final_result_id);
CREATE INDEX idx_archived_students_year ON archived_students(archived_year);
CREATE INDEX idx_sheet_configs_lookup ON sheet_configs(type, class_id, section_id, subject_id, exam_id);
CREATE INDEX idx_class_routines_class ON class_routines(class_id, section_id);
CREATE INDEX idx_class_routines_teacher ON class_routines(teacher_id);
CREATE INDEX idx_class_routines_room ON class_routines(room_id);
CREATE INDEX idx_class_routines_day ON class_routines(day_of_week);
CREATE INDEX idx_class_routines_class_day ON class_routines(class_id, day_of_week);
CREATE INDEX idx_exam_schedules_exam ON exam_schedules(exam_id);
CREATE INDEX idx_exam_schedules_class ON exam_schedules(class_id);
CREATE INDEX idx_exam_schedules_exam_class ON exam_schedules(exam_id, class_id);
CREATE INDEX idx_teacher_shifts_teacher ON teacher_shifts(teacher_id);
CREATE INDEX idx_teacher_shifts_date ON teacher_shifts(shift_date);
CREATE INDEX idx_leave_requests_teacher ON leave_requests(teacher_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_notices_audience ON notices(audience);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_tuition_payments_student ON tuition_payments(student_id);
CREATE INDEX idx_tuition_payments_year_month ON tuition_payments(year, month);
CREATE INDEX idx_expense_entries_year_month ON expense_entries(year, month);
CREATE INDEX idx_income_entries_year_month ON income_entries(year, month);
CREATE UNIQUE INDEX uq_attendance_student_date ON attendance_records(student_id, att_date);
CREATE INDEX idx_attendance_class_section_date ON attendance_records(class_id, section_id, att_date);
CREATE INDEX idx_promotion_logs_year ON promotion_logs(academic_year_from);

-- Performance composite indexes (covers the most common query patterns)
CREATE INDEX idx_students_class_section ON students(class_id, section_id);
CREATE INDEX idx_marks_student_exam_year ON marks(student_id, exam_id, academic_year);
CREATE INDEX idx_marks_subject_exam_year ON marks(subject_id, exam_id, academic_year);
CREATE INDEX idx_attendance_student_date_desc ON attendance_records(student_id, att_date DESC);
CREATE INDEX idx_students_name_trgm ON students USING gin (name gin_trgm_ops);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- ROW LEVEL SECURITY
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ALTER TABLE school_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_subject_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_result_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_salary_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Authenticated policies (core + admin)
CREATE POLICY "auth_rw_school_info" ON school_info FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Classes: Admin+ full access, Class Teacher restricted to assigned class
CREATE POLICY "auth_rw_classes" ON classes FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = classes.id))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = classes.id))
);

-- Sections: Admin+ full access, Class Teacher restricted to assigned section
CREATE POLICY "auth_rw_sections" ON sections FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.section_id = sections.id))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.section_id = sections.id))
);

-- Subjects: Admin+ full access, Class Teacher restricted to assigned class
CREATE POLICY "auth_rw_subjects" ON subjects FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = subjects.class_id))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = subjects.class_id))
);

-- Students: restricted to assigned class and section
CREATE POLICY "auth_rw_students" ON students FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = students.class_id AND cta.section_id = students.section_id))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = students.class_id AND cta.section_id = students.section_id))
);

CREATE POLICY "auth_rw_exams" ON exams FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_rw_grading_rules" ON grading_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_rw_exam_subject_config" ON exam_subject_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Marks: Join with students to check class/section
CREATE POLICY "auth_rw_marks" ON marks FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (
    SELECT 1 FROM students s JOIN class_teacher_assignments cta ON cta.class_id = s.class_id AND cta.section_id = s.section_id
    WHERE s.id = marks.student_id AND cta.user_id = auth.uid()
  ))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (
    SELECT 1 FROM students s JOIN class_teacher_assignments cta ON cta.class_id = s.class_id AND cta.section_id = s.section_id
    WHERE s.id = marks.student_id AND cta.user_id = auth.uid()
  ))
);

-- Results
CREATE POLICY "auth_rw_results" ON results FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (
    SELECT 1 FROM students s JOIN class_teacher_assignments cta ON cta.class_id = s.class_id AND cta.section_id = s.section_id
    WHERE s.id = results.student_id AND cta.user_id = auth.uid()
  ))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (
    SELECT 1 FROM students s JOIN class_teacher_assignments cta ON cta.class_id = s.class_id AND cta.section_id = s.section_id
    WHERE s.id = results.student_id AND cta.user_id = auth.uid()
  ))
);

-- Final Results
CREATE POLICY "auth_rw_final_results" ON final_results FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (
    SELECT 1 FROM students s JOIN class_teacher_assignments cta ON cta.class_id = s.class_id AND cta.section_id = s.section_id
    WHERE s.id = final_results.student_id AND cta.user_id = auth.uid()
  ))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (
    SELECT 1 FROM students s JOIN class_teacher_assignments cta ON cta.class_id = s.class_id AND cta.section_id = s.section_id
    WHERE s.id = final_results.student_id AND cta.user_id = auth.uid()
  ))
);

-- Final Result Details (joined via final_results)
CREATE POLICY "auth_rw_final_result_details" ON final_result_details FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (
    SELECT 1 FROM final_results fr JOIN students s ON s.id = fr.student_id
    JOIN class_teacher_assignments cta ON cta.class_id = s.class_id AND cta.section_id = s.section_id
    WHERE fr.id = final_result_details.final_result_id AND cta.user_id = auth.uid()
  ))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (
    SELECT 1 FROM final_results fr JOIN students s ON s.id = fr.student_id
    JOIN class_teacher_assignments cta ON cta.class_id = s.class_id AND cta.section_id = s.section_id
    WHERE fr.id = final_result_details.final_result_id AND cta.user_id = auth.uid()
  ))
);

CREATE POLICY "auth_rw_archived_students" ON archived_students FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sheet Configs
CREATE POLICY "auth_rw_sheet_configs" ON sheet_configs FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = sheet_configs.class_id AND cta.section_id = sheet_configs.section_id))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = sheet_configs.class_id AND cta.section_id = sheet_configs.section_id))
);
CREATE POLICY "auth_rw_teachers" ON teachers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_rw_rooms" ON rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_rw_class_routines" ON class_routines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_rw_exam_schedules" ON exam_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_rw_teacher_shifts" ON teacher_shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_rw_leave_requests" ON leave_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_rw_notices" ON notices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_rw_routine_settings" ON routine_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_rw_proxy_assignments" ON proxy_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_rw_attendance_records" ON attendance_records FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = attendance_records.class_id AND cta.section_id = attendance_records.section_id))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = attendance_records.class_id AND cta.section_id = attendance_records.section_id))
);
CREATE POLICY "auth_rw_promotion_logs" ON promotion_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Profiles policies
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.profile_role() = 'super_admin');
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.profile_role() = 'super_admin') WITH CHECK (auth.uid() = id OR public.profile_role() = 'super_admin');
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (public.profile_role() = 'super_admin');

-- Class teacher assignments policies
CREATE POLICY "cta_select" ON class_teacher_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "cta_write" ON class_teacher_assignments FOR INSERT TO authenticated WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "cta_update" ON class_teacher_assignments FOR UPDATE TO authenticated USING (public.profile_role() IN ('super_admin', 'admin')) WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "cta_delete" ON class_teacher_assignments FOR DELETE TO authenticated USING (public.profile_role() IN ('super_admin', 'admin'));

-- Finance policies (role-based)
CREATE POLICY "finance_fee_select" ON fee_structure FOR SELECT TO authenticated USING (true);
CREATE POLICY "finance_fee_write" ON fee_structure FOR INSERT TO authenticated WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
CREATE POLICY "finance_fee_update" ON fee_structure FOR UPDATE TO authenticated USING (public.profile_role() IN ('super_admin', 'admin', 'accountant')) WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
CREATE POLICY "finance_fee_delete" ON fee_structure FOR DELETE TO authenticated USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
CREATE POLICY "finance_tuition_all" ON tuition_payments FOR ALL TO authenticated USING (public.profile_role() IN ('super_admin', 'admin', 'accountant')) WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
CREATE POLICY "finance_salary_all" ON salary_payments FOR ALL TO authenticated USING (public.profile_role() IN ('super_admin', 'admin', 'accountant')) WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
CREATE POLICY "finance_income_all" ON income_entries FOR ALL TO authenticated USING (public.profile_role() IN ('super_admin', 'admin', 'accountant')) WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
CREATE POLICY "finance_expense_all" ON expense_entries FOR ALL TO authenticated USING (public.profile_role() IN ('super_admin', 'admin', 'accountant')) WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
CREATE POLICY "finance_staff_config_select" ON staff_salary_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "finance_staff_config_write" ON staff_salary_config FOR INSERT TO authenticated WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
CREATE POLICY "finance_staff_config_update" ON staff_salary_config FOR UPDATE TO authenticated USING (public.profile_role() IN ('super_admin', 'admin', 'accountant')) WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
CREATE POLICY "finance_staff_config_delete" ON staff_salary_config FOR DELETE TO authenticated USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'));

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- TRIGGERS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER tr_school_info_updated BEFORE UPDATE ON school_info FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER tr_attendance_records_updated BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Backfill profiles for existing auth users
INSERT INTO public.profiles (id, role)
SELECT id, 'admin' FROM auth.users
ON CONFLICT (id) DO NOTHING;
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- PROMOTION RPC FUNCTIONS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE OR REPLACE FUNCTION preview_yearly_promotion()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_school RECORD; v_examinee_class_id UUID; v_gender_split_class_nv INTEGER;
  v_result JSONB := '{}'; v_transitions JSONB := '[]'; v_archive_list JSONB := '[]';
  v_row JSONB; v_cls RECORD; v_next_cls RECORD; v_sec RECORD;
  v_students_arr JSONB; v_total_promote INTEGER := 0; v_total_examinee INTEGER := 0;
  v_total_archive INTEGER := 0; v_already_promoted BOOLEAN := FALSE;
  v_current_year TEXT; v_next_year TEXT;
BEGIN
  SELECT id, current_academic_year, last_promotion_year, gender_split_class_id INTO v_school FROM school_info LIMIT 1;
  IF v_school.id IS NULL THEN RETURN jsonb_build_object('error', 'School info not configured'); END IF;
  v_current_year := COALESCE(v_school.current_academic_year, EXTRACT(YEAR FROM NOW())::TEXT);
  v_next_year := (COALESCE(v_current_year::INTEGER, EXTRACT(YEAR FROM NOW())::INTEGER) + 1)::TEXT;
  IF v_school.last_promotion_year = v_current_year THEN v_already_promoted := TRUE; END IF;
  IF v_school.gender_split_class_id IS NOT NULL THEN
    SELECT numeric_value INTO v_gender_split_class_nv FROM classes WHERE id = v_school.gender_split_class_id;
  END IF;
  SELECT id INTO v_examinee_class_id FROM classes WHERE LOWER(TRIM(name)) = 'examinee';
  IF v_examinee_class_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'roll', s.roll, 'student_id', s.student_id, 'section_name', sec.name)), '[]'::jsonb)
    INTO v_archive_list FROM students s JOIN sections sec ON sec.id = s.section_id WHERE s.class_id = v_examinee_class_id;
    v_total_archive := jsonb_array_length(v_archive_list);
  END IF;
  FOR v_cls IN SELECT c.id, c.name, c.numeric_value FROM classes c WHERE c.numeric_value IS NOT NULL AND LOWER(TRIM(c.name)) != 'examinee' ORDER BY c.numeric_value ASC
  LOOP
    IF v_cls.numeric_value = 10 OR LOWER(TRIM(v_cls.name)) IN ('10', 'ten', 'class 10') THEN
      SELECT id, name INTO v_next_cls FROM classes WHERE LOWER(TRIM(name)) = 'examinee';
      IF v_next_cls.id IS NULL THEN v_next_cls.name := 'Examinee (will be created)'; END IF;
    ELSE
      SELECT id, name INTO v_next_cls FROM classes WHERE numeric_value = v_cls.numeric_value + 1 AND LOWER(TRIM(name)) != 'examinee';
      IF v_next_cls.id IS NULL THEN CONTINUE; END IF;
    END IF;
    FOR v_sec IN SELECT sec.id, sec.name FROM sections sec WHERE sec.class_id = v_cls.id ORDER BY sec.name
    LOOP
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'roll', s.roll, 'gender', s.gender)), '[]'::jsonb)
      INTO v_students_arr FROM students s WHERE s.class_id = v_cls.id AND s.section_id = v_sec.id;
      IF jsonb_array_length(v_students_arr) = 0 THEN CONTINUE; END IF;
      IF v_gender_split_class_nv IS NOT NULL AND v_next_cls.id IS NOT NULL AND (SELECT numeric_value FROM classes WHERE id = v_next_cls.id) >= v_gender_split_class_nv THEN
        v_row := jsonb_build_object('from_class', v_cls.name, 'from_section', v_sec.name, 'to_class', COALESCE(v_next_cls.name, 'Unknown'),
          'to_section_boys', 'Boys', 'to_section_girls', 'Girls', 'gender_split', TRUE, 'total_students', jsonb_array_length(v_students_arr),
          'boys_count', (SELECT COUNT(*) FROM students WHERE class_id = v_cls.id AND section_id = v_sec.id AND gender = 'Male'),
          'girls_count', (SELECT COUNT(*) FROM students WHERE class_id = v_cls.id AND section_id = v_sec.id AND gender = 'Female'),
          'unset_count', (SELECT COUNT(*) FROM students WHERE class_id = v_cls.id AND section_id = v_sec.id AND (gender IS NULL OR gender = '')));
      ELSE
        v_row := jsonb_build_object('from_class', v_cls.name, 'from_section', v_sec.name, 'to_class', COALESCE(v_next_cls.name, 'Unknown'),
          'to_section', v_sec.name, 'gender_split', FALSE, 'total_students', jsonb_array_length(v_students_arr));
      END IF;
      v_transitions := v_transitions || v_row;
      IF LOWER(TRIM(COALESCE(v_next_cls.name, ''))) = 'examinee' THEN v_total_examinee := v_total_examinee + jsonb_array_length(v_students_arr);
      ELSE v_total_promote := v_total_promote + jsonb_array_length(v_students_arr); END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('current_academic_year', v_current_year, 'next_academic_year', v_next_year, 'already_promoted', v_already_promoted,
    'transitions', v_transitions, 'examinee_to_archive', v_archive_list, 'total_promote', v_total_promote, 'total_new_examinee', v_total_examinee, 'total_archive', v_total_archive);
END; $$;

CREATE OR REPLACE FUNCTION perform_yearly_promotion(p_target_year TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_school RECORD; v_current_year TEXT; v_next_year TEXT; v_examinee_class_id UUID;
  v_gender_split_class_id UUID; v_gender_split_nv INTEGER; v_cls RECORD; v_next_cls_id UUID;
  v_sec RECORD; v_stu RECORD; v_target_section_id UUID; v_boys_section_id UUID; v_girls_section_id UUID;
  v_sorted_students RECORD; v_roll_counter INTEGER; v_promoted INTEGER := 0; v_archived INTEGER := 0;
  v_new_examinee INTEGER := 0; v_snapshot JSONB; v_log_id UUID; v_marks_snap JSONB; v_is_class_ten BOOLEAN;
BEGIN
  SELECT id, current_academic_year, last_promotion_year, gender_split_class_id INTO v_school FROM school_info LIMIT 1;
  IF v_school.id IS NULL THEN RAISE EXCEPTION 'School info not configured'; END IF;
  v_current_year := COALESCE(v_school.current_academic_year, EXTRACT(YEAR FROM NOW())::TEXT);
  IF v_school.last_promotion_year IS NOT NULL AND v_school.last_promotion_year = v_current_year THEN
    RAISE EXCEPTION 'Promotion already completed for year %. Cannot run twice.', v_current_year;
  END IF;
  v_next_year := COALESCE(p_target_year, (COALESCE(v_current_year::INTEGER, EXTRACT(YEAR FROM NOW())::INTEGER) + 1)::TEXT);
  v_gender_split_class_id := v_school.gender_split_class_id;
  IF v_gender_split_class_id IS NOT NULL THEN SELECT numeric_value INTO v_gender_split_nv FROM classes WHERE id = v_gender_split_class_id; END IF;
  SELECT jsonb_build_object('students', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'student_id', s.student_id, 'class_id', s.class_id, 'section_id', s.section_id,
    'roll', s.roll, 'name', s.name, 'gender', s.gender, 'father_name', s.father_name, 'mother_name', s.mother_name, 'date_of_birth', s.date_of_birth,
    'phone', s.phone, 'address', s.address, 'blood_group', s.blood_group, 'group_name', s.group_name)) FROM students s), '[]'::jsonb),
    'school_info', jsonb_build_object('current_academic_year', v_school.current_academic_year, 'last_promotion_year', v_school.last_promotion_year)) INTO v_snapshot;
  SELECT id INTO v_examinee_class_id FROM classes WHERE LOWER(TRIM(name)) = 'examinee';
  IF v_examinee_class_id IS NULL THEN INSERT INTO classes (name, numeric_value) VALUES ('Examinee', 999) RETURNING id INTO v_examinee_class_id; END IF;
  FOR v_stu IN SELECT s.*, sec.name AS section_name, c.name AS class_name FROM students s JOIN sections sec ON sec.id = s.section_id JOIN classes c ON c.id = s.class_id WHERE s.class_id = v_examinee_class_id
  LOOP
    SELECT COALESCE(jsonb_agg(jsonb_build_object('exam_id', m.exam_id, 'subject_id', m.subject_id, 'academic_year', m.academic_year, 'theory', m.theory, 'mcq', m.mcq, 'practical', m.practical, 'total', m.total)), '[]'::jsonb) INTO v_marks_snap FROM marks m WHERE m.student_id = v_stu.id;
    INSERT INTO archived_students (original_student_id, student_id_text, class_name, section_name, roll, name, gender, father_name, mother_name, date_of_birth, phone, address, blood_group, group_name, final_total_marks, final_total_full_marks, final_gpa, final_grade, final_position, marks_snapshot, old_class_id, old_section_id, archived_year)
    SELECT v_stu.id, v_stu.student_id, v_stu.class_name, v_stu.section_name, v_stu.roll, v_stu.name, v_stu.gender, v_stu.father_name, v_stu.mother_name, v_stu.date_of_birth, v_stu.phone, v_stu.address, v_stu.blood_group, v_stu.group_name, COALESCE(fr.total_marks, 0), COALESCE(fr.total_full_marks, 0), COALESCE(fr.gpa, 0), COALESCE(fr.grade, ''), fr.position, v_marks_snap, v_stu.class_id, v_stu.section_id, v_current_year
    FROM (SELECT 1) AS dummy LEFT JOIN final_results fr ON fr.student_id = v_stu.id AND fr.academic_year = v_current_year;
    DELETE FROM students WHERE id = v_stu.id; v_archived := v_archived + 1;
  END LOOP;
  FOR v_cls IN SELECT c.id, c.name, c.numeric_value FROM classes c WHERE c.numeric_value IS NOT NULL AND LOWER(TRIM(c.name)) != 'examinee' ORDER BY c.numeric_value DESC
  LOOP
    v_is_class_ten := (v_cls.numeric_value = 10) OR LOWER(TRIM(v_cls.name)) IN ('10', 'ten', 'class 10');
    IF v_is_class_ten THEN v_next_cls_id := v_examinee_class_id;
    ELSE SELECT id INTO v_next_cls_id FROM classes WHERE numeric_value = v_cls.numeric_value + 1 AND LOWER(TRIM(name)) != 'examinee';
      IF v_next_cls_id IS NULL THEN CONTINUE; END IF;
    END IF;
    FOR v_sec IN SELECT sec.id, sec.name FROM sections sec WHERE sec.class_id = v_cls.id ORDER BY sec.name
    LOOP
      IF v_gender_split_class_id IS NOT NULL AND v_gender_split_nv IS NOT NULL AND (SELECT numeric_value FROM classes WHERE id = v_next_cls_id) >= v_gender_split_nv AND v_next_cls_id != v_examinee_class_id THEN
        SELECT id INTO v_boys_section_id FROM sections WHERE class_id = v_next_cls_id AND LOWER(TRIM(name)) = 'boys';
        IF v_boys_section_id IS NULL THEN INSERT INTO sections (class_id, name) VALUES (v_next_cls_id, 'Boys') RETURNING id INTO v_boys_section_id; END IF;
        SELECT id INTO v_girls_section_id FROM sections WHERE class_id = v_next_cls_id AND LOWER(TRIM(name)) = 'girls';
        IF v_girls_section_id IS NULL THEN INSERT INTO sections (class_id, name) VALUES (v_next_cls_id, 'Girls') RETURNING id INTO v_girls_section_id; END IF;
        v_roll_counter := COALESCE((SELECT MAX(s.roll::INTEGER) FROM students s WHERE s.class_id = v_next_cls_id AND s.section_id = v_boys_section_id), 0);
        FOR v_sorted_students IN SELECT s.id FROM students s LEFT JOIN final_results fr ON fr.student_id = s.id AND fr.class_id = v_cls.id AND fr.academic_year = v_current_year WHERE s.class_id = v_cls.id AND s.section_id = v_sec.id AND s.gender = 'Male' ORDER BY COALESCE(fr.total_marks, -1) DESC, s.name ASC
        LOOP v_roll_counter := v_roll_counter + 1; UPDATE students SET class_id = v_next_cls_id, section_id = v_boys_section_id, roll = v_roll_counter::TEXT WHERE id = v_sorted_students.id; v_promoted := v_promoted + 1; END LOOP;
        v_roll_counter := COALESCE((SELECT MAX(s.roll::INTEGER) FROM students s WHERE s.class_id = v_next_cls_id AND s.section_id = v_girls_section_id), 0);
        FOR v_sorted_students IN SELECT s.id FROM students s LEFT JOIN final_results fr ON fr.student_id = s.id AND fr.class_id = v_cls.id AND fr.academic_year = v_current_year WHERE s.class_id = v_cls.id AND s.section_id = v_sec.id AND s.gender = 'Female' ORDER BY COALESCE(fr.total_marks, -1) DESC, s.name ASC
        LOOP v_roll_counter := v_roll_counter + 1; UPDATE students SET class_id = v_next_cls_id, section_id = v_girls_section_id, roll = v_roll_counter::TEXT WHERE id = v_sorted_students.id; v_promoted := v_promoted + 1; END LOOP;
        SELECT id INTO v_target_section_id FROM sections WHERE class_id = v_next_cls_id AND name = v_sec.name;
        IF v_target_section_id IS NULL THEN INSERT INTO sections (class_id, name) VALUES (v_next_cls_id, v_sec.name) RETURNING id INTO v_target_section_id; END IF;
        v_roll_counter := COALESCE((SELECT MAX(s.roll::INTEGER) FROM students s WHERE s.class_id = v_next_cls_id AND s.section_id = v_target_section_id), 0);
        FOR v_sorted_students IN SELECT s.id FROM students s LEFT JOIN final_results fr ON fr.student_id = s.id AND fr.class_id = v_cls.id AND fr.academic_year = v_current_year WHERE s.class_id = v_cls.id AND s.section_id = v_sec.id AND (s.gender IS NULL OR s.gender = '') ORDER BY COALESCE(fr.total_marks, -1) DESC, s.name ASC
        LOOP v_roll_counter := v_roll_counter + 1; UPDATE students SET class_id = v_next_cls_id, section_id = v_target_section_id, roll = v_roll_counter::TEXT WHERE id = v_sorted_students.id; v_promoted := v_promoted + 1; END LOOP;
      ELSE
        SELECT id INTO v_target_section_id FROM sections WHERE class_id = v_next_cls_id AND name = v_sec.name;
        IF v_target_section_id IS NULL THEN INSERT INTO sections (class_id, name) VALUES (v_next_cls_id, v_sec.name) RETURNING id INTO v_target_section_id; END IF;
        v_roll_counter := 0;
        FOR v_sorted_students IN SELECT s.id FROM students s LEFT JOIN final_results fr ON fr.student_id = s.id AND fr.class_id = v_cls.id AND fr.academic_year = v_current_year WHERE s.class_id = v_cls.id AND s.section_id = v_sec.id ORDER BY COALESCE(fr.total_marks, -1) DESC, s.name ASC
        LOOP v_roll_counter := v_roll_counter + 1; UPDATE students SET class_id = v_next_cls_id, section_id = v_target_section_id, roll = v_roll_counter::TEXT WHERE id = v_sorted_students.id;
          IF v_next_cls_id = v_examinee_class_id THEN v_new_examinee := v_new_examinee + 1; END IF; v_promoted := v_promoted + 1;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  UPDATE school_info SET current_academic_year = v_next_year, last_promotion_year = v_current_year WHERE id = v_school.id;
  INSERT INTO promotion_logs (academic_year_from, academic_year_to, promoted_count, archived_count, examinee_count, snapshot)
  VALUES (v_current_year, v_next_year, v_promoted, v_archived, v_new_examinee, v_snapshot) RETURNING id INTO v_log_id;
  RETURN jsonb_build_object('success', TRUE, 'promotion_log_id', v_log_id, 'promoted', v_promoted, 'archived', v_archived, 'new_examinee', v_new_examinee, 'academic_year_from', v_current_year, 'academic_year_to', v_next_year);
END; $$;

CREATE OR REPLACE FUNCTION undo_yearly_promotion(p_log_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_log RECORD; v_stu JSONB; v_school_snap JSONB; v_restored INTEGER := 0;
BEGIN
  SELECT * INTO v_log FROM promotion_logs WHERE id = p_log_id;
  IF v_log.id IS NULL THEN RAISE EXCEPTION 'Promotion log not found'; END IF;
  IF v_log.is_undone THEN RAISE EXCEPTION 'This promotion has already been undone'; END IF;
  IF v_log.performed_at < NOW() - INTERVAL '24 hours' THEN RAISE EXCEPTION 'Undo window expired. Promotion can only be undone within 24 hours.'; END IF;
  v_school_snap := v_log.snapshot -> 'school_info';
  UPDATE school_info SET current_academic_year = v_school_snap ->> 'current_academic_year', last_promotion_year = v_school_snap ->> 'last_promotion_year';
  DELETE FROM archived_students WHERE archived_year = v_log.academic_year_from;
  FOR v_stu IN SELECT * FROM jsonb_array_elements(v_log.snapshot -> 'students')
  LOOP
    IF EXISTS (SELECT 1 FROM students WHERE id = (v_stu ->> 'id')::UUID) THEN
      UPDATE students SET class_id = (v_stu ->> 'class_id')::UUID, section_id = (v_stu ->> 'section_id')::UUID, roll = v_stu ->> 'roll' WHERE id = (v_stu ->> 'id')::UUID;
    ELSE
      INSERT INTO students (id, student_id, class_id, section_id, roll, name, gender, father_name, mother_name, date_of_birth, phone, address, blood_group, group_name)
      VALUES ((v_stu ->> 'id')::UUID, v_stu ->> 'student_id', (v_stu ->> 'class_id')::UUID, (v_stu ->> 'section_id')::UUID, v_stu ->> 'roll', v_stu ->> 'name',
        COALESCE(v_stu ->> 'gender', ''), COALESCE(v_stu ->> 'father_name', ''), COALESCE(v_stu ->> 'mother_name', ''), COALESCE(v_stu ->> 'date_of_birth', ''),
        COALESCE(v_stu ->> 'phone', ''), COALESCE(v_stu ->> 'address', ''), COALESCE(v_stu ->> 'blood_group', ''), v_stu ->> 'group_name')
      ON CONFLICT (id) DO UPDATE SET class_id = EXCLUDED.class_id, section_id = EXCLUDED.section_id, roll = EXCLUDED.roll;
    END IF;
    v_restored := v_restored + 1;
  END LOOP;
  UPDATE promotion_logs SET is_undone = TRUE, undone_at = NOW() WHERE id = p_log_id;
  RETURN jsonb_build_object('success', TRUE, 'restored', v_restored, 'academic_year_restored', v_school_snap ->> 'current_academic_year');
END; $$;
