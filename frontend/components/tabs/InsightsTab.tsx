"use client";

import React, { useState } from "react";
import { AnalysisResponse, StructuredInsight } from "@/lib/types";
import { Calculator, CheckCircle2, ChevronDown, ChevronUp, FileCode, ShieldCheck, Sparkles } from "lucide-react";

interface InsightsTabProps {
  data: AnalysisResponse;
}

export function InsightsTab({ data }: InsightsTabProps) {
  const { insights } = data;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");

  const categories = ["all", ...new Set(insights.map((i) => i.category))];

  const filteredInsights = filterCat === "all"
    ? insights
    : insights.filter((i) => i.category === filterCat);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-semibold text-white">Traceable, Evidence-Backed Insights</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Zero invented statistics. Every claim originates strictly from Python calculations with verifiable formulas and p-values.
            </p>
          </div>

          {/* Category filter tabs */}
          <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors capitalize ${
                  filterCat === cat
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {cat.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Insights Cards List */}
      <div className="space-y-3">
        {filteredInsights.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-900/40 rounded-lg border border-slate-800">
            No insights available for this category.
          </div>
        ) : (
          filteredInsights.map((ins) => {
            const isExpanded = expandedId === ins.id;

            return (
              <div
                key={ins.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                          {ins.category.replace("_", " ")}
                        </span>
                        <span className="text-xs font-semibold text-white">{ins.title}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed pt-1">{ins.plain_english}</p>
                    </div>

                    <button
                      onClick={() => toggleExpand(ins.id)}
                      className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-950/40 border border-blue-900/60 px-3 py-1.5 rounded-lg shrink-0 transition-colors"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>{isExpanded ? "Hide Calculation" : "View Evidence"}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Mathematical Traceability Drawer */}
                {isExpanded && (
                  <div className="px-5 py-4 bg-slate-950/80 border-t border-slate-800 text-xs space-y-3">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" /> Computational Proof &amp; Raw Parameters
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">ID: {ins.id}</span>
                    </div>

                    <div className="p-3 bg-slate-900/80 rounded border border-slate-800 font-mono text-[11px] text-blue-300">
                      <strong>Methodology &amp; Formula:</strong> {ins.calculation_details}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse font-mono text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 font-medium">
                            <th className="py-1 px-2">Evidence Metric</th>
                            <th className="py-1 px-2">Computed Quantitative Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {Object.entries(ins.evidence).map(([k, v]) => (
                            <tr key={k}>
                              <td className="py-1.5 px-2 text-slate-400 font-sans">{k}</td>
                              <td className="py-1.5 px-2 text-slate-200">
                                {typeof v === "number" ? v.toLocaleString() : String(v)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
