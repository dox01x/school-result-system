import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getMarksForExamAndSubject(examId: string, subjectId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
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
      students ( id, name, roll )
    `)
    .eq("exam_id", examId)
    .eq("subject_id", subjectId);

  if (error) throw error;

  const formatted = (data || []).map((m: any) => ({
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
