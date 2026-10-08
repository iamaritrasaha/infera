"use client";

import React, { useState } from "react";
import { AnalysisResponse } from "@/lib/types";
import { executeFullAnalysis, errorMessage } from "@/lib/api";
import { VisualizationBoundary } from "./VisualizationBoundary";
import { OverviewTab } from "./tabs/OverviewTab";
import { DataQualityTab } from "./tabs/DataQualityTab";
import { ExploreTab } from "./tabs/ExploreTab";
import { StatisticsTab } from "./tabs/StatisticsTab";
import { MachineLearningTab } from "./tabs/MachineLearningTab";
import { InsightsTab } from "./tabs/InsightsTab";
import { ReportTab } from "./tabs/ReportTab";
import { ArrowLeft, BarChart2, Cpu, FileText, FlaskConical, LayoutDashboard, Loader2, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";

interface AnalysisViewProps {
  initialData: AnalysisResponse;
  onReset: () => void;
}

type TabType = "overview" | "quality" | "explore" | "statistics" | "ml" | "insights" | "report";

export function AnalysisView({ initialData, onReset }: AnalysisViewProps) {
  const [data, setData] = useState<AnalysisResponse>(initialData);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReAnalyze = async (newTarget?: string) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const refreshed = await executeFullAnalysis(data.dataset_id, newTarget ?? data.problem_detection.target_column ?? undefined);
      setData(refreshed);
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
    { id: "insights" as TabType, label: "Insights", icon: Sparkles },
    { id: "report" as TabType, label: "Report", icon: FileText },
  ];

  return (
    <div className="space-y-6 min-w-0">
      {error && <p role="alert" className="rounded-lg border border-rose-500/30 p-3 text-sm text-rose-300">{error}</p>}
      {/* Top Dataset Header Bar */}
      <div className="analysis-header bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              <h2 className="text-lg font-bold text-white tracking-tight break-all">{data.dataset_name}</h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                {data.problem_detection.problem_type.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {data.schema.row_count.toLocaleString()} rows &bull; {data.schema.column_count} columns &bull; Health:{" "}
              <strong className="text-slate-200">{data.health_score}/100</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleReAnalyze()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>{isLoading ? "Computing..." : "Re-Run Pipeline"}</span>
          </button>

          <button
            onClick={() => setActiveTab("report")}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm shadow-blue-500/20"
          >
            Export Report
          </button>
        </div>
      </div>

      {/* Tab Pill Navigation */}
      <div role="tablist" aria-label="Analysis sections" className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800">
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
                const next = event.key === "ArrowRight" ? (index + 1) % navItems.length
                  : event.key === "ArrowLeft" ? (index + navItems.length - 1) % navItems.length
                  : event.key === "Home" ? 0 : event.key === "End" ? navItems.length - 1 : -1;
                if (next < 0) return;
                event.preventDefault();
                setActiveTab(navItems[next].id);
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
              }}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                isActive
                  ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-500"}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Display */}
      <VisualizationBoundary key={activeTab + data.problem_detection.target_column}>
      <div role="tabpanel" id="analysis-panel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === "overview" && (
          <OverviewTab
            data={data}
            onSelectTarget={() => {
              setActiveTab("ml");
            }}
          />
        )}
        {activeTab === "quality" && <DataQualityTab data={data} />}
        {activeTab === "explore" && <ExploreTab data={data} />}
        {activeTab === "statistics" && <StatisticsTab data={data} />}
        {activeTab === "ml" && (
          <MachineLearningTab
            data={data}
            onReAnalyze={async (t) => handleReAnalyze(t)}
          />
        )}
        {activeTab === "insights" && <InsightsTab data={data} />}
        {activeTab === "report" && <ReportTab data={data} />}
      </div>
      </VisualizationBoundary>
    </div>
  );
}
