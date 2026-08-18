import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getSchoolSummaryMetrics() {
  const supabase = await createServerSupabaseClient();
  const [
    { count: totalStudents },
    { count: totalClasses },
    { count: totalExams },
    { data: recentPayments },
  ] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }),
    supabase.from("classes").select("*", { count: "exact", head: true }),
    supabase.from("exams").select("*", { count: "exact", head: true }),
    supabase.from("tuition_payments").select("amount_paid").limit(100),
  ]);

  const totalRevenue = (recentPayments || []).reduce((acc: number, p: any) => acc + (Number(p.amount_paid) || 0), 0);

  return {
    totalStudents: totalStudents || 0,
    totalClasses: totalClasses || 0,
    totalExams: totalExams || 0,
    totalRevenue,
  };
}
