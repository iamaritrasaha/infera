/** Browser-to-FastAPI client. Anonymous ownership tokens never appear in URLs. */
import {
  AnalysisFocus,
  AnalysisResponse,
  ExploreRequest,
  ExplorationOptions,
  ExplorationResponse,
  SampleDatasetInfo,
  UploadResponse,
} from "./types";
import {
  analysisSchema,
  explorationOptionsSchema,
  explorationSchema,
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
    public readonly kind:
      | "transient"
      | "cold-start"
      | "configuration"
      | "incompatible"
      | "deployment"
      | "offline"
      | "http"
      | "network"
      | "timeout"
      | "aborted",
    public readonly status?: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const UNKNOWN_NETWORK_FAILURE =
  "The browser could not complete the request, and it did not expose the cause. This is an unknown browser/network failure, not proof that the backend is starting. Check your network or VPN, open the backend health link, then retry.";

export function connectionTimestamp(): number {
  return typeof performance !== "undefined"
    ? performance.timeOrigin + performance.now()
    : Date.now();
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The request could not be completed. Please try again.";
}

export function apiHealthUrl(): string | null {
  try {
    return `${apiBase()}/health`;
  } catch {
    return null;
  }
}

function endpointLabel(responseUrl: string): string {
  try {
    const pathname = new URL(responseUrl).pathname;
    if (pathname.startsWith("/api/results/")) return "/api/results";
    if (pathname.startsWith("/api/samples/")) return "/api/samples/:id/load";
    return pathname;
  } catch {
    return "API response";
  }
}

function announceApiSuccess(response: Response) {
  if (typeof window === "undefined" || !response.url) return;
  const requestStartedAt = (response as Response & { inferaRequestStartedAt?: number })
    .inferaRequestStartedAt;
  window.dispatchEvent(
    new CustomEvent("infera:api-success", {
      detail: {
        endpoint: endpointLabel(response.url),
        status: response.status,
        requestId: response.headers.get("x-request-id") ?? undefined,
        requestStartedAt: requestStartedAt ?? Date.now(),
      },
    }),
  );
}

async function request(
  path: string,
  init: RequestInit = {},
  owned = false,
  timeoutMs = 125000,
  signal?: AbortSignal,
): Promise<Response> {
  if (signal?.aborted) {
    throw new ApiError("The request was cancelled before it started.", "aborted");
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError(
      "Your browser appears to be offline. Check your network connection.",
      "offline",
    );
  }
  const base = apiBase();
  const headers = new Headers(init.headers);
  if (owned) headers.set("X-Infera-Session", sessionToken());
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abortFromCaller, { once: true });
  if (signal?.aborted) abortFromCaller();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const requestStartedAt = connectionTimestamp();
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
    });
    if (!response.ok) {
      let detail: unknown;
      let bodyText = "";
      try {
        bodyText = (await response.text()).slice(0, 1200);
        try {
          detail = JSON.parse(bodyText).detail;
        } catch {
          /* Non-JSON proxy errors are expected; keep them out of user copy. */
        }
      } catch {
        /* The status is still useful if a proxy body cannot be read. */
      }
      const requestId = response.headers.get("x-request-id") ?? undefined;
      const messages: Record<number, string> = {
        400: "The request could not be processed. Check the file format or selected target.",
        401: "Your analysis session is missing. Reload and try again.",
        403: "This request is not authorized for your session.",
        404: "This dataset or result is unavailable in your session or has expired. Please re-upload.",
        413: "The upload is too large. Use a file under 15 MB.",
        422: "The request contains invalid fields. Check the file and selected target.",
        429: "The engine is processing another analysis. Wait a few moments, then retry.",
      };
      if (response.status >= 500) {
        const retryable = [502, 503, 504].includes(response.status);
        const startupText = typeof detail === "string" ? detail : bodyText;
        const reportsColdStart =
          response.status === 503 &&
          ( /\b(?:service|instance|application|upstream)\b.{0,50}\b(?:starting|waking|spinning up)\b/i.test(
              startupText,
            ) ||
            /\b(?:starting|waking|spinning up)\b.{0,50}\b(?:service|instance|application|upstream)\b/i.test(
            startupText,
            ) );
        throw new ApiError(
          reportsColdStart
              ? `The backend explicitly reports that it is starting (HTTP ${response.status}). Infera will retry within its bounded connection window.`
              : retryable
                ? `The backend returned HTTP ${response.status}. Its response does not identify whether this is a cold start or another upstream problem.`
                : `The analysis service returned HTTP ${response.status}. Retry, and check backend logs if the error continues.`,
          reportsColdStart
              ? "cold-start"
              : retryable
                ? "transient"
                : "http",
          response.status,
          requestId,
        );
      }
      if (path === "/health" && response.status === 404)
        throw new ApiError(
          "The configured backend does not provide the expected /health endpoint. Check the Render service and health-check path.",
          "deployment",
          response.status,
          response.headers.get("x-request-id") ?? undefined,
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
        "http",
        response.status,
        response.headers.get("x-request-id") ?? undefined,
      );
    }
    // Keep the timeout active while reading slow or stalled response bodies.
    const body = await response.blob();
    const copiedResponse = new Response(body, {
      status: response.status,
      headers: response.headers,
    });
    Object.defineProperty(copiedResponse, "url", { value: response.url });
    Object.defineProperty(copiedResponse, "inferaRequestStartedAt", {
      value: requestStartedAt,
    });
    return copiedResponse;
  } catch (error) {
    if (signal?.aborted)
      throw new ApiError("The request was cancelled before it completed.", "aborted");
    if (timedOut)
      throw new ApiError(
        path === "/api/analyze"
          ? "Analysis took longer than expected. The server may still be computing. Retry to retrieve the cached result."
          : `The health/API request timed out after ${Math.ceil(timeoutMs / 1000)} seconds. The browser cannot tell whether the service is waking or the request path is blocked. Check your network and the backend health link, then retry.`,
        "timeout",
      );
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted)
      throw new ApiError("The request was aborted before a response arrived.", "aborted");
    throw new ApiError(UNKNOWN_NETWORK_FAILURE, "network");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

