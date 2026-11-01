"use client";

import { useState, useRef } from "react";
import { UploadCloud, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { uploadCSV, loadSampleDataset, DatasetResponse } from "@/lib/api";

interface UploadProps {
  onDatasetLoaded: (data: DatasetResponse) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function Upload({ onDatasetLoaded, isLoading, setIsLoading }: UploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a valid CSV file (.csv).");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("File exceeds maximum allowed size of 20 MB.");
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const data = await uploadCSV(file);
      onDatasetLoaded(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload dataset.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (isLoading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSample = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await loadSampleDataset();
      onDatasetLoaded(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load sample dataset.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-sm"
        >
          <AlertCircle size={18} className="shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
          dragOver
            ? "border-blue-500 bg-blue-950/30 scale-[1.01]"
            : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
        } ${isLoading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400">
            {isLoading ? <Loader2 className="animate-spin" size={26} /> : <UploadCloud size={26} />}
          </div>

          <div className="space-y-1">
            <p className="text-base font-medium text-slate-200">
              {isLoading ? "Reading and profiling dataset with pandas..." : "Click or drag a CSV file here"}
            </p>
            <p className="text-xs text-slate-400">Maximum file size 20 MB · Standard CSV format</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="h-px bg-slate-800 flex-1" />
        <span className="px-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">Or</span>
        <div className="h-px bg-slate-800 flex-1" />
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleSample}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <Sparkles size={16} className="text-blue-400" />
          <span>Load Sample Housing Dataset (120 rows)</span>
        </button>
      </div>
    </div>
  );
}
