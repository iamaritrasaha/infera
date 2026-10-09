"use client";

import React, { useEffect, useState } from "react";
import { AnalysisResponse, SampleDatasetInfo, UploadResponse } from "@/lib/types";
import { errorMessage, fetchSamples, loadSampleDataset } from "@/lib/api";
import { VERIFIED_HOUSING_EXAMPLE } from "@/lib/verified-example";
import { useEngine } from "./EngineConnection";
import { ArrowRight, CheckCircle2, Database, Loader2, Sparkles } from "lucide-react";



interface SampleDatasetsProps {
  onLoadSample: (res: UploadResponse) => void;
  onLoadExample?: (example: AnalysisResponse) => void;
}

export function SampleDatasets({ onLoadSample, onLoadExample }: SampleDatasetsProps) {
  const { state } = useEngine();
  const [samples, setSamples] = useState<SampleDatasetInfo[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setCatalogLoading(true);
    setError(null);
    try {
      setSamples(await fetchSamples());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    if (state !== "CONNECTED") return;
    let active = true;
    fetchSamples()
      .then((s) => {
        if (active) setSamples(s);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [state]);

  const select = async (id: string) => {
    if (loadingId) return;
    setLoadingId(id);
    setError(null);
    try {
      const result = await loadSampleDataset(id);
      onLoadSample(result);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Verified Instant Example Banner */}
      {onLoadExample && (
        <div className="rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300">
                <CheckCircle2 size={12} /> Instant Preview
              </span>
              <span className="text-xs text-slate-400">Zero waiting · Verified calculations</span>
            </div>
            <h3 className="text-sm font-semibold text-white">
              Explore Verified Housing Price Analysis
            </h3>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Inspect verified calculations from the 250-row benchmark: median price 764,550, Spearman living area association r = 0.864, and Ridge model holdout R² = 0.983.
            </p>
          </div>
          <button
            onClick={() => onLoadExample(VERIFIED_HOUSING_EXAMPLE)}
            className="button-primary shrink-0 flex items-center gap-2 text-xs py-2 px-4 shadow-lg shadow-blue-950/50"
          >
            <Sparkles size={14} className="text-cyan-300" />
            <span>View Full Analysis</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-slate-300">
          Or profile a built-in sample dataset
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Standardized test benchmarks with verified properties for learning and validation.
        </p>
      </div>

      {catalogLoading && (
        <p
          role="status"
          className="flex items-center gap-2 text-xs text-slate-400"
        >
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          Loading the sample catalog when the engine connects.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/30 p-3 text-xs text-rose-300"
        >
          <p>{error}</p>
          <button
            onClick={reload}
            className="mt-2 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white shrink-0 text-xs transition-colors"
            disabled={catalogLoading}
          >
            Retry sample catalog
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {samples.map((s) => (
          <button
            key={s.id}
            onClick={() => select(s.id)}
            disabled={loadingId !== null}
            className="text-left rounded-xl bg-slate-900/60 border border-slate-800 p-4 hover:border-blue-500/50 hover:bg-slate-900/90 transition-all disabled:opacity-60 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              {loadingId === s.id ? (
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              ) : (
                <Database className="w-5 h-5 text-blue-400 group-hover:text-blue-300 transition-colors" />
              )}
              {loadingId === s.id && (
                <span className="text-[10px] text-blue-300 font-mono">Loading...</span>
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white group-hover:text-blue-200 transition-colors">
              {s.name}
            </h3>
            <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {s.description}
            </p>
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>{s.row_count.toLocaleString()} rows</span>
              <span className="text-cyan-300 font-mono truncate max-w-[120px]" title={s.recommended_target}>
                {s.recommended_target}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
