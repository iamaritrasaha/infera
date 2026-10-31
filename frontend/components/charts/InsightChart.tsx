"use client";

import { useRef, useState } from "react";
import { InsightChartData } from "@/lib/types";
import { Check, Download } from "lucide-react";

const WIDTH = 680;
const HEIGHT = 286;
const PLOT = { left: 60, right: 18, top: 18, bottom: 62 };
const NUMBER_FORMAT = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 });

function numberLabel(value: number) {
  return NUMBER_FORMAT.format(value);
}

function dateLabel(value: string | number) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? String(value)
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

export function InsightChart({ chart, id }: { chart: InsightChartData; id?: string }) {
  const points = chart.points;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [activePoint, setActivePoint] = useState<number | null>(null);

  if (!points.length) return null;

  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const yValues = points.map((point) => point.y);
  const isCountChart = chart.kind === "bar" || chart.kind === "histogram";
  const rawMin = Math.min(...yValues);
  const rawMax = Math.max(...yValues);
  const padding = rawMax === rawMin ? Math.max(Math.abs(rawMax) * 0.1, 1) : (rawMax - rawMin) * 0.12;
  const minY = isCountChart ? Math.min(0, rawMin - padding) : rawMin - padding;
  const maxY = isCountChart ? Math.max(0, rawMax + Math.max(padding, Math.abs(rawMax) * 0.08)) : rawMax + padding;
  const yRange = maxY - minY || 1;
  const xForDate = chart.kind === "line" && points.every((point) =>
    typeof point.x === "string" && /^\d{4}-\d{2}-\d{2}T/.test(point.x),
  );
  const xNumbers = points.map((point) => Number(point.x));
  const xForNumber = chart.kind === "scatter" && xNumbers.every(Number.isFinite);
  const minX = Math.min(...xNumbers);
  const maxX = Math.max(...xNumbers);
  const xRange = maxX - minX || 1;

  const x = (index: number) => {
    if (points.length === 1) return PLOT.left + plotWidth / 2;
    if (xForDate) {
      const value = new Date(String(points[index].x)).valueOf();
      const first = new Date(String(points[0].x)).valueOf();
      const last = new Date(String(points[points.length - 1].x)).valueOf();
      return PLOT.left + ((value - first) / (last - first || 1)) * plotWidth;
    }
    if (xForNumber) return PLOT.left + ((xNumbers[index] - minX) / xRange) * plotWidth;
    return PLOT.left + (index / points.length) * plotWidth + plotWidth / points.length / 2;
  };
  const y = (value: number) => PLOT.top + ((maxY - value) / yRange) * plotHeight;
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = minY + (yRange * (tickCount - index)) / tickCount;
    return { value, position: y(value) };
  });
  const xIndexes = Array.from({ length: Math.min(5, points.length) }, (_, index) =>
    points.length === 1 ? 0 : Math.round((index * (points.length - 1)) / (Math.min(5, points.length) - 1)),
  );
  const barWidth = Math.max(4, Math.min(36, (plotWidth / points.length) * 0.62));
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(point.y).toFixed(2)}`)
    .join(" ");

  const handleExportPng = () => {
    if (!svgRef.current) return;
    try {
      const svg = svgRef.current;
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const blobUrl = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 2; // High-resolution 2x rendering
        canvas.width = WIDTH * scale;
        canvas.height = HEIGHT * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#020617"; // Slate-950 dark background matching Infera theme
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const pngUrl = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          const safeName = chart.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          a.download = `infera-${safeName || "chart"}.png`;
          a.href = pngUrl;
          a.click();
          setDownloaded(true);
          setTimeout(() => setDownloaded(false), 2000);
        }
        URL.revokeObjectURL(blobUrl);
      };
      img.src = blobUrl;
    } catch (err) {
      console.error("Failed to export chart PNG:", err);
    }
  };

  return (
    <figure id={id} className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4" aria-labelledby={`caption-${id ?? chart.title}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <figcaption id={`caption-${id ?? chart.title}`} className="text-sm font-medium text-slate-200">
          {chart.title}
        </figcaption>
        <button
          type="button"
          onClick={handleExportPng}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
          title="Export chart as high-resolution PNG"
        >
          {downloaded ? <Check size={12} className="text-emerald-400" /> : <Download size={12} />}
          <span>{downloaded ? "Saved" : "Export PNG"}</span>
        </button>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          ref={svgRef}
          className="min-w-[520px] w-full"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`${chart.title}. Horizontal axis: ${chart.x_label}. Vertical axis: ${chart.y_label}. Hover over marks for values.`}
        >
          <title>{chart.title}</title>
          <desc>{`${chart.points.length} plotted values. ${chart.x_label} on the horizontal axis and ${chart.y_label} on the vertical axis.`}</desc>
          {yTicks.map((tick) => (
            <g key={tick.value}>
              <line x1={PLOT.left} x2={WIDTH - PLOT.right} y1={tick.position} y2={tick.position} stroke="#263449" strokeDasharray="3 5" />
              <text x={PLOT.left - 9} y={tick.position + 4} textAnchor="end" fill="#94a3b8" fontSize="10">
                {numberLabel(tick.value)}
              </text>
            </g>
          ))}
          <line x1={PLOT.left} x2={PLOT.left} y1={PLOT.top} y2={HEIGHT - PLOT.bottom} stroke="#64748b" />
          <line x1={PLOT.left} x2={WIDTH - PLOT.right} y1={HEIGHT - PLOT.bottom} y2={HEIGHT - PLOT.bottom} stroke="#64748b" />

          {(chart.kind === "bar" || chart.kind === "histogram") && points.map((point, index) => {
            const barTop = y(point.y);
            const baseline = y(Math.max(minY, 0));
            const top = Math.min(baseline, barTop);
            const height = Math.max(1, Math.abs(baseline - barTop));
            return (
              <g key={`${point.x}-${index}`}>
                <rect
                  x={x(index) - barWidth / 2}
                  y={top}
                  width={barWidth}
                  height={height}
                  rx="3"
                  fill="#38bdf8"
                  fillOpacity="0.78"
                  tabIndex={0}
                  role="img"
                  aria-label={`${chart.x_label}: ${point.x}; ${chart.y_label}: ${numberLabel(point.y)}. ${point.detail ?? ""}`}
                  className="focus-visible:stroke-white focus-visible:stroke-[3]"
                  onMouseEnter={() => setActivePoint(index)}
                  onMouseLeave={() => setActivePoint(null)}
                  onFocus={() => setActivePoint(index)}
                  onBlur={() => setActivePoint(null)}
                >
                  <title>{`${chart.x_label}: ${point.x}; ${chart.y_label}: ${numberLabel(point.y)}. ${point.detail ?? ""}`}</title>
                </rect>
              </g>
            );
          })}

          {chart.kind === "line" && (
            <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {(chart.kind === "line" || chart.kind === "scatter") && points.map((point, index) => (
            <circle
              key={`${point.x}-${index}`}
              cx={x(index)}
              cy={y(point.y)}
              r={chart.kind === "line" ? 3.4 : 4}
              fill="#67e8f9"
              stroke="#082f49"
              strokeWidth="1.5"
              tabIndex={0}
              role="img"
              aria-label={`${chart.x_label}: ${point.x}; ${chart.y_label}: ${numberLabel(point.y)}. ${point.detail ?? ""}`}
              className="focus-visible:stroke-white focus-visible:stroke-[3]"
              onMouseEnter={() => setActivePoint(index)}
              onMouseLeave={() => setActivePoint(null)}
              onFocus={() => setActivePoint(index)}
              onBlur={() => setActivePoint(null)}
            >
              <title>{`${chart.x_label}: ${point.x}; ${chart.y_label}: ${numberLabel(point.y)}. ${point.detail ?? ""}`}</title>
            </circle>
          ))}

          {xIndexes.map((index) => {
            const point = points[index];
            const label = xForDate ? dateLabel(point.x) : (xForNumber ? numberLabel(Number(point.x)) : String(point.x));
            const rotate = !xForDate && !xForNumber && points.length > 5;
            return (
              <text
                key={`${point.x}-${index}`}
                x={x(index)}
                y={HEIGHT - PLOT.bottom + (rotate ? 9 : 17)}
                textAnchor={rotate ? "start" : "middle"}
                transform={rotate ? `rotate(32 ${x(index)} ${HEIGHT - PLOT.bottom + 9})` : undefined}
                fill="#94a3b8"
                fontSize="10"
              >
                {label.length > 18 ? `${label.slice(0, 17)}…` : label}
              </text>
            );
          })}
          <text x={PLOT.left + plotWidth / 2} y={HEIGHT - 8} textAnchor="middle" fill="#cbd5e1" fontSize="11">
            {chart.x_label}
          </text>
          <text x="14" y={PLOT.top + plotHeight / 2} textAnchor="middle" fill="#cbd5e1" fontSize="11" transform={`rotate(-90 14 ${PLOT.top + plotHeight / 2})`}>
            {chart.y_label}
          </text>
        </svg>
      </div>
      <p role="status" aria-live="polite" className="mt-1 min-h-5 text-[11px] text-slate-500">
        {activePoint == null
          ? "Hover, tap, or focus a mark to inspect its value. The evidence below lists the computed values."
          : `${chart.x_label}: ${String(points[activePoint].x)} · ${chart.y_label}: ${numberLabel(points[activePoint].y)}${points[activePoint].detail ? ` · ${points[activePoint].detail}` : ""}`}
      </p>
    </figure>
  );
}
