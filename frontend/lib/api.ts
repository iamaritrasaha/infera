/**
 * Infera API Client.
 *
 * Concise, direct HTTP client connecting the React frontend to the FastAPI engine.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ColumnInfo {
  name: string;
  dtype: string;
  missing_count: number;
  missing_pct: number;
  unique_count: number;
  is_numeric: boolean;
}

export interface ColumnStats {
  count: number;
  mean: number;
  std: number;
  min: number;
  q25: number;
  median: number;
  q75: number;
  max: number;
}

export interface DatasetSummary {
  row_count: number;
  column_count: number;
  total_missing: number;
  columns: ColumnInfo[];
  numeric_columns: string[];
  statistics: Record<string, ColumnStats>;
  preview: Record<string, unknown>[];
}

export interface CorrelationPair {
  col1: string;
  col2: string;
  correlation: number;
  abs_correlation: number;
}

export interface CorrelationData {
  pairs: CorrelationPair[];
  matrix: {
    columns: string[];
    rows: number[][];
  };
}

export interface DatasetResponse {
  dataset_id: string;
  filename: string;
  summary: DatasetSummary;
  correlations: CorrelationData;
}

export interface RegressionMetrics {
  r2: number;
  train_r2: number;
  mae: number;
  rmse: number;
  mse: number;
}

export interface Coefficient {
  feature: string;
  weight: number;
}

export interface ChartPoint {
  actual: number;
  predicted: number;
}

export interface RegressionResponse {
  target_column: string;
  feature_columns: string[];
  train_samples: number;
  test_samples: number;
  metrics: RegressionMetrics;
  coefficients: Coefficient[];
  intercept: number;
  chart_points: ChartPoint[];
}

export async function checkEngineHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function uploadCSV(file: File): Promise<DatasetResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed." }));
    throw new Error(err.detail || `Upload failed with status ${res.status}`);
  }

  return res.json();
}

export async function loadSampleDataset(): Promise<DatasetResponse> {
  const res = await fetch(`${API_BASE}/api/sample`, {
    method: "POST",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to load sample dataset." }));
    throw new Error(err.detail || `Failed to load sample with status ${res.status}`);
  }

  return res.json();
}

export async function runLinearRegression(
  datasetId: string,
  targetColumn: string,
): Promise<RegressionResponse> {
  const res = await fetch(`${API_BASE}/api/regression`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataset_id: datasetId,
      target_column: targetColumn,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Regression failed." }));
    throw new Error(err.detail || `Regression failed with status ${res.status}`);
  }

  return res.json();
}

export function getReportDownloadUrl(datasetId: string): string {
  return `${API_BASE}/api/report/${encodeURIComponent(datasetId)}`;
}
