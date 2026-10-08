import React from "react";
import Link from "next/link";
import { ArrowRight, Binary, Code2, Cpu, HeartHandshake, Shield, Sparkles } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-12 text-slate-300 text-sm leading-relaxed">
      {/* Header */}
      <div className="space-y-3 border-b border-slate-900 pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Binary className="w-3.5 h-3.5" />
          <span>Product Manifesto &amp; Engineering Values</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          About Infera
        </h1>
        <p className="text-slate-400 text-base">
          Turn data into evidence &mdash; an automated, serious data science SaaS platform.
        </p>
      </div>

      {/* The Origin */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white tracking-tight">Why We Built Infera</h2>
        <p>
          Too many modern AI tools are superficial chatbots that hallucinate statistical metrics, fail to perform proper cross-validation, and claim spurious correlations without testing significance.
        </p>
        <p>
          Infera was engineered from the ground up as a serious Python/data science backend project. Python is the brain of the platform. FastAPI exposes that brain through a clean API, and Next.js delivers a restrained, elegant user experience.
        </p>
      </section>

      {/* Philosophy */}
      <section className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-3">
        <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" /> Infera doesn&apos;t guess. It computes, validates, and explains.
        </h3>
        <p className="text-slate-400 text-xs leading-relaxed">
          Every claim in Infera has a computational foundation. If Infera highlights a correlation, you can inspect the exact Pearson r and p-value. If Infera recommends a model, it was benchmarked on held-out test data against baselines and evaluated with 5-fold cross-validation.
        </p>
      </section>

      {/* Architecture Highlights */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white tracking-tight">Architectural Decisions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-blue-400" /> Decoupled Analysis Engine
            </div>
            <p className="text-slate-400 leading-relaxed">
              The entire data science engine lives in pure Python modules testable directly with pytest without requiring a web server or database connection.
            </p>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" /> ₹0 Development Budget
            </div>
            <p className="text-slate-400 leading-relaxed">
              Designed to operate cost-free on Render Free and Vercel without paid databases, cloud storage buckets, or paid API keys.
            </p>
          </div>
        </div>
      </section>

      <div className="pt-6 border-t border-slate-900 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-colors"
        >
          <span>Try Infera Now</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
