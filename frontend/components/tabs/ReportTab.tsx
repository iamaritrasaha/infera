"use client";
import { useState } from "react";
import Image from "next/image";
import { AnalysisResponse, ExplorationResponse } from "@/lib/types";
import { downloadReport, errorMessage } from "@/lib/api";
import { appendExplorationReport, downloadReportText } from "@/lib/exploration-report";
import {
  Check,
  Copy,
  Download,
  FileText,
  Globe,
  Loader2,
  Printer,
} from "lucide-react";

export function ReportTab({ data, exploration = null }: { data: AnalysisResponse; exploration?: ExplorationResponse | null }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const markdown = appendExplorationReport(data, exploration);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(
        "Clipboard access is unavailable. Download the Markdown report instead.",
      );
    }
  };
  const download = async (format: "markdown" | "html") => {
    setBusy(true);
    setError(null);
    try {
      if (exploration) downloadReportText(data.dataset_name, format, markdown);
      else await downloadReport(data.dataset_id, format);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="report-toolbar report-export">
        <div className="report-title">
          <Image src="/infera-icon.svg" width={34} height={34} alt="" />
          <div>
            <p className="eyebrow">FROM ANALYSIS TO ARTIFACT</p>
            <h3>Exportable Evidence Report</h3>
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-7">
          {exploration
            ? "The full-dataset report is followed by the selected filtered exploration, including its active filters and sample sizes."
            : "Your dataset’s findings, methods, model comparisons, and limitations. Every numerical result comes from this analysis."}
        </p>
        <div className="report-formats">
          <button
            onClick={() => download("markdown")}
            disabled={busy}
            aria-label="Download .MD"
          >
            <FileText size={23} />
            <span>
              <strong>Markdown</strong>
              <small>
                Portable text for notes, version control, and research.
              </small>
            </span>
            <Download size={17} />
          </button>
          <button
            onClick={() => download("html")}
            disabled={busy}
            aria-label="Download .HTML"
          >
            <Globe size={23} />
            <span>
              <strong>HTML document</strong>
              <small>
                A formatted, self-contained report to open or share.
              </small>
            </span>
            <Download size={17} />
          </button>
        </div>
        <div className="report-utilities">
          <button onClick={copy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy Markdown"}
          </button>
          <button onClick={() => window.print()}>
            <Printer size={14} />
            Print / PDF
          </button>
          <span>
            {data.schema.row_count.toLocaleString()} observations · Created by
            Aritra Saha
          </span>
        </div>
        {busy && (
          <p
            role="status"
            className="inline-flex items-center gap-2 text-xs text-blue-300"
          >
            <Loader2 size={14} className="animate-spin" />
            Downloading report…
          </p>
        )}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
      </div>
      <article className="evidence-report bg-slate-900/40 border border-slate-800 rounded-xl p-5 sm:p-10">
        <h3 className="text-sm font-medium mb-5 text-slate-200 report-preview-label">
          Markdown preview
        </h3>
        <pre className="whitespace-pre-wrap break-words text-xs leading-7 font-mono text-slate-300">
          {markdown}
        </pre>
      </article>
    </div>
  );
}
