"use client";

import { useState } from "react";
import { AnalysisResponse, UploadResponse } from "@/lib/types";
import { executeFullAnalysis, errorMessage } from "@/lib/api";
import { UploadZone } from "./UploadZone";
import { SampleDatasets } from "./SampleDatasets";
import { AnalysisView } from "./AnalysisView";
import { EngineBanner, useEngine } from "./EngineConnection";
import {
  ArrowRight,
  Database,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

export function DatasetWorkspace() {
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const { state } = useEngine();
  const load = (data: UploadResponse) => {
    setUploadData(data);
    setAnalysisResult(null);
    setError(null);
    setSelectedTarget(data.recommended_target || "");
  };
  const reset = () => {
    setUploadData(null);
    setAnalysisResult(null);
    setError(null);
  };
  const run = async () => {
    if (!uploadData || isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      setAnalysisResult(
        await executeFullAnalysis(
          uploadData.dataset_id,
          selectedTarget || undefined,
        ),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setIsAnalyzing(false);
    }
  };
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
          <div className="upload-layout">
            <UploadZone onUploadSuccess={load} />
            <aside className="upload-aside">
              <div className="step-label">01 / IMPORT</div>
              <h2>Ready for real analysis.</h2>
              <p>
                Structured data becomes a computed profile. Select a target to
                compare predictive models, or explore the patterns in your
                features.
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
            <SampleDatasets onLoadSample={load} />
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
          <div className="target-panel">
            <div>
              <h3>What would you like to understand?</h3>
              <p>
                Select a target for supervised modeling. Automatic inference
                also considers the dataset structure.
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
          <div className="analysis-launch">
            <p>
              Real Python calculations, applicable tests, and model comparisons.
              <br />
              <span>Results include baselines and limitations.</span>
            </p>
            <button
              onClick={run}
              disabled={isAnalyzing || state !== "CONNECTED"}
              className="button-primary"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Computing Mathematical Evidence...
                </>
              ) : (
                <>
                  Launch Full Analysis <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
          {isAnalyzing && (
            <div className="computation-status" role="status">
              <div className="indeterminate-progress" />
              <p>
                Computing statistics, validation folds, and model comparisons.
                You can inspect the profile while the engine works.
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
