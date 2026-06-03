"use client";

import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Rahim Talukder",
    role: "Parent",
    avatar: "R",
    avatarBg: "from-indigo-500 to-indigo-600",
    rating: 5,
    text: "School Management System has completely transformed how I track my child's academic progress. The report cards are detailed and the interface is incredibly easy to use.",
  },
  {
    name: "Fatima Akter",
    role: "Head Teacher",
    avatar: "F",
    avatarBg: "from-teal-500 to-teal-600",
    rating: 5,
    text: "Managing results for 800+ students used to be a nightmare. With School Management System, we generate report cards in seconds. The class routine feature is a game-changer.",
  },
  {
    name: "Arif Hossain",
    role: "Student, Class 10",
    avatar: "A",
    avatarBg: "from-amber-500 to-amber-600",
    rating: 5,
    text: "I love how I can see my progress across all subjects. The AI learning suggestions helped me improve my weak areas significantly.",
  },
  {
    name: "Nasreen Begum",
    role: "School Administrator",
    avatar: "N",
    avatarBg: "from-rose-500 to-rose-600",
    rating: 5,
    text: "The finance module alone saved us hours of work each month. Fee collection, salary management — everything is streamlined beautifully.",
  },
  {
    name: "Kamal Uddin",
    role: "Mathematics Teacher",
    avatar: "K",
    avatarBg: "from-violet-500 to-violet-600",
    rating: 5,
    text: "Entering marks and managing exam schedules is so intuitive now. I can focus more on teaching and less on paperwork.",
  },
  {
    name: "Salma Khatun",
    role: "Parent",
    avatar: "S",
    avatarBg: "from-cyan-500 to-cyan-600",
    rating: 4,
    text: "The digital ID card for my daughter looks amazing! I feel confident knowing the school is using such a modern system.",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="relative py-24 md:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-teal-50/30 dark:via-teal-500/5 to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tracking-wide uppercase">
              Testimonials
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Loved by Schools{" "}
            <span className="bg-gradient-to-r from-amber-500 to-rose-500 bg-clip-text text-transparent">
              Everywhere
            </span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Hear what educators, students, and parents have to say.
          </p>
        </div>

        {/* Testimonial Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className="group relative rounded-2xl bg-white dark:bg-slate-800/60 backdrop-blur-sm border border-slate-100 dark:border-white/10 p-7 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1"
            >
              {/* Quote Icon */}
              <Quote className="w-8 h-8 text-indigo-100 dark:text-indigo-500/20 mb-4" />

              {/* Text */}
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                &ldquo;{t.text}&rdquo;
              </p>

              {/* Rating */}
              <div className="flex items-center gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star
                    key={j}
                    className={`w-4 h-4 ${
                      j < t.rating
                        ? "text-amber-400 fill-amber-400"
                        : "text-slate-200 dark:text-slate-600"
                    }`}
                  />
                ))}
              </div>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.avatarBg} flex items-center justify-center text-sm font-bold text-white shadow-lg`}
                >
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
