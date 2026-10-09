"use client";

import React, { useState } from "react";
import { AnalysisResponse } from "@/lib/types";
import { CorrelationHeatmap } from "@/components/charts/CorrelationHeatmap";
import { HistogramChart } from "@/components/charts/HistogramChart";
import { InteractiveExplorer } from "./InteractiveExplorer";
import type { ExplorationDrilldown } from "./InteractiveExplorer";
import type { ExplorationResponse } from "@/lib/types";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  GitCompare,
  Hash,
  Layers,
} from "lucide-react";

interface ExploreTabProps {
  data: AnalysisResponse;
  drilldown?: ExplorationDrilldown | null;
  onExplorationResultChange?: (result: ExplorationResponse | null) => void;
}

export function ExploreTab({ data, drilldown, onExplorationResultChange }: ExploreTabProps) {
  const { descriptive_statistics, correlations, schema } = data;
  const numDist = descriptive_statistics.numerical;
  const catDist = descriptive_statistics.categorical;
  const evidence = drilldown?.finding.evidence;
  const drillMetric = typeof evidence?.metric_column === "string" ? evidence.metric_column : null;
  const drillFirst = typeof evidence?.feature_a === "string" ? evidence.feature_a : null;
  const drillSecond = typeof evidence?.feature_b === "string" ? evidence.feature_b : null;
  const drillGroup = typeof evidence?.group_column === "string" ? evidence.group_column : null;

  const [selectedNumCol, setSelectedNumCol] = useState<string>(
    (drillMetric && numDist.some((item) => item.column === drillMetric) ? drillMetric : numDist[0]?.column) || ""
  );
  const [selectedCatCol, setSelectedCatCol] = useState<string>(
    (drillGroup && catDist.some((item) => item.column === drillGroup) ? drillGroup : catDist[0]?.column) || ""
  );

  // Two-variable comparison state
  const [compareVarA, setCompareVarA] = useState<string>(
    drillFirst && schema.columns.some((item) => item.name === drillFirst) ? drillFirst : schema.numerical_columns[0] || ""
  );
  const [compareVarB, setCompareVarB] = useState<string>(
    drillSecond && schema.columns.some((item) => item.name === drillSecond) ? drillSecond : schema.numerical_columns[1] || schema.categorical_columns[0] || ""
  );

  const currentNum = numDist.find((d) => d.column === selectedNumCol) || numDist[0];
  const currentCat = catDist.find((d) => d.column === selectedCatCol) || catDist[0];

  // Bivariate relationship between compareVarA and compareVarB
  const idxA = correlations?.columns?.indexOf(compareVarA) ?? -1;
  const idxB = correlations?.columns?.indexOf(compareVarB) ?? -1;
  const corrValue =
    idxA >= 0 &&
    idxB >= 0 &&
    correlations?.pearson_matrix?.[idxA]?.[idxB] !== undefined &&
    correlations?.pearson_matrix?.[idxA]?.[idxB] !== null
      ? correlations.pearson_matrix[idxA][idxB]
      : null;

  const matchingTopCorr = correlations?.top_correlations?.find(
    (c) =>
      (c.feature_a === compareVarA && c.feature_b === compareVarB) ||
      (c.feature_a === compareVarB && c.feature_b === compareVarA)
  );

  return (
    <div className="space-y-6">
      <InteractiveExplorer data={data} drilldown={drilldown} onResultChange={onExplorationResultChange} />

      <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-400">
        The existing distributions, correlation matrix, and analysis charts below summarize the full dataset. Filters above recalculate only the interactive result and its evidence.
      </p>

      {/* Interactive Two-Variable Comparison Explorer (Phase 10) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-cyan-400" /> Two-Variable Interactive Comparison
            </h3>
            <p className="text-xs text-slate-400">
              Select two features to inspect joint distribution, correlation, or group differences.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="text-slate-500 text-[11px]">Var X:</span>
              <select
                aria-label="First variable"
                value={compareVarA}
                onChange={(e) => setCompareVarA(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-medium"
              >
                {schema.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.inferred_type})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-500 text-xs">&times;</span>

            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="text-slate-500 text-[11px]">Var Y:</span>
              <select
                aria-label="Second variable"
                value={compareVarB}
                onChange={(e) => setCompareVarB(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-medium"
              >
                {schema.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.inferred_type})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Comparison Result Panel */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          {compareVarA === compareVarB ? (
            <p className="text-xs text-slate-400">
              Select two distinct variables to evaluate bivariate associations.
            </p>
          ) : corrValue !== null ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">
                    {compareVarA} &times; {compareVarB}
                  </span>
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                    Numeric Association
                  </span>
                </div>
                <div className="text-xs font-mono">
                  <span className="text-slate-400">Pearson r = </span>
                  <span className={corrValue > 0 ? "text-cyan-400 font-bold" : "text-rose-400 font-bold"}>
                    {corrValue > 0 ? `+${corrValue.toFixed(4)}` : corrValue.toFixed(4)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {matchingTopCorr?.plain_english ||
                  (Math.abs(corrValue) >= 0.7
                    ? `Strong ${corrValue > 0 ? "positive" : "negative"} linear association observed between ${compareVarA} and ${compareVarB}. As ${compareVarA} increases, ${compareVarB} tends to ${corrValue > 0 ? "increase" : "decrease"}.`
                    : Math.abs(corrValue) >= 0.3
                    ? `Moderate ${corrValue > 0 ? "positive" : "negative"} linear association observed between ${compareVarA} and ${compareVarB}.`
                    : `Weak or negligible linear association observed (r = ${corrValue.toFixed(4)}).`)}
              </p>

              <div className="text-[10px] text-slate-500 pt-1">
                Note: Correlation describes linear co-movement in this dataset and does not establish causation.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">
                  {compareVarA} &times; {compareVarB}
                </span>
                <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                  Categorical &times; Numeric Comparison
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Evaluating group segmentation between categorical and numerical features. Inspect the Key Findings section for verified Mann-Whitney or ANOVA hypothesis tests.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Numerical Distribution Explorer */}
      {numDist.length > 0 && currentNum && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-400" /> Numerical Feature Distribution
              </h3>
              <p className="text-xs text-slate-400">Histogram partitions and empirical skewness / kurtosis metrics</p>
            </div>
            <select
              aria-label="Numerical feature"
              value={selectedNumCol}
              onChange={(e) => setSelectedNumCol(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-medium"
            >
              {numDist.map((d) => (
                <option key={d.column} value={d.column}>
                  {d.column}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <HistogramChart
                column={currentNum.column}
                bins={currentNum.histogram}
                mean={currentNum.mean}
                median={currentNum.median}
              />
            </div>

            {/* Distribution metrics panel */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-3 text-xs">
              <h5 className="font-semibold text-slate-300 border-b border-slate-800 pb-2">
                Moments &amp; Summary
              </h5>

              <div className="grid grid-cols-2 gap-2 text-slate-400">
                <div>Mean: <strong className="text-slate-200 font-mono">{currentNum.mean?.toLocaleString() ?? "Unavailable"}</strong></div>
                <div>Median: <strong className="text-slate-200 font-mono">{currentNum.median?.toLocaleString() ?? "Unavailable"}</strong></div>
                <div>Std Dev: <strong className="text-slate-200 font-mono">{currentNum.std?.toLocaleString() ?? "Unavailable"}</strong></div>
                <div>IQR: <strong className="text-slate-200 font-mono">{currentNum.iqr.toLocaleString()}</strong></div>
                <div>Min: <strong className="text-slate-200 font-mono">{currentNum.min.toLocaleString()}</strong></div>
                <div>Max: <strong className="text-slate-200 font-mono">{currentNum.max.toLocaleString()}</strong></div>
                <div>Skewness: <strong className="text-slate-200 font-mono">{currentNum.skewness ?? "Unavailable"}</strong></div>
                <div>Kurtosis: <strong className="text-slate-200 font-mono">{currentNum.kurtosis ?? "Unavailable"}</strong></div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Skewness Interpretation:</span>
                  <p className="text-[11px] text-blue-300 font-medium">{currentNum.skewness_interpretation}</p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Kurtosis Interpretation:</span>
                  <p className="text-[11px] text-indigo-300 font-medium">{currentNum.kurtosis_interpretation}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categorical Distribution Explorer */}
      {catDist.length > 0 && currentCat && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Hash className="w-4 h-4 text-purple-400" /> Categorical Frequency Distribution
              </h3>
              <p className="text-xs text-slate-400">Class proportions, distinct levels, and modal categories</p>
            </div>
            <select
              aria-label="Categorical feature"
              value={selectedCatCol}
              onChange={(e) => setSelectedCatCol(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500 font-medium"
            >
              {catDist.map((d) => (
                <option key={d.column} value={d.column}>
                  {d.column} ({d.unique_count} levels)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-2">
              {currentCat.frequencies.map((freq, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <div className="w-32 text-right font-medium text-slate-300 truncate" title={freq.category}>
                    {freq.category || "<empty>"}
                  </div>
                  <div className="flex-1 h-5 bg-slate-800/80 rounded overflow-hidden flex items-center">
                    <div
                      style={{ width: `${freq.percentage}%` }}
                      className="h-full bg-purple-600/80 rounded transition-all duration-300"
                    />
                  </div>
                  <div className="w-20 font-mono text-[11px] text-slate-400 text-right">
                    {freq.count} ({freq.percentage}%)
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-2 text-xs">
              <h5 className="font-semibold text-slate-300 border-b border-slate-800 pb-2">
                Categorical Summary
              </h5>
              <div className="space-y-1 text-slate-400">
                <div>Distinct Levels: <strong className="text-slate-200 font-mono">{currentCat.unique_count}</strong></div>
                <div>Modal Category: <strong className="text-slate-200 font-mono">{currentCat.mode}</strong></div>
                <div>Modal Proportion: <strong className="text-slate-200 font-mono">{currentCat.mode_percentage}%</strong></div>
              </div>
              {currentCat.is_imbalanced && (
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300 text-[11px] mt-2">
                  Dominant class exhibits heavy frequency concentration ({currentCat.mode_percentage}%).
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Correlation Heatmap Section */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" /> Bivariate Correlation Structure
          </h3>
          <p className="text-xs text-slate-400">
            Interactive Pearson correlation coefficients with hypothesis significance testing
          </p>
        </div>

        <CorrelationHeatmap matrix={correlations} />

        {/* Top Relationships Cards */}
        {correlations.top_correlations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Strongest Identified Relationships
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {correlations.top_correlations.slice(0, 4).map((c, i) => (
                <div key={i} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200 flex items-center gap-1">
                      {c.direction === "positive" ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      {c.feature_a} &times; {c.feature_b}
                    </span>
                    <span className="font-mono font-bold text-blue-400">r = {c.pearson_r > 0 ? `+${c.pearson_r}` : c.pearson_r}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{c.plain_english}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
