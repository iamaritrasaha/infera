import type { AnalysisResponse, ColumnSummary, KeyFinding } from "./types";

export const SNAPSHOT_FORMAT_VERSION = 1;
const DATABASE_NAME = "infera-browser-snapshots";
const STORE_NAME = "analyses";
const MAX_SNAPSHOTS = 20;
const MAX_SNAPSHOT_BYTES = 1_500_000;

type SnapshotSchema = Omit<AnalysisResponse["schema"], "columns"> & {
  columns: Omit<ColumnSummary, "sample_values">[];
};

export interface SavedAnalysisPayload {
  dataset_name: string;
  health_score: number;
  schema: SnapshotSchema;
  quality: AnalysisResponse["quality"];
  descriptive_statistics: AnalysisResponse["descriptive_statistics"];
  correlations: AnalysisResponse["correlations"];
  hypothesis_tests: AnalysisResponse["hypothesis_tests"];
  problem_detection: AnalysisResponse["problem_detection"];
  insights: AnalysisResponse["insights"];
  key_findings: KeyFinding[];
  important_metrics: AnalysisResponse["insight_discovery"]["important_metrics"];
  overview: string;
  analysis_status: string;
}

export interface SavedAnalysisSnapshot {
  id: string;
  title: string;
  created_at: string;
  format_version: number;
  source: "computed" | "precomputed_example";
  analysis: SavedAnalysisPayload;
}

export interface UnsupportedSnapshot {
  id: string;
  title: string;
  created_at: string;
  format_version: number;
  unsupported: true;
}

export type SnapshotListItem = SavedAnalysisSnapshot | UnsupportedSnapshot;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Browser storage is unavailable in this context."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, SNAPSHOT_FORMAT_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("created_at", "created_at", { unique: false });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(new Error("Could not open browser storage for saved analyses."));
    request.onblocked = () => reject(new Error("Close another Infera tab to update saved analysis storage."));
  });
}

function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    try {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      let result!: T;
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => {
        database.close();
        resolve(result);
      };
      transaction.onabort = () => {
        database.close();
        if (transaction.error?.name === "QuotaExceededError") {
          reject(new Error("Browser storage is full. Delete saved analyses or free device space, then try again. The uploaded rows were not saved."));
        } else {
          reject(new Error("Browser storage could not complete this action. No uploaded rows were saved."));
        }
      };
      transaction.onerror = () => undefined;
    } catch {
      database.close();
      reject(new Error("Browser storage could not complete this action. No uploaded rows were saved."));
    }
  }));
}

function makePayload(data: AnalysisResponse): SavedAnalysisPayload {
  const columns = data.schema.columns.map((column) => ({
    name: column.name,
    dtype: column.dtype,
    inferred_type: column.inferred_type,
    null_count: column.null_count,
    null_percentage: column.null_percentage,
    unique_count: column.unique_count,
  }));
  return {
    dataset_name: data.dataset_name,
    health_score: data.health_score,
    schema: { ...data.schema, columns },
    quality: data.quality,
    descriptive_statistics: data.descriptive_statistics,
    correlations: data.correlations,
    hypothesis_tests: data.hypothesis_tests,
    problem_detection: data.problem_detection,
    insights: data.insights,
    key_findings: data.insight_discovery.key_findings,
    important_metrics: data.insight_discovery.important_metrics,
    overview: data.insight_discovery.dataset_overview,
    analysis_status: data.insight_discovery.status,
  };
}

function isCompatible(value: unknown): value is SavedAnalysisSnapshot {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedAnalysisSnapshot>;
  return item.format_version === SNAPSHOT_FORMAT_VERSION
    && typeof item.id === "string"
    && typeof item.title === "string"
    && typeof item.created_at === "string"
    && (item.source === "computed" || item.source === "precomputed_example")
    && !!item.analysis
    && typeof item.analysis.dataset_name === "string"
    && Array.isArray(item.analysis.key_findings)
    && Array.isArray(item.analysis.important_metrics);
}

export async function saveAnalysisSnapshot(
  data: AnalysisResponse,
  title: string,
  source: SavedAnalysisSnapshot["source"],
): Promise<SavedAnalysisSnapshot> {
  const normalizedTitle = title.trim().slice(0, 100);
  if (!normalizedTitle) throw new Error("Enter a title for this saved analysis.");
  const entries = await transact<unknown[]>("readonly", (store) => store.getAll());
  if (entries.length >= MAX_SNAPSHOTS) {
    throw new Error(`This browser already has ${MAX_SNAPSHOTS} saved analyses. Delete one before saving another.`);
  }
  const record: SavedAnalysisSnapshot = {
    id: crypto.randomUUID(),
    title: normalizedTitle,
    created_at: new Date().toISOString(),
    format_version: SNAPSHOT_FORMAT_VERSION,
    source,
    analysis: makePayload(data),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(record)).byteLength;
  if (bytes > MAX_SNAPSHOT_BYTES) {
    throw new Error("This analysis summary is too large for one browser snapshot. The raw dataset was not saved.");
  }
  await transact<IDBValidKey>("readwrite", (store) => store.add(record));
  return record;
}

export async function listAnalysisSnapshots(): Promise<SnapshotListItem[]> {
  const entries = await transact<unknown[]>("readonly", (store) => store.getAll());
  return entries
    .map((entry): SnapshotListItem | null => {
      if (isCompatible(entry)) return entry;
      if (!entry || typeof entry !== "object") return null;
      const value = entry as Partial<UnsupportedSnapshot>;
      if (typeof value.id !== "string") return null;
      return {
        id: value.id,
        title: typeof value.title === "string" ? value.title.slice(0, 100) : "Saved analysis",
        created_at: typeof value.created_at === "string" ? value.created_at : "",
        format_version: typeof value.format_version === "number" ? value.format_version : 0,
        unsupported: true,
      };
    })
    .filter((entry): entry is SnapshotListItem => entry !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function deleteAnalysisSnapshot(id: string): Promise<void> {
  await transact<undefined>("readwrite", (store) => store.delete(id));
}

export async function clearAnalysisSnapshots(): Promise<void> {
  await transact<undefined>("readwrite", (store) => store.clear());
}
