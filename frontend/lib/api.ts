/** Browser-to-FastAPI client. Anonymous ownership tokens never appear in URLs. */
import { AnalysisResponse, SampleDatasetInfo, UploadResponse } from "./types";
import {
  analysisSchema,
  samplesSchema,
  uploadSchema,
} from "./response-schemas";
import { z } from "zod";

export function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const localBrowser =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  const raw =
    configured ||
    (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");
  if (!raw)
    throw new ApiError(
      "The analysis engine URL is not configured. Set NEXT_PUBLIC_API_URL to the deployed FastAPI service and rebuild the frontend.",
      "configuration",
    );
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ApiError(
      "The analysis engine URL is invalid. Check NEXT_PUBLIC_API_URL.",
      "configuration",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new ApiError(
      "The analysis engine URL must be an HTTP(S) origin without credentials, query parameters, or a path.",
      "configuration",
    );
  }
  if (
    typeof window !== "undefined" &&
    !localBrowser &&
    (url.protocol !== "https:" ||
      ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(url.hostname))
  ) {
    throw new ApiError(
      "The deployed frontend requires a public HTTPS analysis engine URL.",
      "configuration",
    );
  }
  return url.origin;
}

function sessionToken(): string {
  try {
    let token = sessionStorage.getItem("infera-session");
    if (!token) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      sessionStorage.setItem("infera-session", token);
    }
    return token;
  } catch {
    throw new Error(
      "Browser session storage is unavailable. Enable it to upload and access your datasets privately.",
    );
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: "transient" | "configuration" | "schema" | "http",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const STARTING =
  "The analysis engine may be starting or unavailable. Please try again shortly. If this persists, check the API URL and backend CORS settings.";
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The request could not be completed. Please try again.";
}

async function request(
  path: string,
  init: RequestInit = {},
  owned = false,
  timeoutMs = 65000,
  signal?: AbortSignal,
): Promise<Response> {
  const base = apiBase();
  const headers = new Headers(init.headers);
  if (owned) headers.set("X-Infera-Session", sessionToken());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers,
      signal: signal
        ? AbortSignal.any([controller.signal, signal])
        : controller.signal,
      cache: "no-store",
      credentials: "omit",
    });
    if (!response.ok) {
      let detail: unknown;
      try {
        detail = (await response.json()).detail;
      } catch {
        /* Non-JSON proxy errors are expected during cold starts. */
      }
      const messages: Record<number, string> = {
        400: "The request could not be processed. Check the file format or selected target.",
        401: "Your analysis session is missing. Reload and try again.",
        403: "This request is not authorized for your session.",
        404: "This dataset or result is unavailable in your session or has expired. Please re-upload.",
        413: "The upload is too large. Use a file under 15 MB.",
        422: "The request contains invalid fields. Check the file and selected target.",
        429: "The engine is processing another analysis. Wait a few moments, then retry.",
      };
      if (response.status >= 500)
        throw new ApiError(
          `${STARTING} (HTTP ${response.status})`,
          "transient",
          response.status,
        );
      const safeDetail =
        typeof detail === "string" &&
        detail.length <= 400 &&
        !/traceback|stack trace|File \"|Error:/i.test(detail)
          ? detail
          : null;
      throw new ApiError(
        safeDetail ||
          messages[response.status] ||
          `The request failed (HTTP ${response.status}). Please retry.`,
        response.status === 429 ? "transient" : "http",
        response.status,
      );
    }
    // Keep the timeout active while reading slow or stalled response bodies.
    const body = await response.blob();
    return new Response(body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    if (controller.signal.aborted)
      throw new ApiError(
        timeoutMs > 65000
          ? "Analysis took longer than expected. The server may still be computing. Retry to retrieve the cached result."
          : STARTING,
        "transient",
      );
    if (error instanceof TypeError) throw new ApiError(STARTING, "transient");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function json<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  try {
    return schema.parse(await response.json());
  } catch {
    throw new ApiError(
      "The analysis engine returned an invalid response. Please retry; if this persists, check that frontend and backend versions match.",
      "schema",
    );
  }
}
export async function fetchHealth(signal?: AbortSignal) {
  return json(
    await request("/health", {}, false, 25000, signal),
    z.object({
      status: z.literal("ok"),
      project: z.literal("Infera"),
      version: z.string(),
    }),
  );
}
export async function fetchSamples(): Promise<SampleDatasetInfo[]> {
  return json(await request("/api/samples"), samplesSchema);
}
export async function loadSampleDataset(
  sampleId: string,
): Promise<UploadResponse> {
  return json(
    await request(
      `/api/samples/${encodeURIComponent(sampleId)}/load`,
      { method: "POST" },
      true,
    ),
    uploadSchema,
  );
}
export async function uploadDatasetFile(file: File): Promise<UploadResponse> {
  if (!/\.(csv|xlsx|json|parquet)$/i.test(file.name))
    throw new Error(
      "Unsupported file format. Use CSV, XLSX, JSON, or Parquet.",
    );
  if (!file.size) throw new Error("The selected file is empty.");
  if (file.size > 15 * 1024 * 1024)
    throw new Error("The upload is too large. Use a file under 15 MB.");
  const formData = new FormData();
  formData.append("file", file);
  return json(
    await request("/api/upload", { method: "POST", body: formData }, true),
    uploadSchema,
  );
}
export async function executeFullAnalysis(
  datasetId: string,
  targetColumn?: string,
): Promise<AnalysisResponse> {
  return json(
    await request(
      "/api/analyze",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: datasetId,
          target_column: targetColumn || null,
        }),
      },
      true,
      180000,
    ),
    analysisSchema,
  ) as Promise<AnalysisResponse>;
}
export async function fetchAnalysisResults(
  datasetId: string,
): Promise<AnalysisResponse> {
  return json(
    await request(`/api/results/${encodeURIComponent(datasetId)}`, {}, true),
    analysisSchema,
  ) as Promise<AnalysisResponse>;
}
export async function downloadReport(
  datasetId: string,
  format: "markdown" | "html",
): Promise<void> {
  const response = await request(
    `/api/results/${encodeURIComponent(datasetId)}/report?format=${format}`,
    {},
    true,
  );
  const expected = format === "html" ? "text/html" : "text/markdown";
  if (!response.headers.get("content-type")?.includes(expected))
    throw new Error("The engine returned an invalid report. Please retry.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    response.headers
      .get("content-disposition")
      ?.match(/filename="([^"]+)"/)?.[1] ||
    `infera-report.${format === "html" ? "html" : "md"}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
