"use client";

import React, { useRef, useState } from "react";
import { AnalysisResponse, ExplorationResponse } from "@/lib/types";
import { AnalysisFocus } from "@/lib/types";
import { executeFullAnalysis, errorMessage } from "@/lib/api";
import { EngineDetail } from "./EngineConnection";
import { VisualizationBoundary } from "./VisualizationBoundary";
import { OverviewTab } from "./tabs/OverviewTab";
import { DataQualityTab } from "./tabs/DataQualityTab";
import { ExploreTab } from "./tabs/ExploreTab";
import { StatisticsTab } from "./tabs/StatisticsTab";
import { MachineLearningTab } from "./tabs/MachineLearningTab";
import { InsightsTab } from "./tabs/InsightsTab";
import { ReportTab } from "./tabs/ReportTab";
import type { ExplorationDrilldown } from "./tabs/InteractiveExplorer";
import { saveAnalysisSnapshot } from "@/lib/snapshots";
import {
  ArrowLeft,
  BarChart2,
  Cpu,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Save,
  Sparkles,
} from "lucide-react";

interface AnalysisViewProps {
  initialData: AnalysisResponse;
  onReset: () => void;
  source?: "computed" | "precomputed_example";
}

type TabType =
  | "overview"
  | "quality"
  | "explore"
  | "statistics"
  | "ml"
  | "insights"
  | "report";

