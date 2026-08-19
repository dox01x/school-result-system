"use client";

import Link from "next/link";
import { BookOpen, Clock, ArrowRight, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UpcomingExamItem {
  subject: string;
  className: string;
  date: string;
  formattedDate: string;
  time: string | null;
}

interface GpaDistributionItem {
  grade: string;
  count: number;
  color: string;
}

interface Props {
  totalExams: number;
  upcomingExams: UpcomingExamItem[];
  totalResultsPublished: number;
  gpaDistribution: GpaDistributionItem[];
  configuredSubjectsCount: number;
}

export function AcademicWidgets({
  totalExams,
  upcomingExams,
  totalResultsPublished,
  gpaDistribution,
  configuredSubjectsCount,
}: Props) {
  const maxGpaCount = Math.max(...gpaDistribution.map((g) => g.count), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
      {/* Upcoming Exams Card */}
      <div className="lg:col-span-6 bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                <BookOpen size={16} strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">Upcoming Exams</h3>
                <p className="text-xs text-muted-foreground">Next 30 days schedules</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary hover:bg-primary/10 gap-1 text-xs">
              <Link href="/administration/exam-schedule">
                All Routines <ArrowRight size={12} />
              </Link>
            </Button>
          </div>

          <div className="space-y-2.5">
            {upcomingExams.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No upcoming exams scheduled in this period
              </div>
            ) : (
              upcomingExams.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground truncate">{e.subject}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock size={11} /> {e.formattedDate}
                      </span>
                      {e.time && (
                        <span className="text-[11px] text-muted-foreground">· {e.time}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs font-semibold bg-background shrink-0">
                    {e.className}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{totalExams} Total Exams · {configuredSubjectsCount} Subjects</span>
          <Link href="/marks" className="text-primary font-semibold hover:underline flex items-center gap-0.5">
            Marks Entry <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* GPA & Result Distribution */}
      <div className="lg:col-span-6 bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                <Award size={16} strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">Academic Performance</h3>
                <p className="text-xs text-muted-foreground">GPA & Grade Distribution</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary hover:bg-primary/10 gap-1 text-xs">
              <Link href="/results">
                View Results <ArrowRight size={12} />
              </Link>
            </Button>
          </div>

          <div className="space-y-3">
            {totalResultsPublished === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No published result data available yet
              </div>
            ) : (
              gpaDistribution.map((g) => {
                const pct = (g.count / maxGpaCount) * 100;
                return (
                  <div key={g.grade} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-foreground w-24 shrink-0 truncate">{g.grade}</span>
                    <div className="flex-1 h-2 sm:h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(pct, g.count > 0 ? 5 : 0)}%`,
                          backgroundColor: g.color,
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold text-foreground w-10 text-right tabular-nums">
                      {g.count}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{totalResultsPublished} Student Result Records</span>
          <Link href="/reports/results" className="text-primary font-semibold hover:underline flex items-center gap-0.5">
            Full Analytics <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}
