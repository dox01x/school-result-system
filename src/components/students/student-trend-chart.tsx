"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts";

type MarkTrend = { exam: string; percentage: number };

interface StudentTrendChartProps {
    data: MarkTrend[];
}

export default function StudentTrendChart({ data }: StudentTrendChartProps) {
    if (data.length === 0) {
        return <p className="text-sm text-muted-foreground">No results found.</p>;
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="exam" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dy={10} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                />
                <Bar dataKey="percentage" fill="var(--primary)" radius={[6, 6, 0, 0]} barSize={40} />
            </BarChart>
        </ResponsiveContainer>
    );
}
