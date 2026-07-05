export type Database = {
    public: {
        Tables: {
            school_info: {
                Row: {
                    id: string;
                    name: string;
                    address: string;
                    phone: string;
                    email: string;
                    logo_url: string;
                    principal_name: string;
                    established_year: string;
                    current_academic_year: string;
                    last_promotion_year: string;
                    detailed_marks: boolean;
                    gender_split_class_id: string | null;
                    created_at?: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    name?: string;
                    address?: string;
                    phone?: string;
                    email?: string;
                    logo_url?: string;
                    principal_name?: string;
                    established_year?: string;
                    current_academic_year?: string;
                    last_promotion_year?: string;
                    detailed_marks?: boolean;
                    gender_split_class_id?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    address?: string;
                    phone?: string;
                    email?: string;
                    logo_url?: string;
                    principal_name?: string;
                    established_year?: string;
                    current_academic_year?: string;
                    last_promotion_year?: string;
                    detailed_marks?: boolean;
                    gender_split_class_id?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            classes: {
                Row: {
                    id: string;
                    name: string;
                    numeric_value: number | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    numeric_value?: number | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    numeric_value?: number | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            sections: {
                Row: {
                    id: string;
                    class_id: string;
                    name: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    class_id: string;
                    name: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    class_id?: string;
                    name?: string;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "sections_class_id_fkey";
                        columns: ["class_id"];
                        isOneToOne: false;
                        referencedRelation: "classes";
                        referencedColumns: ["id"];
                    }
                ];
            };
            subjects: {
                Row: {
                    id: string;
                    class_id: string;
                    name: string;
                    full_marks: number;
                    pass_marks: number;
                    has_theory: boolean;
                    has_mcq: boolean;
                    has_practical: boolean;
                    theory_marks: number;
                    mcq_marks: number;
                    practical_marks: number;
                    is_optional: boolean;
                    group_name: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    class_id: string;
                    name: string;
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
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    class_id?: string;
                    name?: string;
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
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "subjects_class_id_fkey";
                        columns: ["class_id"];
                        isOneToOne: false;
                        referencedRelation: "classes";
                        referencedColumns: ["id"];
                    }
                ];
            };
            students: {
                Row: {
                    id: string;
                    student_id: string | null;
                    class_id: string;
                    section_id: string;
                    roll: string;
                    name: string;
                    gender: string;
                    father_name: string;
                    mother_name: string;
                    date_of_birth: string;
                    phone: string;
                    address: string;
                    blood_group: string;
                    group_name: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    student_id?: string | null;
                    class_id: string;
                    section_id: string;
                    roll: string;
                    name: string;
                    gender?: string;
                    father_name?: string;
                    mother_name?: string;
                    date_of_birth?: string;
                    phone?: string;
                    address?: string;
                    blood_group?: string;
                    group_name?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    student_id?: string | null;
                    class_id?: string;
                    section_id?: string;
                    roll?: string;
                    name?: string;
                    gender?: string;
                    father_name?: string;
                    mother_name?: string;
                    date_of_birth?: string;
                    phone?: string;
                    address?: string;
                    blood_group?: string;
                    group_name?: string | null;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "students_class_id_fkey";
                        columns: ["class_id"];
                        isOneToOne: false;
                        referencedRelation: "classes";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "students_section_id_fkey";
                        columns: ["section_id"];
                        isOneToOne: false;
                        referencedRelation: "sections";
                        referencedColumns: ["id"];
                    }
                ];
            };
            exams: {
                Row: {
                    id: string;
                    name: string;
                    exam_type: string;
                    term: number | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    exam_type: string;
                    term?: number | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    exam_type?: string;
                    term?: number | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            grading_rules: {
                Row: {
                    id: string;
                    marks_category: number;
                    min_marks: number;
                    max_marks: number;
                    grade: string;
                    grade_point: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    marks_category?: number;
                    min_marks: number;
                    max_marks: number;
                    grade: string;
                    grade_point: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    marks_category?: number;
                    min_marks?: number;
                    max_marks?: number;
                    grade?: string;
                    grade_point?: number;
                    created_at?: string;
                };
                Relationships: [];
            };
            exam_subject_config: {
                Row: {
                    id: string;
                    exam_id: string;
                    subject_id: string;
                    full_marks: number;
                    weight_percent: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    exam_id: string;
                    subject_id: string;
                    full_marks?: number;
                    weight_percent?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    exam_id?: string;
                    subject_id?: string;
                    full_marks?: number;
                    weight_percent?: number;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "exam_subject_config_exam_id_fkey";
                        columns: ["exam_id"];
                        isOneToOne: false;
                        referencedRelation: "exams";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "exam_subject_config_subject_id_fkey";
                        columns: ["subject_id"];
                        isOneToOne: false;
                        referencedRelation: "subjects";
                        referencedColumns: ["id"];
                    }
                ];
            };
            marks: {
                Row: {
                    id: string;
                    student_id: string;
                    subject_id: string;
                    exam_id: string;
                    academic_year: string;
                    theory: number | null;
                    mcq: number | null;
                    practical: number | null;
                    total: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    student_id: string;
                    subject_id: string;
                    exam_id: string;
                    academic_year?: string;
                    theory?: number | null;
                    mcq?: number | null;
                    practical?: number | null;
                    total?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    student_id?: string;
                    subject_id?: string;
                    exam_id?: string;
                    academic_year?: string;
                    theory?: number | null;
                    mcq?: number | null;
                    practical?: number | null;
                    total?: number;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "marks_student_id_fkey";
                        columns: ["student_id"];
                        isOneToOne: false;
                        referencedRelation: "students";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "marks_subject_id_fkey";
                        columns: ["subject_id"];
                        isOneToOne: false;
                        referencedRelation: "subjects";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "marks_exam_id_fkey";
                        columns: ["exam_id"];
                        isOneToOne: false;
                        referencedRelation: "exams";
                        referencedColumns: ["id"];
                    }
                ];
            };
            results: {
                Row: {
                    id: string;
                    student_id: string;
                    exam_id: string;
                    academic_year: string;
                    total_marks: number;
                    total_full_marks: number;
                    percentage: number;
                    gpa: number;
                    grade: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    student_id: string;
                    exam_id: string;
                    academic_year?: string;
                    total_marks?: number;
                    total_full_marks?: number;
                    percentage?: number;
                    gpa?: number;
                    grade?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    student_id?: string;
                    exam_id?: string;
                    academic_year?: string;
                    total_marks?: number;
                    total_full_marks?: number;
                    percentage?: number;
                    gpa?: number;
                    grade?: string;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "results_student_id_fkey";
                        columns: ["student_id"];
                        isOneToOne: false;
                        referencedRelation: "students";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "results_exam_id_fkey";
                        columns: ["exam_id"];
                        isOneToOne: false;
                        referencedRelation: "exams";
                        referencedColumns: ["id"];
                    }
                ];
            };
            final_results: {
                Row: {
                    id: string;
                    student_id: string;
                    class_id: string;
                    academic_year: string;
                    total_marks: number;
                    total_full_marks: number;
                    percentage: number;
                    gpa: number;
                    grade: string;
                    position: number | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    student_id: string;
                    class_id: string;
                    academic_year?: string;
                    total_marks?: number;
                    total_full_marks?: number;
                    percentage?: number;
                    gpa?: number;
                    grade?: string;
                    position?: number | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    student_id?: string;
                    class_id?: string;
                    academic_year?: string;
                    total_marks?: number;
                    total_full_marks?: number;
                    percentage?: number;
                    gpa?: number;
                    grade?: string;
                    position?: number | null;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "final_results_student_id_fkey";
                        columns: ["student_id"];
                        isOneToOne: false;
                        referencedRelation: "students";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "final_results_class_id_fkey";
                        columns: ["class_id"];
                        isOneToOne: false;
                        referencedRelation: "classes";
                        referencedColumns: ["id"];
                    }
                ];
            };
            final_result_details: {
                Row: {
                    id: string;
                    final_result_id: string;
                    term: number;
                    percentage: number;
                    raw_marks: number;
                    raw_full_marks: number;
                    raw_gpa: number;
                    weighted_marks: number;
                    weighted_gpa: number;
                    grade: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    final_result_id: string;
                    term: number;
                    percentage?: number;
                    raw_marks?: number;
                    raw_full_marks?: number;
                    raw_gpa?: number;
                    weighted_marks?: number;
                    weighted_gpa?: number;
                    grade?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    final_result_id?: string;
                    term?: number;
                    percentage?: number;
                    raw_marks?: number;
                    raw_full_marks?: number;
                    raw_gpa?: number;
                    weighted_marks?: number;
                    weighted_gpa?: number;
                    grade?: string;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "final_result_details_final_result_id_fkey";
                        columns: ["final_result_id"];
                        isOneToOne: false;
                        referencedRelation: "final_results";
                        referencedColumns: ["id"];
                    }
                ];
            };
            sheet_configs: {
                Row: {
                    id: string;
                    type: string;
                    class_id: string;
                    section_id: string;
                    subject_id: string | null;
                    exam_id: string | null;
                    sheet_id: string;
                    sheet_range: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    type: string;
                    class_id: string;
                    section_id: string;
                    subject_id?: string | null;
                    exam_id?: string | null;
                    sheet_id: string;
                    sheet_range: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    type?: string;
                    class_id?: string;
                    section_id?: string;
                    subject_id?: string | null;
                    exam_id?: string | null;
                    sheet_id?: string;
                    sheet_range?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "sheet_configs_class_id_fkey";
                        columns: ["class_id"];
                        isOneToOne: false;
                        referencedRelation: "classes";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "sheet_configs_section_id_fkey";
                        columns: ["section_id"];
                        isOneToOne: false;
                        referencedRelation: "sections";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "sheet_configs_subject_id_fkey";
                        columns: ["subject_id"];
                        isOneToOne: false;
                        referencedRelation: "subjects";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "sheet_configs_exam_id_fkey";
                        columns: ["exam_id"];
                        isOneToOne: false;
                        referencedRelation: "exams";
                        referencedColumns: ["id"];
                    }
                ];
            };
            attendance_records: {
                Row: {
                    id: string;
                    student_id: string;
                    class_id: string;
                    section_id: string;
                    att_date: string;
                    status: string;
                    source: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    student_id: string;
                    class_id: string;
                    section_id: string;
                    att_date: string;
                    status: string;
                    source?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    student_id?: string;
                    class_id?: string;
                    section_id?: string;
                    att_date?: string;
                    status?: string;
                    source?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "attendance_records_student_id_fkey";
                        columns: ["student_id"];
                        isOneToOne: false;
                        referencedRelation: "students";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "attendance_records_class_id_fkey";
                        columns: ["class_id"];
                        isOneToOne: false;
                        referencedRelation: "classes";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "attendance_records_section_id_fkey";
                        columns: ["section_id"];
                        isOneToOne: false;
                        referencedRelation: "sections";
                        referencedColumns: ["id"];
                    }
                ];
            };
        teachers: {
                Row: {
                    id: string;
                    name: string;
                    phone: string;
                    email: string;
                    subject_specialty: string;
                    designation: string;
                    employee_type: string | null;
                    proxy_count: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    phone?: string;
                    email?: string;
                    subject_specialty?: string;
                    designation?: string;
                    employee_type?: string | null;
                    proxy_count?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    phone?: string;
                    email?: string;
                    subject_specialty?: string;
                    designation?: string;
                    employee_type?: string | null;
                    proxy_count?: number;
                    created_at?: string;
                };
                Relationships: [];
            };
            staffs: {
                Row: {
                    id: string;
                    name: string;
                    phone: string;
                    email: string;
                    designation: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    phone?: string;
                    email?: string;
                    designation?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    phone?: string;
                    email?: string;
                    designation?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
            rooms: {
                Row: {
                    id: string;
                    name: string;
                    capacity: number;
                    room_type: string;
                    tables_count: number | null;
                    seats_per_table: number | null;
                    order_index: number | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    capacity?: number;
                    room_type?: string;
                    tables_count?: number | null;
                    seats_per_table?: number | null;
                    order_index?: number | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    capacity?: number;
                    room_type?: string;
                    tables_count?: number | null;
                    seats_per_table?: number | null;
                    order_index?: number | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            class_routines: {
                Row: {
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
                };
                Insert: {
                    id?: string;
                    class_id: string;
                    section_id: string;
                    subject_id: string;
                    teacher_id: string;
                    room_id?: string | null;
                    day_of_week: number;
                    start_time: string;
                    end_time: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    class_id?: string;
                    section_id?: string;
                    subject_id?: string;
                    teacher_id?: string;
                    room_id?: string | null;
                    day_of_week?: number;
                    start_time?: string;
                    end_time?: string;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "class_routines_class_id_fkey";
                        columns: ["class_id"];
                        isOneToOne: false;
                        referencedRelation: "classes";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "class_routines_section_id_fkey";
                        columns: ["section_id"];
                        isOneToOne: false;
                        referencedRelation: "sections";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "class_routines_subject_id_fkey";
                        columns: ["subject_id"];
                        isOneToOne: false;
                        referencedRelation: "subjects";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "class_routines_teacher_id_fkey";
                        columns: ["teacher_id"];
                        isOneToOne: false;
                        referencedRelation: "teachers";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "class_routines_room_id_fkey";
                        columns: ["room_id"];
                        isOneToOne: false;
                        referencedRelation: "rooms";
                        referencedColumns: ["id"];
                    }
                ];
            };
            exam_schedules: {
                Row: {
                    id: string;
                    exam_id: string;
                    class_id: string;
                    subject_id: string;
                    exam_date: string;
                    start_time: string;
                    end_time: string;
                    room_id: string | null;
                    invigilator_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    exam_id: string;
                    class_id: string;
                    subject_id: string;
                    exam_date: string;
                    start_time: string;
                    end_time: string;
                    room_id?: string | null;
                    invigilator_id?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    exam_id?: string;
                    class_id?: string;
                    subject_id?: string;
                    exam_date?: string;
                    start_time?: string;
                    end_time?: string;
                    room_id?: string | null;
                    invigilator_id?: string | null;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "exam_schedules_exam_id_fkey";
                        columns: ["exam_id"];
                        isOneToOne: false;
                        referencedRelation: "exams";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "exam_schedules_class_id_fkey";
                        columns: ["class_id"];
                        isOneToOne: false;
                        referencedRelation: "classes";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "exam_schedules_subject_id_fkey";
                        columns: ["subject_id"];
                        isOneToOne: false;
                        referencedRelation: "subjects";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "exam_schedules_room_id_fkey";
                        columns: ["room_id"];
                        isOneToOne: false;
                        referencedRelation: "rooms";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "exam_schedules_invigilator_id_fkey";
                        columns: ["invigilator_id"];
                        isOneToOne: false;
                        referencedRelation: "teachers";
                        referencedColumns: ["id"];
                    }
                ];
            };
            exam_seat_plans: {
                Row: {
                    id: string;
                    exam_id: string;
                    start_time: string;
                    end_time: string;
                    class_id: string;
                    section_id: string;
                    room_id: string;
                    allocated_students: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    exam_id: string;
                    start_time: string;
                    end_time: string;
                    class_id: string;
                    section_id: string;
                    room_id: string;
                    allocated_students: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    exam_id?: string;
                    start_time?: string;
                    end_time?: string;
                    class_id?: string;
                    section_id?: string;
                    room_id?: string;
                    allocated_students?: number;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "exam_seat_plans_exam_id_fkey";
                        columns: ["exam_id"];
                        isOneToOne: false;
                        referencedRelation: "exams";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "exam_seat_plans_class_id_fkey";
                        columns: ["class_id"];
                        isOneToOne: false;
                        referencedRelation: "classes";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "exam_seat_plans_section_id_fkey";
                        columns: ["section_id"];
                        isOneToOne: false;
                        referencedRelation: "sections";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "exam_seat_plans_room_id_fkey";
                        columns: ["room_id"];
                        isOneToOne: false;
                        referencedRelation: "rooms";
                        referencedColumns: ["id"];
                    }
                ];
            };
            exam_duties: {
                Row: {
                    id: string;
                    exam_id: string | null;
                    room_id: string;
                    teacher_id: string;
                    exam_date: string;
                    start_time: string;
                    end_time: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    exam_id?: string | null;
                    room_id: string;
                    teacher_id: string;
                    exam_date: string;
                    start_time: string;
                    end_time: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    exam_id?: string | null;
                    room_id?: string;
                    teacher_id?: string;
                    exam_date?: string;
                    start_time?: string;
                    end_time?: string;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "exam_duties_exam_id_fkey";
                        columns: ["exam_id"];
                        isOneToOne: false;
                        referencedRelation: "exams";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "exam_duties_room_id_fkey";
                        columns: ["room_id"];
                        isOneToOne: false;
                        referencedRelation: "rooms";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "exam_duties_teacher_id_fkey";
                        columns: ["teacher_id"];
                        isOneToOne: false;
                        referencedRelation: "teachers";
                        referencedColumns: ["id"];
                    }
                ];
            };
            exam_paper_distributions: {
                Row: {
                    id: string;
                    exam_id: string;
                    class_id: string;
                    section_id: string | null;
                    subject_id: string;
                    teacher_id: string;
                    total_copies: number;
                    date_given: string;
                    date_returned: string | null;
                    date_received_from_hall: string | null;
                    status: string;
                    notes: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    exam_id: string;
                    class_id: string;
                    section_id?: string | null;
                    subject_id: string;
                    teacher_id: string;
                    total_copies: number;
                    date_given: string;
                    date_returned?: string | null;
                    date_received_from_hall?: string | null;
                    status?: string;
                    notes?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    exam_id?: string;
                    class_id?: string;
                    section_id?: string | null;
                    subject_id?: string;
                    teacher_id?: string;
                    total_copies?: number;
                    date_given?: string;
                    date_returned?: string | null;
                    date_received_from_hall?: string | null;
                    status?: string;
                    notes?: string | null;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "exam_paper_distributions_exam_id_fkey";
                        columns: ["exam_id"];
                        isOneToOne: false;
                        referencedRelation: "exams";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "exam_paper_distributions_class_id_fkey";
                        columns: ["class_id"];
                        isOneToOne: false;
                        referencedRelation: "classes";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "exam_paper_distributions_section_id_fkey";
                        columns: ["section_id"];
                        isOneToOne: false;
                        referencedRelation: "sections";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "exam_paper_distributions_subject_id_fkey";
                        columns: ["subject_id"];
                        isOneToOne: false;
                        referencedRelation: "subjects";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "exam_paper_distributions_teacher_id_fkey";
                        columns: ["teacher_id"];
                        isOneToOne: false;
                        referencedRelation: "teachers";
                        referencedColumns: ["id"];
                    }
                ];
            };
            teacher_shifts: {
                Row: {
                    id: string;
                    teacher_id: string;
                    shift_date: string;
                    start_time: string;
                    end_time: string;
                    duty_type: string;
                    notes: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    teacher_id: string;
                    shift_date: string;
                    start_time: string;
                    end_time: string;
                    duty_type?: string;
                    notes?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    teacher_id?: string;
                    shift_date?: string;
                    start_time?: string;
                    end_time?: string;
                    duty_type?: string;
                    notes?: string;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "teacher_shifts_teacher_id_fkey";
                        columns: ["teacher_id"];
                        isOneToOne: false;
                        referencedRelation: "teachers";
                        referencedColumns: ["id"];
                    }
                ];
            };
            leave_requests: {
                Row: {
                    id: string;
                    teacher_id: string;
                    start_date: string;
                    end_date: string;
                    reason: string;
                    status: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    teacher_id: string;
                    start_date: string;
                    end_date: string;
                    reason?: string;
                    status?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    teacher_id?: string;
                    start_date?: string;
                    end_date?: string;
                    reason?: string;
                    status?: string;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "leave_requests_teacher_id_fkey";
                        columns: ["teacher_id"];
                        isOneToOne: false;
                        referencedRelation: "teachers";
                        referencedColumns: ["id"];
                    }
                ];
            };
            notices: {
                Row: {
                    id: string;
                    title: string;
                    content: string;
                    audience: string;
                    priority: string;
                    is_published: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    title: string;
                    content: string;
                    audience?: string;
                    priority?: string;
                    is_published?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    title?: string;
                    content?: string;
                    audience?: string;
                    priority?: string;
                    is_published?: boolean;
                    created_at?: string;
                };
                Relationships: [];
            };
            ai_curriculum_suggestions: {
                Row: {
                    id: string;
                    student_id: string;
                    subject: string;
                    suggestion_text: string;
                    created_at: string;
                    is_completed: boolean;
                };
                Insert: {
                    id?: string;
                    student_id: string;
                    subject: string;
                    suggestion_text: string;
                    created_at?: string;
                    is_completed?: boolean;
                };
                Update: {
                    id?: string;
                    student_id?: string;
                    subject?: string;
                    suggestion_text?: string;
                    created_at?: string;
                    is_completed?: boolean;
                };
                Relationships: [];
            };
            ai_weak_topics: {
                Row: {
                    id: string;
                    student_id: string;
                    subject: string;
                    topic: string;
                    weakness_score: number;
                    detected_at: string;
                    is_resolved: boolean;
                };
                Insert: {
                    id?: string;
                    student_id: string;
                    subject: string;
                    topic: string;
                    weakness_score?: number;
                    detected_at?: string;
                    is_resolved?: boolean;
                };
                Update: {
                    id?: string;
                    student_id?: string;
                    subject?: string;
                    topic?: string;
                    weakness_score?: number;
                    detected_at?: string;
                    is_resolved?: boolean;
                };
                Relationships: [];
            };
            ai_quizzes: {
                Row: {
                    id: string;
                    student_id: string;
                    subject: string;
                    topic: string;
                    difficulty: string;
                    questions: unknown;
                    created_at: string;
                    status: string;
                };
                Insert: {
                    id?: string;
                    student_id: string;
                    subject: string;
                    topic: string;
                    difficulty: string;
                    questions: unknown;
                    created_at?: string;
                    status?: string;
                };
                Update: {
                    id?: string;
                    student_id?: string;
                    subject?: string;
                    topic?: string;
                    difficulty?: string;
                    questions?: unknown;
                    created_at?: string;
                    status?: string;
                };
                Relationships: [];
            };
            ai_quiz_results: {
                Row: {
                    id: string;
                    quiz_id: string;
                    student_id: string;
                    answers: unknown;
                    score: number;
                    time_taken_seconds: number;
                    completed_at: string;
                };
                Insert: {
                    id?: string;
                    quiz_id: string;
                    student_id: string;
                    answers: unknown;
                    score?: number;
                    time_taken_seconds?: number;
                    completed_at?: string;
                };
                Update: {
                    id?: string;
                    quiz_id?: string;
                    student_id?: string;
                    answers?: unknown;
                    score?: number;
                    time_taken_seconds?: number;
                    completed_at?: string;
                };
                Relationships: [];
            };
            ai_progress_snapshots: {
                Row: {
                    id: string;
                    student_id: string;
                    snapshot_data: unknown;
                    ai_feedback: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    student_id: string;
                    snapshot_data?: unknown;
                    ai_feedback?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    student_id?: string;
                    snapshot_data?: unknown;
                    ai_feedback?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
            routine_settings: {
                Row: {
                    id: string;
                    working_days: string[];
                    periods_per_day: number;
                    period_duration_minutes: number;
                    period_durations: number[] | null;
                    break_after_period: number;
                    break_duration_minutes: number;
                    class_start_time: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    working_days?: string[];
                    periods_per_day?: number;
                    period_duration_minutes?: number;
                    period_durations?: number[] | null;
                    break_after_period?: number;
                    break_duration_minutes?: number;
                    class_start_time?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    working_days?: string[];
                    periods_per_day?: number;
                    period_duration_minutes?: number;
                    period_durations?: number[] | null;
                    break_after_period?: number;
                    break_duration_minutes?: number;
                    class_start_time?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            proxy_assignments: {
                Row: {
                    id: string;
                    leave_request_id: string | null;
                    routine_id: string;
                    assignment_date: string;
                    original_teacher_id: string;
                    proxy_teacher_id: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    leave_request_id?: string | null;
                    routine_id: string;
                    assignment_date: string;
                    original_teacher_id: string;
                    proxy_teacher_id: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    leave_request_id?: string | null;
                    routine_id?: string;
                    assignment_date?: string;
                    original_teacher_id?: string;
                    proxy_teacher_id?: string;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "proxy_assignments_leave_request_id_fkey";
                        columns: ["leave_request_id"];
                        isOneToOne: false;
                        referencedRelation: "leave_requests";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "proxy_assignments_routine_id_fkey";
                        columns: ["routine_id"];
                        isOneToOne: false;
                        referencedRelation: "class_routines";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "proxy_assignments_original_teacher_id_fkey";
                        columns: ["original_teacher_id"];
                        isOneToOne: false;
                        referencedRelation: "teachers";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "proxy_assignments_proxy_teacher_id_fkey";
                        columns: ["proxy_teacher_id"];
                        isOneToOne: false;
                        referencedRelation: "teachers";
                        referencedColumns: ["id"];
                    }
                ];
            };
            profiles: {
                Row: {
                    id: string;
                    role: string;
                    full_name: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    role?: string;
                    full_name?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    role?: string;
                    full_name?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            fee_structure: {
                Row: {
                    id: string;
                    class_name: string;
                    fee_type: string;
                    amount: number;
                    description: string | null;
                    academic_year: string;
                    is_active: boolean | null;
                    created_at: string | null;
                };
                Insert: {
                    id?: string;
                    class_name: string;
                    fee_type: string;
                    amount: number;
                    description?: string | null;
                    academic_year: string;
                    is_active?: boolean | null;
                    created_at?: string | null;
                };
                Update: {
                    id?: string;
                    class_name?: string;
                    fee_type?: string;
                    amount?: number;
                    description?: string | null;
                    academic_year?: string;
                    is_active?: boolean | null;
                    created_at?: string | null;
                };
                Relationships: [];
            };
            tuition_payments: {
                Row: {
                    id: string;
                    receipt_number: string;
                    student_id: string | null;
                    class_name: string;
                    section: string | null;
                    fee_type: string;
                    fee_details: unknown | null;
                    month: number | null;
                    year: number;
                    amount_due: number;
                    amount_paid: number;
                    discount: number | null;
                    fine: number | null;
                    payment_method: string | null;
                    collected_by: string | null;
                    payment_date: string | null;
                    note: string | null;
                    is_printed: boolean | null;
                };
                Insert: {
                    id?: string;
                    receipt_number: string;
                    student_id?: string | null;
                    class_name: string;
                    section?: string | null;
                    fee_type: string;
                    fee_details?: unknown | null;
                    month?: number | null;
                    year: number;
                    amount_due: number;
                    amount_paid: number;
                    discount?: number | null;
                    fine?: number | null;
                    payment_method?: string | null;
                    collected_by?: string | null;
                    payment_date?: string | null;
                    note?: string | null;
                    is_printed?: boolean | null;
                };
                Update: {
                    id?: string;
                    receipt_number?: string;
                    student_id?: string | null;
                    class_name?: string;
                    section?: string | null;
                    fee_type?: string;
                    fee_details?: unknown | null;
                    month?: number | null;
                    year?: number;
                    amount_due?: number;
                    amount_paid?: number;
                    discount?: number | null;
                    fine?: number | null;
                    payment_method?: string | null;
                    collected_by?: string | null;
                    payment_date?: string | null;
                    note?: string | null;
                    is_printed?: boolean | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "tuition_payments_student_id_fkey";
                        columns: ["student_id"];
                        isOneToOne: false;
                        referencedRelation: "students";
                        referencedColumns: ["id"];
                    }
                ];
            };
            salary_payments: {
                Row: {
                    id: string;
                    slip_number: string;
                    staff_id: string;
                    staff_type: string | null;
                    month: number;
                    year: number;
                    basic_salary: number;
                    allowances: unknown;
                    deductions: unknown;
                    gross_salary: number | null;
                    net_salary: number | null;
                    payment_method: string | null;
                    paid_by: string | null;
                    payment_date: string | null;
                    note: string | null;
                    is_printed: boolean | null;
                };
                Insert: {
                    id?: string;
                    slip_number: string;
                    staff_id: string;
                    staff_type?: string | null;
                    month: number;
                    year: number;
                    basic_salary: number;
                    allowances?: unknown;
                    deductions?: unknown;
                    gross_salary?: number | null;
                    net_salary?: number | null;
                    payment_method?: string | null;
                    paid_by?: string | null;
                    payment_date?: string | null;
                    note?: string | null;
                    is_printed?: boolean | null;
                };
                Update: {
                    id?: string;
                    slip_number?: string;
                    staff_id?: string;
                    staff_type?: string | null;
                    month?: number;
                    year?: number;
                    basic_salary?: number;
                    allowances?: unknown;
                    deductions?: unknown;
                    gross_salary?: number | null;
                    net_salary?: number | null;
                    payment_method?: string | null;
                    paid_by?: string | null;
                    payment_date?: string | null;
                    note?: string | null;
                    is_printed?: boolean | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "salary_payments_staff_id_fkey";
                        columns: ["staff_id"];
                        isOneToOne: false;
                        referencedRelation: "teachers";
                        referencedColumns: ["id"];
                    }
                ];
            };
            income_entries: {
                Row: {
                    id: string;
                    category: string;
                    amount: number;
                    description: string;
                    received_from: string | null;
                    payment_method: string | null;
                    received_by: string | null;
                    income_date: string;
                    academic_year: string | null;
                    month: number | null;
                    year: number | null;
                    created_at: string | null;
                };
                Insert: {
                    id?: string;
                    category: string;
                    amount: number;
                    description: string;
                    received_from?: string | null;
                    payment_method?: string | null;
                    received_by?: string | null;
                    income_date: string;
                    academic_year?: string | null;
                    month?: number | null;
                    year?: number | null;
                    created_at?: string | null;
                };
                Update: {
                    id?: string;
                    category?: string;
                    amount?: number;
                    description?: string;
                    received_from?: string | null;
                    payment_method?: string | null;
                    received_by?: string | null;
                    income_date?: string;
                    academic_year?: string | null;
                    month?: number | null;
                    year?: number | null;
                    created_at?: string | null;
                };
                Relationships: [];
            };
            expense_entries: {
                Row: {
                    id: string;
                    category: string;
                    amount: number;
                    description: string;
                    vendor: string | null;
                    payment_method: string | null;
                    paid_by: string | null;
                    expense_date: string;
                    receipt_url: string | null;
                    month: number | null;
                    year: number | null;
                    created_at: string | null;
                };
                Insert: {
                    id?: string;
                    category: string;
                    amount: number;
                    description: string;
                    vendor?: string | null;
                    payment_method?: string | null;
                    paid_by?: string | null;
                    expense_date: string;
                    receipt_url?: string | null;
                    month?: number | null;
                    year?: number | null;
                    created_at?: string | null;
                };
                Update: {
                    id?: string;
                    category?: string;
                    amount?: number;
                    description?: string;
                    vendor?: string | null;
                    payment_method?: string | null;
                    paid_by?: string | null;
                    expense_date?: string;
                    receipt_url?: string | null;
                    month?: number | null;
                    year?: number | null;
                    created_at?: string | null;
                };
                Relationships: [];
            };
            staff_salary_config: {
                Row: {
                    id: string;
                    staff_id: string;
                    basic_salary: number;
                    allowances: unknown;
                    deductions: unknown;
                    effective_from: string;
                    is_active: boolean | null;
                    created_at: string | null;
                };
                Insert: {
                    id?: string;
                    staff_id: string;
                    basic_salary: number;
                    allowances?: unknown;
                    deductions?: unknown;
                    effective_from: string;
                    is_active?: boolean | null;
                    created_at?: string | null;
                };
                Update: {
                    id?: string;
                    staff_id?: string;
                    basic_salary?: number;
                    allowances?: unknown;
                    deductions?: unknown;
                    effective_from?: string;
                    is_active?: boolean | null;
                    created_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_salary_config_staff_id_fkey";
                        columns: ["staff_id"];
                        isOneToOne: true;
                        referencedRelation: "teachers";
                        referencedColumns: ["id"];
                    }
                ];
            };
            staff_salary_configs: {
                Row: {
                    id: string;
                    staff_id: string;
                    basic_salary: number;
                    allowances: unknown;
                    deductions: unknown;
                    effective_from: string;
                    is_active: boolean | null;
                    created_at: string | null;
                };
                Insert: {
                    id?: string;
                    staff_id: string;
                    basic_salary: number;
                    allowances?: unknown;
                    deductions?: unknown;
                    effective_from: string;
                    is_active?: boolean | null;
                    created_at?: string | null;
                };
                Update: {
                    id?: string;
                    staff_id?: string;
                    basic_salary?: number;
                    allowances?: unknown;
                    deductions?: unknown;
                    effective_from?: string;
                    is_active?: boolean | null;
                    created_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_salary_configs_staff_id_fkey";
                        columns: ["staff_id"];
                        isOneToOne: true;
                        referencedRelation: "staffs";
                        referencedColumns: ["id"];
                    }
                ];
            };
            staff_salary_payments: {
                Row: {
                    id: string;
                    slip_number: string;
                    staff_id: string;
                    month: number;
                    year: number;
                    basic_salary: number;
                    allowances: unknown;
                    deductions: unknown;
                    gross_salary: number | null;
                    net_salary: number | null;
                    payment_method: string | null;
                    paid_by: string | null;
                    payment_date: string | null;
                    note: string | null;
                    is_printed: boolean | null;
                };
                Insert: {
                    id?: string;
                    slip_number: string;
                    staff_id: string;
                    month: number;
                    year: number;
                    basic_salary: number;
                    allowances?: unknown;
                    deductions?: unknown;
                    gross_salary?: number | null;
                    net_salary?: number | null;
                    payment_method?: string | null;
                    paid_by?: string | null;
                    payment_date?: string | null;
                    note?: string | null;
                    is_printed?: boolean | null;
                };
                Update: {
                    id?: string;
                    slip_number?: string;
                    staff_id?: string;
                    month?: number;
                    year?: number;
                    basic_salary?: number;
                    allowances?: unknown;
                    deductions?: unknown;
                    gross_salary?: number | null;
                    net_salary?: number | null;
                    payment_method?: string | null;
                    paid_by?: string | null;
                    payment_date?: string | null;
                    note?: string | null;
                    is_printed?: boolean | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "staff_salary_payments_staff_id_fkey";
                        columns: ["staff_id"];
                        isOneToOne: false;
                        referencedRelation: "staffs";
                        referencedColumns: ["id"];
                    }
                ];
            };
            promotion_logs: {
                Row: {
                    id: string;
                    academic_year_from: string;
                    academic_year_to: string;
                    promoted_count: number;
                    archived_count: number;
                    examinee_count: number;
                    snapshot: Record<string, unknown>;
                    performed_at: string;
                    is_undone: boolean;
                    undone_at: string | null;
                };
                Insert: {
                    id?: string;
                    academic_year_from: string;
                    academic_year_to: string;
                    promoted_count?: number;
                    archived_count?: number;
                    examinee_count?: number;
                    snapshot?: Record<string, unknown>;
                    performed_at?: string;
                    is_undone?: boolean;
                    undone_at?: string | null;
                };
                Update: {
                    id?: string;
                    academic_year_from?: string;
                    academic_year_to?: string;
                    promoted_count?: number;
                    archived_count?: number;
                    examinee_count?: number;
                    snapshot?: Record<string, unknown>;
                    performed_at?: string;
                    is_undone?: boolean;
                    undone_at?: string | null;
                };
                Relationships: [];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            preview_yearly_promotion: {
                Args: Record<string, never>;
                Returns: Record<string, unknown>;
            };
            perform_yearly_promotion: {
                Args: { p_target_year?: string };
                Returns: Record<string, unknown>;
            };
            undo_yearly_promotion: {
                Args: { p_log_id: string };
                Returns: Record<string, unknown>;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};

// Convenience types
export type SchoolInfo = Database["public"]["Tables"]["school_info"]["Row"];
export type Class = Database["public"]["Tables"]["classes"]["Row"];
export type Section = Database["public"]["Tables"]["sections"]["Row"];
export type Subject = Database["public"]["Tables"]["subjects"]["Row"];
export type Student = Database["public"]["Tables"]["students"]["Row"];
export type Exam = Database["public"]["Tables"]["exams"]["Row"];
export type GradingRule = Database["public"]["Tables"]["grading_rules"]["Row"];
export type ExamSubjectConfig = Database["public"]["Tables"]["exam_subject_config"]["Row"];
export type Mark = Database["public"]["Tables"]["marks"]["Row"];
export type Result = Database["public"]["Tables"]["results"]["Row"];
export type FinalResult = Database["public"]["Tables"]["final_results"]["Row"];
export type FinalResultDetail = Database["public"]["Tables"]["final_result_details"]["Row"];
export type SheetConfig = Database["public"]["Tables"]["sheet_configs"]["Row"];
export type AttendanceRecord = Database["public"]["Tables"]["attendance_records"]["Row"];
export type Teacher = Database["public"]["Tables"]["teachers"]["Row"];
export type Room = Database["public"]["Tables"]["rooms"]["Row"];
export type ClassRoutine = Database["public"]["Tables"]["class_routines"]["Row"];
export type ExamSchedule = Database["public"]["Tables"]["exam_schedules"]["Row"];
export type TeacherShift = Database["public"]["Tables"]["teacher_shifts"]["Row"];
export type LeaveRequest = Database["public"]["Tables"]["leave_requests"]["Row"];
export type Notice = Database["public"]["Tables"]["notices"]["Row"];
export type RoutineSettingsRow = Database["public"]["Tables"]["routine_settings"]["Row"];
export type ProxyAssignment = Database["public"]["Tables"]["proxy_assignments"]["Row"];
export type PromotionLog = Database["public"]["Tables"]["promotion_logs"]["Row"];
export type ExamSeatPlan = Database["public"]["Tables"]["exam_seat_plans"]["Row"];
export type ExamDuty = Database["public"]["Tables"]["exam_duties"]["Row"];
export type ExamPaperDistribution = Database["public"]["Tables"]["exam_paper_distributions"]["Row"];
export type Staff = Database["public"]["Tables"]["staffs"]["Row"];
export type StaffSalaryConfig = Database["public"]["Tables"]["staff_salary_configs"]["Row"];
export type StaffSalaryPayment = Database["public"]["Tables"]["staff_salary_payments"]["Row"];

