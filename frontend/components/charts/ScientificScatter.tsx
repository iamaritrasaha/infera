"use client";

import { useState } from "react";
import { formatMetric } from "@/lib/format";

export type PlotPoint = { x: number; y: number; label: string; group?: number };
const palette = [
  "#72adff",
  "#6ad7b6",
  "#c0a0f7",
  "#f2c46d",
  "#ff97a1",
  "#6ed5e9",
];
export function ScientificScatter({
  points,
  title,
  xLabel,
  yLabel,
  diagonal = false,
  zeroLine = false,
  legend = [],
}: {
  points: PlotPoint[];
  title: string;
  xLabel: string;
  yLabel: string;
  diagonal?: boolean;
  zeroLine?: boolean;
  legend?: { group: number; label: string }[];
}) {
  const [selected, setSelected] = useState<PlotPoint | null>(null);
  const valid = points.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
  );
  if (!valid.length)
    return (
      <div className="chart-empty">
        No finite observations available for {title.toLowerCase()}.
      </div>
    );
  let xLow = Math.min(...valid.map((p) => p.x)),
    xHigh = Math.max(...valid.map((p) => p.x));
  let yLow = Math.min(...valid.map((p) => p.y)),
    yHigh = Math.max(...valid.map((p) => p.y));
  if (diagonal) {
    xLow = yLow = Math.min(xLow, yLow);
    xHigh = yHigh = Math.max(xHigh, yHigh);
  }
  if (zeroLine) {
    const extent = Math.max(Math.abs(yLow), Math.abs(yHigh)) || 1;
    yLow = -extent;
    yHigh = extent;
  }
  const xPad = (xHigh - xLow || Math.abs(xLow) * 0.1 || 1) * 0.07;
  const yPad = (yHigh - yLow || Math.abs(yLow) * 0.1 || 1) * 0.07;
  xLow -= xPad;
  xHigh += xPad;
  yLow -= yPad;
  yHigh += yPad;
  const w = 440,
    h = 280,
    left = 68,
    right = 22,
    top = 20,
    bottom = 48;
  const x = (v: number) =>
    left + ((v - xLow) / (xHigh - xLow)) * (w - left - right);
  const y = (v: number) =>
    h - bottom - ((v - yLow) / (yHigh - yLow)) * (h - top - bottom);
  const color = (group = 0) =>
    group < 0 ? "#a0adc0" : palette[group % palette.length];
  return (
    <div className="scientific-chart">
      <h5>{title}</h5>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="group"
        aria-label={title}
        className="w-full h-auto max-h-80"
      >
        <title>
          {title}: {valid.length} computed observations
        </title>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const xv = xLow + t * (xHigh - xLow),
            yv = yLow + t * (yHigh - yLow);
          return (
            <g key={t}>
              <line
                x1={left}
                x2={w - right}
                y1={y(yv)}
                y2={y(yv)}
                stroke="#263447"
                strokeDasharray="2 4"
              />
              <text x={left - 8} y={y(yv) + 3} textAnchor="end">
                {formatMetric(yv)}
              </text>
              <text x={x(xv)} y={h - bottom + 17} textAnchor="middle">
                {formatMetric(xv)}
              </text>
            </g>
          );
        })}
        <line
          x1={left}
          x2={w - right}
          y1={h - bottom}
          y2={h - bottom}
          stroke="#52657e"
        />
        <text
          x={(left + w - right) / 2}
          y={h - 7}
          textAnchor="middle"
          className="axis-label"
        >
          {xLabel}
        </text>
        <text
          transform={`translate(13 ${(top + h - bottom) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="axis-label"
        >
          {yLabel}
        </text>
        {diagonal && (
          <line
            x1={x(Math.max(xLow, yLow))}
            y1={y(Math.max(xLow, yLow))}
            x2={x(Math.min(xHigh, yHigh))}
            y2={y(Math.min(xHigh, yHigh))}
            stroke="#a0adc0"
            strokeDasharray="5 5"
          />
        )}
        {zeroLine && (
          <line
            x1={left}
            x2={w - right}
            y1={y(0)}
            y2={y(0)}
            stroke="#a0adc0"
            strokeDasharray="5 5"
          />
        )}
        {valid.map((p, i) => (
          <circle
            key={i}
            cx={x(p.x)}
            cy={y(p.y)}
            r={selected === p ? 5 : 3.4}
            fill={color(p.group)}
            opacity={selected === p ? 1 : 0.75}
            stroke={selected === p ? "#eaf2ff" : "none"}
            tabIndex={0}
            role="img"
            aria-label={`${p.label}: ${xLabel} ${formatMetric(p.x)}, ${yLabel} ${formatMetric(p.y)}`}
            onFocus={() => setSelected(p)}
            onBlur={() => setSelected(null)}
            onMouseEnter={() => setSelected(p)}
            onMouseLeave={() => setSelected(null)}
            onClick={() => setSelected(p)}
          >
            <title>
              {p.label}: {p.x}, {p.y}
            </title>
          </circle>
        ))}
      </svg>
      <div className="chart-tooltip" aria-live="polite">
        {selected
          ? `${selected.label} · ${xLabel}: ${formatMetric(selected.x)} · ${yLabel}: ${formatMetric(selected.y)}`
          : "Hover, tap, or focus an observation to inspect its values."}
      </div>
      {diagonal && (
        <p className="chart-note">
          Dashed line: ideal 1:1 parity. Points come from held-out predictions.
        </p>
      )}
      {zeroLine && (
        <p className="chart-note">
          Dashed line: zero residual. Residual = actual − predicted.
        </p>
      )}
      {legend.length > 0 && (
        <div className="chart-legend">
          {legend.map((l) => (
            <span key={l.group}>
              <i style={{ backgroundColor: color(l.group) }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
