"use client";

import Link from "next/link";
import { ArrowLeft, Layers, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { DEFAULT_COMPONENTS } from "@/features/exam-configuration/constants";

export default function ExamComponentsConfigPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Exam Configuration", href: "/exam-configuration" },
          { label: "Assessment Components" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Assessment Components</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure default split of Theory, Practical, MCQ, and Continuous Assessment marks.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/exam-configuration">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Config
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEFAULT_COMPONENTS.map((comp) => (
          <Card key={comp.key} className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> {comp.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Default Full Marks:</span>
                <span className="font-mono font-bold">{comp.defaultFull}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Default Pass Threshold:</span>
                <span className="font-mono font-bold text-destructive">{comp.defaultPass}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
