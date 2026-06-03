"use client";

import dynamic from "next/dynamic";

// Dynamically import recharts to avoid it blocking initial page load
const PieChart = dynamic(
    () => import("recharts").then((mod) => mod.PieChart),
    { ssr: false }
);
const Pie = dynamic(
    () => import("recharts").then((mod) => mod.Pie),
    { ssr: false }
);
const Cell = dynamic(
    () => import("recharts").then((mod) => mod.Cell),
    { ssr: false }
);
const ResponsiveContainer = dynamic(
    () => import("recharts").then((mod) => mod.ResponsiveContainer),
    { ssr: false }
);
const RechartsTooltip = dynamic(
    () => import("recharts").then((mod) => mod.Tooltip),
    { ssr: false }
);

type AttendanceItem = { name: "Present" | "Absent"; value: number; color: string; count: number };

type Props = {
    data: AttendanceItem[];
    label: string;
};

export function AttendanceChart({ data, label }: Props) {
    return (
        <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground font-heading">Attendance Overview</h3>
                <span className="text-[10px] text-slate-400 font-medium">{label}</span>
            </div>
            <div className="flex items-center gap-6">
                <div className="w-32 h-32 shrink-0 min-h-[128px] min-w-[128px]">
                    <ResponsiveContainer width="100%" height={128}>
                        <PieChart>
                            <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={52} paddingAngle={4} dataKey="value" strokeWidth={0}>
                                {data.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                            </Pie>
                            <RechartsTooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", fontSize: "11px", boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.06)" }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="space-y-3 flex-1">
                    {data.map((item) => (
                        <div key={item.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-xs text-muted-foreground">{item.name}</span></div>
                            <span className="text-xs font-semibold text-foreground">{item.value}%</span>
                        </div>
                    ))}
                    <div className="pt-2 border-t border-border/30">
                        <div className="flex items-center justify-between"><span className="text-[10px] text-slate-400">Total</span><span className="text-xs font-bold text-foreground">{data.reduce((acc, row) => acc + row.count, 0)}</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
