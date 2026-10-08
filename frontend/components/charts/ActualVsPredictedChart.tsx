"use client";

import React, { useState } from "react";

interface ScatterPoint {
  actual: number;
  predicted: number;
}

interface ActualVsPredictedProps {
  data: ScatterPoint[];
  targetName: string;
}

export function ActualVsPredictedChart({ data, targetName }: ActualVsPredictedProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ScatterPoint | null>(null);

  if (!data || data.length === 0) {
    return <div className="text-sm text-slate-400 py-6 text-center">No prediction scatter points available.</div>;
  }

  const allVals = data.flatMap((d) => [d.actual, d.predicted]);
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const range = maxVal - minVal || 1;

  // Chart dimension constants
  const size = 260;
  const padding = 30;
  const plotSize = size - padding * 2;

  const getCoord = (val: number) => {
    return padding + ((val - minVal) / range) * plotSize;
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-2">
        <h5 className="text-xs font-semibold text-slate-300">Predicted vs Actual ({targetName})</h5>
        {hoveredPoint && (
          <div className="text-[11px] font-mono text-blue-400">
            Act: {hoveredPoint.actual.toLocaleString()} | Pred: {hoveredPoint.predicted.toLocaleString()}
          </div>
        )}
      </div>

      <div className="relative">
        <svg width={size} height={size} className="overflow-visible">
          {/* Grid lines */}
          <line
            x1={padding}
            y1={size - padding}
            x2={size - padding}
            y2={size - padding}
            stroke="#334155"
            strokeWidth="1"
          />
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={size - padding}
            stroke="#334155"
            strokeWidth="1"
          />

          {/* Reference y = x diagonal line */}
          <line
            x1={padding}
            y1={size - padding}
            x2={size - padding}
            y2={padding}
            stroke="#64748b"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Data Points */}
          {data.map((pt, i) => {
            const cx = getCoord(pt.actual);
            const cy = size - getCoord(pt.predicted); // invert Y
            const isHovered = hoveredPoint === pt;

            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={isHovered ? 6 : 3.5}
                className={`transition-all cursor-pointer ${
                  isHovered ? "fill-blue-400 stroke-white stroke-2" : "fill-blue-500/80 hover:fill-blue-400"
                }`}
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}
        </svg>
      </div>

      <div className="w-full flex justify-between items-center text-[10px] text-slate-400 mt-2 px-6">
        <span>Actual: {minVal.toLocaleString()}</span>
        <span className="text-slate-500">Dashed line: Ideal 1:1 parity</span>
        <span>{maxVal.toLocaleString()}</span>
      </div>
    </div>
  );
}
