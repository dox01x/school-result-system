"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Exam } from "@/types/exam";

export function useExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExams = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();

      const { data, error: err } = await supabase
        .from("exams")
        .select("id, name, exam_type, term, created_at")
        .order("created_at", { ascending: false });

      if (err) throw err;
      setExams((data as unknown as Exam[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch exams";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  return { exams, loading, error, refetch: fetchExams };
}
