"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export function useResults(examId?: string, classId?: string, sectionId?: string) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!examId || !classId) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();

      let query = supabase
        .from("marks")
        .select(`
          id,
          student_id,
          subject_id,
          academic_year,
          theory,
          mcq,
          practical,
          total,
          students!inner ( id, name, roll, class_id, section_id ),
          subjects ( id, name, full_marks, pass_marks )
        `)
        .eq("exam_id", examId)
        .eq("students.class_id", classId);

      if (sectionId) {
        query = query.eq("students.section_id", sectionId);
      }

      const { data, error: err } = await query;
      if (err) throw err;

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

      setResults(formatted);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch results";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [examId, classId, sectionId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  return { results, loading, error, refetch: fetchResults };
}
