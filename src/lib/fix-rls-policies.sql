-- ═══════════════════════════════════════════════════════════════
-- RLS POLICY FIX — Supabase SQL Editor-এ পুরোটা একবারে Run করুন
-- ═══════════════════════════════════════════════════════════════

-- ─── Step 1: Recreate profile_role() function ───
CREATE OR REPLACE FUNCTION public.profile_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ─── Step 2: Drop ALL existing policies ───
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ─── Step 3: Recreate ALL policies correctly ───

-- school_info
CREATE POLICY "school_info_select" ON school_info FOR SELECT TO authenticated USING (true);
CREATE POLICY "school_info_modify" ON school_info FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "school_info_insert" ON school_info FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "school_info_delete" ON school_info FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'));

-- classes
CREATE POLICY "auth_rw_classes" ON classes FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = classes.id))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = classes.id))
);

-- sections
CREATE POLICY "auth_rw_sections" ON sections FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.section_id = sections.id))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.section_id = sections.id))
);

-- subjects
CREATE POLICY "auth_rw_subjects" ON subjects FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = subjects.class_id))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = subjects.class_id))
);

-- students
CREATE POLICY "auth_rw_students" ON students FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = students.class_id AND cta.section_id = students.section_id))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = students.class_id AND cta.section_id = students.section_id))
);

-- exams
CREATE POLICY "exams_select" ON exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "exams_modify" ON exams FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'));
CREATE POLICY "exams_update" ON exams FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'));
CREATE POLICY "exams_delete" ON exams FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'));

-- grading_rules
CREATE POLICY "grading_rules_select" ON grading_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "grading_rules_modify" ON grading_rules FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'));
CREATE POLICY "grading_rules_update" ON grading_rules FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'));
CREATE POLICY "grading_rules_delete" ON grading_rules FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'));

-- exam_subject_config
CREATE POLICY "exam_subject_config_select" ON exam_subject_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "exam_subject_config_modify" ON exam_subject_config FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'));
CREATE POLICY "exam_subject_config_update" ON exam_subject_config FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'));
CREATE POLICY "exam_subject_config_delete" ON exam_subject_config FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'));

-- marks
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

-- results
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

-- final_results
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

-- final_result_details
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

-- archived_students
CREATE POLICY "archived_students_select" ON archived_students FOR SELECT TO authenticated USING (true);
CREATE POLICY "archived_students_modify" ON archived_students FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "archived_students_update" ON archived_students FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "archived_students_delete" ON archived_students FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'));

-- sheet_configs
CREATE POLICY "auth_rw_sheet_configs" ON sheet_configs FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = sheet_configs.class_id AND cta.section_id = sheet_configs.section_id))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = sheet_configs.class_id AND cta.section_id = sheet_configs.section_id))
);

-- teachers
CREATE POLICY "teachers_select" ON teachers FOR SELECT TO authenticated USING (true);
CREATE POLICY "teachers_modify" ON teachers FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "teachers_update" ON teachers FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "teachers_delete" ON teachers FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'));

-- rooms
CREATE POLICY "rooms_select" ON rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "rooms_modify" ON rooms FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "rooms_update" ON rooms FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "rooms_delete" ON rooms FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'));

-- class_routines
CREATE POLICY "class_routines_select" ON class_routines FOR SELECT TO authenticated USING (true);
CREATE POLICY "class_routines_modify" ON class_routines FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "class_routines_update" ON class_routines FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "class_routines_delete" ON class_routines FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'));

-- exam_schedules
CREATE POLICY "exam_schedules_select" ON exam_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "exam_schedules_modify" ON exam_schedules FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'));
CREATE POLICY "exam_schedules_update" ON exam_schedules FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'));
CREATE POLICY "exam_schedules_delete" ON exam_schedules FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'exam_controller'));

-- teacher_shifts
CREATE POLICY "teacher_shifts_select" ON teacher_shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "teacher_shifts_modify" ON teacher_shifts FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "teacher_shifts_update" ON teacher_shifts FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "teacher_shifts_delete" ON teacher_shifts FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'));

