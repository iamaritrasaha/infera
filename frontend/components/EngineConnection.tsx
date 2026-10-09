"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ApiError,
  apiBase,
  apiHealthUrl,
  connectionTimestamp,
  errorMessage,
  fetchDiagnostics,
  fetchHealth,
} from "@/lib/api";
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  Radio,
  RefreshCw,
  WifiOff,
} from "lucide-react";

export type EngineState =
  | "CHECKING"
  | "STARTING"
  | "RETRYING"
  | "CONNECTED"
  | "DEGRADED"
  | "TEMPORARILY_UNAVAILABLE"
  | "DEPLOYMENT_ERROR"
  | "INCOMPATIBLE"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "REQUEST_TIMEOUT"
  | "OFFLINE";

export interface DiagnosticData {
  status?: string;
  project?: string;
  version?: string;
  uptime_seconds?: number;
  memory_mb?: number | null;
  python_version?: string;
  max_concurrent_analyses?: number;
  environment?: string;
  latency_ms?: number;
  api_origin?: string | null;
  browser_online?: boolean | null;
  visibility_state?: DocumentVisibilityState | null;
  last_status?: number | null;
  last_endpoint?: string | null;
  last_request_id?: string | null;
  last_error_kind?: string | null;
}

type Connection = {
  state: EngineState;
  error: string | null;
  attempt: number;
  elapsedSeconds: number;
  diagnostics: DiagnosticData | null;
  healthUrl: string | null;
  retry: () => void;
};

const Context = createContext<Connection | null>(null);

