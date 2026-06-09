-- ═══════════════════════════════════════════
-- RBAC Migration — Run this in Supabase SQL Editor
-- Adds role-based access control to profiles + class teacher assignments
-- ═══════════════════════════════════════════

-- Step 1: Drop existing constraint and update roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'exam_controller', 'accountant', 'class_teacher'));

-- Step 2: Upgrade the first registered user to super_admin
-- (the user with the earliest created_at in auth.users who has a profile)
UPDATE profiles SET role = 'super_admin'
WHERE id = (
  SELECT p.id FROM profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY u.created_at ASC
  LIMIT 1
);

-- Step 3: Create class_teacher_assignments table
CREATE TABLE IF NOT EXISTS class_teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, section_id)  -- one class teacher per section
);

CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_user ON class_teacher_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_class ON class_teacher_assignments(class_id, section_id);

-- Step 4: Enable RLS on new table
ALTER TABLE class_teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Only super_admin and admin can manage class teacher assignments
CREATE POLICY "cta_select" ON class_teacher_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "cta_insert" ON class_teacher_assignments FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "cta_update" ON class_teacher_assignments FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "cta_delete" ON class_teacher_assignments FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'));

-- Step 5: Update profiles RLS — allow super_admin to read/manage all profiles
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- Everyone can read their own profile; super_admin can read all
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.profile_role() = 'super_admin');

-- Own user can update their full_name; super_admin can update any profile
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.profile_role() = 'super_admin')
  WITH CHECK (auth.uid() = id OR public.profile_role() = 'super_admin');

-- super_admin can insert profiles (for creating users)
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() = 'super_admin');

-- Step 6: Update handle_new_user to default to 'admin' (super_admin upgrades first user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (NEW.id, 'admin', COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

-- Step 7: Update profile_role function to return the new role values
CREATE OR REPLACE FUNCTION public.profile_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
