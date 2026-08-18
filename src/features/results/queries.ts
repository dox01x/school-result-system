import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getStudentResultDetail(examId: string, studentId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: marks, error: marksError } = await supabase
    .from("marks")
    .select(`
      id,
      student_id,
      exam_id,
      subject_id,
      academic_year,
      theory,
      mcq,
      practical,
      total,
      students ( id, name, roll, class_id, classes ( id, name ), sections ( id, name ) ),
      exams ( id, name, term, exam_type ),
      subjects ( id, name, full_marks, pass_marks )
    `)
    .eq("exam_id", examId)
    .eq("student_id", studentId);

  if (marksError) throw marksError;

  const formatted = (marks || []).map((m: any) => ({
    ...m,
    theory_marks: m.theory,
    practical_marks: m.practical,
    total_marks: m.total,
    students: m.students ? {
      ...m.students,
      roll_number: m.students.roll,
    } : null,
  }));

  return formatted;
}
