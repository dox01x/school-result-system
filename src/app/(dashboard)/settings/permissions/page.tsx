"use client";

import Link from "next/link";
import { ArrowLeft, Shield, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { USER_ROLES } from "@/features/users/constants";

const PERMISSION_MATRIX = [
  { module: "Dashboard Overview", super_admin: true, admin: true, exam_controller: true, class_teacher: true, accountant: true, viewer: true },
  { module: "Student Management & Admissions", super_admin: true, admin: true, exam_controller: false, class_teacher: true, accountant: false, viewer: false },
  { module: "Classes & Sections Setup", super_admin: true, admin: true, exam_controller: true, class_teacher: false, accountant: false, viewer: false },
  { module: "Exam Setup & Term Weightage", super_admin: true, admin: true, exam_controller: true, class_teacher: false, accountant: false, viewer: false },
  { module: "Marks Entry & Bulk Import", super_admin: true, admin: true, exam_controller: true, class_teacher: true, accountant: false, viewer: false },
  { module: "Results Publication & Marksheets", super_admin: true, admin: true, exam_controller: true, class_teacher: false, accountant: false, viewer: false },
  { module: "Fee Collection & Tuition", super_admin: true, admin: true, exam_controller: false, class_teacher: false, accountant: true, viewer: false },
  { module: "Salary, Expense & Daily Closing", super_admin: true, admin: true, exam_controller: false, class_teacher: false, accountant: true, viewer: false },
  { module: "Routine & Duty Timetable", super_admin: true, admin: true, exam_controller: true, class_teacher: false, accountant: false, viewer: false },
  { module: "User Accounts & Role Assignment", super_admin: true, admin: false, exam_controller: false, class_teacher: false, accountant: false, viewer: false },
];

export default function PermissionsMatrixPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "Permissions Matrix" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Role-Based Permissions Matrix</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            System security boundaries and module privileges for each operational role.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Settings
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[640px]">
              <thead className="bg-muted/50 border-b border-border uppercase font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3.5">Module / Feature</th>
                  <th className="p-3.5 text-center">Super Admin</th>
                  <th className="p-3.5 text-center">Admin</th>
                  <th className="p-3.5 text-center">Exam Controller</th>
                  <th className="p-3.5 text-center">Class Teacher</th>
                  <th className="p-3.5 text-center">Accountant</th>
                  <th className="p-3.5 text-center">Viewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {PERMISSION_MATRIX.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-medium text-foreground text-sm">{row.module}</td>
                    <td className="p-3.5 text-center">{row.super_admin ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />}</td>
                    <td className="p-3.5 text-center">{row.admin ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />}</td>
                    <td className="p-3.5 text-center">{row.exam_controller ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />}</td>
                    <td className="p-3.5 text-center">{row.class_teacher ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />}</td>
                    <td className="p-3.5 text-center">{row.accountant ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />}</td>
                    <td className="p-3.5 text-center">{row.viewer ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
