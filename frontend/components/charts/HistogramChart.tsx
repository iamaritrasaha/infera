"use client";

import React, { useState } from "react";
import { HistogramBin } from "@/lib/types";

interface HistogramChartProps {
  column: string;
  bins: HistogramBin[];
  mean?: number | null;
  median?: number | null;
}

export function HistogramChart({ column, bins, mean, median }: HistogramChartProps) {
  const [hoveredBin, setHoveredBin] = useState<HistogramBin | null>(null);

  bins = (bins || []).filter(b => Number.isFinite(b.count) && b.count >= 0);
  if (!bins || bins.length === 0) {
    return <div className="text-sm text-slate-400 py-6 text-center">No histogram bins available.</div>;
  }

  const maxCount = Math.max(...bins.map((b) => b.count), 1);


  return (
    <div className="w-full bg-slate-900/60 border border-slate-800 rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-slate-400">
        <div>
          <span className="font-medium text-slate-200">{column}</span> Distribution
        </div>
        <div className="flex items-center gap-3">
          {mean != null && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> Mean: {mean.toLocaleString()}
            </span>
          )}
          {median != null && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Median: {median.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="relative h-44 flex items-end gap-1.5 pt-6 pb-2 border-b border-slate-800">
        {bins.map((bin, idx) => {
          const barHeightPct = (bin.count / maxCount) * 100;
          const isHovered = hoveredBin === bin;

          return (
            <div
              key={idx}
              className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
              tabIndex={0}
              role="img"
              aria-label={`${bin.label}: ${bin.count} observations`}
              onFocus={() => setHoveredBin(bin)}
              onBlur={() => setHoveredBin(null)}
              onMouseEnter={() => setHoveredBin(bin)}
              onMouseLeave={() => setHoveredBin(null)}
            >
              <div
                style={{ height: `${barHeightPct}%` }}
                className={`w-full rounded-t transition-all duration-200 ${
                  isHovered ? "bg-blue-400 shadow-lg shadow-blue-500/20" : "bg-blue-600/75 hover:bg-blue-500/90"
                }`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 justify-between items-center mt-2 text-[11px] text-slate-400">
        <span>{bins[0]?.bin_start}</span>
        <span className="text-slate-300 font-mono">
          {hoveredBin ? (
            <span>
              Range: {hoveredBin.label} &bull; <strong className="text-white">{hoveredBin.count}</strong> items
            </span>
          ) : (
            <span>Hover over a bin to inspect frequencies</span>
          )}
        </span>
        <span>{bins[bins.length - 1]?.bin_end}</span>
      </div>
    </div>
  );
}
