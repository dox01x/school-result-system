"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { createClient } from "@/lib/supabase/client";

interface ClassDetail {
  id: string;
  name: string;
  numeric_value?: number | null;
}

interface SectionDetail {
  id: string;
  name: string;
  class_id: string;
}

interface StudentDetail {
  id: string;
  name: string;
  roll: string;
  roll_number?: string | number;
  phone?: string | null;
  guardian_phone?: string | null;
}

export default function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [sections, setSections] = useState<SectionDetail[]>([]);
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const supabase = createClient();
        const { data: c } = await supabase.from("classes").select("*").eq("id", classId).maybeSingle();
        if (c) {
          setCls(c);
          const [{ data: s }, { data: st }] = await Promise.all([
            supabase.from("sections").select("*").eq("class_id", classId),
            supabase.from("students").select("*").eq("class_id", classId).order("roll", { ascending: true }),
          ]);
          setSections(s || []);

          const sortedStudents = ((st || []) as StudentDetail[]).sort((a, b) => {
            const ra = parseInt(String(a.roll), 10) || 0;
            const rb = parseInt(String(b.roll), 10) || 0;
            return ra - rb;
          });
          setStudents(sortedStudents);
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [classId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
        <div className="h-48 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold">Class Not Found</h2>
        <Button asChild variant="outline">
          <Link href="/classes">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Classes
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Classes", href: "/classes" },
          { label: cls.name },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{cls.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Total Sections: {sections.length} • Total Enrolled: {students.length} students
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/classes">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> All Classes
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Sections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sections.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sections configured.</p>
            ) : (
              sections.map((sec) => (
                <div key={sec.id} className="p-3 rounded-lg border border-border/60 flex items-center justify-between text-sm">
                  <span className="font-semibold">Section {sec.name}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Enrolled Students ({students.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No students enrolled in this class yet.</p>
            ) : (
              <div className="divide-y divide-border/40 max-h-[450px] overflow-y-auto">
                {students.map((st) => (
                  <div key={st.id} className="py-2.5 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-mono text-xs font-bold text-foreground">
                        {st.roll || st.roll_number || "—"}
                      </span>
                      <Link href={`/students/${st.id}`} className="font-medium hover:text-primary transition-colors">
                        {st.name}
                      </Link>
                    </div>
                    <span className="text-xs text-muted-foreground">{st.phone || st.guardian_phone || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
