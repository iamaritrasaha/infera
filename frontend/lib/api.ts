/**
 * Infera Backend API Client
 */

import { AnalysisResponse, SampleDatasetInfo, UploadResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchHealth(): Promise<{ status: string; project: string; version: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Backend health probe failed");
  return res.json();
}

export async function fetchSamples(): Promise<SampleDatasetInfo[]> {
  const res = await fetch(`${API_BASE}/api/samples`);
  if (!res.ok) throw new Error("Failed to load sample catalog");
  return res.json();
}

export async function loadSampleDataset(sampleId: string): Promise<UploadResponse> {
  const res = await fetch(`${API_BASE}/api/samples/${sampleId}/load`, {
    method: "POST",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to load sample '${sampleId}'`);
  }
  return res.json();
}

export async function uploadDatasetFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to process uploaded file");
  }

  return res.json();
}

export async function executeFullAnalysis(
  datasetId: string,
  targetColumn?: string
): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataset_id: datasetId,
      target_column: targetColumn || null,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Analysis computation failed");
  }

  return res.json();
}

export async function fetchAnalysisResults(datasetId: string): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE}/api/results/${datasetId}`);
  if (!res.ok) throw new Error("Results not found or expired");
  return res.json();
}

export function getReportDownloadUrl(datasetId: string, format: "markdown" | "html"): string {
  return `${API_BASE}/api/results/${datasetId}/report?format=${format}`;
}