// Four 25-second checks with bounded 1.5/4/8-second backoff cover the observed
// Render Free wake window without treating an opaque browser network error as startup.
const backoff = [1500, 4000, 8000] as const;
const healthTimeoutMs = 25000;
const maxAttempts = backoff.length + 1;
const maxStartupMs = 120000;

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function EngineProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EngineState>("CHECKING");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null);

  const stateRef = useRef<EngineState>("CHECKING");
  const running = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const latestCheckStartedAtRef = useRef(0);
  const mountedRef = useRef(false);
  const onlineRetryUsed = useRef(false);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimestampRef = useRef<number>(0);
  const healthUrl = apiHealthUrl();
  const apiOrigin = (() => {
    try {
      return apiBase();
    } catch {
      return null;
    }
  })();

  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const startTicker = useCallback((startedAt: number) => {
    stopTicker();
    startTimestampRef.current = startedAt;
    setElapsedSeconds(0);
    tickerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimestampRef.current) / 1000));
    }, 1000);
  }, [stopTicker]);

  const updateState = useCallback((next: EngineState, nextError: string | null) => {
    stateRef.current = next;
    setState(next);
    setError(nextError);
  }, []);

  const retry = useCallback(() => {
    running.current?.abort();
    running.current = null;
    const runId = ++runIdRef.current;
    const startedAt = connectionTimestamp();
    latestCheckStartedAtRef.current = startedAt;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      updateState("OFFLINE", "Your browser reports that it is offline. Reconnect, then retry.");
      stopTicker();
      return;
    }

    const controller = new AbortController();
    running.current = controller;
    const { signal } = controller;
    const deadline = startedAt + maxStartupMs;

    updateState("CHECKING", null);
    setAttempt(1);
    setDiagnostics((previous) => ({
      ...previous,
      api_origin: apiOrigin,
      browser_online: typeof navigator === "undefined" ? null : navigator.onLine,
      visibility_state: typeof document === "undefined" ? null : document.visibilityState,
      last_status: null,
      last_endpoint: "/health",
      last_request_id: null,
      last_error_kind: null,
    }));
    startTicker(startedAt);

    const isCurrentRun = () =>
      mountedRef.current && runIdRef.current === runId && !signal.aborted;
    const finish = () => {
      stopTicker();
      if (running.current === controller) running.current = null;
    };

    void (async () => {
      try {
        for (let att = 1; att <= maxAttempts; att++) {
          if (!isCurrentRun()) return;
          const remaining = deadline - Date.now();
          if (remaining <= 0) {
            updateState(
              "TEMPORARILY_UNAVAILABLE",
              "The bounded connection window ended without a successful health response. The cause is not known; retry or open the backend health link.",
            );
            setAttempt(att - 1);
            finish();
            return;
          }

          setAttempt(att);
          const reqStart = Date.now();
          try {
            const healthRes = await fetchHealth(signal, Math.min(healthTimeoutMs, remaining));
            if (!isCurrentRun()) return;
            const latency = Date.now() - reqStart;
            updateState(
              healthRes.status === "degraded" ? "DEGRADED" : "CONNECTED",
              healthRes.status === "degraded"
                ? "The health endpoint responded, but the backend reports degraded status."
                : null,
            );
            setDiagnostics((previous) => ({
              ...previous,
              api_origin: apiOrigin,
              latency_ms: latency,
              last_status: 200,
              last_endpoint: "/health",
              last_request_id: healthRes.requestId ?? null,
              last_error_kind: null,
              browser_online: typeof navigator === "undefined" ? null : navigator.onLine,
              visibility_state: typeof document === "undefined" ? null : document.visibilityState,
            }));
            finish();

            // Fetch background diagnostics without blocking connection state
            fetchDiagnostics()
              .then((d) => {
                if (!mountedRef.current || runIdRef.current !== runId) return;
                setDiagnostics((previous) => ({
                  ...previous,
                  ...d,
                  api_origin: apiOrigin,
                  latency_ms: latency,
                  last_status: 200,
                  last_endpoint: "/api/diagnostic",
                  last_request_id: d.requestId ?? healthRes.requestId ?? null,
                }));
              })
              .catch(() => {
                if (!mountedRef.current || runIdRef.current !== runId) return;
                setDiagnostics((previous) => ({
                  ...previous,
                  status: healthRes.status,
                  project: healthRes.project,
                  version: healthRes.version,
                  latency_ms: latency,
                  api_origin: apiOrigin,
                  last_status: 200,
                  last_endpoint: "/health",
                  last_request_id: healthRes.requestId ?? null,
                }));
              });
            return;
          } catch (err) {
            if (!isCurrentRun() || (err instanceof ApiError && err.kind === "aborted")) return;

            if (typeof navigator !== "undefined" && navigator.onLine === false) {
              updateState("OFFLINE", "Your browser reports that it is offline. Reconnect, then retry.");
              setDiagnostics((previous) => ({
                ...previous,
                browser_online: false,
                last_error_kind: "offline",
              }));
              finish();
              return;
            }

            const apiError = err instanceof ApiError
              ? err
              : new ApiError(
                  "The browser could not complete the request, and it did not expose the cause. This is an unknown browser/network failure, not proof that the backend is starting.",
                  "network",
                );
            const nextDiagnostics: DiagnosticData = {
              api_origin: apiOrigin,
              browser_online: typeof navigator === "undefined" ? null : navigator.onLine,
              visibility_state: typeof document === "undefined" ? null : document.visibilityState,
              last_endpoint: "/health",
              last_status: apiError.status ?? null,
              last_request_id: apiError.requestId ?? null,
              last_error_kind: apiError.kind,
            };
            setDiagnostics((previous) => ({ ...previous, ...nextDiagnostics }));

            if (apiError.kind === "offline") {
              updateState("OFFLINE", errorMessage(apiError));
              finish();
              return;
            }
            if (apiError.kind === "configuration" || apiError.kind === "deployment") {
              updateState("DEPLOYMENT_ERROR", errorMessage(apiError));
              finish();
              return;
            }
            if (apiError.kind === "incompatible") {
              updateState("INCOMPATIBLE", errorMessage(apiError));
              finish();
              return;
            }
            if (apiError.kind === "network") {
              updateState("NETWORK_ERROR", errorMessage(apiError));
              finish();
              return;
            }
            if (apiError.kind === "http") {
              updateState("HTTP_ERROR", errorMessage(apiError));
              finish();
              return;
            }

            if (
              att === maxAttempts ||
              Date.now() >= deadline ||
              !["cold-start", "transient", "timeout"].includes(apiError.kind)
            ) {
              const finalState = apiError.kind === "timeout"
                ? "REQUEST_TIMEOUT"
                : "TEMPORARILY_UNAVAILABLE";
              updateState(finalState, errorMessage(apiError));
              finish();
              return;
            }

            updateState(
              apiError.kind === "cold-start" ? "STARTING" : "RETRYING",
              apiError.kind === "timeout"
                ? `Health request ${att} timed out. The browser cannot tell whether the backend is waking or the request path is blocked; retrying within the bounded window.`
                : errorMessage(apiError),
            );

            const delayMs = Math.min(backoff[att - 1] ?? 0, Math.max(0, deadline - Date.now()));
            await pause(delayMs, signal);
          }
        }
      } finally {
        if (running.current === controller) running.current = null;
      }
    })().catch(() => {
      // Ignore cancellations from abort()
    });
  }, [apiOrigin, startTicker, stopTicker, updateState]);

  useEffect(() => {
    mountedRef.current = true;
    const initialCheck = setTimeout(() => {
      if (stateRef.current === "CHECKING") retry();
    }, 0);

    const handleOnline = () => {
      if (stateRef.current === "OFFLINE" && !onlineRetryUsed.current) {
        onlineRetryUsed.current = true;
        retry();
      }
    };

    const handleOffline = () => {
      runIdRef.current += 1;
      latestCheckStartedAtRef.current = connectionTimestamp();
      running.current?.abort();
      running.current = null;
      stopTicker();
      onlineRetryUsed.current = false;
      updateState("OFFLINE", "Your browser reports that it is offline. Reconnect, then retry.");
      setDiagnostics((previous) => ({
        ...previous,
        browser_online: false,
        last_error_kind: "offline",
      }));
    };

    const handleVisibility = () => {
      // Visibility is diagnostic only. Returning to a tab must not restart a
      // failed 2-minute sequence or create a new health request loop.
      setDiagnostics((previous) => ({
        ...previous,
        visibility_state: document.visibilityState,
      }));
    };

    const handleApiSuccess = (event: Event) => {
      const detail = (event as CustomEvent<{
        endpoint?: string;
        status?: number;
        requestId?: string;
        requestStartedAt?: number;
      }>).detail;
      if (!detail || typeof detail.status !== "number" || detail.status < 200 || detail.status >= 300) return;
      if (
        typeof detail.requestStartedAt === "number" &&
        detail.requestStartedAt < latestCheckStartedAtRef.current
      ) return;
      latestCheckStartedAtRef.current = Math.max(
        latestCheckStartedAtRef.current,
        detail.requestStartedAt ?? connectionTimestamp(),
      );
      if (running.current) {
        runIdRef.current += 1;
        running.current.abort();
        running.current = null;
      }
      stopTicker();
      updateState("CONNECTED", null);
      setDiagnostics((previous) => ({
        ...previous,
        api_origin: apiOrigin,
        browser_online: typeof navigator === "undefined" ? null : navigator.onLine,
        visibility_state: typeof document === "undefined" ? null : document.visibilityState,
        last_status: detail.status ?? null,
        last_endpoint: detail.endpoint ?? "API response",
        last_request_id: detail.requestId ?? null,
        last_error_kind: null,
      }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("infera:api-success", handleApiSuccess);

    return () => {
      clearTimeout(initialCheck);
      mountedRef.current = false;
      runIdRef.current += 1;
      stopTicker();
      running.current?.abort();
      running.current = null;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("infera:api-success", handleApiSuccess);
    };
  }, [apiOrigin, retry, stopTicker, updateState]);

  return (
    <Context.Provider
      value={{
        state,
        error,
        attempt,
        elapsedSeconds,
        diagnostics,
        healthUrl,
        retry,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useEngine() {
  const engine = useContext(Context);
  if (!engine) throw new Error("Engine connection provider is missing.");
  return engine;
}

export const engineStateLabels: Record<EngineState, string> = {
  CHECKING: "Checking engine",
  STARTING: "Backend reports that it is starting",
  RETRYING: "Retrying the engine connection",
  CONNECTED: "Engine connected",
  DEGRADED: "Analysis engine degraded",
  TEMPORARILY_UNAVAILABLE: "Engine temporarily unavailable",
  DEPLOYMENT_ERROR: "Backend deployment problem",
  INCOMPATIBLE: "Backend response incompatible",
  HTTP_ERROR: "Backend returned an HTTP error",
  NETWORK_ERROR: "Unknown network failure",
  REQUEST_TIMEOUT: "Health request timed out",
  OFFLINE: "Network offline",
};

export function EngineIndicator() {
  const { state, elapsedSeconds, retry } = useEngine();
  const waiting = ["CHECKING", "STARTING", "RETRYING"].includes(state);

  let statusClass = "unavailable";
  if (state === "CONNECTED") statusClass = "connected";
  else if (waiting) statusClass = "checking";

  let labelText = engineStateLabels[state];
  if (waiting) {
    labelText = `${engineStateLabels[state]} (${elapsedSeconds}s)`;
  }

  return (
    <button
      onClick={retry}
      disabled={waiting}
      aria-label="Retry analysis engine connection"
      title={`${engineStateLabels[state]}${waiting ? "" : " · Click to recheck"}`}
      className={`engine-indicator ${statusClass}`}
    >
      {waiting ? (
        <Loader2 size={13} className="animate-spin text-blue-400" />
      ) : state === "CONNECTED" ? (
        <span className="status-dot bg-emerald-400" />
      ) : state === "OFFLINE" ? (
        <WifiOff size={13} className="text-slate-400" />
      ) : (
        <span className="status-dot bg-rose-400" />
      )}
      <span>{labelText}</span>
    </button>
  );
}

export function EngineBanner() {
  const { state, error, attempt, elapsedSeconds, diagnostics, healthUrl, retry } = useEngine();
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const isWaiting = ["CHECKING", "STARTING", "RETRYING"].includes(state);
  const isOffline = state === "OFFLINE";
  if (state === "CONNECTED" || (state === "CHECKING" && elapsedSeconds < 5)) return null;

  const message = state === "CHECKING"
    ? "Checking the backend health endpoint. This request has a 25-second timeout; automatic checks stop within two minutes."
    : isWaiting
      ? error ?? "Checking the backend connection. This sequence has a two-minute limit."
      : `${error ?? "The analysis engine could not be reached."} Automatic checks have stopped; retry when you are ready.`;

  return (
    <div
      className={`engine-banner ${isWaiting ? "" : "engine-error"}`}
      role={isWaiting ? "status" : "alert"}
    >
      {isWaiting ? (
        <Loader2 size={20} className="animate-spin text-blue-400 shrink-0" />
      ) : isOffline ? (
        <WifiOff size={20} className="text-slate-400 shrink-0" />
      ) : (
        <AlertTriangle size={20} className="text-rose-400 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-sm">{engineStateLabels[state]}</p>
          {isWaiting && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-950/80 border border-blue-800 text-blue-300 font-mono">
              {elapsedSeconds}s elapsed · attempt {attempt} of {maxAttempts}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{message}</p>

        {state === "NETWORK_ERROR" && (
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            If the backend link opens but this dashboard still cannot connect, check the browser console and the failed health request. The browser may not reveal whether the cause is CORS or another network policy; do not share session tokens.
          </p>
        )}

        {healthUrl && (
          <a
            href={healthUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 text-xs text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
          >
            Open backend health check
          </a>
        )}

        {/* Expandable Diagnostic Drawer */}
        <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowDiagnostics((prev) => !prev)}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span>{showDiagnostics ? "Hide diagnostics" : "View connection diagnostics"}</span>
              <ChevronDown
                size={12}
                className={`transition-transform ${showDiagnostics ? "rotate-180" : ""}`}
              />
            </button>

            {showDiagnostics && (
              <div className="mt-2 p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Connection State:</span>
                  <span className="text-slate-200 font-semibold">{state}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Attempts Made:</span>
                  <span>{attempt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Time Elapsed:</span>
                  <span>{elapsedSeconds}s</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">API origin:</span>
                  <span className="text-right break-all">{diagnostics?.api_origin ?? "not configured"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Browser online:</span>
                  <span>{diagnostics?.browser_online == null ? "unknown" : diagnostics.browser_online ? "yes" : "no"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tab visibility:</span>
                  <span>{diagnostics?.visibility_state ?? "unknown"}</span>
                </div>
                {diagnostics?.last_status != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Last HTTP status:</span>
                    <span>{diagnostics.last_status}</span>
                  </div>
                )}
                {diagnostics?.last_endpoint && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Last endpoint:</span>
                    <span className="text-right">{diagnostics.last_endpoint}</span>
                  </div>
                )}
                {diagnostics?.last_error_kind && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Failure type:</span>
                    <span className="text-right">{diagnostics.last_error_kind}</span>
                  </div>
                )}
                {diagnostics?.last_request_id && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Request ID:</span>
                    <span className="text-right break-all">{diagnostics.last_request_id}</span>
                  </div>
                )}
                {diagnostics?.latency_ms && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Last Latency:</span>
                    <span>{diagnostics.latency_ms}ms</span>
                  </div>
                )}
                {diagnostics?.version && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Engine Version:</span>
                    <span>v{diagnostics.version}</span>
                  </div>
                )}
                {diagnostics?.uptime_seconds && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Server Uptime:</span>
                    <span>{diagnostics.uptime_seconds}s</span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 font-sans">
                  Tip: A stale health state will not block you from analyzing loaded datasets.
                </div>
              </div>
            )}
        </div>
      </div>

      {!isWaiting && (
        <button
          className="button-secondary shrink-0 flex items-center gap-1.5 text-xs"
          onClick={retry}
        >
          <RefreshCw size={14} />
          Retry connection
        </button>
      )}
    </div>
  );
}

export function EngineDetail() {
  const { state } = useEngine();
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-400">
      <Radio size={13} className={state === "CONNECTED" ? "text-emerald-400" : "text-slate-500"} />
      {engineStateLabels[state]}
    </span>
  );
}
