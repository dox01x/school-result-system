"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";

export default function ExamRulesConfigPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Exam Configuration", href: "/exam-configuration" },
          { label: "Pass / Fail Rules" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pass / Fail & Promotion Rules</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            System thresholds for student pass status, optional subject bonus points, and promotions.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/exam-configuration">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Config
          </Link>
        </Button>
      </div>

      <div className="space-y-4">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Core Passing Criteria
            </CardTitle>
            <CardDescription className="text-xs">
              A student must achieve at least 33% (Grade D) in each mandatory subject to pass the examination.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              If a student fails in any mandatory subject, overall GPA is marked as 0.00 (Grade F).
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              Optional 4th subject point bonus is calculated as: <code>max(0, Point - 2.00)</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
