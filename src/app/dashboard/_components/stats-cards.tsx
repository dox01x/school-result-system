"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
    GraduationCap, Users, ClipboardList, School, ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ── Count-up hook ── */
function useCountUp(target: number, duration = 500) {
    const [val, setVal] = useState(0);
    const ref = useRef<number>(0);
    useEffect(() => {
        if (target === 0) {
            queueMicrotask(() => setVal(0));
            return;
        }
        const start = ref.current;
        const diff = target - start;
        const startTime = performance.now();
        const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + diff * eased);
            setVal(current);
            if (progress < 1) requestAnimationFrame(animate);
            else ref.current = target;
        };
        requestAnimationFrame(animate);
    }, [target, duration]);
    return val;
}

type Props = {
    students: number;
    classes: number;
    sections: number;
    exams: number;
};

export function StatsCards({ students, classes, sections, exams }: Props) {
    const studentsCount = useCountUp(students);
    const classesCount = useCountUp(classes);
    const sectionsCount = useCountUp(sections);
    const examsCount = useCountUp(exams);

    const cards: {
        label: string;
        val: number;
        icon: LucideIcon;
        href: string;
        color: string;
        bg: string;
        subLabel: string;
    }[] = [
        {
            label: "Enrolled Students",
            val: studentsCount,
            icon: GraduationCap,
            href: "/dashboard/students",
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-500/10 border-blue-500/20",
            subLabel: "Active records",
        },
        {
            label: "Academic Classes",
            val: classesCount,
            icon: School,
            href: "/dashboard/classes",
            color: "text-indigo-600 dark:text-indigo-400",
            bg: "bg-indigo-500/10 border-indigo-500/20",
            subLabel: "Configured grades",
        },
        {
            label: "Class Sections",
            val: sectionsCount,
            icon: Users,
            href: "/dashboard/classes",
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/20",
            subLabel: "Active divisions",
        },
        {
            label: "Total Exams",
            val: examsCount,
            icon: ClipboardList,
            href: "/dashboard/exams",
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-500/10 border-amber-500/20",
            subLabel: "Terms & evaluations",
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {cards.map((c) => (
                <Link key={c.label} href={c.href} className="group block focus-visible:outline-none">
                    <div className="bg-card rounded-xl p-4 sm:p-5 border border-border/80 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all duration-150 relative overflow-hidden active:scale-[0.99]">
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <div className={`p-2 rounded-lg border ${c.bg} ${c.color} shrink-0`}>
                                <c.icon className="h-4.5 w-4.5" strokeWidth={2} />
                            </div>
                            <span className="text-muted-foreground/50 group-hover:text-primary transition-colors">
                                <ArrowUpRight size={15} strokeWidth={2} />
                            </span>
                        </div>
                        <div>
                            <div className="text-xl sm:text-2xl font-bold text-foreground tracking-tight tabular-nums">
                                {c.val}
                            </div>
                            <p className="text-xs sm:text-[13px] font-medium text-foreground/90 mt-0.5 truncate">
                                {c.label}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                {c.subLabel}
                            </p>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}
