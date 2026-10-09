"use client";
import React, { useEffect, useState } from "react";
import { SampleDatasetInfo, UploadResponse } from "@/lib/types";
import { errorMessage, fetchSamples, loadSampleDataset } from "@/lib/api";
import { useEngine } from "./EngineConnection";
import { Database, Loader2 } from "lucide-react";

export function SampleDatasets({
  onLoadSample,
}: {
  onLoadSample: (res: UploadResponse) => void;
}) {
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
      onLoadSample(await loadSampleDataset(id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingId(null);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-300">
        Explore with a synthetic sample dataset
      </p>
      <p className="text-xs text-slate-400">
        Generated examples for learning and testing; these are not real-world
        benchmark datasets.
      </p>
      {catalogLoading && (
        <p
          role="status"
          className="flex items-center gap-2 text-xs text-slate-400"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
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
            className="mt-2 px-3 py-2 rounded bg-slate-800 text-white"
            disabled={catalogLoading}
          >
            Retry sample catalog
          </button>
        </div>
      )}
      {!catalogLoading && !error && samples.length === 0 && (
        <p className="text-sm text-slate-400">
          No sample files are available. You can upload your own dataset.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {samples.map((s) => (
          <button
            key={s.id}
            onClick={() => select(s.id)}
            disabled={loadingId !== null}
            className="text-left rounded-xl bg-slate-900/60 border border-slate-800 p-4 hover:border-blue-500/50 disabled:opacity-60"
          >
            {loadingId === s.id ? (
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            ) : (
              <Database className="w-5 h-5 text-blue-400" />
            )}
            <h3 className="mt-3 text-sm font-semibold text-white">{s.name}</h3>
            <p className="mt-2 text-xs text-slate-400">{s.description}</p>
            <p className="mt-3 text-xs text-slate-400">
              {s.row_count.toLocaleString()} rows · {s.column_count} columns
            </p>
            <p className="mt-1 text-xs text-blue-300">
              Target: {s.recommended_target}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
