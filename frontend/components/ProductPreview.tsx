"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Database,
  FileCheck2,
  ScanLine,
} from "lucide-react";
import preview from "@/lib/sample-preview.json";
import { HistogramChart } from "./charts/HistogramChart";

export function ProductPreview() {
  const [view, setView] = useState<"distribution" | "quality">("distribution");
  return (
    <div className="product-preview">
      <div className="preview-toolbar">
        <div className="flex items-center gap-2">
          <Database size={15} className="text-blue-400" />
          <span>housing.csv</span>
        </div>
        <span className="preview-tag">COMPUTED EXAMPLE</span>
      </div>
      <div className="preview-body">
        <div className="preview-eyebrow">
          <span>DATASET OVERVIEW</span>
          <FileCheck2 size={14} className="text-emerald-400" />
        </div>
        <div className="preview-metrics">
          {[
            ["Observations", preview.rows.toLocaleString()],
            ["Features", preview.columns],
            ["Data health", `${preview.health}/100`],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div
          className="preview-controls"
          role="group"
          aria-label="Example preview views"
        >
          <button
            aria-pressed={view === "distribution"}
            onClick={() => setView("distribution")}
          >
            <BarChart3 size={14} />
            Distribution
          </button>
          <button
            aria-pressed={view === "quality"}
            onClick={() => setView("quality")}
          >
            <ScanLine size={14} />
            Data quality
          </button>
        </div>
        {view === "distribution" ? (
          <HistogramChart
            column="price"
            bins={preview.histogram}
            mean={preview.mean}
            median={preview.median}
          />
        ) : (
          <div className="preview-quality">
            <div>
              <span>Missing values</span>
              <strong>{preview.missing}%</strong>
            </div>
            <div>
              <span>Duplicate rows</span>
              <strong>{preview.duplicates}</strong>
            </div>
            <div>
              <span>Numerical columns</span>
              <strong>{preview.numerical}</strong>
            </div>
            <p>
              Quality scores describe data hygiene. They do not guarantee valid
              predictions.
            </p>
          </div>
        )}
        <div className="preview-source">
          <span>Python-computed snapshot · Synthetic housing sample</span>
          <a href="/dashboard">
            Analyze it yourself <ArrowUpRight size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}
