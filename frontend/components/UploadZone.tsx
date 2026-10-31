"use client";

import React, { useRef, useState } from "react";
import { UploadResponse } from "@/lib/types";
import { uploadDatasetFile, errorMessage } from "@/lib/api";
import { AlertCircle, Loader2, UploadCloud } from "lucide-react";

export interface LocalFilePreview {
  file: File;
  name: string;
  sizeFormatted: string;
  rowCountEstimate: number;
  columns: string[];
  sampleRows: Record<string, string>[];
}

export function parseLocalPreview(file: File): Promise<LocalFilePreview> {
  return new Promise((resolve, reject) => {
    const slice = file.slice(0, 65536); // Read first 64KB for safe client-side inspection
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error("File slice is empty");

        let columns: string[] = [];
        let sampleRows: Record<string, string>[] = [];
        let estimatedRows = 0;

        if (file.name.toLowerCase().endsWith(".json")) {
          try {
            const parsed = JSON.parse(text);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            if (arr.length > 0 && typeof arr[0] === "object") {
              columns = Object.keys(arr[0]).slice(0, 50);
              sampleRows = arr.slice(0, 5).map((row) => {
                const r: Record<string, string> = {};
                for (const col of columns) r[col] = String(row[col] ?? "");
                return r;
              });
              estimatedRows = arr.length;
            }
          } catch {
            const lines = text.split("\n").filter((l) => l.trim().startsWith("{"));
            if (lines.length > 0) {
              const first = JSON.parse(lines[0]);
              columns = Object.keys(first).slice(0, 50);
              sampleRows = lines.slice(0, 5).map((line) => {
                const obj = JSON.parse(line);
                const r: Record<string, string> = {};
                for (const col of columns) r[col] = String(obj[col] ?? "");
                return r;
              });
              const avgLineBytes = text.length / lines.length;
              estimatedRows = Math.round(file.size / avgLineBytes);
            }
          }
        } else {
          // CSV / TSV
          const isTsv = file.name.toLowerCase().endsWith(".tsv");
          const delimiter = isTsv ? "\t" : ",";
          const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
          if (lines.length > 0) {
            columns = lines[0]
              .split(delimiter)
              .map((c) => c.replace(/^["']|["']$/g, "").trim());
            const dataLines = lines.slice(1, 6);
            sampleRows = dataLines.map((line) => {
              const vals = line
                .split(delimiter)
                .map((v) => v.replace(/^["']|["']$/g, "").trim());
              const row: Record<string, string> = {};
              columns.forEach((col, idx) => {
                row[col] = vals[idx] ?? "";
              });
              return row;
            });
            const avgLineBytes = text.length / lines.length;
            estimatedRows = Math.max(
              lines.length - 1,
              Math.round(file.size / avgLineBytes) - 1,
            );
          }
        }

        const sizeKb = Math.round(file.size / 1024);
        const sizeFormatted =
          sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

        resolve({
          file,
          name: file.name,
          sizeFormatted,
          rowCountEstimate: Math.max(sampleRows.length, estimatedRows),
          columns,
          sampleRows,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Unable to read local file"));
    reader.readAsText(slice);
  });
}

interface UploadZoneProps {
  onUploadSuccess: (res: UploadResponse) => void;
  onLocalPreview?: (preview: LocalFilePreview) => void;
}

export function UploadZone({ onUploadSuccess, onLocalPreview }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (isUploading) return;
    setErrorMsg(null);

    // Provide safe client-side preview immediately if supported
    if (
      onLocalPreview &&
      (file.name.toLowerCase().endsWith(".csv") ||
        file.name.toLowerCase().endsWith(".json") ||
        file.name.toLowerCase().endsWith(".tsv"))
    ) {
      try {
        const preview = await parseLocalPreview(file);
        onLocalPreview(preview);
      } catch {
        // Fallback directly to backend upload
      }
    }

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

          <div className="space-y-1 text-center">
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
              "The Python engine is validating columns and calculating data health."
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
          className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-2 text-xs text-rose-300"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold">Upload failed</p>
            <p className="mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}
