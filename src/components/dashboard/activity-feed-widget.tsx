"use client";

import { Clock, Megaphone, UserPlus, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ActivityItem {
  id: string;
  type: "payment" | "notice" | "admission";
  title: string;
  description: string;
  timestamp: string;
  formattedTime: string;
  badgeVariant?: "success" | "warning" | "default" | "destructive";
}

interface Props {
  activities: ActivityItem[];
}

export function ActivityFeedWidget({ activities }: Props) {
  return (
    <div className="bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
              <Clock size={16} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground tracking-tight">Recent Activities</h3>
              <p className="text-xs text-muted-foreground">Institutional audit feed</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Live stream
          </Badge>
        </div>

        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No recent institutional activity recorded
            </div>
          ) : (
            activities.slice(0, 6).map((item) => {
              let IconComponent = Clock;
              let iconColor = "text-muted-foreground bg-muted";

              if (item.type === "payment") {
                IconComponent = Receipt;
                iconColor = "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10";
              } else if (item.type === "notice") {
                IconComponent = Megaphone;
                iconColor = "text-amber-600 dark:text-amber-400 bg-amber-500/10";
              } else if (item.type === "admission") {
                IconComponent = UserPlus;
                iconColor = "text-blue-600 dark:text-blue-400 bg-blue-500/10";
              }

              return (
                <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors">
                  <div className={`p-2 rounded-lg ${iconColor} shrink-0 mt-0.5`}>
                    <IconComponent size={14} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
                      <span className="text-[10.5px] text-muted-foreground shrink-0">{item.formattedTime}</span>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5 line-clamp-1 leading-snug">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
