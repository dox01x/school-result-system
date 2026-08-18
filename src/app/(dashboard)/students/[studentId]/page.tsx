"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, User, Award, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { Student } from "@/types/student";

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const supabase = createClient();
        const { data: s } = await supabase
          .from("students")
          .select("*, classes(id, name), sections(id, name)")
          .eq("id", studentId)
          .maybeSingle();

        if (s) {
          const studentObj: Student = {
            ...(s as unknown as Student),
            roll_number: s.roll,
            guardian_name: s.father_name || s.mother_name || "",
            guardian_phone: s.phone || "",
          };
          setStudent(studentObj);

          const [{ data: p }, { data: m }] = await Promise.all([
            supabase.from("tuition_payments").select("*").eq("student_id", studentId).order("created_at", { ascending: false }),
            supabase.from("marks").select("*, subjects(name), exams(name)").eq("student_id", studentId),
          ]);
          setPayments(p || []);
          setMarks(m || []);
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [studentId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
        <div className="h-48 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold">Student Not Found</h2>
        <p className="text-sm text-muted-foreground">The requested student profile does not exist.</p>
        <Button asChild variant="outline">
          <Link href="/students">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Students
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Students", href: "/students" },
          { label: student.name },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl border border-primary/20">
            {student.name ? student.name.charAt(0).toUpperCase() : "S"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{student.name}</h1>
              <Badge variant="outline" className="capitalize">
                {student.status || "Active"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Roll: <span className="font-semibold text-foreground">{student.roll || student.roll_number}</span> • Class:{" "}
              <span className="font-semibold text-foreground">{student.classes?.name || "N/A"}</span> ({student.sections?.name || "N/A"})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/students">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> All Students
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="w-4 h-4" /> Profile Info
          </TabsTrigger>
          <TabsTrigger value="academic" className="gap-1.5">
            <Award className="w-4 h-4" /> Academic & Marks
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-1.5">
            <Receipt className="w-4 h-4" /> Tuition & Fees
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal & Guardian Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
              <div>
                <span className="text-muted-foreground text-xs block">Father / Guardian Name</span>
                <span className="font-medium">{student.father_name || student.guardian_name || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Mother Name</span>
                <span className="font-medium">{student.mother_name || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Phone Number</span>
                <span className="font-medium">{student.phone || student.guardian_phone || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Gender</span>
                <span className="font-medium capitalize">{student.gender || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Date of Birth</span>
                <span className="font-medium">{formatDate(student.date_of_birth)}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Blood Group</span>
                <span className="font-medium text-destructive">{student.blood_group || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Address</span>
                <span className="font-medium">{student.address || "—"}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academic">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Marks & Performance History</CardTitle>
            </CardHeader>
            <CardContent>
              {marks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No examination marks recorded yet.</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {marks.map((m, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-semibold text-foreground">{m.subjects?.name}</span>
                        <span className="text-xs text-muted-foreground block">{m.exams?.name}</span>
                      </div>
                      <div className="font-mono font-bold text-primary">
                        {m.total ?? m.total_marks ?? m.marks_obtained ?? "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Receipts & History</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No tuition payments recorded yet.</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {payments.map((p, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-semibold text-foreground">{p.month} {p.year}</span>
                        <span className="text-xs text-muted-foreground block">Receipt: {p.receipt_no || "N/A"}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-600 block">{formatCurrency(p.amount_paid)}</span>
                        <span className="text-[11px] text-muted-foreground capitalize">{p.payment_method}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
