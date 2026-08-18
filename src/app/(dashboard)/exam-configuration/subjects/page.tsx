"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { createClient } from "@/lib/supabase/client";

export default function ExamSubjectsConfigPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSubjects() {
      try {
        setLoading(true);
        const supabase = createClient();
        const { data } = await supabase.from("subjects").select("*").order("name");
        setSubjects(data || []);
      } finally {
        setLoading(false);
      }
    }
    loadSubjects();
  }, []);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Exam Configuration", href: "/exam-configuration" },
          { label: "Subject Mappings" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Exam Subject Configurations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Subject weightages, default pass marks, and examination subject mapping.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/exam-configuration">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Config
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Loading subjects...</div>
          ) : subjects.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">No subjects found.</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Subject Name</th>
                  <th className="p-3.5 text-center">Full Marks</th>
                  <th className="p-3.5 text-center">Pass Marks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-mono text-xs text-primary font-semibold">{sub.code}</td>
                    <td className="p-3.5 font-medium">{sub.name}</td>
                    <td className="p-3.5 text-center font-mono">{sub.full_marks || 100}</td>
                    <td className="p-3.5 text-center font-mono">{sub.pass_marks || 33}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
