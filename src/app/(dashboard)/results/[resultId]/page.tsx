"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { createClient } from "@/lib/supabase/client";

export default function ResultDetailPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = use(params);
  const [student, setStudent] = useState<any>(null);
  const [marks, setMarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadResult() {
      try {
        setLoading(true);
        const supabase = createClient();
        const { data: st } = await supabase
          .from("students")
          .select("*, classes(name), sections(name)")
          .eq("id", resultId)
          .maybeSingle();

        if (st) {
          setStudent(st);
          const { data: m } = await supabase
            .from("marks")
            .select("*, subjects(name, full_marks, pass_marks), exams(name)")
            .eq("student_id", resultId);

          setMarks(m || []);
        }
      } finally {
        setLoading(false);
      }
    }
    loadResult();
  }, [resultId]);

  if (loading) {
    return <div className="py-16 text-center text-muted-foreground">Loading marksheet...</div>;
  }

  if (!student) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold">Result Card Not Found</h2>
        <Button asChild variant="outline">
          <Link href="/results">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Results
          </Link>
        </Button>
      </div>
    );
  }

  const totalMarks = marks.reduce((acc, m) => acc + (Number(m.total ?? m.total_marks) || 0), 0);
  const totalMax = marks.reduce((acc, m) => acc + (Number(m.subjects?.full_marks) || 100), 0);
  const percentage = totalMax > 0 ? (totalMarks / totalMax) * 100 : 0;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Results", href: "/results" },
          { label: `Marksheet: ${student.name}` },
        ]}
      />

      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Official Academic Transcript</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Student result card and subject-wise breakdown.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-1.5">
            <Printer className="w-4 h-4" /> Print Marksheet
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/results">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> All Results
            </Link>
          </Button>
        </div>
      </div>

      <Card className="max-w-3xl mx-auto border border-border shadow-sm p-8 bg-card">
        <div className="text-center pb-6 border-b border-border/60">
          <h2 className="text-2xl font-bold tracking-tight text-primary">Academic Transcript</h2>
          <p className="text-xs text-muted-foreground">Academic Progress Report & Marksheet</p>
        </div>

        <div className="grid grid-cols-2 gap-4 py-4 text-xs">
          <div>
            <p><span className="text-muted-foreground">Student Name:</span> <strong className="text-foreground">{student.name}</strong></p>
            <p className="mt-1"><span className="text-muted-foreground">Roll Number:</span> <strong className="text-foreground">{student.roll || student.roll_number}</strong></p>
          </div>
          <div className="text-right">
            <p><span className="text-muted-foreground">Class:</span> <strong className="text-foreground">{student.classes?.name} ({student.sections?.name})</strong></p>
            <p className="mt-1"><span className="text-muted-foreground">Total Obtained:</span> <strong className="text-primary">{totalMarks} / {totalMax} ({percentage.toFixed(1)}%)</strong></p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden border border-border/80 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-muted-foreground uppercase font-semibold">
              <tr>
                <th className="p-3">Subject</th>
                <th className="p-3 text-center">Full Marks</th>
                <th className="p-3 text-center">Theory</th>
                <th className="p-3 text-center">Practical</th>
                <th className="p-3 text-center">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {marks.map((m, idx) => (
                <tr key={idx}>
                  <td className="p-3 font-medium">{m.subjects?.name}</td>
                  <td className="p-3 text-center text-muted-foreground">{m.subjects?.full_marks || 100}</td>
                  <td className="p-3 text-center">{m.theory ?? m.theory_marks ?? "—"}</td>
                  <td className="p-3 text-center">{m.practical ?? m.practical_marks ?? "—"}</td>
                  <td className="p-3 text-center font-bold text-primary">{m.total ?? m.total_marks ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
