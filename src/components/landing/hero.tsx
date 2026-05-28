"use client";

import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-br from-brand to-brand-light">
      {/* Geometric Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Diagonal accent */}
      <div className="absolute -bottom-1 left-0 right-0 h-24 bg-surface" style={{ clipPath: "polygon(0 100%, 100% 100%, 100% 0)" }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 grid lg:grid-cols-2 items-center gap-16">
        {/* Left: Text */}
        <div className="space-y-8">
          {/* Eyebrow */}
          <span className="inline-flex items-center gap-1.5 bg-brand-accent/15 text-brand-accent text-xs font-semibold px-3 py-1.5 rounded-full uppercase tracking-widest">
            🎓 Modern School Platform
          </span>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-heading font-extrabold tracking-tight text-white leading-tight" style={{ textWrap: "balance" }}>
            Shaping Futures{" "}
            <span className="text-brand-accent">Through</span>{" "}
            Excellence
          </h1>

          {/* Subtext */}
          <p className="text-lg md:text-xl text-slate-300 max-w-lg leading-relaxed">
            A comprehensive school management system that empowers educators,
            engages students, and simplifies academic administration.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 bg-brand-accent hover:bg-brand-accent-dark text-white font-semibold text-sm tracking-wide px-6 py-3.5 rounded-xl shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-95"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <button
              onClick={() =>
                document.querySelector("#about")?.scrollIntoView({ behavior: "smooth" })
              }
              className="inline-flex items-center gap-2 border border-white/25 text-white font-semibold text-sm px-6 py-3.5 rounded-xl hover:bg-white/10 transition-all duration-200"
            >
              <Play className="w-4 h-4" />
              Learn More
            </button>
          </div>
        </div>

        {/* Right: Dashboard Preview Card */}
        <div className="hidden lg:block">
          <div className="relative rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 shadow-2xl p-6 space-y-5">
            {/* Window dots */}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
              <div className="w-3 h-3 rounded-full bg-green-400/80" />
              <div className="flex-1" />
              <span className="text-xs text-white/40 font-mono">resultpro.app</span>
            </div>
            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Students", value: "1,247", color: "bg-indigo-500/20 text-indigo-200" },
                { label: "Subjects", value: "42", color: "bg-teal-500/20 text-teal-200" },
                { label: "Pass Rate", value: "94.2%", color: "bg-amber-500/20 text-amber-200" },
              ].map((s) => (
                <div key={s.label} className={`${s.color} rounded-xl p-4 text-center`}>
                  <p className="text-2xl font-extrabold text-white">{s.value}</p>
                  <p className="text-xs mt-1 opacity-70">{s.label}</p>
                </div>
              ))}
            </div>
            {/* Mini progress bars */}
            <div className="space-y-3">
              {[
                { label: "Mathematics", pct: 87 },
                { label: "Science", pct: 92 },
                { label: "English", pct: 78 },
              ].map((b) => (
                <div key={b.label} className="space-y-1">
                  <div className="flex justify-between text-xs text-white/60">
                    <span>{b.label}</span>
                    <span>{b.pct}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-accent rounded-full animate-bar-fill"
                      style={{ width: `${b.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
