"use client";

import {
  Zap,
  ShieldCheck,
  Smartphone,
  BarChart3,
  Clock,
  Globe,
} from "lucide-react";

const reasons = [
  { icon: Zap, title: "Lightning Fast", desc: "Optimized for speed and reliability even with thousands of students." },
  { icon: ShieldCheck, title: "Secure & Private", desc: "Role-based access control, encryption, and automated backups." },
  { icon: Smartphone, title: "Mobile-First Design", desc: "Works perfectly on every device — phones, tablets, and desktops." },
  { icon: BarChart3, title: "Data-Driven Insights", desc: "Visual dashboards and analytics to track academic performance." },
  { icon: Clock, title: "Save 10+ Hours/Week", desc: "Automate report cards, attendance, and administrative tasks." },
  { icon: Globe, title: "Multi-Language Ready", desc: "Support for Bengali, English, and other regional languages." },
];

export function WhyChooseUs() {
  return (
    <section className="py-20 md:py-28 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 items-center gap-16">
          {/* Left: Header */}
          <div className="space-y-6">
            <span className="inline-flex items-center gap-1.5 bg-brand/5 text-brand text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-widest">
              🏆 Why Choose Us
            </span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold tracking-tight text-[#0F172A]" style={{ textWrap: "balance" }}>
              Built by Educators,{" "}
              <span className="text-brand-accent">For Educators</span>
            </h2>
            <p className="text-base text-slate-600 leading-relaxed max-w-md">
              We understand the unique challenges schools face. That&apos;s why
              ResultPro is designed with a laser focus on simplicity,
              reliability, and real results.
            </p>
          </div>

          {/* Right: Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {reasons.map((r) => (
              <div
                key={r.title}
                className="flex gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5"
              >
                <div className="bg-brand-accent/10 text-brand-accent p-2.5 rounded-xl h-fit flex-shrink-0">
                  <r.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#0F172A]">{r.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
