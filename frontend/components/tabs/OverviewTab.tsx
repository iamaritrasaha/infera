"use client";

import { useState } from "react";
import { AnalysisFocus, AnalysisResponse, InsightQuestion, KeyFinding } from "@/lib/types";
import { InsightChart } from "@/components/charts/InsightChart";
import { ChevronDown, Compass, Database, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";

interface OverviewTabProps {
  data: AnalysisResponse;
  onSelectTarget?: (target: string) => void;
  onApplyFocus?: (focus: AnalysisFocus) => Promise<void>;
}

const goalLabels: Record<string, string> = {
  discover_insights: "Discover Insights",
  trends: "Trends over Time",
  compare_groups: "Compare Groups",
  relationships: "Explore Relationships",
  predict_outcome: "Predict Outcome",
  explore_everything: "Explore Everything",
};

const questions: { value: InsightQuestion; label: string }[] = [
  { value: "automatic", label: "Let Infera choose" },
  { value: "time", label: "What changed over time?" },
  { value: "groups", label: "How do groups differ?" },
  { value: "relationships", label: "Which fields move together?" },
  { value: "distributions", label: "How are values spread?" },
];

const categoryLabels: Record<KeyFinding["category"], string> = {
  time: "Time pattern",
  group: "Group comparison",
  relationship: "Association",
  distribution: "Distribution",
  model: "Prediction",
};

function displayEvidence(value: unknown) {
  if (value === null || value === undefined) return "Not available";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 5 });
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function FindingCard({ finding }: { finding: KeyFinding }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-cyan-800/80 bg-cyan-950/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
          {categoryLabels[finding.category]}
        </span>
        <span className="text-[10px] capitalize text-slate-400">{finding.confidence} evidence</span>
      </div>
      <h4 className="mt-3 text-base font-semibold leading-snug text-white">{finding.title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-200">{finding.summary}</p>
      <p className="mt-3 text-xs leading-5 text-slate-400">{finding.interpretation}</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <a
          href={`#finding-chart-${finding.id}`}
          className="text-xs font-medium text-cyan-300 underline decoration-cyan-800 underline-offset-4 hover:text-cyan-200"
        >
          View supporting chart
        </a>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white">
            Evidence and limitation <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {Object.entries(finding.evidence).map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">{key.replaceAll("_", " ")}</dt>
                  <dd className="break-words text-xs text-slate-200">{displayEvidence(value)}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-slate-800 pt-3 text-xs leading-5 text-slate-400">
              <strong className="text-slate-300">What this cannot tell us: </strong>{finding.limitation}
            </p>
          </div>
        </details>
      </div>
    </article>
  );
}

function FindingVisual({ finding }: { finding: KeyFinding }) {
  if (!finding.chart) return null;
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/35 p-4">
      <InsightChart chart={finding.chart} id={`finding-chart-${finding.id}`} />
      <p className="mt-3 text-sm leading-6 text-slate-300">{finding.interpretation}</p>
      <details className="mt-3 text-xs text-slate-400">
        <summary className="cursor-pointer font-medium text-slate-300">Inspect the values behind this chart</summary>
        <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {Object.entries(finding.evidence).map(([key, value]) => (
            <div key={key}>
              <dt className="text-[10px] uppercase tracking-wide text-slate-500">{key.replaceAll("_", " ")}</dt>
              <dd className="break-words text-slate-200">{displayEvidence(value)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </article>
  );
}

export function OverviewTab({ data, onSelectTarget, onApplyFocus }: OverviewTabProps) {
  const { schema, health_score, quality, preview_rows, problem_detection } = data;
  const discovery = data.insight_discovery;
  const [searchTerm, setSearchTerm] = useState("");
  const [focus, setFocus] = useState<AnalysisFocus>(discovery.selected_focus);
  const [applying, setApplying] = useState(false);

  const filteredColumns = schema.columns.filter(
    (column) =>
      column.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      column.inferred_type.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const timeFindings = discovery.key_findings.filter((item) => item.category === "time" || item.category === "distribution");
  const relationshipFindings = discovery.key_findings.filter((item) => item.category === "group" || item.category === "relationship");
  const modelFindings = discovery.key_findings.filter((item) => item.category === "model");

  const getHealthLabel = (score: number) => {
    if (score >= 85) return "Few observed data-quality issues";
    if (score >= 70) return "Some checks need review";
    if (score >= 50) return "Review data quality before modeling";
    return "Significant data-quality issues detected";
  };

  const applyFocus = async () => {
    if (!onApplyFocus || applying) return;
    setApplying(true);
    try {
      await onApplyFocus(focus);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-7">
      <section aria-labelledby="dataset-overview-title" className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-cyan-300">
            <Sparkles size={18} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Dataset overview</p>
          </div>
          {discovery.goal && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-950/90 border border-blue-800 text-cyan-200">
              <Compass size={12} className="text-cyan-400" />
              <span>Goal: {goalLabels[discovery.goal] || discovery.goal}</span>
            </span>
          )}
        </div>
        <h3 id="dataset-overview-title" className="mt-3 text-xl font-semibold text-white">What this data contains</h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{discovery.dataset_overview}</p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-900/70 bg-slate-950/60 px-3 py-1.5 text-xs text-cyan-100">
          <TrendingUp size={14} /> {discovery.status}
        </p>
      </section>

      {discovery.important_metrics.length > 0 && (
        <section aria-labelledby="important-metrics-title">
          <div className="mb-3 flex items-center gap-2">
            <Target size={16} className="text-cyan-300" />
            <h3 id="important-metrics-title" className="text-sm font-semibold text-white">Important metrics</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {discovery.important_metrics.map((metric) => (
              <article key={metric.label} className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-400">{metric.label}</p>
                <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-white">{metric.value}</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">{metric.detail}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="key-findings-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Insights first</p>
            <h3 id="key-findings-title" className="mt-1 text-base font-semibold text-white">Key findings</h3>
          </div>
          <span className="text-xs text-slate-500">{discovery.key_findings.length} selected from the available evidence</span>
        </div>
        {discovery.key_findings.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {discovery.key_findings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-sm leading-6 text-slate-300">
            {discovery.status} Try a different focus or inspect the data in Explore.
          </div>
        )}
      </section>

      {timeFindings.length > 0 && (
        <section aria-labelledby="patterns-title">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-cyan-300" />
            <h3 id="patterns-title" className="text-sm font-semibold text-white">Trends and patterns</h3>
          </div>
          <div className="space-y-3">{timeFindings.map((item) => <FindingVisual key={item.id} finding={item} />)}</div>
        </section>
      )}

      {relationshipFindings.length > 0 && (
        <section aria-labelledby="relationships-title">
          <div className="mb-3 flex items-center gap-2">
            <Database size={16} className="text-cyan-300" />
            <h3 id="relationships-title" className="text-sm font-semibold text-white">Relationships and comparisons</h3>
          </div>
          <div className="space-y-3">{relationshipFindings.map((item) => <FindingVisual key={item.id} finding={item} />)}</div>
        </section>
      )}

      {modelFindings.length > 0 && (
        <section aria-labelledby="model-finding-title">
          <h3 id="model-finding-title" className="mb-3 text-sm font-semibold text-white">Prediction performance</h3>
          <div className="space-y-3">{modelFindings.map((item) => <FindingVisual key={item.id} finding={item} />)}</div>
        </section>
      )}

      <section aria-labelledby="explore-further-title" className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-cyan-300" />
          <h3 id="explore-further-title" className="text-sm font-semibold text-white">Explore further</h3>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {discovery.suggested_questions.map((question) => (
            <li key={question} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-xs leading-5 text-slate-300">{question}</li>
          ))}
        </ul>
        {onApplyFocus && (
          <details className="group mt-4 border-t border-slate-800 pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-slate-300 hover:text-white">
              <span>Choose a metric, date, or grouping to focus the analysis</span>
              <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-[11px] text-slate-400">
                Main metric
                <select value={focus.metric_column ?? ""} onChange={(event) => setFocus({ ...focus, metric_column: event.target.value || null })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
                  <option value="">Automatic choice</option>
                  {discovery.options.metric_columns.map((column) => <option key={column} value={column}>{column}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-[11px] text-slate-400">
                Date or time field
                <select value={focus.date_column ?? ""} onChange={(event) => setFocus({ ...focus, date_column: event.target.value || null })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
                  <option value="">Automatic choice</option>
                  {discovery.options.date_columns.map((column) => <option key={column} value={column}>{column}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-[11px] text-slate-400">
                Group by
                <select value={focus.group_column ?? ""} onChange={(event) => setFocus({ ...focus, group_column: event.target.value || null })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
                  <option value="">Automatic choice</option>
                  {discovery.options.group_columns.map((column) => <option key={column} value={column}>{column}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-[11px] text-slate-400">
                Analytical question
                <select value={focus.question} onChange={(event) => setFocus({ ...focus, question: event.target.value as InsightQuestion })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
                  {questions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
            </div>
            <button type="button" onClick={applyFocus} disabled={applying} className="mt-4 rounded-lg bg-cyan-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-600 disabled:cursor-wait disabled:opacity-60">
              {applying ? "Recomputing findings…" : "Update analysis focus"}
            </button>
          </details>
        )}
      </section>

      <details className="group rounded-xl border border-slate-800 bg-slate-950/30 p-4 sm:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-200">
          <span className="flex items-center gap-2"><ShieldCheck size={16} className="text-slate-400" /> Dataset details and diagnostics</span>
          <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 space-y-5 border-t border-slate-800 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-[11px] text-slate-400">Records</p>
              <p className="mt-1 text-xl font-semibold text-white">{schema.row_count.toLocaleString()}</p>
              <p className="mt-1 text-[10px] text-slate-500">{quality.missing.complete_rows_percentage}% complete rows</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-[11px] text-slate-400">Fields</p>
              <p className="mt-1 text-xl font-semibold text-white">{schema.column_count}</p>
              <p className="mt-1 text-[10px] text-slate-500">{schema.numerical_columns.length} numeric · {schema.categorical_columns.length} categorical</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-[11px] text-slate-400">Data quality score</p>
              <p className="mt-1 text-xl font-semibold text-white">{health_score}/100</p>
              <p className="mt-1 text-[10px] text-slate-500">{getHealthLabel(health_score)}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-[11px] text-slate-400">Missing values</p>
              <p className="mt-1 text-xl font-semibold text-white">{quality.missing.total_missing_cells.toLocaleString()}</p>
              <p className="mt-1 text-[10px] text-slate-500">{quality.duplicates.duplicate_rows_count.toLocaleString()} duplicate rows · {schema.memory_formatted}</p>
            </div>
          </div>

          {problem_detection.target_column && (
            <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200"><Target size={14} className="text-cyan-300" /> Modeling target: {problem_detection.target_column}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{problem_detection.reason}</p>
              </div>
              {onSelectTarget && <button onClick={() => onSelectTarget(problem_detection.target_column!)} className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">Review model diagnostics</button>}
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">Column details</h4>
                <p className="mt-1 text-[11px] text-slate-400">Types, missing values, uniqueness, and sample values.</p>
              </div>
              <input type="search" aria-label="Search columns" placeholder="Search columns…" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500 sm:w-56" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead><tr className="border-b border-slate-800 text-slate-400"><th className="px-3 py-2">Column</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Missing</th><th className="px-3 py-2">Distinct</th><th className="px-3 py-2">Example values</th></tr></thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredColumns.map((column) => (
                    <tr key={column.name} className="hover:bg-slate-800/30">
                      <td className="px-3 py-2.5 font-medium text-slate-200">{column.name}</td>
                      <td className="px-3 py-2.5 text-slate-400">{schema.id_columns.includes(column.name) ? "Identifier" : column.inferred_type}</td>
                      <td className="px-3 py-2.5 text-slate-400">{column.null_percentage}%</td>
                      <td className="px-3 py-2.5 text-slate-400">{column.unique_count.toLocaleString()}</td>
                      <td className="max-w-xs truncate px-3 py-2.5 font-mono text-[11px] text-slate-500">{column.sample_values.slice(0, 4).map(String).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {preview_rows && preview_rows.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <h4 className="text-sm font-semibold text-white">Example records</h4>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead><tr className="border-b border-slate-800 text-slate-400">{Object.keys(preview_rows[0]).map((key) => <th key={key} className="whitespace-nowrap px-3 py-2">{key}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">{preview_rows.map((row, rowIndex) => <tr key={rowIndex}>{Object.values(row).map((value, columnIndex) => <td key={columnIndex} className="whitespace-nowrap px-3 py-2 text-slate-400">{value === null || value === "" ? "-" : String(value)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
