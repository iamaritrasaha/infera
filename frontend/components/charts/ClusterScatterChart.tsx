"use client";

import React, { useState } from "react";

interface ScatterPoint {
  pca_x: number;
  pca_y: number;
  cluster: number;
  cluster_label: string;
}

interface ClusterScatterProps {
  points: ScatterPoint[];
}

const CLUSTER_COLORS = [
  "fill-blue-500",
  "fill-emerald-500",
  "fill-purple-500",
  "fill-amber-500",
  "fill-rose-500",
  "fill-cyan-500",
];

export function ClusterScatterChart({ points }: ClusterScatterProps) {
  const [hoveredPt, setHoveredPt] = useState<ScatterPoint | null>(null);

  if (!points || points.length === 0) {
    return <div className="text-sm text-slate-400 py-6 text-center">No cluster projection coordinates.</div>;
  }

  const xs = points.map((p) => p.pca_x);
  const ys = points.map((p) => p.pca_y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const width = 280;
  const height = 200;
  const padding = 25;

  const getX = (val: number) => padding + ((val - minX) / rangeX) * (width - padding * 2);
  const getY = (val: number) => height - (padding + ((val - minY) / rangeY) * (height - padding * 2));

  // Unique clusters
  const clusterMap = new Map<number, string>();
  points.forEach((p) => clusterMap.set(p.cluster, p.cluster_label));
  const uniqueClusters = Array.from(clusterMap.entries());

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-2">
        <h5 className="text-xs font-semibold text-slate-200">2D PCA Cluster Projection</h5>
        {hoveredPt && (
          <span className="text-[11px] font-medium text-slate-300">
            {hoveredPt.cluster_label} &bull; ({hoveredPt.pca_x}, {hoveredPt.pca_y})
          </span>
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
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={height - padding}
            stroke="#334155"
            strokeWidth="1"
          />

          {points.map((pt, i) => {
            const cx = getX(pt.pca_x);
            const cy = getY(pt.pca_y);
            const isHovered = hoveredPt === pt;
            const colorClass = pt.cluster === -1 ? "fill-slate-600" : CLUSTER_COLORS[pt.cluster % CLUSTER_COLORS.length];

            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={isHovered ? 6 : 4}
                className={`transition-all cursor-pointer ${colorClass} ${
                  isHovered ? "stroke-white stroke-2" : "hover:opacity-100 opacity-80"
                }`}
                onMouseEnter={() => setHoveredPt(pt)}
                onMouseLeave={() => setHoveredPt(null)}
              />
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-slate-400">
        {uniqueClusters.map(([cid, label]) => {
          const dotColor = cid === -1 ? "bg-slate-600" : CLUSTER_COLORS[cid % CLUSTER_COLORS.length].replace("fill-", "bg-");
          return (
            <span key={cid} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${dotColor} inline-block`}></span> {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
