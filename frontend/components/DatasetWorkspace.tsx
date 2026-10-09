"use client";

import { useState } from "react";
import { AnalysisResponse, AnalysisFocus, UploadResponse } from "@/lib/types";
import { executeFullAnalysis, errorMessage, uploadDatasetFile } from "@/lib/api";
import { LocalFilePreview, UploadZone } from "./UploadZone";
import { SampleDatasets } from "./SampleDatasets";
import { AnalysisView } from "./AnalysisView";
import { EngineBanner } from "./EngineConnection";
import {
  Activity,
  ArrowRight,
  Compass,
  Cpu,
  Database,
  Info,
  Layers,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";

type GoalId =
  | "discover_insights"
  | "trends"
  | "compare_groups"
  | "relationships"
  | "predict_outcome"
  | "explore_everything";

interface GoalOption {
  id: GoalId;
  title: string;
  description: string;
  icon: typeof Sparkles;
}

const ANALYSIS_GOALS: GoalOption[] = [
  {
    id: "discover_insights",
    title: "Discover Insights",
    description: "Automatic discovery of top patterns and unexpected observations across all dimensions.",
    icon: Sparkles,
  },
  {
    id: "trends",
    title: "Trends over Time",
    description: "Chronological patterns, peak/trough periods, and temporal progression rates.",
    icon: TrendingUp,
  },
  {
    id: "compare_groups",
    title: "Compare Groups",
    description: "Categorical group separations, segment medians, and distribution differences.",
    icon: Layers,
  },
  {
    id: "relationships",
    title: "Explore Relationships",
    description: "Pairwise associations, Spearman/Pearson correlation matrix, and strong interactions.",
    icon: Activity,
  },
  {
    id: "predict_outcome",
    title: "Predict Outcome",
    description: "Supervised predictive modeling, cross-validation, baseline comparison, and feature importance.",
    icon: Cpu,
  },
  {
    id: "explore_everything",
    title: "Explore Everything",
    description: "Comprehensive multi-module statistical run across the full analytical spectrum.",
    icon: Compass,
  },
];

export function DatasetWorkspace() {
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [localPreview, setLocalPreview] = useState<LocalFilePreview | null>(null);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<GoalId>("discover_insights");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploadingPreview, setIsUploadingPreview] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = (data: UploadResponse) => {
    setUploadData(data);
    setLocalPreview(null);
    setAnalysisResult(null);
    setError(null);
    setSelectedTarget(data.recommended_target || "");
  };

  const reset = () => {
    setUploadData(null);
    setLocalPreview(null);
    setAnalysisResult(null);
    setError(null);
  };

  const handleUploadLocalPreview = async () => {
    if (!localPreview || isUploadingPreview) return;
    setIsUploadingPreview(true);
    setError(null);
    try {
      const result = await uploadDatasetFile(localPreview.file);
      load(result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsUploadingPreview(false);
    }
  };

  const run = async () => {
    if (!uploadData || isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);

    const focus: AnalysisFocus = {
      question: "automatic",
    };

    try {
      const result = await executeFullAnalysis(
        uploadData.dataset_id,
        selectedTarget || undefined,
        focus,
        selectedGoal
      );
      setAnalysisResult(result);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const hasDatetimeColumn =
    uploadData?.columns.some((c) => c.inferred_type === "datetime") ?? false;

  return (
    <div className="workspace-container">
      <EngineBanner />

      {analysisResult ? (
        <AnalysisView initialData={analysisResult} onReset={reset} />
      ) : !uploadData ? (
        <div className="dataset-start">
          <div className="workspace-intro">
            <p className="eyebrow">ANALYSIS WORKSPACE</p>
            <h1>
              Your data.
              <br className="sm:hidden" /> A new perspective.
            </h1>
            <p>
              Start with a dataset. Infera will profile its structure before you
              choose what to investigate.
            </p>
          </div>

          {/* Local File Preview (Safe client-side inspection before/during upload) */}
          {localPreview && (
            <div className="mb-6 rounded-xl border border-cyan-500/30 bg-slate-900/80 p-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      Client-side preview -- no data uploaded yet
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {localPreview.sizeFormatted} · ~{localPreview.rowCountEstimate.toLocaleString()} rows
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-white">
                    {localPreview.name}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLocalPreview(null)}
                    disabled={isUploadingPreview}
                    className="button-secondary text-xs"
                  >
                    Clear preview
                  </button>
                  <button
                    onClick={handleUploadLocalPreview}
                    disabled={isUploadingPreview}
                    className="button-primary text-xs flex items-center gap-1.5"
                  >
                    {isUploadingPreview ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Uploading &amp; Profiling...
                      </>
                    ) : (
                      <>
                        <Upload size={13} />
                        Upload &amp; Profile with Python
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-400">
                <p>
                  First {localPreview.sampleRows.length} records parsed directly inside your browser. No files are transferred until you upload.
                </p>
                <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-800">
                      <tr>
                        {localPreview.columns.slice(0, 10).map((col) => (
                          <th key={col} className="px-3 py-2 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {localPreview.sampleRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          {localPreview.columns.slice(0, 10).map((col) => (
                            <td key={col} className="px-3 py-1.5 whitespace-nowrap text-slate-400">
                              {row[col] || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="upload-layout">
            <UploadZone
              onUploadSuccess={load}
              onLocalPreview={(preview) => setLocalPreview(preview)}
            />
            <aside className="upload-aside">
              <div className="step-label">01 / IMPORT</div>
              <h2>Ready for real analysis.</h2>
              <p>
                Structured data becomes a computed profile. Select an analysis goal to
                direct model training, hypothesis tests, and evidence discovery.
              </p>
              <ul>
                <li>
                  <Database size={15} /> Up to 50,000 rows and 100 columns
                </li>
                <li>
                  <ShieldCheck size={15} /> Access isolated to this browser
                  session
                </li>
              </ul>
              <p className="text-xs">
                Temporary datasets expire after one hour of inactivity or a
                server restart.
              </p>
            </aside>
          </div>

          <div className="sample-section">
            <SampleDatasets
              onLoadSample={load}
              onLoadExample={(example) => setAnalysisResult(example)}
            />
          </div>
        </div>
      ) : (
        <div className="staging-panel">
          <div className="staging-heading">
            <div>
              <p className="eyebrow">PROFILE READY / CONFIGURE ANALYSIS</p>
              <h2>{uploadData.dataset_name}</h2>
              <p className="font-mono text-xs text-slate-400">
                {uploadData.row_count.toLocaleString()} rows ·{" "}
                {uploadData.column_count} columns ·{" "}
                {uploadData.memory_formatted}
              </p>
            </div>
            <button
              onClick={reset}
              disabled={isAnalyzing}
              className="button-secondary"
            >
              <RotateCcw size={14} />
              Upload Different File
            </button>
          </div>

          <div className="staging-metrics">
            {[
              ["Observations", uploadData.row_count.toLocaleString()],
              ["Features", uploadData.column_count],
              [
                "Missing cells",
                uploadData.columns
                  .reduce((n, c) => n + c.null_count, 0)
                  .toLocaleString(),
              ],
              ["Data health", `${uploadData.health_score}/100`],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          {/* Analysis Goal Selector (Phase 8) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-blue-400" /> Choose Analysis Goal
                </h3>
                <p className="text-xs text-slate-400">
                  Select your primary analytical objective. Infera tailors ranking, visualizations, and statistical models accordingly.
                </p>
              </div>
              <span className="text-[11px] text-cyan-300 font-mono">
                Goal: {ANALYSIS_GOALS.find((g) => g.id === selectedGoal)?.title}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {ANALYSIS_GOALS.map((goal) => {
                const Icon = goal.icon;
                const isSelected = selectedGoal === goal.id;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => setSelectedGoal(goal.id)}
                    disabled={isAnalyzing}
                    className={`text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-950/40 text-white shadow-sm shadow-blue-500/20"
                        : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className={`w-4 h-4 ${
                          isSelected ? "text-cyan-300" : "text-slate-400"
                        }`}
                      />
                      <span className="text-xs font-semibold">{goal.title}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
                      {goal.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Date-absence transparency warning when Trends is selected without temporal column */}
            {selectedGoal === "trends" && !hasDatetimeColumn && (
              <div
                role="alert"
                className="mt-3 p-3 rounded-lg border border-amber-500/30 bg-amber-950/20 text-xs text-amber-200 flex items-start gap-2.5"
              >
                <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>No date/timestamp column detected.</strong> Chronological trend analysis requires temporal data. Infera will focus on record sequence without guessing or fabricating calendar dates. Consider selecting another goal for deeper non-temporal evidence.
                </div>
              </div>
            )}
          </div>

          {/* Target variable selection */}
          <div className="target-panel">
            <div>
              <h3>What would you like to understand?</h3>
              <p>
                Select a target variable for supervised modeling, or leave as automatic inference.
              </p>
            </div>
            <label className="target-label">
              Target variable
              <select
                aria-label="Analysis target"
                value={selectedTarget}
                disabled={isAnalyzing}
                onChange={(e) => setSelectedTarget(e.target.value)}
              >
                <option value="">Automatic inference</option>
                {uploadData.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.inferred_type})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {uploadData.potential_targets.length > 0 && (
            <div className="target-candidates">
              <span>Suggested targets</span>
              {uploadData.potential_targets.map((c) => (
                <button
                  disabled={isAnalyzing}
                  key={c.column}
                  aria-pressed={selectedTarget === c.column}
                  onClick={() => setSelectedTarget(c.column)}
                >
                  {c.column}
                </button>
              ))}
            </div>
          )}

          <div className="profile-columns">
            <h3>Column profile</h3>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Inferred type</th>
                    <th>Missing</th>
                    <th>Unique values</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadData.columns.map((c) => (
                    <tr key={c.name}>
                      <td>{c.name}</td>
                      <td>{c.inferred_type}</td>
                      <td className="font-mono">{c.null_percentage}%</td>
                      <td className="font-mono">
                        {c.unique_count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Launch Full Analysis Button (Anti-Gatekeeper Principle: Never disabled simply due to connection polling) */}
          <div className="analysis-launch">
            <p>
              Real Python calculations, applicable tests, and model comparisons.
              <br />
              <span>Results include baselines, evidence values, and limitations.</span>
            </p>
            <button
              onClick={run}
              disabled={isAnalyzing}
              className="button-primary flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  <span>Computing Mathematical Evidence...</span>
                </>
              ) : (
                <>
                  <span>Launch Full Analysis</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>

          {isAnalyzing && (
            <div className="computation-status" role="status">
              <div className="indeterminate-progress" />
              <p>
                Executing Python analysis pipeline (hypotheses, cross-validation, feature importance, and deterministic insight ranking). This may take 10-30 seconds.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
