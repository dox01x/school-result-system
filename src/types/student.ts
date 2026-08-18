export interface Student {
  id: string;
  student_id?: string | null;
  name: string;
  roll: string;
  roll_number?: number | string;
  class_id: string;
  section_id: string;
  father_name?: string | null;
  mother_name?: string | null;
  guardian_name?: string | null;
  phone?: string | null;
  guardian_phone?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  blood_group?: string | null;
  address?: string | null;
  photo_url?: string | null;
  group_name?: string | null;
  status?: string | null;
  classes?: { id?: string; name: string; numeric_value?: number | null } | null;
  sections?: { id?: string; name: string; class_id?: string } | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClassItem {
  id: string;
  name: string;
  numeric_value?: number | null;
  code?: string | null;
  display_order?: number;
  sections?: SectionItem[];
  created_at?: string;
}

export interface SectionItem {
  id: string;
  name: string;
  class_id: string;
  capacity?: number;
  created_at?: string;
}

export interface SubjectItem {
  id: string;
  name: string;
  class_id?: string;
  full_marks?: number;
  pass_marks?: number;
  has_theory?: boolean;
  has_mcq?: boolean;
  has_practical?: boolean;
  theory_marks?: number;
  mcq_marks?: number;
  practical_marks?: number;
  is_optional?: boolean;
  group_name?: string | null;
  code?: string;
  created_at?: string;
}
