"use client";

import { useEffect, useState } from "react";
import { BookOpen, Loader2, Trash2 } from "lucide-react";
import {
  clearAnalysisSnapshots,
  deleteAnalysisSnapshot,
  listAnalysisSnapshots,
  type SavedAnalysisSnapshot,
  type SnapshotListItem,
} from "@/lib/snapshots";
import { InsightChart } from "@/components/charts/InsightChart";

export function SavedAnalysisLibrary({ onOpen }: { onOpen: (snapshot: SavedAnalysisSnapshot) => void }) {
  const [items, setItems] = useState<SnapshotListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listAnalysisSnapshots());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Saved analyses could not be loaded from this browser.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    listAnalysisSnapshots()
      .then(setItems)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Saved analyses could not be loaded from this browser."))
      .finally(() => setLoading(false));
  }, []);

  const remove = async (id: string) => {
    try {
      await deleteAnalysisSnapshot(id);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This saved analysis could not be deleted.");
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Delete every saved analysis from this browser? This cannot be undone.")) return;
    try {
      await clearAnalysisSnapshots();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Saved analyses could not be cleared.");
    }
  };

  return (
    <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5" aria-labelledby="saved-analyses-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="saved-analyses-title" className="flex items-center gap-2 text-sm font-semibold text-white"><BookOpen size={16} className="text-cyan-300" /> Saved analyses in this browser</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">Saved findings stay on this device. They may include sensitive category names and statistics from your data. Raw previews, session tokens, and per-row model outputs are excluded. A saved analysis is a past result; re-upload the data to recompute it.</p>
        </div>
        {items.length > 0 && <button type="button" onClick={() => void clearAll()} className="rounded-lg border border-rose-900/70 px-2.5 py-1.5 text-xs text-rose-200 hover:bg-rose-950/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400">Clear all</button>}
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg border border-rose-500/30 p-2.5 text-xs text-rose-200">{error}</p>}
      {loading ? <p className="mt-4 flex items-center gap-2 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> Reading browser storage…</p>
        : items.length === 0 ? <p className="mt-4 rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">No saved analyses yet. Choose “Save analysis to this browser” after a computation.</p>
          : <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {items.map((item) => {
              const unsupported = "unsupported" in item;
              return <li key={item.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="min-w-0">
                  {unsupported ? <p className="text-xs font-medium text-amber-200">{item.title} · format v{item.format_version} cannot be opened</p>
                    : <button type="button" onClick={() => onOpen(item)} className="max-w-full truncate text-left text-sm font-medium text-cyan-100 underline decoration-cyan-900 underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">{item.title}</button>}
                  <p className="mt-1 text-[11px] text-slate-500">{item.created_at ? new Date(item.created_at).toLocaleString() : "Saved analysis"}{!unsupported && item.source === "precomputed_example" ? " · precomputed example" : ""}</p>
                </div>
                <button type="button" onClick={() => void remove(item.id)} aria-label={`Delete saved analysis ${item.title}`} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-950/60 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"><Trash2 size={15} /></button>
              </li>;
            })}
          </ul>}
      <p className="mt-3 text-[10px] text-slate-600">Up to 20 summaries are stored locally. Browser storage can be erased by the browser or operating system at any time.</p>
    </section>
  );
}

export function SavedAnalysisViewer({ snapshot, onClose }: { snapshot: SavedAnalysisSnapshot; onClose: () => void }) {
  const analysis = snapshot.analysis;
  return (
    <section className="analysis-workspace space-y-5" aria-labelledby="saved-analysis-view-title">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-cyan-900/60 bg-slate-900/70 p-4 sm:p-5">
        <div>
          <p className="eyebrow">READ-ONLY BROWSER SNAPSHOT · FORMAT V{snapshot.format_version}</p>
          <h1 id="saved-analysis-view-title" className="mt-1 text-xl font-semibold text-white">{snapshot.title}</h1>
          <p className="mt-1 text-xs text-slate-400">{analysis.dataset_name} · Saved {new Date(snapshot.created_at).toLocaleString()}</p>
        </div>
        <button type="button" onClick={onClose} className="button-secondary text-xs">Back to workspace</button>
      </header>

      <p role="note" className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100">This is a saved computation, not a live dataset session. The temporary backend session may have expired. Re-upload the source data to run new analyses.</p>
      {snapshot.source === "precomputed_example" && <p className="rounded-lg border border-blue-800/50 bg-blue-950/20 p-3 text-xs text-blue-100">These results came from Infera’s precomputed synthetic example, not a live upload.</p>}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Saved dataset summary">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-[11px] text-slate-500">Records in original analysis</p><p className="mt-1 text-xl font-semibold text-white">{analysis.schema.row_count.toLocaleString()}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-[11px] text-slate-500">Fields</p><p className="mt-1 text-xl font-semibold text-white">{analysis.schema.column_count.toLocaleString()}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-[11px] text-slate-500">Data quality indicator</p><p className="mt-1 text-xl font-semibold text-white">{analysis.health_score}/100</p></div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-white">What this data contains</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{analysis.overview}</p>
        <p className="mt-3 text-xs text-slate-400">{analysis.analysis_status}</p>
      </section>

      <section className="space-y-3" aria-labelledby="saved-key-findings-title">
        <h2 id="saved-key-findings-title" className="text-base font-semibold text-white">Key findings</h2>
        {analysis.key_findings.length ? analysis.key_findings.map((finding) => <article key={finding.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-200">{finding.category} · {finding.confidence} evidence</span>
          <h3 className="mt-2 text-base font-semibold text-white">{finding.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-200">{finding.summary}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">{finding.interpretation}</p>
          {finding.chart && <InsightChart chart={finding.chart} id={`snapshot-${snapshot.id}-${finding.id}`} />}
          <details className="mt-3 text-xs text-slate-400"><summary className="cursor-pointer font-medium text-slate-300">Evidence limits</summary><p className="mt-2 leading-5">{finding.limitation}</p><dl className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(finding.evidence).map(([key, value]) => <div key={key}><dt className="text-[10px] uppercase text-slate-500">{key.replaceAll("_", " ")}</dt><dd className="break-words text-slate-200">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl></details>
        </article>) : <p className="rounded-lg border border-slate-800 p-4 text-xs text-slate-400">No strong, well-supported pattern stood out in the saved result.</p>}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-white">Important metrics</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{analysis.important_metrics.map((metric) => <div key={metric.label} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><dt className="text-[11px] text-slate-500">{metric.label}</dt><dd className="mt-1 text-sm font-medium text-white">{metric.value}</dd><dd className="mt-1 text-[11px] leading-5 text-slate-400">{metric.detail}</dd></div>)}</dl>
      </section>

      <p className="text-[11px] leading-5 text-slate-500">Column sample values, uploaded preview rows, session IDs, session tokens, report HTML, and per-record model predictions were not included in this snapshot. Some category names and statistics remain because they are part of the findings.</p>
    </section>
  );
}
