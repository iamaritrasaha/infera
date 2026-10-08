import Link from "next/link";
import { ArrowRight, Binary, Code2, Cpu, Shield } from "lucide-react";

export default function AboutPage() {
  return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10 text-slate-300 text-sm leading-7">
    <header className="space-y-4 border-b border-slate-800 pb-8">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-400"><Binary className="w-4 h-4" /> About Infera</p>
      <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight">Built independently.<br />Designed around evidence.</h1>
      <p className="text-base text-slate-400 max-w-2xl">Infera is an open-source automated data science platform that transforms structured datasets into understandable, verifiable insights.</p>
    </header>
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-white">Why I built Infera</h2>
      <p>I created Infera to make statistical analysis and machine learning more accessible without requiring users to write extensive data-processing code.</p>
      <p>The goal is a system that performs real computations in Python and explains the results transparently. Dataset profiling, statistical tests, and model comparisons help users inspect evidence, understand limitations, and decide what to investigate next.</p>
    </section>
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-white">The engineering approach</h2>
      <p>Python is the computational foundation. FastAPI exposes the analysis engine, while Pandas, NumPy, SciPy, Statsmodels, and scikit-learn provide the tools for profiling, statistical inference, and machine learning. Next.js presents the results.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"><Cpu className="w-5 h-5 text-blue-400 mb-3" /><h3 className="font-semibold text-white">Computation before interpretation</h3><p className="mt-2 text-slate-400">Statistical computation is separate from presentation. Numerical findings originate from calculations and can be inspected through their supporting evidence.</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"><Shield className="w-5 h-5 text-emerald-400 mb-3" /><h3 className="font-semibold text-white">Transparent limitations</h3><p className="mt-2 text-slate-400">Unavailable analyses are explained. Comparisons include baselines, validation methods, and resource constraints so a high ranking is not mistaken for proof of a useful model.</p></div>
      </div>
    </section>
    <section className="rounded-2xl border border-blue-900/50 bg-blue-950/20 p-6 sm:p-8">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-3">The philosophy</h2>
      <blockquote className="text-xl sm:text-2xl font-semibold text-white leading-relaxed">“Infera doesn’t guess. It computes, validates, and explains.”</blockquote>
    </section>
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-white">Independent development</h2>
      <p>Infera is independently designed and developed by <strong className="text-white">Aritra Saha</strong>, its sole creator and developer. The project is open source under the MIT License and uses a Python + FastAPI backend without requiring paid APIs or services.</p>
      <a href="https://github.com/iamaritrasaha/infera" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"><Code2 className="w-4 h-4" /> Explore the source on GitHub</a>
    </section>
    <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-5 py-3 text-sm font-semibold text-white">Open the dashboard <ArrowRight className="w-4 h-4" /></Link>
  </div>;
}
