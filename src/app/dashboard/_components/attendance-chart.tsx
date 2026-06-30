"use client";

import dynamic from "next/dynamic";

type AttendanceItem = { name: "Present" | "Absent"; value: number; color: string; count: number };

type Props = {
    data: AttendanceItem[];
    label: string;
};

// Single dynamic import for the entire chart (replaces 5 separate dynamic imports)
const AttendanceChartInner = dynamic(
    () => import("./attendance-chart-inner"),
    {
        ssr: false,
        loading: () => (
            <div className="bg-card rounded-2xl p-5 border border-border">
                <div className="flex items-center justify-between mb-4">
                    <div className="h-4 w-32 rounded-md bg-muted animate-pulse" />
                    <div className="h-3 w-12 rounded-md bg-muted animate-pulse" />
                </div>
                <div className="flex items-center gap-6">
                    <div className="w-32 h-32 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="space-y-3 flex-1">
                        <div className="h-3 w-full rounded-md bg-muted animate-pulse" />
                        <div className="h-3 w-3/4 rounded-md bg-muted animate-pulse" />
                    </div>
                </div>
            </div>
        ),
    }
);

export function AttendanceChart({ data, label }: Props) {
    return <AttendanceChartInner data={data} label={label} />;
}
