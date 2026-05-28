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
        { label: "Total Students", val: studentsCount, icon: GraduationCap, iconBg: "bg-blue-50", iconColor: "text-blue-600", href: "/dashboard/students" },
        { label: "Active Classes", val: classesCount, icon: School, iconBg: "bg-emerald-50", iconColor: "text-emerald-600", href: "/dashboard/classes" },
        { label: "Sections", val: sectionsCount, icon: Users, iconBg: "bg-violet-50", iconColor: "text-violet-600", href: "/dashboard/classes" },
        { label: "Total Exams", val: examsCount, icon: ClipboardList, iconBg: "bg-rose-50", iconColor: "text-rose-500", href: "/dashboard/exams" },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
            {cards.map((c) => (
                <Link key={c.label} href={c.href}>
                    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm hover-lift cursor-pointer">
                        <div className="flex items-start justify-between mb-3">
                            <div className={`${c.iconBg} rounded-xl p-2.5`}><c.icon className={`h-5 w-5 ${c.iconColor}`} strokeWidth={1.8} /></div>
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className="text-2xl font-bold text-slate-800 tabular-nums">{c.val}</div>
                        <p className="text-xs text-slate-400 mt-1 font-medium">{c.label}</p>
                    </div>
                </Link>
            ))}
        </div>
    );
}