export function AnalysisView({ initialData, onReset, source = "computed" }: AnalysisViewProps) {
  const [data, setData] = useState<AnalysisResponse>(initialData);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<ExplorationDrilldown | null>(null);
  const [interactiveExploration, setInteractiveExploration] = useState<ExplorationResponse | null>(null);
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [snapshotTitle, setSnapshotTitle] = useState(initialData.dataset_name);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const drilldownCounter = useRef(0);

  const saveSnapshot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingSnapshot) return;
    setSavingSnapshot(true);
    setSnapshotError(null);
    setSnapshotMessage(null);
    try {
      await saveAnalysisSnapshot(data, snapshotTitle, source);
      setSnapshotMessage("Saved in this browser. Return to the workspace to open or delete it.");
      setShowSavePanel(false);
    } catch (reason) {
      setSnapshotError(reason instanceof Error ? reason.message : "This analysis could not be saved to browser storage.");
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handleExploreFinding = (finding: AnalysisResponse["insight_discovery"]["key_findings"][number]) => {
    if (finding.category === "model") {
      setActiveTab("ml");
      return;
    }
    drilldownCounter.current += 1;
    setDrilldown({ finding, nonce: drilldownCounter.current });
    setActiveTab("explore");
  };

  const handleReAnalyze = async (newTarget?: string, newFocus?: AnalysisFocus) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const refreshed = await executeFullAnalysis(
        data.dataset_id,
        newTarget ?? data.problem_detection.target_column ?? undefined,
        newFocus ?? data.insight_discovery.selected_focus,
      );
      setData(refreshed);
      setInteractiveExploration(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const navItems = [
    { id: "overview" as TabType, label: "Overview", icon: LayoutDashboard },
    { id: "quality" as TabType, label: "Data Quality", icon: ShieldAlert },
    { id: "explore" as TabType, label: "Explore", icon: BarChart2 },
    { id: "statistics" as TabType, label: "Statistics", icon: FlaskConical },
    { id: "ml" as TabType, label: "Machine Learning", icon: Cpu },
    { id: "insights" as TabType, label: "Statistical Evidence", icon: Sparkles },
    { id: "report" as TabType, label: "Report", icon: FileText },
  ];

  return (
    <div className="analysis-workspace min-w-0">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-500/30 p-3 text-sm text-rose-300"
        >
          {error}
        </p>
      )}
      {/* Top Dataset Header Bar */}
      <div className="analysis-header">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onReset}
            disabled={isLoading}
            aria-label="Choose another dataset"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
            title="Upload or pick another dataset"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h2 className="text-lg font-bold text-white tracking-tight break-all">
                {data.dataset_name}
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-200 border border-cyan-900">
                {source === "precomputed_example" ? "Precomputed synthetic example" : "Computed analysis"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {data.insight_discovery.key_findings.length} key findings · {source === "precomputed_example" ? "Example results, not a live upload" : "Computed from this dataset"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <EngineDetail />
          {source === "computed" && <button
            onClick={() => handleReAnalyze()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>{isLoading ? "Computing..." : "Refresh findings"}</span>
          </button>}

          <button
            type="button"
            onClick={() => { setShowSavePanel((visible) => !visible); setSnapshotError(null); setSnapshotMessage(null); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            <Save size={14} /> Save analysis to this browser
          </button>

          <button
            onClick={() => setActiveTab("report")}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm shadow-blue-500/20"
          >
            Export Report
          </button>
        </div>
      </div>

      {showSavePanel && <form onSubmit={(event) => void saveSnapshot(event)} className="mb-4 rounded-xl border border-cyan-900/60 bg-slate-900/80 p-4">
        <label className="block max-w-xl text-xs font-medium text-slate-200">Analysis title
          <input autoFocus maxLength={100} value={snapshotTitle} onChange={(event) => setSnapshotTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400" />
        </label>
        <p className="mt-2 max-w-3xl text-[11px] leading-5 text-amber-100">This explicitly saves computed findings on this device. Some category names and statistics may be sensitive. Raw preview rows, session tokens, and per-record model predictions are excluded. Browser storage may be cleared by your browser.</p>
        {snapshotError && <p role="alert" className="mt-2 text-xs text-rose-200">{snapshotError}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" disabled={savingSnapshot} className="button-primary text-xs disabled:opacity-50">{savingSnapshot ? "Saving…" : "Save snapshot"}</button>
          <button type="button" onClick={() => setShowSavePanel(false)} className="button-secondary text-xs">Cancel</button>
        </div>
      </form>}
      {snapshotMessage && <p role="status" className="mb-4 rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-2.5 text-xs text-emerald-100">{snapshotMessage}</p>}

      <div className="workspace-grid">
        <aside className="workspace-sidebar">
          <p className="step-label">WORKSPACE</p>
          {/* Section Navigation */}
          <div
            role="tablist"
            aria-label="Analysis sections"
            aria-orientation="vertical"
            className="workspace-tabs"
          >
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-controls="analysis-panel"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onKeyDown={(event) => {
                    const next =
                      event.key === "ArrowRight" || event.key === "ArrowDown"
                        ? (index + 1) % navItems.length
                        : event.key === "ArrowLeft" || event.key === "ArrowUp"
                          ? (index + navItems.length - 1) % navItems.length
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? navItems.length - 1
                              : -1;
                    if (next < 0) return;
                    event.preventDefault();
                    setActiveTab(navItems[next].id);
                    event.currentTarget.parentElement
                      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                      [next]?.focus();
                  }}
                  onClick={() => setActiveTab(item.id)}
                  className={`workspace-tab ${isActive ? "active" : ""}`}
                >
                  <Icon
                    className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-500"}`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="sidebar-note">
            <p>PYTHON ENGINE</p>
            <span>
              Computed results.
              <br />
              Inspectable evidence.
            </span>
          </div>
        </aside>
        {/* Tab Content Display */}
        <VisualizationBoundary
          key={activeTab + data.problem_detection.target_column}
        >
          <div
            className="workspace-panel"
            role="tabpanel"
            id="analysis-panel"
            aria-labelledby={`tab-${activeTab}`}
          >
            {activeTab === "overview" && (
              <OverviewTab
                key={JSON.stringify(data.insight_discovery.selected_focus)}
                data={data}
                onApplyFocus={(focus) => handleReAnalyze(undefined, focus)}
                onExploreFinding={handleExploreFinding}
                onSelectTarget={() => {
                  setActiveTab("ml");
                }}
              />
            )}
            {activeTab === "quality" && <DataQualityTab data={data} />}
            {activeTab === "explore" && <ExploreTab data={data} drilldown={drilldown} onExplorationResultChange={setInteractiveExploration} />}
            {activeTab === "statistics" && <StatisticsTab data={data} />}
            {activeTab === "ml" && (
              <MachineLearningTab
                data={data}
                onReAnalyze={async (t) => handleReAnalyze(t)}
              />
            )}
            {activeTab === "insights" && <InsightsTab data={data} onExploreFinding={handleExploreFinding} />}
            {activeTab === "report" && <ReportTab data={data} exploration={interactiveExploration} />}
          </div>
        </VisualizationBoundary>
      </div>
    </div>
  );
}
