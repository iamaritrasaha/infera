"use client";

import React from "react";

interface ConfusionMatrixProps {
  matrix: number[][];
  labels: string[];
}

export function ConfusionMatrixGrid({ matrix, labels }: ConfusionMatrixProps) {
  if (!matrix || matrix.length === 0 || !labels || labels.length === 0) {
    return <div className="text-sm text-slate-400 py-6 text-center">No confusion matrix data.</div>;
  }

  // Calculate totals for normalized coloring
  const total = matrix.reduce((acc, row) => acc + row.reduce((rAcc, cell) => rAcc + cell, 0), 0) || 1;
  const maxCell = Math.max(...matrix.flatMap((row) => row), 1);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h5 className="text-xs font-semibold text-slate-200">Confusion Matrix</h5>
          <p className="text-[11px] text-slate-400">Rows: Actual True Class &bull; Columns: Predicted Class</p>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="inline-block">
          <table className="border-collapse table-fixed text-xs">
            <thead>
              <tr>
                <th className="p-2 w-28 text-right font-medium text-slate-400">True \ Pred</th>
                {labels.map((l, i) => (
                  <th key={i} className="p-2 text-center font-medium text-slate-300 w-24">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, rIdx) => {
                const rowLabel = labels[rIdx] ?? `Class ${rIdx}`;
                return (
                  <tr key={rIdx}>
                    <th className="p-2 text-right font-medium text-slate-400 truncate max-w-[110px]" title={rowLabel}>
                      {rowLabel}
                    </th>
                    {row.map((val, cIdx) => {
                      const isDiagonal = rIdx === cIdx;
                      const intensity = val / maxCell;
                      const pct = ((val / total) * 100).toFixed(1);

                      let bgClass = "bg-slate-900 text-slate-300";
                      if (isDiagonal) {
                        if (intensity > 0.6) bgClass = "bg-emerald-600/90 text-white font-bold";
                        else if (intensity > 0.3) bgClass = "bg-emerald-700/70 text-emerald-100 font-semibold";
                        else bgClass = "bg-emerald-950/80 text-emerald-300";
                      } else if (val > 0) {
                        if (intensity > 0.5) bgClass = "bg-rose-700/90 text-white font-bold";
                        else bgClass = "bg-rose-950/70 text-rose-300";
                      }

                      return (
                        <td
                          key={cIdx}
                          className={`p-3 text-center border border-slate-800 transition-colors ${bgClass}`}
                        >
                          <div className="font-mono text-sm">{val}</div>
                          <div className="text-[10px] opacity-75">{pct}%</div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-6 mt-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block"></span> Correct Predictions (Diagonal)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-rose-700 inline-block"></span> Misclassifications (Off-diagonal)
          </span>
        </div>
      </div>
    </div>
  );
}
