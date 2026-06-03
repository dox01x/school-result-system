// Routine Settings page — admin can configure working days, periods, etc.
"use client";

import { useEffect, useState } from "react";
import type { RoutineSettings } from "@/types/routine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Settings as Gear, ArrowLeft, Save as FloppyDisk, Clock, CalendarDays as CalendarBlank } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const ALL_DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function RoutineSettingsPage() {
    const [settings, setSettings] = useState<RoutineSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Local form state
    const [workingDays, setWorkingDays] = useState<string[]>([]);
    const [periodsPerDay, setPeriodsPerDay] = useState(7);
    const [periodDuration, setPeriodDuration] = useState(45);
    const [periodDurations, setPeriodDurations] = useState<number[]>([]);
    const [breakAfterPeriod, setBreakAfterPeriod] = useState(3);
    const [breakDuration, setBreakDuration] = useState(20);
    const [classStartTime, setClassStartTime] = useState("08:00");

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/administration/routine/settings");
                const result = await res.json();
                if (result.success && result.data) {
                    const d = result.data;
                    setSettings(d);
                    setWorkingDays(d.working_days || ALL_DAYS.slice(0, 6));
                    setPeriodsPerDay(d.periods_per_day || 7);
                    setPeriodDuration(d.period_duration_minutes || 45);
                    setPeriodDurations(d.period_durations || []);
                    setBreakAfterPeriod(d.break_after_period || 3);
                    setBreakDuration(d.break_duration_minutes || 20);
                    setClassStartTime(d.class_start_time || "08:00");
                }
            } catch {
                toast.error("Failed to load settings");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const toggleDay = (day: string) => {
        setWorkingDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
        );
    };

    const handlePeriodDurationChange = (index: number, value: number) => {
        setPeriodDurations((prev) => {
            const newDurations = [...prev];
            // Fill array up to the index if it's currently shorter
            for (let i = 0; i <= index; i++) {
                if (newDurations[i] === undefined) {
                    newDurations[i] = periodDuration;
                }
            }
            newDurations[index] = value;
            return newDurations;
        });
    };

    const handleSave = async () => {
        if (workingDays.length === 0) {
            toast.error("Please select at least one working day");
            return;
        }
        if (periodsPerDay < 1 || periodsPerDay > 12) {
            toast.error("Periods per day must be between 1 and 12");
            return;
        }

        setSaving(true);
        try {
            // Trim or pad periodDurations to exactly match periodsPerDay
            const finalDurations = Array.from({ length: periodsPerDay }).map((_, i) => periodDurations[i] ?? periodDuration);

            const res = await fetch("/api/administration/routine/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    working_days: workingDays,
                    periods_per_day: periodsPerDay,
                    period_duration_minutes: periodDuration,
                    period_durations: finalDurations,
                    break_after_period: breakAfterPeriod,
                    break_duration_minutes: breakDuration,
                    class_start_time: classStartTime,
                }),
            });
            const result = await res.json();
            if (result.success) {
                toast.success("Settings saved successfully");
                setSettings(result.data);
                setPeriodDurations(result.data.period_durations || []);
            } else {
                toast.error(result.error || "Failed to save settings");
            }
        } catch {
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    // Compute generated time slots preview
    const timeSlots = (() => {
        const slots: { period: number; start: string; end: string; isBreak?: boolean }[] = [];
        const [startH, startM] = classStartTime.split(":").map(Number);
        let currentMinutes = startH * 60 + startM;

        for (let p = 1; p <= periodsPerDay; p++) {
            const startMin = currentMinutes;
            const currentDuration = periodDurations[p - 1] ?? periodDuration;
            const endMin = startMin + currentDuration;
            slots.push({
                period: p,
                start: `${Math.floor(startMin / 60).toString().padStart(2, "0")}:${(startMin % 60).toString().padStart(2, "0")}`,
                end: `${Math.floor(endMin / 60).toString().padStart(2, "0")}:${(endMin % 60).toString().padStart(2, "0")}`,
            });
            currentMinutes = endMin;

            // Add break after specified period
            if (p === breakAfterPeriod && breakDuration > 0 && p < periodsPerDay) {
                slots.push({
                    period: 0,
                    start: `${Math.floor(currentMinutes / 60).toString().padStart(2, "0")}:${(currentMinutes % 60).toString().padStart(2, "0")}`,
                    end: `${Math.floor((currentMinutes + breakDuration) / 60).toString().padStart(2, "0")}:${((currentMinutes + breakDuration) % 60).toString().padStart(2, "0")}`,
                    isBreak: true,
                });
                currentMinutes += breakDuration;
            }
        }
        return slots;
    })();

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Link href="/dashboard/administration/routine">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading mb-1">Routine Settings</h1>
                    <p className="text-muted-foreground mt-0.5 text-sm">Configure working days, periods, and timing for the class routine.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Working Days */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            <CalendarBlank className="h-4 w-4 text-muted-foreground" />
                            Working Days
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">Select the days when classes will be held:</p>
                        <div className="flex flex-wrap gap-2">
                            {ALL_DAYS.map((day) => {
                                const isActive = workingDays.includes(day);
                                return (
                                    <button
                                        key={day}
                                        onClick={() => toggleDay(day)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                            isActive
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-background text-muted-foreground border-border hover:border-primary/50"
                                        }`}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Selected: <span className="font-medium">{workingDays.length}</span> days
                        </p>
                    </CardContent>
                </Card>

                {/* Period Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Clock size={16} strokeWidth={1.5} className=" text-muted-foreground" />
                            Period Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label className="text-xs">Periods Per Day</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={periodsPerDay}
                                    onChange={(e) => setPeriodsPerDay(Number(e.target.value))}
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-xs">Default Period Duration (minutes)</Label>
                                <Input
                                    type="number"
                                    min={20}
                                    max={90}
                                    value={periodDuration}
                                    onChange={(e) => setPeriodDuration(Number(e.target.value))}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 space-y-3">
                                <Label className="text-xs text-muted-foreground border-b pb-1 mb-2 block">Individual Period Durations</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {Array.from({ length: periodsPerDay }).map((_, i) => (
                                        <div key={i} className="grid gap-1">
                                            <Label className="text-[10px] text-muted-foreground uppercase">Period {i + 1}</Label>
                                            <Input
                                                type="number"
                                                min={10}
                                                max={120}
                                                className="h-8 text-sm"
                                                value={periodDurations[i] ?? periodDuration}
                                                onChange={(e) => handlePeriodDurationChange(i, Number(e.target.value))}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label className="text-xs">Class Start Time</Label>
                                <Input
                                    type="time"
                                    value={classStartTime}
                                    onChange={(e) => setClassStartTime(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-xs">Break After Period</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={periodsPerDay}
                                    value={breakAfterPeriod}
                                    onChange={(e) => setBreakAfterPeriod(Number(e.target.value))}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label className="text-xs">Break Duration (minutes)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={60}
                                    value={breakDuration}
                                    onChange={(e) => setBreakDuration(Number(e.target.value))}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Time Slots Preview */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Gear size={16} strokeWidth={1.5} className=" text-muted-foreground" />
                            Time Slots Preview
                            <Badge variant="secondary" className="text-[10px] px-1.5">{periodsPerDay} periods</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {timeSlots.map((slot, i) => (
                                <div
                                    key={i}
                                    className={`rounded-lg px-3 py-2 text-center border ${
                                        slot.isBreak
                                            ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30"
                                            : "bg-accent/50 border-border"
                                    }`}
                                >
                                    <div className="text-[10px] text-muted-foreground font-medium">
                                        {slot.isBreak ? "Break" : `Period ${slot.period}`}
                                    </div>
                                    <div className="text-xs font-medium mt-0.5">
                                        {slot.start} — {slot.end}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                    <FloppyDisk size={16} strokeWidth={1.5} className=" " />
                    {saving ? "Saving..." : "Save Settings"}
                </Button>
            </div>
        </div>
    );
}
