export type ExamStatus = "draft" | "scheduled" | "in_progress" | "completed" | "published";
export type ExamType = "mct" | "semester" | "standalone";

export interface Exam {
  id: string;
  name: string;
  exam_type?: string;
  term?: number | string | null;
  academic_year?: string;
  start_date?: string | null;
  end_date?: string | null;
  is_published?: boolean;
  status?: ExamStatus;
  created_at?: string;
  updated_at?: string;
}

export interface ExamRoom {
  id: string;
  name?: string;
  room_number?: string;
  capacity: number;
  building?: string | null;
  floor?: string | null;
  created_at?: string;
}

export interface ExamSchedule {
  id: string;
  exam_id: string;
  class_id: string;
  subject_id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room_id?: string | null;
  room_number?: string | null;
  created_at?: string;
}

export interface ExamDuty {
  id: string;
  exam_id: string;
  teacher_id: string;
  room_id?: string | null;
  exam_date?: string;
  duty_date?: string;
  start_time?: string;
  end_time?: string;
  shift?: string | null;
  room_number?: string | null;
  created_at?: string;
}
