"use client";

import React from "react";
import { AnalysisResponse } from "@/lib/types";
import { AlertCircle, AlertTriangle, CheckCircle, Copy, HelpCircle, Layers, ShieldCheck } from "lucide-react";

interface DataQualityProps {
  data: AnalysisResponse;
}

export function DataQualityTab({ data }: DataQualityProps) {
  const { quality } = data;
  const { missing, duplicates, outliers, cardinality } = quality;

  return (
    <div className="space-y-6">
      {/* Overview Quality Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Missing summary */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Missing Cells Rate</span>
            <AlertCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">
            {missing.overall_missing_percentage}%
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {missing.total_missing_cells.toLocaleString()} empty values across {missing.columns_with_missing_count} columns
          </p>
        </div>

        {/* Duplicates summary */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Exact Duplicate Records</span>
            <Copy className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">
            {duplicates.duplicate_rows_percentage}%
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {duplicates.duplicate_rows_count} identical rows detected
          </p>
        </div>

        {/* Outliers summary */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Statistical Outliers (IQR)</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">
            {outliers.total_iqr_outliers}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Found across {outliers.columns_with_outliers_count} numerical features
          </p>
        </div>
      </div>

      {/* Missing Values Breakdown Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Missing Data Diagnostic</h3>
            <p className="text-xs text-slate-400">{missing.recommendation}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 px-3">Attribute</th>
                <th className="py-2.5 px-3">Missing Entries</th>
                <th className="py-2.5 px-3">Percentage</th>
                <th className="py-2.5 px-3">Visual Proportion</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {missing.column_profiles.map((cp, idx) => {
                let statusBadge = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                if (cp.status === "minor") statusBadge = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
                if (cp.status === "moderate") statusBadge = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
                if (cp.status === "severe") statusBadge = "bg-rose-500/10 text-rose-400 border border-rose-500/20";

                return (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-200">{cp.column}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{cp.missing_count.toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{cp.missing_percentage}%</td>
                    <td className="py-2.5 px-3 w-48">
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(cp.missing_percentage, 100)}%` }}
                          className={`h-full rounded-full ${
                            cp.missing_percentage > 20
                              ? "bg-rose-500"
                              : cp.missing_percentage > 5
                              ? "bg-amber-500"
                              : "bg-blue-500"
                          }`}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${statusBadge}`}>
                        {cp.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Outliers Diagnostic Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Statistical Outliers vs Data Corruption</h3>
            <span className="text-[11px] px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 rounded">
              IQR &bull; 1.5x Fence Rule
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{outliers.recommendation}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 px-3">Feature</th>
                <th className="py-2.5 px-3">IQR Lower Fence</th>
                <th className="py-2.5 px-3">IQR Upper Fence</th>
                <th className="py-2.5 px-3">Extreme Count</th>
                <th className="py-2.5 px-3">Rate</th>
                <th className="py-2.5 px-3">Analytical Interpretation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {outliers.profiles.map((op, idx) => {
                let badgeClass = "text-slate-400";
                if (op.severity === "notable") badgeClass = "text-amber-400 font-medium";
                if (op.severity === "extreme") badgeClass = "text-rose-400 font-semibold";

                return (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-200">{op.column}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{op.iqr_lower_bound.toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{op.iqr_upper_bound.toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-200">{op.iqr_outlier_count}</td>
                    <td className={`py-2.5 px-3 font-mono ${badgeClass}`}>{op.iqr_outlier_percentage}%</td>
                    <td className="py-2.5 px-3 text-slate-300 text-[11px] leading-relaxed max-w-md">
                      {op.context_note}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cardinality & Low-Variance Signals */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-1">Feature Cardinality &amp; Variance Health</h3>
        <p className="text-xs text-slate-400 mb-4">{cardinality.recommendation}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg">
            <span className="font-semibold text-slate-300 block mb-1">Constant Columns (Zero Variance)</span>
            {cardinality.constant_columns.length > 0 ? (
              <ul className="text-rose-400 space-y-1">
                {cardinality.constant_columns.map((c, i) => (
                  <li key={i}>&bull; {c} (Must be dropped)</li>
                ))}
              </ul>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> None detected
              </span>
            )}
          </div>

          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg">
            <span className="font-semibold text-slate-300 block mb-1">Quasi-Constant (&gt;98% Dominant)</span>
            {cardinality.quasi_constant_columns.length > 0 ? (
              <ul className="text-amber-400 space-y-1">
                {cardinality.quasi_constant_columns.map((c, i) => (
                  <li key={i}>&bull; {c}</li>
                ))}
              </ul>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> None detected
              </span>
            )}
          </div>

          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg">
            <span className="font-semibold text-slate-300 block mb-1">High Cardinality Categoricals</span>
            {cardinality.high_cardinality_categorical_columns.length > 0 ? (
              <ul className="text-blue-400 space-y-1">
                {cardinality.high_cardinality_categorical_columns.map((c, i) => (
                  <li key={i}>&bull; {c}</li>
                ))}
              </ul>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Standard cardinality
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
