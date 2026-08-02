"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
    GraduationCap, Users, ClipboardList, School,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ── Count-up hook ── */
function useCountUp(target: number, duration = 600) {
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

    const cards: { label: string; val: number; icon: LucideIcon; href: string }[] = [
        { label: "Students", val: studentsCount, icon: GraduationCap, href: "/dashboard/students" },
        { label: "Classes", val: classesCount, icon: School, href: "/dashboard/classes" },
        { label: "Sections", val: sectionsCount, icon: Users, href: "/dashboard/classes" },
        { label: "Exams", val: examsCount, icon: ClipboardList, href: "/dashboard/exams" },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c) => (
                <Link key={c.label} href={c.href}>
                    <div className="bg-card rounded-xl p-5 border border-border hover:border-border/80 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[13px] font-medium text-muted-foreground">{c.label}</p>
                            <c.icon className="h-4 w-4 text-muted-foreground/50" strokeWidth={1.5} />
                        </div>
                        <div className="text-2xl font-semibold text-foreground tabular-nums">
                            {c.val}
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}
