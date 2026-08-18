"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function MarksEntryPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [marksMap, setMarksMap] = useState<Record<string, { theory: string; practical: string }>>({});

  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadFilters() {
      const supabase = createClient();
      const [{ data: e }, { data: c }, { data: sub }] = await Promise.all([
        (supabase as any).from("exams").select("id, name").order("created_at", { ascending: false }),
        supabase.from("classes").select("id, name").order("name"),
        (supabase as any).from("subjects").select("id, name").order("name"),
      ]);
      setExams(e || []);
      setClasses(c || []);
      setSubjects(sub || []);
      if (e && e.length > 0) setSelectedExam(e[0].id);
      if (c && c.length > 0) setSelectedClass(c[0].id);
      if (sub && sub.length > 0) setSelectedSubject(sub[0].id);
    }
    loadFilters();
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    async function loadSections() {
      const supabase = createClient();
      const { data } = await supabase.from("sections").select("id, name").eq("class_id", selectedClass);
      setSections(data || []);
      if (data && data.length > 0) setSelectedSection(data[0].id);
      else setSelectedSection("");
    }
    loadSections();
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedClass || !selectedExam || !selectedSubject) return;
    async function loadStudentsAndMarks() {
      setLoading(true);
      try {
        const supabase = createClient();
        let sQuery = (supabase as any)
          .from("students")
          .select("id, name, roll")
          .eq("class_id", selectedClass)
          .order("roll", { ascending: true });

        if (selectedSection && selectedSection !== "all") {
          sQuery = sQuery.eq("section_id", selectedSection);
        }

        const [{ data: stData }, { data: mData }] = await Promise.all([
          sQuery,
          (supabase as any)
            .from("marks")
            .select("student_id, theory_marks, practical_marks, total_marks")
            .eq("exam_id", selectedExam)
            .eq("subject_id", selectedSubject),
        ]);

        const mappedStudents = (stData || []).map((s: any) => ({
          ...s,
          roll_number: s.roll || s.roll_number,
        }));
        setStudents(mappedStudents);

        const initialMap: Record<string, { theory: string; practical: string }> = {};
        (mData || []).forEach((m: any) => {
          initialMap[m.student_id] = {
            theory: m.theory_marks !== null && m.theory_marks !== undefined ? String(m.theory_marks) : "",
            practical: m.practical_marks !== null && m.practical_marks !== undefined ? String(m.practical_marks) : "",
          };
        });
        setMarksMap(initialMap);
      } finally {
        setLoading(false);
      }
    }
    loadStudentsAndMarks();
  }, [selectedClass, selectedSection, selectedExam, selectedSubject]);

  function handleMarkChange(studentId: string, field: "theory" | "practical", val: string) {
    setMarksMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: val,
      },
    }));
  }

  async function handleSaveAll() {
    if (!selectedExam || !selectedSubject) {
      toast.error("Please select an exam and subject.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const recordsToUpsert = students.map((st) => {
        const row = marksMap[st.id] || { theory: "", practical: "" };
        const theory = row.theory !== "" ? parseFloat(row.theory) : null;
        const practical = row.practical !== "" ? parseFloat(row.practical) : null;
        const total = (theory ?? 0) + (practical ?? 0);

        return {
          exam_id: selectedExam,
          subject_id: selectedSubject,
          student_id: st.id,
          theory_marks: theory,
          practical_marks: practical,
          total_marks: total,
        };
      });

      const { error } = await supabase
        .from("marks")
        .upsert(recordsToUpsert as any, { onConflict: "exam_id,student_id,subject_id" });

      if (error) throw error;
      toast.success(`Saved marks for ${recordsToUpsert.length} students!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save marks.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Marks Overview", href: "/marks" },
          { label: "Direct Marks Entry" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Direct Marks Entry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Rapid marks entry grid with real-time total computation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSaveAll} disabled={saving || students.length === 0} className="gap-1.5 shadow-sm">
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save All Marks"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Select Exam & Subject Target</CardTitle>
          <CardDescription>Filter the students by examination, class, section, and subject.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Examination</label>
            <Select value={selectedExam} onValueChange={setSelectedExam}>
              <SelectTrigger>
                <SelectValue placeholder="Select Exam" />
              </SelectTrigger>
              <SelectContent>
                {exams.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.academic_year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Class</label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Section</label>
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger>
                <SelectValue placeholder="All Sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subject</label>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Select Subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Loading student list...</div>
          ) : students.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">No students found for this class & section.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 w-16 text-center">Roll</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3 w-36">Theory</th>
                    <th className="px-4 py-3 w-36">Practical</th>
                    <th className="px-4 py-3 w-28 text-center">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {students.map((st) => {
                    const row = marksMap[st.id] || { theory: "", practical: "" };
                    const tNum = parseFloat(row.theory) || 0;
                    const pNum = parseFloat(row.practical) || 0;
                    const total = (row.theory !== "" || row.practical !== "") ? tNum + pNum : "—";

                    return (
                      <tr key={st.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 text-center font-mono font-bold text-muted-foreground">
                          {st.roll_number}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{st.name}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            value={row.theory}
                            onChange={(e) => handleMarkChange(st.id, "theory", e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            value={row.practical}
                            onChange={(e) => handleMarkChange(st.id, "practical", e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono font-bold text-primary">
                          {total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
