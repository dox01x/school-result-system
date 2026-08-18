"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, ShieldCheck, Megaphone, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Exam } from "@/types/exam";

export default function PublishResultsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    loadExams();
  }, []);

  async function loadExams() {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase.from("exams").select("*").order("created_at", { ascending: false });
      setExams((data as unknown as Exam[]) || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleTogglePublish(exam: Exam) {
    const nextStatus = !exam.is_published;
    setToggling(exam.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("exams")
        .update({ is_published: nextStatus } as any)
        .eq("id", exam.id);

      if (error) throw error;

      toast.success(nextStatus ? `Published results for ${exam.name}!` : `Unpublished ${exam.name}`);
      setExams((prev) =>
        prev.map((e) => (e.id === exam.id ? { ...e, is_published: nextStatus } : e))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update publication status.");
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Results Overview", href: "/results" },
          { label: "Publish Results" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Publish Exam Results</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Control result visibility for students, teachers, and public scorecards.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/results">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Results
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-muted-foreground">Loading exams...</div>
        ) : exams.length === 0 ? (
          <div className="col-span-full py-16 text-center text-muted-foreground">No exams found.</div>
        ) : (
          exams.map((exam) => (
            <Card key={exam.id} className="border-border/60 shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">{exam.name}</CardTitle>
                  <CardDescription className="text-xs">
                    Academic Year {exam.academic_year} {exam.term && `• ${String(exam.term).replace("_", " ")}`}
                  </CardDescription>
                </div>
                <Badge variant={exam.is_published ? "default" : "secondary"} className="text-xs">
                  {exam.is_published ? "Live & Published" : "Draft / Unpublished"}
                </Badge>
              </CardHeader>
              <CardContent className="pt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {exam.is_published
                    ? "Marksheets and transcripts are currently visible."
                    : "Scores are hidden from students & viewers."}
                </span>
                <Button
                  size="sm"
                  variant={exam.is_published ? "outline" : "default"}
                  onClick={() => handleTogglePublish(exam)}
                  disabled={toggling === exam.id}
                >
                  {exam.is_published ? "Unpublish" : "Publish Live"}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
