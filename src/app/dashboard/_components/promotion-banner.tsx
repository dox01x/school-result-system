"use client";

import { usePromotionReminder } from "@/lib/hooks/usePromotionReminder";
import Link from "next/link";
import { Bell } from "lucide-react";

type Props = {
    academicYear: string | undefined;
};

export function PromotionBanner({ academicYear }: Props) {
    const { shouldShow, currentYear, dismiss } = usePromotionReminder(academicYear);

    if (!shouldShow) return null;

    return (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 min-w-0">
                <Bell className="h-5 w-5 text-red-600 shrink-0" />
                <p className="text-sm text-red-800 font-medium">
                    New calendar year ({currentYear}) detected, but active academic year is still {academicYear}. Please execute the Yearly Promotion.
                </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Link href="/dashboard/promotion" className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors btn-press">
                    Promote Now
                </Link>
                <button
                    type="button"
                    onClick={dismiss}
                    className="text-xs rounded-lg border border-red-300 px-2.5 py-1.5 text-red-800 hover:bg-red-100 transition-colors font-medium btn-press"
                >
                    Dismiss
                </button>
            </div>
        </div>
    );
}
