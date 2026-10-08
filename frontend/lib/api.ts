/**
 * Infera Backend API Client
 *
 * Supports Vercel Services bindings (BACKEND_URL in runtime functions/SSR),
 * same-origin relative routing (/api/(.*) rewrites in browser),
 * and local development fallback (NEXT_PUBLIC_API_URL / localhost:8000).
 */

import { AnalysisResponse, SampleDatasetInfo, UploadResponse } from "./types";

export function getBackendUrl(endpoint: string): string {
  const cleanPath = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;

  // 1. Runtime functions / SSR with Vercel service binding
  if (typeof window === "undefined" && process.env.BACKEND_URL) {
    const base = process.env.BACKEND_URL.endsWith("/")
      ? process.env.BACKEND_URL
      : `${process.env.BACKEND_URL}/`;
    return new URL(cleanPath, base).toString();
  }

  // 2. Custom public URL configured via environment variable
  if (process.env.NEXT_PUBLIC_API_URL) {
    const base = process.env.NEXT_PUBLIC_API_URL.endsWith("/")
      ? process.env.NEXT_PUBLIC_API_URL
      : `${process.env.NEXT_PUBLIC_API_URL}/`;
    return new URL(cleanPath, base).toString();
  }

  // 3. Browser environment on Vercel: use relative path for same-domain rewrite
  if (typeof window !== "undefined") {
    return `/${cleanPath}`;
  }

  // 4. Default fallback for local testing without env vars
  return new URL(cleanPath, "http://localhost:8000/").toString();
}

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err: any) {
    if (err.name === "TypeError" || String(err.message).toLowerCase().includes("fetch")) {
      throw new Error(
        "Unable to reach the backend engine. Please verify the service is running and retry in a moment."
      );
    }
    throw err;
  }
}

export async function fetchHealth(): Promise<{ status: string; project: string; version: string }> {
  const res = await safeFetch(getBackendUrl("api/health"));
  if (!res.ok) throw new Error("Backend health probe failed");
  return res.json();
}

export async function fetchSamples(): Promise<SampleDatasetInfo[]> {
  const res = await safeFetch(getBackendUrl("api/samples"));
  if (!res.ok) throw new Error("Failed to load sample catalog");
  return res.json();
}

export async function loadSampleDataset(sampleId: string): Promise<UploadResponse> {
  const res = await safeFetch(getBackendUrl(`api/samples/${sampleId}/load`), {
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

  const res = await safeFetch(getBackendUrl("api/upload"), {
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
  const res = await safeFetch(getBackendUrl("api/analyze"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataset_id: datasetId,
      target_column: targetColumn || null,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    if (res.status === 429) {
      throw new Error(
        errorData.detail ||
          "The engine is currently executing another heavy analysis. Please wait a few moments and try again."
      );
    }
    throw new Error(errorData.detail || "Analysis computation failed");
  }

  return res.json();
}

export async function fetchAnalysisResults(datasetId: string): Promise<AnalysisResponse> {
  const res = await safeFetch(getBackendUrl(`api/results/${datasetId}`));
  if (!res.ok) throw new Error("Results not found or expired");
  return res.json();
}

export function getReportDownloadUrl(datasetId: string, format: "markdown" | "html"): string {
  return getBackendUrl(`api/results/${datasetId}/report?format=${format}`);
}
