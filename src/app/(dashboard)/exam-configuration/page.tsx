import Link from "next/link";
import { Sliders, Award, BookOpen, Layers, ShieldCheck, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";

const CONFIG_CARDS = [
  {
    title: "Grading Scales & GPA",
    description: "Define grade points, letter grades (A+, A, A-, B, C, D, F) and percentage boundaries.",
    href: "/exam-configuration/grading",
    icon: Award,
  },
  {
    title: "Subject Configurations",
    description: "Map subjects, credit hours, optional subject rules, and specific examination weightages.",
    href: "/exam-configuration/subjects",
    icon: BookOpen,
  },
  {
    title: "Marks Components",
    description: "Manage assessment components: Written (Theory), MCQ, Practical Lab, and Continuous Assignment.",
    href: "/exam-configuration/components",
    icon: Layers,
  },
  {
    title: "Pass / Fail Rules",
    description: "Establish pass criteria, grace marks, mandatory subject thresholds, and promotion prerequisites.",
    href: "/exam-configuration/rules",
    icon: ShieldCheck,
  },
];

export default function ExamConfigurationPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Examinations", href: "/exams" },
          { label: "Exam Configuration" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Exam Configuration Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure system-wide academic grading criteria, subject setups, and marks distribution.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CONFIG_CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.href} href={c.href} className="group">
              <Card className="h-full border-border/60 hover:border-primary/40 hover:shadow-md transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <Icon className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-base group-hover:text-primary transition-colors">
                      {c.title}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs pt-1.5">{c.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 flex items-center text-xs font-medium text-primary gap-1">
                  Configure Settings <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
