"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface DashboardAlert {
  id: string;
  priority: "critical" | "warning" | "info";
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

interface Props {
  alerts: DashboardAlert[];
}

export function AttentionCenter({ alerts }: Props) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-3" role="region" aria-label="Actionable Alerts Center">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={15} strokeWidth={2.2} />
          </div>
          <h2 className="text-sm font-semibold text-foreground tracking-tight">Attention Center</h2>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold">
            {alerts.length}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {alerts.map((alert) => {
          let borderStyle = "border-border";
          const bgStyle = "bg-card";
          let iconBg = "bg-blue-500/10 text-blue-600 dark:text-blue-400";
          let IconComponent = Info;
          let priorityLabel = "Info";
          let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";

          if (alert.priority === "critical") {
            borderStyle = "border-destructive/30 bg-destructive/5 hover:border-destructive/50";
            iconBg = "bg-destructive/10 text-destructive";
            IconComponent = AlertCircle;
            priorityLabel = "Action Required";
            badgeVariant = "destructive";
          } else if (alert.priority === "warning") {
            borderStyle = "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50";
            iconBg = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
            IconComponent = AlertTriangle;
            priorityLabel = "Notice";
            badgeVariant = "secondary";
          }

          return (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border ${borderStyle} ${bgStyle} shadow-xs flex flex-col justify-between transition-all duration-150`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${iconBg} shrink-0`}>
                      <IconComponent size={14} strokeWidth={2.2} />
                    </div>
                    <Badge variant={badgeVariant} className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0">
                      {priorityLabel}
                    </Badge>
                  </div>
                </div>
                <h3 className="text-[13px] font-semibold text-foreground leading-snug line-clamp-1">{alert.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{alert.description}</p>
              </div>

              <div className="pt-3 mt-2 flex items-center justify-end">
                <Button
                  size="sm"
                  variant={alert.priority === "critical" ? "destructive" : "outline"}
                  asChild
                  className="text-xs h-7 gap-1 font-medium shadow-none"
                >
                  <Link href={alert.actionHref}>
                    {alert.actionLabel}
                    <ArrowRight size={12} strokeWidth={2} />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
