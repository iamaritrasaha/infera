"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiError, errorMessage, fetchDiagnostics, fetchHealth } from "@/lib/api";
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
  | "CONNECTED"
  | "DEGRADED"
  | "TEMPORARILY_UNAVAILABLE"
  | "DEPLOYMENT_ERROR"
  | "OFFLINE";

export interface DiagnosticData {
  status: string;
  project: string;
  version: string;
  uptime_seconds?: number;
  memory_mb?: number | null;
  python_version?: string;
  max_concurrent_analyses?: number;
  environment?: string;
  latency_ms?: number;
}

type Connection = {
  state: EngineState;
  error: string | null;
  attempt: number;
  elapsedSeconds: number;
  diagnostics: DiagnosticData | null;
  retry: () => void;
  checkDirectly: () => Promise<boolean>;
};

const Context = createContext<Connection | null>(null);

// Exponential and bounded backoff sequence designed for Render Free cold starts (typically 50-90s)
const backoff = [2000, 4000, 8000, 12000, 16000, 20000, 20000, 20000];
const maxStartupMs = 150000; // 2.5 minutes maximum bounded duration

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
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

  const stateRef = useRef<EngineState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const running = useRef<AbortController | null>(null);
  const lastSuccess = useRef(0);
  const tickerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimestampRef = useRef<number>(0);

  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const startTicker = useCallback(() => {
    stopTicker();
    startTimestampRef.current = Date.now();
    setElapsedSeconds(0);
    tickerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimestampRef.current) / 1000));
    }, 1000);
  }, [stopTicker]);

  const checkDirectly = useCallback(async (): Promise<boolean> => {
    if (stateRef.current === "CONNECTED" && Date.now() - lastSuccess.current < 60000) {
      return true;
    }
    try {
      const res = await fetchHealth(undefined, 10000);
      lastSuccess.current = Date.now();
      setState(res.status === "degraded" ? "DEGRADED" : "CONNECTED");
      setError(null);
      stopTicker();
      return true;
    } catch {
      return false;
    }
  }, [stopTicker]);

  const retry = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setState("OFFLINE");
      setError("Network connection is offline. Automatic checks will resume when connectivity returns.");
      stopTicker();
      return;
    }

    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    const { signal } = controller;
    const deadline = Date.now() + maxStartupMs;

    setState("CHECKING");
    setError(null);
    setAttempt(1);
    startTicker();

    // After 3.5 seconds of initial check, transition to STARTING to inform the user
    const startingTimer = setTimeout(() => {
      if (!signal.aborted) {
        setState((s) => (s === "CHECKING" ? "STARTING" : s));
      }
    }, 3500);

    void (async () => {
      try {
        for (let att = 1; att <= backoff.length + 1; att++) {
          const remaining = deadline - Date.now();
          if (remaining <= 0) {
            setState("TEMPORARILY_UNAVAILABLE");
            setError(
              "The analysis engine did not become ready within the startup window. Render Free instances sleep after inactivity and may need extra time to warm up."
            );
            setAttempt(att - 1);
            stopTicker();
            return;
          }

          setAttempt(att);
          const reqStart = Date.now();
          try {
            const healthRes = await fetchHealth(signal, Math.min(45000, remaining));
            if (signal.aborted) return;
            const latency = Date.now() - reqStart;
            lastSuccess.current = Date.now();
            stopTicker();

            setState(healthRes.status === "degraded" ? "DEGRADED" : "CONNECTED");
            setError(null);

            // Fetch background diagnostics without blocking connection state
            fetchDiagnostics()
              .then((d) => setDiagnostics({ ...d, latency_ms: latency }))
              .catch(() => {
                setDiagnostics({
                  status: healthRes.status,
                  project: healthRes.project,
                  version: healthRes.version,
                  latency_ms: latency,
                });
              });
            return;
          } catch (err) {
            if (signal.aborted) return;

            if (typeof navigator !== "undefined" && navigator.onLine === false) {
              setState("OFFLINE");
              setError("Your browser appears to be offline.");
              stopTicker();
              return;
            }

            const isApiError = err instanceof ApiError;
            const isOffline = isApiError && err.kind === "offline";
            const isDeployment =
              isApiError &&
              (err.kind === "deployment" ||
                err.kind === "configuration" ||
                err.kind === "incompatible");
            const isTransient = isApiError && err.kind === "transient";

            if (isOffline) {
              setState("OFFLINE");
              setError(errorMessage(err));
              stopTicker();
              return;
            }

            if (isDeployment) {
              setState("DEPLOYMENT_ERROR");
              setError(errorMessage(err));
              stopTicker();
              return;
            }

            if (!isTransient || att === backoff.length + 1) {
              setState("TEMPORARILY_UNAVAILABLE");
              setError(errorMessage(err));
              stopTicker();
              return;
            }

            setState("STARTING");
            setError(errorMessage(err));

            const delayMs = Math.min(backoff[att - 1], Math.max(0, deadline - Date.now()));
            await pause(delayMs, signal);
          }
        }
      } finally {
        clearTimeout(startingTimer);
        if (running.current === controller) running.current = null;
      }
    })().catch(() => {
      // Ignore cancellations from abort()
    });
  }, [startTicker, stopTicker]);

  useEffect(() => {
    const initialCheck = setTimeout(() => {
      retry();
    }, 0);

    const handleOnline = () => {
      if (stateRef.current === "OFFLINE" || stateRef.current === "TEMPORARILY_UNAVAILABLE") {
        retry();
      }
    };

    const handleOffline = () => {
      running.current?.abort();
      stopTicker();
      setState("OFFLINE");
      setError("Network connection lost. Waiting for connectivity to resume...");
    };

    const handleVisibility = () => {
      if (
        !running.current &&
        document.visibilityState === "visible" &&
        (stateRef.current !== "CONNECTED" || Date.now() - lastSuccess.current > 60000)
      ) {
        retry();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(initialCheck);
      stopTicker();
      running.current?.abort();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [retry, stopTicker]);

  return (
    <Context.Provider
      value={{
        state,
        error,
        attempt,
        elapsedSeconds,
        diagnostics,
        retry,
        checkDirectly,
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
  STARTING: "Starting the analysis engine",
  CONNECTED: "Engine connected",
  DEGRADED: "Analysis engine degraded",
  TEMPORARILY_UNAVAILABLE: "Engine temporarily unavailable",
  DEPLOYMENT_ERROR: "Backend deployment problem",
  OFFLINE: "Network offline",
};

export function EngineIndicator() {
  const { state, elapsedSeconds, error, retry } = useEngine();
  const waiting = state === "CHECKING" || state === "STARTING";

  let statusClass = "unavailable";
  if (state === "CONNECTED") statusClass = "connected";
  else if (waiting) statusClass = "checking";

  const isIncompatible = error?.toLowerCase().includes("incompatible");
  let labelText = engineStateLabels[state];
  if (state === "STARTING") {
    labelText = `Starting engine (${elapsedSeconds}s)`;
  } else if (isIncompatible) {
    labelText = "Backend response incompatible";
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
  const { state, error, attempt, elapsedSeconds, diagnostics, retry } = useEngine();
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Per Phase 3 requirement:
  // "When the website first loads:
  //  - Begin a nonblocking health check.
  //  - Keep the interface responsive.
  //  - Show an unobtrusive status indicator.
  //  - Do not immediately display a large error banner."
  // When connected or during the initial brief CHECKING check, do not show a large banner.
  if (state === "CONNECTED" || state === "CHECKING") return null;

  const isStarting = state === "STARTING";
  const isOffline = state === "OFFLINE";

  return (
    <div
      className={`engine-banner ${isStarting ? "" : "engine-error"}`}
      role={isStarting ? "status" : "alert"}
    >
      {isStarting ? (
        <Loader2 size={20} className="animate-spin text-blue-400 shrink-0" />
      ) : isOffline ? (
        <WifiOff size={20} className="text-slate-400 shrink-0" />
      ) : (
        <AlertTriangle size={20} className="text-rose-400 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-sm">
            {isStarting
              ? "Starting the analysis engine"
              : engineStateLabels[state]}
          </p>
          {isStarting && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-950/80 border border-blue-800 text-blue-300 font-mono">
              {elapsedSeconds}s elapsed · attempt {attempt} of 9
            </span>
          )}
        </div>

        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
          {isStarting
            ? `Infera uses a free Python server, which may need some time to start. Bounded health checks allow up to two minutes for a cold start. Health check ${attempt} of 9. This retry sequence stops on its own.`
            : `${error ?? "The analysis engine could not be reached."} Automatic checks have stopped; retry when you are ready.`}
        </p>

        {/* Expandable Diagnostic Drawer */}
        {!isStarting && (
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
        )}
      </div>

      {!isStarting && (
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
