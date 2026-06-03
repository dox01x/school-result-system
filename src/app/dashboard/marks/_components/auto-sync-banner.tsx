"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AutoSyncBannerProps {
    enabled: boolean;
    intervalSec: number;
    syncStatus: "idle" | "syncing" | "error";
    lastSyncTime: Date | null;
    onStop: () => void;
}

/**
 * Indicator bar displayed when Google Sheets auto-sync is active.
 * Shows sync interval, status, and a stop button.
 */
const AutoSyncBanner = React.memo(function AutoSyncBanner({
    enabled,
    intervalSec,
    syncStatus,
    lastSyncTime,
    onStop,
}: AutoSyncBannerProps) {
    if (!enabled) return null;

    return (
        <Card className="border-0 bg-emerald-50 shadow-none rounded-xl">
            <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                    <p className="text-sm text-primary dark:text-emerald-400 font-medium">
                        Auto-Sync ON — every {intervalSec}s
                        {syncStatus === "syncing" && " (syncing…)"}
                        {syncStatus === "error" && " (error, retrying…)"}
                        {lastSyncTime && syncStatus === "idle" &&
                            ` — last: ${lastSyncTime.toLocaleTimeString()}`}
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={onStop} className="h-7 text-xs">
                    Stop Sync
                </Button>
            </CardContent>
        </Card>
    );
});

AutoSyncBanner.displayName = "AutoSyncBanner";

export default AutoSyncBanner;
