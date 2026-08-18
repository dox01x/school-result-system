export type UserRole =
  | "super_admin"
  | "admin"
  | "exam_controller"
  | "class_teacher"
  | "accountant"
  | "viewer";

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  phone_number?: string | null;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuthSession {
  user: {
    id: string;
    email?: string | null;
    role?: UserRole;
  } | null;
  token?: string | null;
}

export interface ClassTeacherAssignment {
  class_id: string;
  section_id: string;
  class_name?: string;
  section_name?: string;
}
