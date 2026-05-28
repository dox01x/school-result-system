"use client";

import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { CalendarClock, CalendarCheck, UserCog, Megaphone, ArrowRight, Shield } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

const modules = [
    {
        title: "Class Routine",
        description: "Create and manage weekly class schedules for each class and section. Includes teacher and room conflict detection.",
        href: "/dashboard/administration/routine",
        icon: CalendarClock,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-50 dark:bg-blue-500/10",
    },
    {
        title: "Exam Schedule",
        description: "Plan exam dates, assign rooms, and designate invigilators for each subject and class.",
        href: "/dashboard/administration/exam-schedule",
        icon: CalendarCheck,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-500/10",
    },
    {
        title: "Teacher Shift",
        description: "Manage teacher duty rosters, assign shifts, and handle leave requests with an approval workflow.",
        href: "/dashboard/administration/teacher-shift",
        icon: UserCog,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-500/10",
    },
    {
        title: "Notice Board",
        description: "Create announcements for students, parents, and teachers. Export notices as PDF.",
        href: "/dashboard/administration/notice",
        icon: Megaphone,
        color: "text-purple-600 dark:text-purple-400",
        bg: "bg-purple-50 dark:bg-purple-500/10",
    },
];

export default function AdministrationPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                icon={Shield}
                iconBg="bg-rose-50"
                iconColor="text-rose-600"
                title="Administration"
                subtitle="Manage class routines, exam schedules, teacher shifts, and school notices."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.map((mod) => {
                    const Icon = mod.icon;
                    return (
                        <Link key={mod.href} href={mod.href} className="group">
                            <Card className="h-full transition-all duration-200 hover:border-blue-200 hover:shadow-md">
                                <CardContent className="p-5 flex flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-10 w-10 rounded-xl ${mod.bg} flex items-center justify-center shrink-0`}>
                                            <Icon className={`h-5 w-5 ${mod.color}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-sm">{mod.title}</h3>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
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
