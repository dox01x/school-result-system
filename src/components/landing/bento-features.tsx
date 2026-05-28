"use client";

import {
  BarChart3,
  Users,
  CalendarDays,
  Wallet,
  ClipboardCheck,
  Brain,
  BookOpen,
  Shield,
} from "lucide-react";

const programs = [
  {
    icon: BarChart3,
    title: "Result Management",
    desc: "Configurable exams, automatic grading, and instant report card generation for every student.",
  },
  {
    icon: Users,
    title: "Student Profiles",
    desc: "Digital ID cards, enrollment tracking, and a comprehensive student database at your fingertips.",
  },
  {
    icon: CalendarDays,
    title: "Class Routine",
    desc: "Shift-based timetable management with built-in conflict detection and teacher assignment.",
  },
  {
    icon: Wallet,
    title: "Finance Module",
    desc: "Fee structure setup, tuition collection, salary management, and automated financial reports.",
  },
  {
    icon: ClipboardCheck,
    title: "Exam Scheduling",
    desc: "Create and manage examination schedules with intuitive subject and date assignment tools.",
  },
  {
    icon: Brain,
    title: "AI Learning",
    desc: "AI-powered curriculum analysis, weak-topic detection, and adaptive quiz generation for students.",
  },
];

export function BentoFeatures() {
  return (
    <section id="programs" className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-4">
          <span className="inline-flex items-center gap-1.5 bg-brand/5 text-brand text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-widest">
            🎯 Our Programs
          </span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold tracking-tight text-[#0F172A]" style={{ textWrap: "balance" }}>
            Everything Your School Needs
          </h2>
          <p className="text-base text-slate-600 leading-relaxed">
            A comprehensive suite of tools built for modern educational institutions.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((p) => (
            <div
              key={p.title}
              className="group bg-white border border-slate-100 rounded-2xl p-6 transition-all duration-300 hover:shadow-card-hover hover:border-brand/20 hover:-translate-y-1"
            >
              <div className="bg-brand/5 text-brand p-3 rounded-xl w-fit mb-4 group-hover:bg-brand group-hover:text-white transition-colors duration-300">
                <p.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-heading font-semibold text-[#0F172A] mb-2">
                {p.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {p.desc}
              </p>
              <span className="inline-block mt-4 text-sm font-medium text-brand opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300">
                Learn more →
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
