-- Seed data for development and testing

-- 1. School Profile
INSERT INTO public.school_info (id, name, address, phone, email, academic_year)
VALUES (1, 'EduPulse Model Academy', 'House 12, Road 4, Dhanmondi, Dhaka', '+880 1700-000000', 'contact@edupulse.edu.bd', '2026')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  academic_year = EXCLUDED.academic_year;

-- 2. Classes
INSERT INTO public.classes (id, name)
VALUES 
  ('c1111111-1111-1111-1111-111111111111', 'Class 6'),
  ('c2222222-2222-2222-2222-222222222222', 'Class 7'),
  ('c3333333-3333-3333-3333-333333333333', 'Class 8'),
  ('c4444444-4444-4444-4444-444444444444', 'Class 9'),
  ('c5555555-5555-5555-5555-555555555555', 'Class 10')
ON CONFLICT (id) DO NOTHING;

-- 3. Sections
INSERT INTO public.sections (id, name, class_id)
VALUES 
  ('s1111111-1111-1111-1111-111111111111', 'A', 'c1111111-1111-1111-1111-111111111111'),
  ('s2222222-2222-2222-2222-222222222222', 'B', 'c1111111-1111-1111-1111-111111111111'),
  ('s3333333-3333-3333-3333-333333333333', 'A', 'c2222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

-- 4. Subjects
INSERT INTO public.subjects (id, name, code, full_marks, pass_marks)
VALUES
  ('sub11111-1111-1111-1111-111111111111', 'Bangla 1st Paper', '101', 100, 33),
  ('sub22222-2222-2222-2222-222222222222', 'English 1st Paper', '107', 100, 33),
  ('sub33333-3333-3333-3333-333333333333', 'General Mathematics', '109', 100, 33),
  ('sub44444-4444-4444-4444-444444444444', 'General Science', '127', 100, 33)
ON CONFLICT (id) DO NOTHING;
