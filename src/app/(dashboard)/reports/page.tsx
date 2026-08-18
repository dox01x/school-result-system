import Link from "next/link";
import { FileText, BarChart2, Wallet, GraduationCap, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { REPORT_CATEGORIES } from "@/features/reports/constants";

export default function ReportsIndexPage() {
  const iconMap: Record<string, any> = {
    results: BarChart2,
    finance: Wallet,
    students: GraduationCap,
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Reports & Analytics" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">School Reporting & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Access institutional reports on student achievement, revenue breakdown, and attendance.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {REPORT_CATEGORIES.map((cat) => {
          const Icon = iconMap[cat.id] || FileText;
          return (
            <Link key={cat.id} href={cat.href} className="group">
              <Card className="h-full border-border/60 hover:border-primary/40 hover:shadow-md transition-all">
                <CardHeader className="pb-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold mb-2">
                    <Icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    {cat.title}
                  </CardTitle>
                  <CardDescription className="text-xs pt-1">{cat.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 flex items-center text-xs font-medium text-primary gap-1">
                  View Analytics <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
