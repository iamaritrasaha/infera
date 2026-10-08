"use client";

import React, { useState } from "react";

interface ResidualPoint {
  predicted: number;
  residual: number;
}

interface ResidualChartProps {
  data: ResidualPoint[];
}

export function ResidualChart({ data }: ResidualChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ResidualPoint | null>(null);

  if (!data || data.length === 0) {
    return <div className="text-sm text-slate-400 py-6 text-center">No residual points available.</div>;
  }

  const predVals = data.map((d) => d.predicted);
  const resVals = data.map((d) => d.residual);

  const minPred = Math.min(...predVals);
  const maxPred = Math.max(...predVals);
  const rangePred = maxPred - minPred || 1;

  const maxAbsRes = Math.max(...resVals.map((v) => Math.abs(v)), 1);

  const width = 260;
  const height = 180;
  const padding = 28;

  const getX = (val: number) => padding + ((val - minPred) / rangePred) * (width - padding * 2);
  const getY = (res: number) => {
    // Zero line at height / 2
    const mid = height / 2;
    const scale = (height / 2 - padding) / maxAbsRes;
    return mid - res * scale;
  };

  const zeroY = height / 2;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-2">
        <h5 className="text-xs font-semibold text-slate-300">Residuals vs Predicted</h5>
        {hoveredPoint && (
          <div className="text-[11px] font-mono text-purple-400">
            Pred: {hoveredPoint.predicted.toLocaleString()} | Res: {hoveredPoint.residual.toLocaleString()}
          </div>
        )}
      </div>

      <div className="relative">
        <svg width={width} height={height} className="overflow-visible">
          {/* Axis border */}
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="#334155"
            strokeWidth="1"
          />

          {/* Zero residual horizontal line */}
          <line
            x1={padding}
            y1={zeroY}
            x2={width - padding}
            y2={zeroY}
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />

          {/* Residual Points */}
          {data.map((pt, i) => {
            const cx = getX(pt.predicted);
            const cy = getY(pt.residual);
            const isHovered = hoveredPoint === pt;

            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={isHovered ? 5.5 : 3.5}
                className={`transition-all cursor-pointer ${
                  isHovered ? "fill-purple-400 stroke-white stroke-2" : "fill-purple-500/80 hover:fill-purple-400"
                }`}
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}
        </svg>
      </div>

      <div className="w-full flex justify-between items-center text-[10px] text-slate-400 mt-2 px-6">
        <span>- {maxAbsRes.toLocaleString()}</span>
        <span className="text-slate-500">Center: Zero residual line</span>
        <span>+ {maxAbsRes.toLocaleString()}</span>
      </div>
    </div>
  );
}
