"use client";
import { useState } from "react";
import { formatMetric } from "@/lib/format";

type Observation = { timestamp: string; value: number };
export function TimeSeriesChart({ points }: { points: Observation[] }) {
  const [selected, setSelected] = useState<Observation | null>(null);
  const valid = (points || [])
    .filter(
      (p) =>
        Number.isFinite(p.value) && Number.isFinite(Date.parse(p.timestamp)),
    )
    .toSorted((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (!valid.length)
    return <p className="chart-empty">No temporal observations available.</p>;
  const values = valid.map((p) => p.value),
    times = valid.map((p) => Date.parse(p.timestamp));
  const lo = Math.min(...values),
    hi = Math.max(...values),
    start = Math.min(...times),
    end = Math.max(...times);
  const pad = (hi - lo || Math.abs(lo) * 0.1 || 1) * 0.08;
  const low = lo - pad,
    high = hi + pad;
  const x = (p: Observation) =>
    65 + ((Date.parse(p.timestamp) - start) / (end - start || 1)) * 490;
  const y = (p: Observation) => 200 - ((p.value - low) / (high - low)) * 170;
  return (
    <div className="scientific-chart">
      <svg
        role="group"
        aria-label="Numerical observations over time"
        viewBox="0 0 600 250"
        className="w-full h-auto max-h-80"
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="65"
              x2="555"
              y1={200 - t * 170}
              y2={200 - t * 170}
              stroke="#263447"
              strokeDasharray="2 4"
            />
            <text x="55" y={204 - t * 170} textAnchor="end">
              {formatMetric(low + t * (high - low))}
            </text>
          </g>
        ))}
        <text x="65" y="225">
          {valid[0].timestamp.slice(0, 10)}
        </text>
        <text x="555" y="225" textAnchor="end">
          {valid[valid.length - 1].timestamp.slice(0, 10)}
        </text>
        <text x="310" y="245" textAnchor="middle" className="axis-label">
          Observation date
        </text>
        <text
          transform="translate(14 115) rotate(-90)"
          textAnchor="middle"
          className="axis-label"
        >
          Observed value
        </text>
        <polyline
          points={valid.map((p) => `${x(p)},${y(p)}`).join(" ")}
          fill="none"
          stroke="#72adff"
          strokeWidth="2"
        />
        {valid.map((p, i) => (
          <circle
            key={i}
            cx={x(p)}
            cy={y(p)}
            r={selected === p ? 4 : 2}
            fill="#72adff"
            tabIndex={0}
            role="img"
            aria-label={`${p.timestamp}: ${p.value}`}
            onMouseEnter={() => setSelected(p)}
            onMouseLeave={() => setSelected(null)}
            onFocus={() => setSelected(p)}
            onBlur={() => setSelected(null)}
            onClick={() => setSelected(p)}
          >
            <title>
              {p.timestamp}: {p.value}
            </title>
          </circle>
        ))}
      </svg>
      <p className="chart-tooltip">
        {selected
          ? `${selected.timestamp} · ${formatMetric(selected.value)}`
          : "Hover, tap, or focus to inspect a computed observation."}
      </p>
      <p className="chart-note">Observed data. No forecast is shown.</p>
    </div>
  );
}
