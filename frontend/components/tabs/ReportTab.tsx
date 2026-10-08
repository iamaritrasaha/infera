"use client";
import { useState } from "react";
import { AnalysisResponse } from "@/lib/types";
import { downloadReport, errorMessage } from "@/lib/api";
import { Check, Copy, Download, Globe, Printer } from "lucide-react";

export function ReportTab({ data }: { data: AnalysisResponse }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(data.reports.markdown); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setError("Clipboard access is unavailable. Download the Markdown report instead."); }
  };
  const download = async (format: "markdown" | "html") => {
    setBusy(true); setError(null);
    try { await downloadReport(data.dataset_id, format); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };
  const buttonClass = "flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50";
  return <div className="space-y-6">
    <div className="report-toolbar bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
      <div><h3 className="text-base font-semibold text-white">Exportable Evidence Report</h3><p className="text-xs text-slate-400">Methodology, computed findings, model comparisons, and limitations</p></div>
      <div className="flex flex-wrap gap-2">
        <button onClick={copy} className={buttonClass}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? "Copied" : "Copy Markdown"}</button>
        <button onClick={() => download("markdown")} disabled={busy} className={buttonClass}><Download className="w-4 h-4" />Download .MD</button>
        <button onClick={() => download("html")} disabled={busy} className={buttonClass}><Globe className="w-4 h-4" />Download .HTML</button>
        <button onClick={() => window.print()} className={buttonClass}><Printer className="w-4 h-4" />Print / PDF</button>
      </div>
      {busy && <p role="status" className="text-xs text-slate-400">Downloading report…</p>}
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    </div>
    <article className="evidence-report bg-slate-900/40 border border-slate-800 rounded-xl p-5 sm:p-10">
      <pre className="whitespace-pre-wrap break-words text-xs leading-7 font-sans text-slate-300">{data.reports.markdown}</pre>
    </article>
  </div>;
}
