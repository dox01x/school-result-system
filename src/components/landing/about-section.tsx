"use client";

import { Target, Eye, Heart } from "lucide-react";

export function AboutSection() {
  return (
    <section id="about" className="py-20 md:py-28 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 items-center gap-16">
        {/* Left: Text */}
        <div className="space-y-6">
          <span className="inline-flex items-center gap-1.5 bg-brand/5 text-brand text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-widest">
            📚 About Us
          </span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold tracking-tight text-[#0F172A]" style={{ textWrap: "balance" }}>
            Building a Foundation for{" "}
            <span className="text-brand-accent">Lifelong Learning</span>
          </h2>
          <p className="text-base font-normal leading-relaxed text-slate-600 max-w-lg">
            ResultPro is more than a school management tool — it&apos;s an ecosystem
            designed to nurture academic growth. We combine modern technology
            with proven educational practices to create an environment where
            every student can thrive.
          </p>
          <div className="space-y-4 pt-2">
            {[
              { icon: Target, title: "Our Mission", desc: "To empower schools with intuitive tools that simplify administration and enhance learning outcomes." },
              { icon: Eye, title: "Our Vision", desc: "A future where technology bridges the gap between educators and students seamlessly." },
              { icon: Heart, title: "Our Values", desc: "Trust, innovation, accessibility, and a relentless focus on student success." },
            ].map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="bg-brand-accent/10 text-brand-accent p-2.5 rounded-xl h-fit flex-shrink-0">
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#0F172A]">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Visual Card */}
        <div className="relative">
          <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {[
                { n: "15+", l: "Years Experience", c: "bg-brand-pale text-brand" },
                { n: "500+", l: "Schools Trust Us", c: "bg-amber-50 text-brand-accent" },
                { n: "50K+", l: "Students Managed", c: "bg-emerald-50 text-emerald-600" },
                { n: "99.9%", l: "Uptime", c: "bg-violet-50 text-violet-600" },
              ].map((b) => (
                <div key={b.l} className={`${b.c} rounded-2xl p-5 text-center`}>
                  <p className="text-2xl font-extrabold">{b.n}</p>
                  <p className="text-xs font-medium mt-1 opacity-70">{b.l}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Decorative dot pattern */}
          <div
            className="absolute -top-6 -right-6 w-32 h-32 -z-10 opacity-30"
            style={{
              backgroundImage: "radial-gradient(#0F2D5A 1.5px, transparent 1.5px)",
              backgroundSize: "12px 12px",
            }}
          />
        </div>
      </div>
    </section>
  );
}
