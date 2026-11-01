"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  Download,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Table as TableIcon,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Play,
  Loader2,
} from "lucide-react";
import {
  DatasetResponse,
  RegressionResponse,
  runLinearRegression,
  getReportDownloadUrl,
} from "@/lib/api";

interface ResultsProps {
  dataset: DatasetResponse;
  onReset: () => void;
}

export function Results({ dataset, onReset }: ResultsProps) {
  const { summary, correlations, dataset_id, filename } = dataset;
  const [selectedTarget, setSelectedTarget] = useState<string>(
    summary.numeric_columns.length > 0 ? summary.numeric_columns[summary.numeric_columns.length - 1] : ""
  );
  const [isTraining, setIsTraining] = useState(false);
  const [regressionResult, setRegressionResult] = useState<RegressionResponse | null>(null);
  const [regressionError, setRegressionError] = useState<string | null>(null);

  const handleTrain = async () => {
    if (!selectedTarget) return;
    setIsTraining(true);
    setRegressionError(null);
    try {
      const res = await runLinearRegression(dataset_id, selectedTarget);
      setRegressionResult(res);
    } catch (err: unknown) {
      setRegressionError(err instanceof Error ? err.message : "Training failed.");
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-10 animate-fade-in">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100">{filename}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                <CheckCircle2 size={12} /> Ready
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Dataset ID: <code className="text-slate-300 font-mono">{dataset_id.slice(0, 8)}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={getReportDownloadUrl(dataset_id)}
            download
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-lg shadow-blue-900/20 transition-colors"
          >
            <Download size={15} />
            <span>Download Report (.md)</span>
          </a>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            <RotateCcw size={14} />
            <span>Upload New File</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div data-testid="total-rows" className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Rows</p>
          <p className="text-3xl font-bold text-slate-100 mt-2">{summary.row_count.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Observation instances</p>
        </div>
        <div data-testid="total-columns" className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Columns</p>
          <p className="text-3xl font-bold text-slate-100 mt-2">{summary.column_count}</p>
          <p className="text-xs text-slate-500 mt-1">{summary.numeric_columns.length} numeric, {summary.column_count - summary.numeric_columns.length} categorical</p>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Missing Values</p>
          <p className={`text-3xl font-bold mt-2 ${summary.total_missing > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {summary.total_missing.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {summary.total_missing === 0 ? "Clean dataset (no nulls)" : "Handled via training imputation"}
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Correlated Pairs</p>
          <p className="text-3xl font-bold text-blue-400 mt-2">{correlations.pairs.length}</p>
          <p className="text-xs text-slate-500 mt-1">Pearson coefficients evaluated</p>
        </div>
      </div>

      {/* Section 1: Data Preview */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TableIcon size={18} className="text-blue-400" />
          <h2 className="text-lg font-semibold text-slate-200">Data Preview & Columns</h2>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/30">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider">
              <tr>
                {summary.columns.map((col) => (
                  <th key={col.name} className="px-4 py-3 font-semibold">
                    <div className="flex flex-col">
                      <span className="text-slate-200">{col.name}</span>
                      <span className="text-[10px] lowercase text-slate-500">{col.dtype}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {summary.preview.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  {summary.columns.map((col) => (
                    <td key={col.name} className="px-4 py-2.5 whitespace-nowrap">
                      {row[col.name] !== null && row[col.name] !== undefined
                        ? String(row[col.name])
                        : <span className="text-amber-500/70">null</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Descriptive Statistics */}
      {summary.numeric_columns.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-200">Descriptive Statistics</h2>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/30">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Column</th>
                  <th className="px-4 py-3 font-semibold">Count</th>
                  <th className="px-4 py-3 font-semibold">Mean</th>
                  <th className="px-4 py-3 font-semibold">Std Dev</th>
                  <th className="px-4 py-3 font-semibold">Min</th>
                  <th className="px-4 py-3 font-semibold">25%</th>
                  <th className="px-4 py-3 font-semibold">Median</th>
                  <th className="px-4 py-3 font-semibold">75%</th>
                  <th className="px-4 py-3 font-semibold">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {summary.numeric_columns.map((col) => {
                  const stat = summary.statistics[col];
                  if (!stat) return null;
                  return (
                    <tr key={col} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5 font-sans font-medium text-slate-200">{col}</td>
                      <td className="px-4 py-2.5 text-slate-400">{stat.count}</td>
                      <td className="px-4 py-2.5 text-blue-300 font-semibold">{stat.mean}</td>
                      <td className="px-4 py-2.5">{stat.std}</td>
                      <td className="px-4 py-2.5">{stat.min}</td>
                      <td className="px-4 py-2.5">{stat.q25}</td>
                      <td className="px-4 py-2.5">{stat.median}</td>
                      <td className="px-4 py-2.5">{stat.q75}</td>
                      <td className="px-4 py-2.5">{stat.max}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 3: Pearson Correlations */}
      {correlations.pairs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-200">Pearson Correlation Analysis</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Pairs List */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/30 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Strongest Linear Relationships
              </h3>
              <div className="space-y-2">
                {correlations.pairs.slice(0, 6).map((pair, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">{pair.col1}</span>
                      <span className="text-slate-500">↔</span>
                      <span className="font-medium text-slate-200">{pair.col2}</span>
                    </div>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded ${
                        pair.correlation > 0
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                          : "bg-rose-950 text-rose-400 border border-rose-800/60"
                      }`}
                    >
                      {pair.correlation > 0 ? `+${pair.correlation}` : pair.correlation}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Correlation Heatmap Grid */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/30 space-y-3 overflow-x-auto">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Correlation Matrix
              </h3>
              <div className="inline-block min-w-full">
                <table className="text-center text-xs">
                  <thead>
                    <tr>
                      <th className="p-1"></th>
                      {correlations.matrix.columns.map((col) => (
                        <th key={col} className="p-1.5 font-medium text-slate-400 max-w-[80px] truncate text-[11px]">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {correlations.matrix.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td className="p-1.5 font-medium text-slate-400 text-left text-[11px] max-w-[80px] truncate">
                          {correlations.matrix.columns[rIdx]}
                        </td>
                        {row.map((val, cIdx) => {
                          const intensity = Math.abs(val);
                          const bgStyle =
                            val > 0
                              ? `rgba(59, 130, 246, ${Math.max(0.1, intensity * 0.8)})`
                              : `rgba(244, 63, 94, ${Math.max(0.1, intensity * 0.8)})`;
                          return (
                            <td
                              key={cIdx}
                              style={{ backgroundColor: bgStyle }}
                              className="p-1.5 border border-slate-900 font-mono text-[11px] text-white font-medium rounded"
                              title={`${correlations.matrix.columns[rIdx]} & ${correlations.matrix.columns[cIdx]}: ${val}`}
                            >
                              {val.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Machine Learning Linear Regression */}
      {summary.numeric_columns.length >= 2 && (
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-blue-400" />
                <h2 className="text-lg font-semibold text-slate-200">Linear Regression Studio</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Fit an ordinary least-squares model with strict 80% train / 20% test validation and zero leakage.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="target-select" className="text-xs font-medium text-slate-400">
                Target Column:
              </label>
              <select
                id="target-select"
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-500"
              >
                {summary.numeric_columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleTrain}
                disabled={isTraining || !selectedTarget}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-lg shadow-blue-900/30 transition-colors disabled:opacity-50"
              >
                {isTraining ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                <span>{isTraining ? "Fitting Model..." : "Train Model"}</span>
              </button>
            </div>
          </div>

          {regressionError && (
            <div role="alert" className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-400" />
              <span>{regressionError}</span>
            </div>
          )}

          {regressionResult && (
            <div className="space-y-6 pt-4 border-t border-slate-800">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">Test R² Score</p>
                  <p className="text-2xl font-bold text-blue-400 mt-1 font-mono">{regressionResult.metrics.r2}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Variance explained on test data</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">Train R² Score</p>
                  <p className="text-2xl font-bold text-slate-300 mt-1 font-mono">{regressionResult.metrics.train_r2}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Training fit baseline</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">Mean Abs Error (MAE)</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{regressionResult.metrics.mae}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Average prediction error</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">Root Mean Sq Error (RMSE)</p>
                  <p className="text-2xl font-bold text-slate-200 mt-1 font-mono">{regressionResult.metrics.rmse}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Penalizes large errors</p>
                </div>
              </div>

              {/* Chart & Feature Weights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Feature Coefficients */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Feature Weights (Coefficients)
                  </h3>
                  <div className="space-y-2">
                    {regressionResult.coefficients.map((coef, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-300">{coef.feature}</span>
                          <span className="font-mono text-slate-400">{coef.weight}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${coef.weight >= 0 ? "bg-blue-500" : "bg-rose-500"}`}
                            style={{
                              width: `${Math.min(100, Math.abs(coef.weight) * 20)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 text-[11px] text-slate-500 flex justify-between border-t border-slate-800/80">
                      <span>Model Intercept</span>
                      <span className="font-mono text-slate-400">{regressionResult.intercept}</span>
                    </div>
                  </div>
                </div>

                {/* Actual vs Predicted Scatter Chart */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Actual vs. Predicted (Test Split)
                    </h3>
                    <span className="text-[10px] text-slate-500">Dashed line = perfect prediction (y = x)</span>
                  </div>

                  {regressionResult.chart_points.length > 0 && (
                    <div className="relative w-full aspect-video bg-slate-900/50 rounded-lg p-2 border border-slate-800">
                      {(() => {
                        const pts = regressionResult.chart_points;
                        const allVals = pts.flatMap((p) => [p.actual, p.predicted]);
                        const min = Math.min(...allVals);
                        const max = Math.max(...allVals);
                        const range = max - min || 1;

                        const toSvgX = (v: number) => 30 + ((v - min) / range) * 230;
                        const toSvgY = (v: number) => 170 - ((v - min) / range) * 140;

                        return (
                          <svg viewBox="0 0 280 190" className="w-full h-full">
                            {/* Grid Lines */}
                            <line x1="30" y1="170" x2="260" y2="170" stroke="#334155" strokeWidth="1" />
                            <line x1="30" y1="30" x2="30" y2="170" stroke="#334155" strokeWidth="1" />

                            {/* Ideal y = x Line */}
                            <line
                              x1={toSvgX(min)}
                              y1={toSvgY(min)}
                              x2={toSvgX(max)}
                              y2={toSvgY(max)}
                              stroke="#64748b"
                              strokeWidth="1.5"
                              strokeDasharray="4 4"
                            />

                            {/* Points */}
                            {pts.map((pt, idx) => (
                              <circle
                                key={idx}
                                cx={toSvgX(pt.actual)}
                                cy={toSvgY(pt.predicted)}
                                r="4"
                                fill="#60a5fa"
                                fillOpacity="0.8"
                                stroke="#1e3a8a"
                                strokeWidth="1"
                              >
                                <title>{`Actual: ${pt.actual}, Predicted: ${pt.predicted}`}</title>
                              </circle>
                            ))}

                            {/* Labels */}
                            <text x="145" y="185" fill="#94a3b8" fontSize="8" textAnchor="middle">
                              Actual Values
                            </text>
                            <text
                              x="12"
                              y="100"
                              fill="#94a3b8"
                              fontSize="8"
                              textAnchor="middle"
                              transform="rotate(-90 12 100)"
                            >
                              Predicted Values
                            </text>
                          </svg>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