async function json<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      "The backend responded, but its health or analysis response does not match this frontend version (incompatible). Deploy compatible frontend and backend revisions.",
      "incompatible",
      response.status,
      response.headers.get("x-request-id") ?? undefined,
    );
  }

  let parsed: T;
  try {
    parsed = schema.parse(payload);
  } catch {
    throw new ApiError(
      "The backend responded, but its health or analysis response does not match this frontend version (incompatible). Deploy compatible frontend and backend revisions.",
      "incompatible",
      response.status,
      response.headers.get("x-request-id") ?? undefined,
    );
  }

  let pathname = "";
  try {
    pathname = new URL(response.url).pathname;
  } catch {
    /* Mock responses and opaque URLs do not identify an endpoint. */
  }
  if (pathname !== "/health") announceApiSuccess(response);
  return parsed;
}
export async function fetchHealth(signal?: AbortSignal, timeoutMs = 45000) {
  const response = await request("/health", {}, false, timeoutMs, signal);
  const health = await json(
    response,
    z.object({
      status: z.union([z.literal("ok"), z.literal("degraded")]),
      project: z.literal("Infera"),
      version: z.string(),
      engine_status: z.string().optional(),
      timestamp: z.number().optional(),
    }),
  );
  return {
    ...health,
    requestId: response.headers.get("x-request-id") ?? undefined,
  };
}

export async function fetchDiagnostics() {
  const response = await request("/api/diagnostic", {}, false, 15000);
  const diagnostics = await json(
    response,
    z.object({
      status: z.literal("ok"),
      project: z.literal("Infera"),
      version: z.string(),
      uptime_seconds: z.number(),
      memory_mb: z.number().nullable().optional(),
      python_version: z.string(),
      max_concurrent_analyses: z.number(),
      environment: z.string(),
    }),
  );
  return {
    ...diagnostics,
    requestId: response.headers.get("x-request-id") ?? undefined,
  };
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
  focus: AnalysisFocus = { question: "automatic" },
  goal?: string,
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
          metric_column: focus.metric_column || null,
          date_column: focus.date_column || null,
          group_column: focus.group_column || null,
          question: focus.question,
          goal: goal || null,
        }),
      },
      true,
      180000,
    ),
    analysisSchema,
  ) as Promise<AnalysisResponse>;
}

export async function getExplorationOptions(
  datasetId: string,
  column: string,
  signal?: AbortSignal,
): Promise<ExplorationOptions> {
  return json(
    await request(
      "/api/explore/options",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: datasetId, column }),
      },
      true,
      30000,
      signal,
    ),
    explorationOptionsSchema,
  );
}

export async function runExploration(
  payload: ExploreRequest,
  signal?: AbortSignal,
): Promise<ExplorationResponse> {
  return json(
    await request(
      "/api/explore",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      true,
      30000,
      signal,
    ),
    explorationSchema,
  );
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
  announceApiSuccess(response);
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
