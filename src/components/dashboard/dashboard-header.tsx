"use client";

import { useEffect, useState, useCallback } from "react";
import {
  RotateCw,
  Calendar,
  Download,
  Filter,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS_EN } from "@/lib/rbac";
import type { DateRangePreset } from "@/lib/dashboard/dashboard-service";

interface Props {
  role: string;
  userName: string;
  academicYear?: string;
  schoolName?: string;
  range: DateRangePreset;
  selectedClassId?: string;
  classes: { id: string; name: string }[];
  isRefreshing: boolean;
  lastUpdated: Date;
  onRangeChange: (range: DateRangePreset) => void;
  onClassChange: (classId?: string) => void;
  onRefresh: () => void;
  onExport: (type: "summary" | "transactions" | "due", format: "csv" | "json") => void;
}

const RANGE_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  this_week: "This Week",
  this_month: "This Month",
  prev_month: "Previous Month",
  this_year: "This Year",
  custom: "Custom Range",
};

export function DashboardHeader({
  role,
  userName,
  academicYear,
  schoolName,
  range,
  selectedClassId,
  classes,
  isRefreshing,
  lastUpdated,
  onRangeChange,
  onClassChange,
  onRefresh,
  onExport,
}: Props) {
  const [freshnessText, setFreshnessText] = useState("Just now");

  const updateFreshness = useCallback(() => {
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
    if (diffSecs < 10) setFreshnessText("Just now");
    else if (diffSecs < 60) setFreshnessText(`${diffSecs}s ago`);
    else {
      const mins = Math.floor(diffSecs / 60);
      setFreshnessText(`${mins}m ago`);
    }
  }, [lastUpdated]);

  useEffect(() => {
    const interval = setInterval(updateFreshness, 5000);
    return () => clearInterval(interval);
  }, [updateFreshness]);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const roleLabel = ROLE_LABELS_EN[role as keyof typeof ROLE_LABELS_EN] || role;

  return (
    <div className="space-y-4">
      {/* Top Banner: Greeting, School & Freshness */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              {greeting}, {userName}
            </h1>
            <Badge variant="outline" className="text-xs font-semibold bg-primary/5 text-primary border-primary/20">
              <ShieldCheck size={12} className="mr-1 inline text-emerald-500" />
              {roleLabel}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{dateStr}</span>
            {academicYear && <span>· Academic Session {academicYear}</span>}
            {schoolName && <span>· {schoolName}</span>}
          </p>
        </div>

        {/* Global Controls: Filters, Refresh, Export */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          {/* Class Filter (Optional) */}
          {role !== "class_teacher" && classes && classes.length > 0 && (
            <Select
              value={selectedClassId || "all"}
              onValueChange={(val) => onClassChange(val === "all" ? undefined : val)}
            >
              <SelectTrigger className="h-8.5 text-xs w-32 sm:w-36 bg-card border-border/80">
                <Filter size={12} className="mr-1 text-muted-foreground shrink-0" />
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date Range Selector */}
          <Select value={range} onValueChange={(val) => onRangeChange(val as DateRangePreset)}>
            <SelectTrigger className="h-8.5 text-xs w-32 sm:w-36 bg-card border-border/80">
              <Calendar size={12} className="mr-1 text-muted-foreground shrink-0" />
              <SelectValue>{RANGE_LABELS[range]}</SelectValue>
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="prev_month">Previous Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>

          {/* Export Dropdown */}
          {role !== "class_teacher" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8.5 text-xs gap-1.5 bg-card">
                  <Download size={13} className="text-muted-foreground" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs w-48">
                <DropdownMenuItem onClick={() => onExport("summary", "csv")}>
                  Summary Overview (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport("summary", "json")}>
                  Summary Overview (JSON)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onExport("transactions", "csv")}>
                  Transactions Log (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport("due", "csv")}>
                  Outstanding Dues (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Refresh Button with Freshness indicator */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8.5 text-xs gap-1.5 bg-card"
            title={`Updated ${freshnessText}`}
          >
            <RotateCw size={13} className={`${isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
            <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">
              {freshnessText}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
