"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Student } from "@/types/student";

export function useStudents(classId?: string, sectionId?: string) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();

      let query = supabase
        .from("students")
        .select("id, student_id, name, roll, class_id, section_id, father_name, mother_name, phone, gender, date_of_birth, blood_group, address, group_name, classes ( id, name ), sections ( id, name )")
        .order("roll", { ascending: true });

      if (classId) {
        query = query.eq("class_id", classId);
      }
      if (sectionId) {
        query = query.eq("section_id", sectionId);
      }

      const { data, error: err } = await query;
      if (err) throw err;

      const formatted: Student[] = ((data || []) as unknown as Student[]).map((s) => ({
        ...s,
        roll_number: s.roll,
        guardian_name: s.father_name || s.mother_name || "",
        guardian_phone: s.phone || "",
      }));

      // Sort numerically by roll
      formatted.sort((a, b) => {
        const ra = parseInt(String(a.roll), 10) || 0;
        const rb = parseInt(String(b.roll), 10) || 0;
        return ra - rb;
      });

      setStudents(formatted);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch students";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [classId, sectionId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return { students, loading, error, refetch: fetchStudents };
}
