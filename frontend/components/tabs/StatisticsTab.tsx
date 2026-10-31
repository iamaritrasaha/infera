"use client";

import React from "react";
import { AnalysisResponse } from "@/lib/types";
import { CheckCircle2, FlaskConical, HelpCircle, XCircle } from "lucide-react";

interface StatisticsTabProps {
  data: AnalysisResponse;
}

export function StatisticsTab({ data }: StatisticsTabProps) {
  const { descriptive_statistics, hypothesis_tests } = data;
  const numDist = descriptive_statistics.numerical;

  return (
    <div className="space-y-6">
      {/* Descriptive Statistics Summary Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-white">Descriptive Statistics Table</h3>
          <p className="text-xs text-slate-400">Sample moments, quantiles, and shape parameters for all numerical features</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 px-3">Feature</th>
                <th className="py-2.5 px-3 text-right">Count</th>
                <th className="py-2.5 px-3 text-right">Mean</th>
                <th className="py-2.5 px-3 text-right">Std Dev</th>
                <th className="py-2.5 px-3 text-right">Min</th>
                <th className="py-2.5 px-3 text-right">25% (Q1)</th>
                <th className="py-2.5 px-3 text-right">Median</th>
                <th className="py-2.5 px-3 text-right">75% (Q3)</th>
                <th className="py-2.5 px-3 text-right">Max</th>
                <th className="py-2.5 px-3 text-right">Skewness</th>
                <th className="py-2.5 px-3 text-right">Kurtosis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {numDist.map((d, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-3 font-medium font-sans text-slate-200">{d.column}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">{d.count}</td>
                  <td className="py-2.5 px-3 text-right text-slate-200 font-semibold">{d.mean?.toLocaleString() ?? "Unavailable"}</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">{d.std?.toLocaleString() ?? "Unavailable"}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">{d.min.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">{d.q25.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-blue-400 font-semibold">{d.median?.toLocaleString() ?? "Unavailable"}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">{d.q75.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">{d.max.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">{d.skewness ?? "Unavailable"}</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">{d.kurtosis ?? "Unavailable"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hypothesis Testing Suite */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-white">Statistical Hypothesis Tests</h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-medium">
              alpha = 0.05
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Formal statistical inference: tests for group mean divergence, non-parametric rank equivalence, and categorical independence.
          </p>
        </div>

        {hypothesis_tests.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-lg border border-slate-800">
            No suitable categorical/numerical pairs met minimum sample criteria for hypothesis testing.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hypothesis_tests.map((test, idx) => {
              const isSignificant = test.is_rejected;
              return (
                <div
                  key={idx}
                  className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors"
                >
                  <div>
                    {/* Header: Test Name & Decision */}
                    <div className="flex flex-col xl:flex-row items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-xs font-bold text-white tracking-wide">{test.test_name}</h4>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {test.feature_a} &bull; {test.feature_b}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0 border ${
                          isSignificant
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {isSignificant ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Statistically Significant
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" /> Inconclusive
                          </>
                        )}
                      </span>
                    </div>

                    {/* Hypotheses */}
                    <div className="space-y-1.5 text-xs text-slate-300 my-3 bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
                      <div>
                        <strong className="text-slate-400 font-medium">H₀:</strong> {test.null_hypothesis}
                      </div>
                      <div>
                        <strong className="text-slate-400 font-medium">H₁:</strong> {test.alt_hypothesis}
                      </div>
                    </div>

                    {/* Numbers: Test stat, p-value */}
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono py-1">
                      <span className="text-slate-300">
                        {test.statistic_name}: <strong className="text-white">{test.statistic_value}</strong>
                      </span>
                      <span className="text-slate-300">
                        p-value:{" "}
                        <strong className={isSignificant ? "text-emerald-400" : "text-slate-200"}>
                          {test.p_value < 0.0001 ? test.p_value.toExponential(4) : test.p_value.toFixed(4)}
                        </strong>
                      </span>
                    </div>

                    {/* Plain English interpretation */}
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed bg-slate-900/30 p-2 rounded">
                      {test.interpretation}
                    </p>
                  </div>

                  {/* Footnote on assumptions */}
                  <div className="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3 shrink-0" />
                    <span>{test.assumptions_note}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
