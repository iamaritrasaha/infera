"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiError, errorMessage, fetchHealth } from "@/lib/api";
import { Loader2, RefreshCw, Radio, TriangleAlert } from "lucide-react";

export type EngineState =
  "CHECKING" | "STARTING" | "CONNECTED" | "DEGRADED" | "UNAVAILABLE";
type Connection = {
  state: EngineState;
  error: string | null;
  attempt: number;
  retry: () => void;
};
const Context = createContext<Connection | null>(null);
const backoff = [1500, 4000, 8000];

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
  const [status, setStatus] = useState<Omit<Connection, "retry">>({
    state: "CHECKING",
    error: null,
    attempt: 0,
  });
  const running = useRef<AbortController | null>(null);
  const lastSuccess = useRef(0);
  const retry = useCallback(() => {
    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    const { signal } = controller;
    setStatus({ state: "CHECKING", error: null, attempt: 1 });
    const waking = setTimeout(() => {
      if (!signal.aborted)
        setStatus((s) =>
          s.state === "CHECKING" ? { ...s, state: "STARTING" } : s,
        );
    }, 4000);
    void (async () => {
      try {
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            await fetchHealth(signal);
            if (signal.aborted) return;
            lastSuccess.current = Date.now();
            setStatus({ state: "CONNECTED", error: null, attempt });
            return;
          } catch (error) {
            if (signal.aborted) return;
            const transient =
              error instanceof ApiError && error.kind === "transient";
            if (!transient || attempt === 4) {
              setStatus({
                state:
                  error instanceof ApiError && error.kind === "schema"
                    ? "DEGRADED"
                    : "UNAVAILABLE",
                error: errorMessage(error),
                attempt,
              });
              return;
            }
            setStatus({
              state: "STARTING",
              error: errorMessage(error),
              attempt: attempt + 1,
            });
            await pause(backoff[attempt - 1], signal);
          }
        }
      } finally {
        clearTimeout(waking);
        if (running.current === controller) running.current = null;
      }
    })().catch(() => {
      /* Only the provider's cancelled backoff reaches here. */
    });
  }, []);

  useEffect(() => {
    const initialCheck = setTimeout(retry, 0);
    const reconnect = () => {
      if (
        !running.current &&
        document.visibilityState === "visible" &&
        Date.now() - lastSuccess.current > 60000
      )
        retry();
    };
    window.addEventListener("online", reconnect);
    document.addEventListener("visibilitychange", reconnect);
    return () => {
      clearTimeout(initialCheck);
      running.current?.abort();
      window.removeEventListener("online", reconnect);
      document.removeEventListener("visibilitychange", reconnect);
    };
  }, [retry]);
  return (
    <Context.Provider value={{ ...status, retry }}>{children}</Context.Provider>
  );
}

export function useEngine() {
  const engine = useContext(Context);
  if (!engine) throw new Error("Engine connection provider is missing.");
  return engine;
}

const labels: Record<EngineState, string> = {
  CHECKING: "Checking engine",
  STARTING: "Starting the analysis engine",
  CONNECTED: "Engine connected",
  DEGRADED: "Engine response incompatible",
  UNAVAILABLE: "Engine unavailable",
};

export function EngineIndicator() {
  const { state, retry } = useEngine();
  const waiting = state === "CHECKING" || state === "STARTING";
  return (
    <button
      onClick={retry}
      disabled={waiting}
      aria-label="Retry analysis engine connection"
      title={`${labels[state]}${waiting ? "" : " · Check again"}`}
      className={`engine-indicator ${state === "CONNECTED" ? "connected" : waiting ? "checking" : "unavailable"}`}
    >
      {waiting ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <span className="status-dot" />
      )}
      <span>{labels[state]}</span>
    </button>
  );
}

export function EngineBanner() {
  const { state, error, attempt, retry } = useEngine();
  if (state === "CONNECTED") return null;
  const waiting = state === "CHECKING" || state === "STARTING";
  return (
    <div
      className={`engine-banner ${waiting ? "" : "engine-error"}`}
      role={waiting ? "status" : "alert"}
    >
      {waiting ? (
        <Loader2 size={19} className="animate-spin shrink-0" />
      ) : (
        <TriangleAlert size={19} className="shrink-0" />
      )}
      <div className="flex-1">
        <p className="font-medium text-sm">{labels[state]}</p>
        <p className="text-xs text-slate-400 mt-1">
          {waiting
            ? "The free analysis server may need a moment to wake up."
            : error}
        </p>
        {state === "STARTING" && (
          <p className="text-xs text-slate-400 mt-1">
            Attempt {attempt} of 4. This check stops after about two minutes.
          </p>
        )}
      </div>
      {!waiting && (
        <button className="button-secondary" onClick={retry}>
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
      <Radio size={13} />
      {labels[state]}
    </span>
  );
}
