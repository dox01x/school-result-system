"use client";

import Link from "next/link";
import { ClipboardList, Calendar, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Exam } from "@/types/exam";

export function ExamCard({ exam }: { exam: Exam }) {
  return (
    <Card className="hover:shadow-md transition-all border-border/60 hover:border-primary/40 group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <Link href={`/exams/${exam.id}`} className="font-semibold text-base hover:text-primary transition-colors">
                {exam.name}
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-muted-foreground" /> {exam.academic_year}
                </span>
                {exam.term && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{String(exam.term).replace("_", " ")}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Badge variant={exam.is_published ? "default" : "secondary"} className="text-[11px]">
            {exam.is_published ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Published
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> Draft
              </span>
            )}
          </Badge>
        </div>

        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Manage schedule & rooms</span>
          <Button asChild size="sm" variant="ghost" className="h-8 text-xs gap-1 group-hover:text-primary">
            <Link href={`/exams/${exam.id}`}>
              Configure <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
