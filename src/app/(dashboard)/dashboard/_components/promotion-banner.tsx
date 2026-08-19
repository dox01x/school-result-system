"use client";

import { usePromotionReminder } from "@/lib/hooks/usePromotionReminder";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
    academicYear: string | undefined;
};

export function PromotionBanner({ academicYear }: Props) {
    const { shouldShow, currentYear, dismiss } = usePromotionReminder(academicYear);

    if (!shouldShow) return null;

    return (
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
                <Bell className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <p className="text-sm text-foreground">
                    New calendar year ({currentYear}) detected. Academic year is still {academicYear}.
                </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" asChild>
                    <Link href="/promotion">Promote Now</Link>
                </Button>
                <Button size="sm" variant="outline" onClick={dismiss}>
                    Dismiss
                </Button>
            </div>
        </div>
    );
}
