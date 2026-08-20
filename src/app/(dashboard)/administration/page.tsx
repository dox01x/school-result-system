"use client";

import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { CalendarCheck, UserCog, Megaphone, ArrowRight, Shield } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

const modules = [
    {
        title: "Class Routine",
        description: "Create and manage weekly class schedules for each class and section. Includes teacher and room conflict detection.",
        href: "/administration/routine",
        icon: CalendarCheck,
    },
    {
        title: "Exam Schedule",
        description: "Plan exam dates, assign rooms, and designate invigilators for each subject and class.",
        href: "/administration/exam-schedule",
        icon: CalendarCheck,
    },
    {
        title: "Teacher Shift",
        description: "Manage teacher duty rosters, assign shifts, and handle leave requests with an approval workflow.",
        href: "/administration/teacher-shift",
        icon: UserCog,
    },
    {
        title: "Notice Board",
        description: "Create announcements for students, parents, and teachers. Export notices as PDF.",
        href: "/administration/notice",
        icon: Megaphone,
    },
];

export default function AdministrationPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                icon={Shield}
                title="Administration"
                subtitle="Manage class routines, exam schedules, teacher shifts, and school notices."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.map((mod) => {
                    const Icon = mod.icon;
                    return (
                        <Link key={mod.href} href={mod.href} className="group">
                            <Card className="h-full transition-all duration-200 border border-border/80 rounded-2xl bg-card shadow-xs hover:border-primary/40 hover:shadow-md">
                                <CardContent className="p-5 flex flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                            <Icon className="h-5 w-5" strokeWidth={1.8} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{mod.title}</h3>
                                        </div>
                                        <ArrowRight size={16} strokeWidth={1.8} className="text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
                                    </div>
                                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                                        {mod.description}
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
