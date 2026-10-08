"use client";

import React, { useState } from "react";
import { AnalysisResponse } from "@/lib/types";
import { CheckCircle2, AlertTriangle, AlertOctagon, Database, Table, Cpu, ShieldCheck } from "lucide-react";

interface OverviewTabProps {
  data: AnalysisResponse;
  onSelectTarget?: (target: string) => void;
}

export function OverviewTab({ data, onSelectTarget }: OverviewTabProps) {
  const { schema, health_score, quality, preview_rows, problem_detection } = data;
  const [searchTerm, setSearchTerm] = useState("");

  const filteredColumns = schema.columns.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.inferred_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getHealthBadge = (score: number) => {
    if (score >= 85) {
      return {
        label: "Excellent Integrity",
        color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        icon: CheckCircle2,
      };
    }
    if (score >= 70) {
      return {
        label: "Good Quality",
        color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
        icon: ShieldCheck,
      };
    }
    if (score >= 50) {
      return {
        label: "Requires Preprocessing",
        color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        icon: AlertTriangle,
      };
    }
    return {
      label: "Critical Hygiene Issues",
      color: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      icon: AlertOctagon,
    };
  };

  const healthBadge = getHealthBadge(health_score);
  const HealthIcon = healthBadge.icon;

  return (
    <div className="space-y-6">
      {/* Metric Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Health Score Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Data Health Score</span>
            <HealthIcon className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight text-white">{health_score}</span>
            <span className="text-sm font-medium text-slate-500">/ 100</span>
          </div>
          <div className="mt-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${healthBadge.color}`}>
              {healthBadge.label}
            </span>
          </div>
        </div>

        {/* Dataset Dimensions */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Observations (Rows)</span>
            <Table className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">
            {schema.row_count.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Complete rows: <strong className="text-slate-200">{quality.missing.complete_rows_percentage}%</strong>
          </div>
        </div>

        {/* Column Dimensions */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Features (Columns)</span>
            <Database className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">
            {schema.column_count}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {schema.numerical_columns.length} num &bull; {schema.categorical_columns.length} cat &bull; {schema.datetime_columns.length} dt
          </div>
        </div>

        {/* Memory Footprint */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Memory Footprint</span>
            <Cpu className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">
            {schema.memory_formatted}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Processed temporarily in memory
          </div>
        </div>
      </div>

      {/* Suggested Target Banner if available */}
      {problem_detection.target_column && (
        <div className="bg-blue-950/30 border border-blue-900/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Target Detected: {problem_detection.target_column}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-900/50 text-blue-300 border border-blue-800">
                  {problem_detection.problem_type.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">{problem_detection.reason}</p>
            </div>
          </div>
          {onSelectTarget && (
            <button
              onClick={() => onSelectTarget(problem_detection.target_column!)}
              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors shrink-0"
            >
              Configure Target
            </button>
          )}
        </div>
      )}

      {/* Column Schema Catalog */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Attribute Dictionary &amp; Schema Profile</h3>
            <p className="text-xs text-slate-400">Classified data types, null rates, and empirical uniqueness</p>
          </div>
          <input
            type="text"
            aria-label="Search attributes"
            placeholder="Search attributes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 w-full sm:w-64"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 px-3">Column</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Original Type</th>
                <th className="py-2.5 px-3">Missing</th>
                <th className="py-2.5 px-3">Distinct Values</th>
                <th className="py-2.5 px-3">Sample Observation Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredColumns.map((col, idx) => {
                let badgeColor = "bg-slate-800 text-slate-300";
                if (col.inferred_type === "numerical") badgeColor = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
                else if (col.inferred_type === "categorical") badgeColor = "bg-purple-500/10 text-purple-400 border border-purple-500/20";
                else if (col.inferred_type === "datetime") badgeColor = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
                else if (col.inferred_type === "boolean") badgeColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";

                return (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span>{col.name}</span>
                        {schema.id_columns.includes(col.name) && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-400 border border-slate-700">ID</span>
                        )}
                        {schema.constant_columns.includes(col.name) && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-950 text-rose-400 border border-rose-800">Constant</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${badgeColor}`}>
                        {col.inferred_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">{col.dtype}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className={col.null_percentage > 0 ? "text-amber-400 font-medium" : "text-slate-400"}>
                          {col.null_percentage}%
                        </span>
                        {col.null_count > 0 && <span className="text-slate-500 text-[10px]">({col.null_count})</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-mono">{col.unique_count.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] truncate max-w-xs">
                      {col.sample_values.map((v) => (v === null ? "null" : String(v))).slice(0, 4).join(", ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Data Preview (First 10 Rows) */}
      {preview_rows && preview_rows.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-white">Initial Record Sample</h3>
              <p className="text-xs text-slate-400">Head observations (first {preview_rows.length} rows)</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  {Object.keys(preview_rows[0]).map((key, i) => (
                    <th key={i} className="py-2 px-3 whitespace-nowrap bg-slate-950/40">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
                {preview_rows.map((row: Record<string, unknown>, rIdx: number) => (
                  <tr key={rIdx} className="hover:bg-slate-800/20">
                    {Object.values(row).map((val: unknown, cIdx) => (
                      <td key={cIdx} className="py-2 px-3 whitespace-nowrap text-slate-300">
                        {val === "" || val === null || val === undefined ? (
                          <span className="text-slate-600 italic">null</span>
                        ) : (
                          String(val)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
