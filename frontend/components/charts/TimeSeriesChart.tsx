import React from "react";
export function TimeSeriesChart({ points }: { points: { timestamp: string; value: number }[] }) {
  const valid = points.filter(p => Number.isFinite(p.value) && Number.isFinite(Date.parse(p.timestamp)));
  if (!valid.length) return <p className="text-sm text-slate-400">No temporal observations available.</p>;
  const values = valid.map(p => p.value), times = valid.map(p => Date.parse(p.timestamp));
  const lo = Math.min(...values), hi = Math.max(...values), start = Math.min(...times), end = Math.max(...times);
  const coords = valid.map(p => `${20 + (Date.parse(p.timestamp) - start) / (end - start || 1) * 560},${180 - (p.value - lo) / (hi - lo || 1) * 160}`).join(" ");
  return <div><svg role="img" aria-label="Numerical observations over time" viewBox="0 0 600 200" className="w-full h-auto max-h-72"><line x1="20" y1="180" x2="580" y2="180" stroke="#475569" /><polyline points={coords} fill="none" stroke="#60a5fa" strokeWidth="2" /><title>{valid.map(p => `${p.timestamp}: ${p.value}`).join("; ")}</title></svg><p className="flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>{valid[0].timestamp} → {valid[valid.length - 1].timestamp}</span><span>Range: {lo.toLocaleString()} to {hi.toLocaleString()}</span></p></div>;
}