-- leave_requests
CREATE POLICY "leave_requests_select" ON leave_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "leave_requests_modify" ON leave_requests FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "leave_requests_update" ON leave_requests FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "leave_requests_delete" ON leave_requests FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'));

-- notices
CREATE POLICY "notices_select" ON notices FOR SELECT TO authenticated USING (true);
CREATE POLICY "notices_modify" ON notices FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "notices_update" ON notices FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "notices_delete" ON notices FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'));

-- routine_settings
CREATE POLICY "routine_settings_select" ON routine_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "routine_settings_modify" ON routine_settings FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "routine_settings_update" ON routine_settings FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "routine_settings_delete" ON routine_settings FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'));

-- proxy_assignments
CREATE POLICY "proxy_assignments_select" ON proxy_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "proxy_assignments_modify" ON proxy_assignments FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "proxy_assignments_update" ON proxy_assignments FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "proxy_assignments_delete" ON proxy_assignments FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'));

-- attendance_records
CREATE POLICY "auth_rw_attendance_records" ON attendance_records FOR ALL TO authenticated USING (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = attendance_records.class_id AND cta.section_id = attendance_records.section_id))
) WITH CHECK (
  public.profile_role() IN ('super_admin', 'admin', 'exam_controller', 'accountant') OR
  (public.profile_role() = 'class_teacher' AND EXISTS (SELECT 1 FROM class_teacher_assignments cta WHERE cta.user_id = auth.uid() AND cta.class_id = attendance_records.class_id AND cta.section_id = attendance_records.section_id))
);

-- promotion_logs
CREATE POLICY "promotion_logs_select" ON promotion_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "promotion_logs_modify" ON promotion_logs FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "promotion_logs_update" ON promotion_logs FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "promotion_logs_delete" ON promotion_logs FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'));

-- profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.profile_role() = 'super_admin');
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.profile_role() = 'super_admin')
  WITH CHECK (auth.uid() = id OR public.profile_role() = 'super_admin');
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() = 'super_admin');
CREATE POLICY "profiles_delete" ON profiles FOR DELETE TO authenticated
  USING (public.profile_role() = 'super_admin');

-- class_teacher_assignments
CREATE POLICY "cta_select" ON class_teacher_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "cta_write" ON class_teacher_assignments FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "cta_update" ON class_teacher_assignments FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin'));
CREATE POLICY "cta_delete" ON class_teacher_assignments FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin'));

-- ═══════════════════════════════════════════
-- FINANCE POLICIES (super_admin + admin + accountant)
-- ═══════════════════════════════════════════

-- fee_structure
CREATE POLICY "finance_fee_select" ON fee_structure FOR SELECT TO authenticated USING (true);
CREATE POLICY "finance_fee_write" ON fee_structure FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
CREATE POLICY "finance_fee_update" ON fee_structure FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
CREATE POLICY "finance_fee_delete" ON fee_structure FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'));

-- tuition_payments
CREATE POLICY "finance_tuition_all" ON tuition_payments FOR ALL TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));

-- salary_payments
CREATE POLICY "finance_salary_all" ON salary_payments FOR ALL TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));

-- income_entries
CREATE POLICY "finance_income_all" ON income_entries FOR ALL TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));

-- expense_entries
CREATE POLICY "finance_expense_all" ON expense_entries FOR ALL TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));

-- staff_salary_config
CREATE POLICY "finance_staff_config_select" ON staff_salary_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "finance_staff_config_write" ON staff_salary_config FOR INSERT TO authenticated
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
CREATE POLICY "finance_staff_config_update" ON staff_salary_config FOR UPDATE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'))
  WITH CHECK (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
CREATE POLICY "finance_staff_config_delete" ON staff_salary_config FOR DELETE TO authenticated
  USING (public.profile_role() IN ('super_admin', 'admin', 'accountant'));
