"use client";

import React, { useState } from "react";
import { CorrelationMatrix } from "@/lib/types";

interface HeatmapProps {
  matrix: CorrelationMatrix;
}

export function CorrelationHeatmap({ matrix }: HeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    rowCol: string;
    colCol: string;
    r: number;
  } | null>(null);

  const cols = matrix.columns;
  if (!cols || cols.length === 0) {
    return <div className="text-sm text-slate-400 py-6 text-center">Insufficient numerical features for correlation matrix.</div>;
  }

  // Get color for correlation value [-1, 1]
  const getColor = (r: number) => {
    if (r === 1.0) return "bg-blue-600 text-white font-bold";
    if (r > 0.7) return "bg-blue-700/80 text-white";
    if (r > 0.4) return "bg-blue-800/60 text-blue-100";
    if (r > 0.15) return "bg-blue-950/70 text-blue-200";
    if (r >= -0.15 && r <= 0.15) return "bg-slate-900/80 text-slate-400";
    if (r < -0.7) return "bg-rose-700/80 text-white";
    if (r < -0.4) return "bg-rose-800/60 text-rose-100";
    return "bg-rose-950/70 text-rose-200";
  };

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800 rounded-lg p-4 overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-200">Pearson Correlation Matrix</h4>
          <p className="text-xs text-slate-400">Values range from -1.0 (inverse) to +1.0 (direct)</p>
        </div>
        {hoveredCell && (
          <div className="text-xs bg-slate-800 px-3 py-1.5 rounded border border-slate-700">
            <span className="text-slate-300">{hoveredCell.rowCol}</span> &times;{" "}
            <span className="text-slate-300">{hoveredCell.colCol}</span>:{" "}
            <strong className={hoveredCell.r >= 0 ? "text-blue-400" : "text-rose-400"}>
              r = {hoveredCell.r > 0 ? `+${hoveredCell.r.toFixed(3)}` : hoveredCell.r.toFixed(3)}
            </strong>
          </div>
        )}
      </div>

      <div className="inline-block min-w-full">
        <table className="border-collapse table-fixed text-xs">
          <thead>
            <tr>
              <th className="p-1.5 w-24"></th>
              {cols.map((c, i) => (
                <th key={i} className="p-1.5 text-center font-medium text-slate-400 truncate max-w-[80px]" title={c}>
                  {c.length > 8 ? `${c.substring(0, 7)}…` : c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cols.map((rowName, rIdx) => (
              <tr key={rIdx}>
                <th className="p-1.5 text-right font-medium text-slate-400 truncate max-w-[100px]" title={rowName}>
                  {rowName.length > 10 ? `${rowName.substring(0, 9)}…` : rowName}
                </th>
                {cols.map((colName, cIdx) => {
                  const val = matrix.pearson_matrix[rIdx]?.[cIdx] ?? 0;
                  return (
                    <td
                      key={cIdx}
                      onMouseEnter={() => setHoveredCell({ rowCol: rowName, colCol: colName, r: val })}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`p-1.5 text-center font-mono cursor-pointer transition-colors border border-slate-900/40 ${getColor(
                        val
                      )}`}
                    >
                      {val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-400 pt-3 border-t border-slate-800">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-700/80 inline-block"></span> Strong Inverse (-1.0 to -0.5)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-900 inline-block border border-slate-700"></span> Uncorrelated (-0.15 to +0.15)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-700/80 inline-block"></span> Strong Direct (+0.5 to +1.0)
        </span>
      </div>
    </div>
  );
}
