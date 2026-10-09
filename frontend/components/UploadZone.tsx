"use client";

import React, { useRef, useState } from "react";
import { UploadResponse } from "@/lib/types";
import { uploadDatasetFile, errorMessage } from "@/lib/api";
import { AlertCircle, Loader2, UploadCloud } from "lucide-react";

interface UploadZoneProps {
  onUploadSuccess: (res: UploadResponse) => void;
}

export function UploadZone({ onUploadSuccess }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (isUploading) return;
    setErrorMsg(null);
    setIsUploading(true);
    try {
      const result = await uploadDatasetFile(file);
      onUploadSuccess(result);
    } catch (err) {
      setErrorMsg(errorMessage(err));
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
    <div className="upload-zone">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload dataset"
        aria-disabled={isUploading}
        onKeyDown={(e) => {
          if (!isUploading && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onClick={() => {
          if (!isUploading) fileInputRef.current?.click();
        }}
        className={`drop-area ${isDragging ? "dragging" : ""} ${isUploading ? "uploading" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          aria-label="Dataset file"
          disabled={isUploading}
          accept=".csv,.xlsx,.json,.parquet"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFile(e.target.files[0]);
              e.target.value = "";
            }
          }}
        />

        {isUploading && (
          <div
            className="upload-progress"
            role="status"
            aria-label="Uploading and profiling"
          >
            <div className="indeterminate-progress" />
          </div>
        )}
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
              {isUploading
                ? "Uploading and profiling your dataset"
                : "Drop your dataset here"}
            </h4>
            <p className="text-xs text-slate-400">
              Supports{" "}
              <span className="text-slate-300 font-medium">
                CSV, XLSX, JSON, Parquet
              </span>{" "}
              &bull; Up to 15 MB
            </p>
          </div>

          <div className="text-xs text-slate-400 pt-2">
            {isUploading ? (
              "Progress is indeterminate while the engine validates the file."
            ) : (
              <span className="browse-label">
                Browse files <span aria-hidden="true">↗</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-xs text-rose-300"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
