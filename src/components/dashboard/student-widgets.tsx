"use client";

import Link from "next/link";
import { GraduationCap, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClassDistributionItem {
  className: string;
  count: number;
}

interface GenderDistribution {
  male: number;
  female: number;
  other: number;
  unspecified?: number;
}

interface Props {
  totalStudents: number;
  classDistribution: ClassDistributionItem[];
  genderDistribution: GenderDistribution;
  onClassClick?: (className: string) => void;
}

export function StudentWidgets({
  totalStudents,
  classDistribution,
  genderDistribution,
  onClassClick,
}: Props) {
  const maxCount = Math.max(...classDistribution.map((r) => r.count), 1);
  const malePct = totalStudents > 0 ? Math.round((genderDistribution.male / totalStudents) * 100) : 0;
  const femalePct = totalStudents > 0 ? Math.round((genderDistribution.female / totalStudents) * 100) : 0;
  const unassigned = (genderDistribution.other || 0) + (genderDistribution.unspecified || 0);
  const showUnassigned = unassigned > 0;
  const unassignedPct = totalStudents > 0 ? Math.round((unassigned / totalStudents) * 100) : 0;

  return (
    <div className="bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
              <GraduationCap size={16} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground tracking-tight">Student Enrollment by Class</h3>
              <p className="text-xs text-muted-foreground">Class distribution & gender split</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary hover:bg-primary/10 gap-1 text-xs">
            <Link href="/students">
              All Students <ArrowRight size={12} />
            </Link>
          </Button>
        </div>

        {/* Gender Breakdown Pill */}
        <div className={`grid ${showUnassigned ? "grid-cols-3" : "grid-cols-2"} gap-2.5 sm:gap-3 mb-5`}>
          <div className="p-2.5 sm:p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground">Boys</p>
              <p className="text-sm sm:text-base font-bold text-foreground tabular-nums">{genderDistribution.male}</p>
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 sm:px-2 py-0.5 rounded-md w-fit">
              {malePct}%
            </span>
          </div>

          <div className="p-2.5 sm:p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground">Girls</p>
              <p className="text-sm sm:text-base font-bold text-foreground tabular-nums">{genderDistribution.female}</p>
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 sm:px-2 py-0.5 rounded-md w-fit">
              {femalePct}%
            </span>
          </div>

          {showUnassigned && (
            <div className="p-2.5 sm:p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground">Unassigned</p>
                <p className="text-sm sm:text-base font-bold text-foreground tabular-nums">{unassigned}</p>
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 sm:px-2 py-0.5 rounded-md w-fit">
                {unassignedPct}%
              </span>
            </div>
          )}
        </div>

        {/* Class Bars */}
        <div className="space-y-3">
          {classDistribution.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No students enrolled yet
            </div>
          ) : (
            classDistribution.slice(0, 6).map((row) => {
              const pct = maxCount > 0 ? (row.count / maxCount) * 100 : 0;
              return (
                <div
                  key={row.className}
                  onClick={() => onClassClick && onClassClick(row.className)}
                  className="flex items-center gap-3 sm:gap-4 p-1.5 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="w-24 sm:w-28 shrink-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{row.className}</p>
                  </div>
                  <div className="flex-1 h-2 sm:h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(pct, row.count > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-10 text-right tabular-nums">
                    {row.count}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-4 mt-3 border-t border-border/60 flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{totalStudents} Total Enrolled</span>
        <Link href="/classes" className="text-primary font-semibold hover:underline flex items-center gap-0.5">
          Manage Classes <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}
