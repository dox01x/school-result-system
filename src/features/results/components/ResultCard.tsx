"use client";

import { Award, BookOpen, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StudentResultSummary } from "@/types/result";

export function ResultCard({ summary }: { summary: StudentResultSummary }) {
  return (
    <Card className="border-border/60 shadow-sm hover:shadow-md transition-all">
      <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between border-b border-border/40">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" /> {summary.student_name}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Roll: {summary.roll_number} • Class: {summary.class_name} ({summary.section_name})
          </p>
        </div>
        <div className="text-right">
          <Badge variant={summary.passed ? "default" : "destructive"} className="text-xs font-semibold">
            GPA {summary.gpa.toFixed(2)} ({summary.letter_grade})
          </Badge>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {summary.percentage.toFixed(1)}% Marks
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-4">
        <div className="space-y-2">
          {summary.subject_results.map((sub, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-border/20 last:border-0">
              <span className="flex items-center gap-1.5 font-medium text-foreground/90">
                <BookOpen className="w-3 h-3 text-muted-foreground" /> {sub.subject_name}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{sub.obtained}/{sub.max}</span>
                <span className="font-semibold w-7 text-right">{sub.grade}</span>
                {sub.passed ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
