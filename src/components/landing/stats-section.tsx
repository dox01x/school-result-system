"use client";

import { useEffect, useRef, useState } from "react";
import { GraduationCap, BookOpen, Award, Users } from "lucide-react";

const stats = [
  { icon: GraduationCap, value: 1250, suffix: "+", label: "Students Enrolled" },
  { icon: Users, value: 85, suffix: "+", label: "Expert Teachers" },
  { icon: Award, value: 15, suffix: "", label: "Years of Excellence" },
  { icon: BookOpen, value: 94, suffix: "%", label: "Board Pass Rate" },
];

function Counter({ target, suffix, active }: { target: number; suffix: string; active: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    let v = 0;
    const step = target / 120;
    const id = setInterval(() => {
      v += step;
      if (v >= target) { setN(target); clearInterval(id); }
      else setN(Math.floor(v));
    }, 16);
    return () => clearInterval(id);
  }, [active, target]);
  return <>{n.toLocaleString()}{suffix}</>;
}

export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="relative -mt-16 z-10 pb-12">
      <div ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 text-center transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1"
            >
              <div className="bg-brand-accent/10 text-brand-accent p-3 rounded-xl w-fit mx-auto mb-4">
                <s.icon className="w-6 h-6" />
              </div>
              <p className="text-3xl md:text-4xl font-extrabold text-brand tabular-nums">
                <Counter target={s.value} suffix={s.suffix} active={visible} />
              </p>
              <p className="text-sm text-slate-500 font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
