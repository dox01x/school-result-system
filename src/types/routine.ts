// Routine module TypeScript type definitions

export interface RoutineSettings {
  id: string;
  working_days: string[];
  periods_per_day: number;
  period_duration_minutes: number;
  period_durations: number[];
  break_after_period: number;
  break_duration_minutes: number;
  class_start_time: string;
  created_at: string;
  updated_at: string;
}

export interface RoutinePeriodWithDetails {
  id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  room_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
  // Joined fields
  subject_name?: string;
  teacher_name?: string;
  room_name?: string;
  class_name?: string;
  section_name?: string;
}

// A teacher's full weekly schedule
export interface TeacherScheduleEntry {
  day_of_week: number;
  start_time: string;
  end_time: string;
  class_name: string;
  section_name: string;
  subject_name: string;
  room_name?: string;
}

export interface TeacherWeeklySchedule {
  teacher_id: string;
  teacher_name: string;
  teacher_phone: string;
  teacher_designation: string;
  schedule: TeacherScheduleEntry[];
}

// Conflict detection
export interface ConflictEntry {
  teacher_id: string;
  teacher_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  conflicting_entries: {
    class_name: string;
    section_name: string;
    subject_name: string;
    start_time: string;
    end_time: string;
  }[];
}

export interface ConflictCheckResult {
  has_conflict: boolean;
  conflicts: ConflictEntry[];
}

// Re-export from shared types to avoid duplication
export type { ApiResponse } from "./finance";
