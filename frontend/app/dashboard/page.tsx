"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { SampleDatasetInfo } from "@/lib/types";
import { fetchHealth, fetchSamples } from "@/lib/api";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle,
  Cpu,
  Database,
  ExternalLink,
  Layers,
  Plus,
  Shield,
  Zap,
} from "lucide-react";

export default function DashboardPage() {
  const [samples, setSamples] = useState<SampleDatasetInfo[]>([]);
  const [backendHealth, setBackendHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchSamples(), fetchHealth()])
      .then(([sList, health]) => {
        setSamples(sList);
        setBackendHealth(health);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Analysis Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">
            Empirical data science platform &bull; Real-time analysis workbench
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-blue-500/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Dataset Analysis</span>
        </Link>
      </div>

      {/* System Status & Free-Tier Operational Specs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span>Computational Brain</span>
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-white">
            {backendHealth?.project || "Infera"} v{backendHealth?.version || "0.1.0"}
          </div>
          <p className="text-slate-400">Python 3.12 Engine &bull; Scikit-Learn 1.9 &bull; SciPy 1.18</p>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span>Free-Tier Guardrails</span>
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400">Memory Safe</div>
          <p className="text-slate-400">15 MB upload limit &bull; 50,000 row max &bull; In-memory TTL</p>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span>Inference Standards</span>
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-purple-400">Zero Hallucinations</div>
          <p className="text-slate-400">No external LLM &bull; Exact formulas &bull; Verifiable metrics</p>
        </div>
      </div>

      {/* Pre-Packaged Benchmark Catalog */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">Pre-Packaged Scientific Benchmarks</h2>
          <p className="text-xs text-slate-400">
            Launch immediate automated pipelines on validated real-world datasets
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {samples.map((s) => (
            <div
              key={s.id}
              className="p-5 bg-slate-900/50 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100">{s.name}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                    {s.suggested_problem_type.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{s.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Target: <strong className="text-slate-200">{s.recommended_target}</strong>
                </span>
                <Link
                  href="/"
                  className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 group"
                >
                  <span>Launch on Landing</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
