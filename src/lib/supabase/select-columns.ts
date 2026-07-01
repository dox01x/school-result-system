/**
 * Explicit column lists for Supabase queries (avoid select('*')).
 * Keep in sync with src/lib/database.types.ts Row shapes.
 */

export const SCHOOL_INFO_COLUMNS =
    "id,name,address,phone,email,logo_url,principal_name,established_year,current_academic_year,last_promotion_year,detailed_marks,gender_split_class_id,created_at,updated_at";

export const CLASS_COLUMNS = "id,name,numeric_value,created_at";
export const SECTION_COLUMNS = "id,class_id,name,created_at";
export const SUBJECT_COLUMNS =
    "id,class_id,name,full_marks,pass_marks,has_theory,has_mcq,has_practical,theory_marks,mcq_marks,practical_marks,is_optional,group_name,created_at";
export const STUDENT_COLUMNS =
    "id,student_id,class_id,section_id,roll,name,gender,father_name,mother_name,date_of_birth,phone,address,blood_group,group_name,created_at";
export const EXAM_COLUMNS = "id,name,exam_type,term,created_at";
export const GRADING_RULE_COLUMNS = "id,marks_category,min_marks,max_marks,grade,grade_point,created_at";
export const EXAM_SUBJECT_CONFIG_COLUMNS = "id,exam_id,subject_id,full_marks,weight_percent,created_at";
export const MARK_COLUMNS =
    "id,student_id,subject_id,exam_id,academic_year,theory,mcq,practical,total,created_at";
export const RESULT_COLUMNS =
    "id,student_id,exam_id,academic_year,total_marks,total_full_marks,percentage,gpa,grade,created_at";
export const TEACHER_COLUMNS =
    "id,name,phone,email,subject_specialty,designation,employee_type,proxy_count,created_at";
export const STAFF_COLUMNS =
    "id,name,phone,email,designation,created_at";
export const ROOM_COLUMNS = "id,name,capacity,room_type,tables_count,seats_per_table,order_index,created_at";
export const EXAM_SEAT_PLAN_COLUMNS = "id,exam_id,class_id,section_id,room_id,allocated_students,created_at";
export const EXAM_DUTY_COLUMNS = "id,exam_id,room_id,teacher_id,exam_date,start_time,end_time,created_at";
export const EXAM_PAPER_DISTRIBUTION_COLUMNS = "id,exam_id,class_id,subject_id,teacher_id,total_copies,date_given,date_returned,status,notes,created_at";
export const CLASS_ROUTINE_COLUMNS =
    "id,class_id,section_id,subject_id,teacher_id,room_id,day_of_week,start_time,end_time,created_at";
export const EXAM_SCHEDULE_COLUMNS =
    "id,exam_id,class_id,subject_id,exam_date,start_time,end_time,room_id,invigilator_id,created_at";
export const NOTICE_COLUMNS = "id,title,content,audience,priority,is_published,created_at";
export const ROUTINE_SETTINGS_COLUMNS =
    "id,working_days,periods_per_day,period_duration_minutes,period_durations,break_after_period,break_duration_minutes,class_start_time,created_at,updated_at";
export const SHEET_CONFIG_COLUMNS =
    "id,type,class_id,section_id,subject_id,exam_id,sheet_id,sheet_range,created_at,updated_at";

export const ATTENDANCE_COLUMNS =
    "id,student_id,class_id,section_id,att_date,status,source,created_at,updated_at";

export const PROMOTION_LOG_COLUMNS =
    "id,academic_year_from,academic_year_to,promoted_count,archived_count,examinee_count,performed_at,is_undone,undone_at";

export const FEE_STRUCTURE_COLUMNS =
    "id,class_name,fee_type,amount,description,academic_year,is_active,created_at";
export const TUITION_PAYMENT_COLUMNS =
    "id,receipt_number,student_id,class_name,section,fee_type,fee_details,month,year,amount_due,amount_paid,discount,fine,payment_method,collected_by,payment_date,note,is_printed";
export const SALARY_PAYMENT_COLUMNS =
    "id,slip_number,staff_id,staff_type,month,year,basic_salary,allowances,deductions,gross_salary,net_salary,payment_method,paid_by,payment_date,note,is_printed";
export const INCOME_ENTRY_COLUMNS =
    "id,category,amount,description,received_from,payment_method,received_by,income_date,academic_year,month,year,created_at";
export const EXPENSE_ENTRY_COLUMNS =
    "id,category,amount,description,vendor,payment_method,paid_by,expense_date,receipt_url,month,year,created_at";
export const STAFF_SALARY_CONFIG_COLUMNS =
    "id,staff_id,basic_salary,allowances,deductions,effective_from,is_active,created_at";

export const TEACHER_SHIFT_COLUMNS =
    "id,teacher_id,shift_date,start_time,end_time,duty_type,notes,created_at";
export const LEAVE_REQUEST_COLUMNS =
    "id,teacher_id,start_date,end_date,reason,status,created_at";
