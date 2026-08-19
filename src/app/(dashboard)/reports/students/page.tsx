"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users, GraduationCap, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { createClient } from "@/lib/supabase/client";

export default function StudentDemographicsReportPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const supabase = createClient();
        const [{ data: cData }, { count }] = await Promise.all([
          supabase.from("classes").select("*, students(id)"),
          supabase.from("students").select("*", { count: "exact", head: true }),
        ]);

        setClasses(cData || []);
        setStudentCount(count || 0);
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
          { label: "Student Demographics" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Student Enrollment & Demographics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Total active students, class distributions, and capacity utilization.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/reports">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> All Reports
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Enrolled Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-primary">{studentCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all academic classes & sections</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Active Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">{classes.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Academic grade levels</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Class-wise Enrollment Distribution</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[320px]">
              <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3.5">Class Name</th>
                  <th className="p-3.5 text-center">Enrolled Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {classes.map((cls) => (
                  <tr key={cls.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-medium">{cls.name}</td>
                    <td className="p-3.5 text-center font-mono font-bold text-primary">
                      {cls.students?.length || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
