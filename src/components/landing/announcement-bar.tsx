"use client";

import { Megaphone } from "lucide-react";

const notices = [
  "📢 Admission Open for Session 2026-27 — Apply Now!",
  "🏆 Our students secured top positions in National Board Exams",
  "📅 Annual Sports Day — May 15, 2026",
  "📚 New AI-powered learning module launched for all students",
];

export function AnnouncementBar() {
  return (
    <div className="bg-brand text-white text-sm py-2.5 overflow-hidden">
      <div className="flex items-center gap-3 animate-marquee whitespace-nowrap">
        {[...notices, ...notices].map((n, i) => (
          <span key={i} className="inline-flex items-center gap-2 mx-8">
            <Megaphone className="w-3.5 h-3.5 text-brand-accent flex-shrink-0" />
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}
