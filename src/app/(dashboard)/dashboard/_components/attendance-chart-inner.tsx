"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { Badge } from "@/components/ui/badge";

type AttendanceItem = { name: "Present" | "Absent"; value: number; color: string; count: number };

type Props = {
    data: AttendanceItem[];
    label: string;
};

export default function AttendanceChartInner({ data, label }: Props) {
    const total = data.reduce((acc, row) => acc + row.count, 0);

    return (
        <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
            <div className="w-36 h-36 shrink-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height={144}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={42}
                            outerRadius={62}
                            paddingAngle={3}
                            dataKey="value"
                            strokeWidth={0}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <RechartsTooltip
                            contentStyle={{
                                backgroundColor: "var(--card)",
                                color: "var(--card-foreground)",
                                border: "1px solid var(--border)",
                                borderRadius: "8px",
                                fontSize: "12px",
                                boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.08)",
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-lg font-bold text-foreground leading-tight tabular-nums">{total}</span>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Students</span>
                </div>
            </div>

            <div className="space-y-3 flex-1 w-full max-w-sm">
                {data.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/50">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-xs font-semibold text-foreground">{item.name}</span>
                            <span className="text-[11px] text-muted-foreground tabular-nums">({item.count})</span>
                        </div>
                        <Badge
                            variant={item.name === "Present" ? "success" : "destructive"}
                            className="text-xs font-bold tabular-nums"
                        >
                            {item.value}%
                        </Badge>
                    </div>
                ))}
            </div>
        </div>
    );
}
