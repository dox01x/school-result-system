"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
    GraduationCap, Users, ClipboardList,
    TrendingUp, School,
} from "lucide-react";

/* ── Count-up hook ── */
function useCountUp(target: number, duration = 800) {
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

    const cards = [
        { label: "Total Students", val: studentsCount, icon: GraduationCap, iconBg: "bg-muted", iconColor: "text-foreground group-hover:scale-110", href: "/dashboard/students" },
        { label: "Active Classes", val: classesCount, icon: School, iconBg: "bg-muted", iconColor: "text-foreground group-hover:scale-110", href: "/dashboard/classes" },
        { label: "Sections", val: sectionsCount, icon: Users, iconBg: "bg-muted", iconColor: "text-foreground group-hover:scale-110", href: "/dashboard/classes" },
        { label: "Total Exams", val: examsCount, icon: ClipboardList, iconBg: "bg-muted", iconColor: "text-foreground group-hover:scale-110", href: "/dashboard/exams" },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
            {cards.map((c) => (
                <Link key={c.label} href={c.href}>
                    <div className="group bg-card rounded-2xl p-6 border border-border shadow-sm hover:border-border dark:hover:border-border hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between h-full">
                        <div className="flex items-start justify-between mb-6">
                            <div className={`${c.iconBg} rounded-2xl p-3.5 transition-transform duration-300`}><c.icon className={`h-6 w-6 ${c.iconColor} transition-transform duration-300`} strokeWidth={1.5} /></div>
                            <TrendingUp className="h-5 w-5 text-muted-foreground/40 dark:text-muted-foreground group-hover:text-foreground dark:group-hover:text-muted-foreground/40 transition-colors" strokeWidth={2} />
                        </div>
                        <div>
                            <div className="text-4xl font-black tracking-tighter text-foreground tabular-nums leading-none">{c.val}</div>
                            <p className="text-sm text-muted-foreground mt-2 font-semibold">{c.label}</p>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}
