"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart2, Award, Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { createClient } from "@/lib/supabase/client";

export default function ResultsReportsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const supabase = createClient();
        const { data } = await supabase.from("exams").select("*").order("created_at", { ascending: false });
        setExams(data || []);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Reports", href: "/reports" },
          { label: "Result Analytics" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Examination Result Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pass rates, GPA distribution curves, and top student rankings per term.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/reports">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> All Reports
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-muted-foreground">Loading examination data...</div>
        ) : exams.length === 0 ? (
          <div className="col-span-full py-16 text-center text-muted-foreground">No examination records found.</div>
        ) : (
          exams.map((exam) => (
            <Card key={exam.id} className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" /> {exam.name}
                </CardTitle>
                <CardDescription className="text-xs">Academic Year {exam.academic_year}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-1 border-b border-border/40 text-xs">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-semibold capitalize text-primary">{exam.is_published ? "Published" : "Draft"}</span>
                </div>
                <Button asChild size="sm" variant="outline" className="w-full text-xs">
                  <Link href={`/exams/${exam.id}`}>View Performance Breakdown</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
