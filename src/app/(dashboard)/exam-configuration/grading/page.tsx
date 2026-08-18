"use client";

import Link from "next/link";
import { ArrowLeft, Award, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { GRADING_SCALE } from "@/features/results/constants";

export default function GradingConfigPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Exam Configuration", href: "/exam-configuration" },
          { label: "Grading Scales" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">GPA & Grading Scales</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Standard 5.0 GPA scale and letter grade boundaries according to the national curriculum.
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
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3.5">Letter Grade</th>
                <th className="p-3.5 text-center">Marks Range</th>
                <th className="p-3.5 text-center">Grade Point</th>
                <th className="p-3.5">Remarks / Distinction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {GRADING_SCALE.map((g) => (
                <tr key={g.grade} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3.5 font-bold text-base text-primary">{g.grade}</td>
                  <td className="p-3.5 text-center font-mono">{g.min}% – {g.max}%</td>
                  <td className="p-3.5 text-center font-mono font-bold">{g.point.toFixed(2)}</td>
                  <td className="p-3.5 text-muted-foreground">{g.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
