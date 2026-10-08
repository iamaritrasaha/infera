"use client";

import React, { useState } from "react";
import { AnalysisResponse } from "@/lib/types";
import { getReportDownloadUrl } from "@/lib/api";
import { Check, Copy, Download, FileText, Globe, Printer } from "lucide-react";

interface ReportTabProps {
  data: AnalysisResponse;
}

export function ReportTab({ data }: ReportTabProps) {
  const { dataset_id, dataset_name, reports } = data;
  const [copied, setCopied] = useState(false);

  const handleCopyMarkdown = () => {
    if (reports?.markdown) {
      navigator.clipboard.writeText(reports.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Export Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">Exportable Evidence Report</h3>
          <p className="text-xs text-slate-400">
            Professional audit report complete with methodology, formulas, and model comparisons
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy Markdown"}</span>
          </button>

          <a
            href={getReportDownloadUrl(dataset_id, "markdown")}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .MD</span>
          </a>

          <a
            href={getReportDownloadUrl(dataset_id, "html")}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Download .HTML</span>
          </a>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Report Markdown Document Preview */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 sm:p-10 font-sans text-slate-200 space-y-6">
        <div className="prose prose-invert max-w-none prose-headings:text-slate-100 prose-a:text-blue-400 prose-code:text-blue-300 prose-pre:bg-slate-950/80">
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed bg-transparent border-0 p-0 text-slate-300">
            {reports?.markdown || "Report generation in progress..."}
          </pre>
        </div>
      </div>
    </div>
  );
}
