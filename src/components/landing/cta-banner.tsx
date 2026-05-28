"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export function CTABanner() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-indigo-700 to-teal-600" />
          {/* Pattern overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
          {/* Glow orbs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />

          {/* Content */}
          <div className="relative px-8 py-16 md:py-20 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="text-xs font-semibold text-white/90 tracking-wide uppercase">
                Get Started Today
              </span>
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight max-w-2xl mx-auto leading-tight">
              Ready to Transform Your School?
            </h2>
            <p className="text-lg text-indigo-100 max-w-lg mx-auto">
              Join hundreds of institutions already using ResultPro to manage
              their academic operations efficiently.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2 px-8 py-4 text-sm font-semibold text-indigo-700 bg-white hover:bg-indigo-50 rounded-2xl shadow-xl shadow-black/10 transition-all duration-300 hover:-translate-y-0.5"
              >
                Start Now — Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button
                onClick={() =>
                  document
                    .querySelector("#features")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="inline-flex items-center gap-2 px-8 py-4 text-sm font-semibold text-white border-2 border-white/30 hover:border-white/50 hover:bg-white/10 rounded-2xl transition-all duration-300 hover:-translate-y-0.5"
              >
                Explore Features
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
