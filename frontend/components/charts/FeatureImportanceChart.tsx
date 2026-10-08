"use client";

import React from "react";

interface FeatureImportanceProps {
  importances: { feature: string; importance: number; signed_coefficient?: number }[];
  title?: string;
}

export function FeatureImportanceChart({ importances, title = "Top Predictive Features" }: FeatureImportanceProps) {
  if (!importances || importances.length === 0) {
    return <div className="text-sm text-slate-400 py-4 text-center">No feature importance metrics available.</div>;
  }

  const top10 = importances.filter(f => Number.isFinite(f.importance)).slice(0, 10);
  const maxImp = Math.max(...top10.map((f) => f.importance), 0.0001);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-xs font-semibold text-slate-200">{title}</h5>
        <span className="text-[11px] text-slate-400">Relative contribution</span>
      </div>

      <div className="space-y-2">
        {top10.map((f, i) => {
          const pct = ((f.importance / maxImp) * 100).toFixed(0);
          return (
            <div key={i} className="flex items-center gap-3 text-xs">
              <div className="w-20 sm:w-36 text-right font-medium text-slate-300 truncate" title={f.feature}>
                {f.feature}
              </div>
              <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden flex items-center">
                <div
                  style={{ width: `${pct}%` }}
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-300"
                />
              </div>
              <div className="w-14 font-mono text-[11px] text-slate-400 text-right">
                {f.signed_coefficient !== undefined ? (
                  <span className={f.signed_coefficient >= 0 ? "text-blue-400" : "text-rose-400"}>
                    {f.signed_coefficient > 0 ? `+${f.signed_coefficient.toFixed(3)}` : f.signed_coefficient.toFixed(3)}
                  </span>
                ) : (
                  <span>{f.importance.toPrecision(3)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
