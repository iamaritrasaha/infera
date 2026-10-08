"use client";

import React, { useRef, useState } from "react";
import { UploadResponse } from "@/lib/types";
import { uploadDatasetFile } from "@/lib/api";
import { AlertCircle, FileUp, Loader2, UploadCloud } from "lucide-react";

interface UploadZoneProps {
  onUploadSuccess: (res: UploadResponse) => void;
}

export function UploadZone({ onUploadSuccess }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setIsUploading(true);
    try {
      const result = await uploadDatasetFile(file);
      onUploadSuccess(result);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload and parse dataset");
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
            : "border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-700"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.json,.parquet"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-blue-600/10 text-blue-400 rounded-full border border-blue-500/20">
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            ) : (
              <UploadCloud className="w-6 h-6" />
            )}
          </div>

          <div className="space-y-1">
            <h4 className="text-base font-semibold text-white">
              {isUploading ? "Profiling & Validating Dataset..." : "Drop your dataset here, or browse"}
            </h4>
            <p className="text-xs text-slate-400">
              Supports <span className="text-slate-300 font-medium">CSV, XLSX, JSON, Parquet</span> &bull; Up to 15 MB
            </p>
          </div>

          <div className="text-[11px] text-slate-500 pt-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
            Data is parsed temporarily in-memory and discarded upon analysis completion.
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
