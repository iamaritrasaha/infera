/**
 * Infera Data Science Engine TypeScript Types
 */

export interface SampleDatasetInfo {
  id: string;
  name: string;
  description: string;
  row_count: number;
  column_count: number;
  recommended_target: string;
  suggested_problem_type: string;
}

export interface ColumnSummary {
  name: string;
  dtype: string;
  inferred_type: "numerical" | "categorical" | "datetime" | "text" | "boolean";
  null_count: number;
  null_percentage: number;
  unique_count: number;
  sample_values: (string | number | boolean | null)[];
}

export interface PotentialTarget {
  column: string;
  suggested_type: string;
}

export interface UploadResponse {
  dataset_id: string;
  dataset_name: string;
  row_count: number;
  column_count: number;
  memory_formatted: string;
  health_score: number;
  columns: ColumnSummary[];
  potential_targets: PotentialTarget[];
  preview_rows: Record<string, any>[];
}

export interface HistogramBin {
  bin_start: number;
  bin_end: number;
  count: number;
  label: string;
}

export interface NumericalDistribution {
  column: string;
  count: number;
  null_count: number;
  mean: number;
  median: number;
  std: number;
  variance: number;
  min: number;
  max: number;
  q25: number;
  q75: number;
  iqr: number;
  skewness: number;
  skewness_interpretation: string;
  kurtosis: number;
  kurtosis_interpretation: string;
  histogram: HistogramBin[];
}

export interface CategoryFrequency {
  category: string;
  count: number;
  percentage: number;
}

export interface CategoricalDistribution {
  column: string;
  total_count: number;
  null_count: number;
  unique_count: number;
  mode: string;
  mode_frequency: number;
  mode_percentage: number;
  is_imbalanced: boolean;
  frequencies: CategoryFrequency[];
}

export interface ColumnMissingProfile {
  column: string;
  missing_count: number;
  missing_percentage: number;
  status: "clean" | "minor" | "moderate" | "severe";
}

export interface MissingProfile {
  total_cells: number;
  total_missing_cells: number;
  overall_missing_percentage: number;
  total_rows: number;
  complete_rows_count: number;
  complete_rows_percentage: number;
  rows_with_missing_count: number;
  rows_with_missing_percentage: number;
  columns_with_missing_count: number;
  column_profiles: ColumnMissingProfile[];
  recommendation: string;
}

export interface DuplicateProfile {
  total_rows: number;
  duplicate_rows_count: number;
  duplicate_rows_percentage: number;
  unique_rows_count: number;
  status: "clean" | "moderate" | "severe";
  has_key_column_collisions: boolean;
  key_column_name: string | null;
  key_collision_count: number;
  recommendation: string;
}

export interface ColumnOutlierProfile {
  column: string;
  total_valid_count: number;
  iqr_outlier_count: number;
  iqr_outlier_percentage: number;
  iqr_lower_bound: number;
  iqr_upper_bound: number;
  zscore_outlier_count: number;
  zscore_outlier_percentage: number;
  severity: "none" | "mild" | "notable" | "extreme";
  context_note: string;
}

export interface OutlierProfile {
  total_numerical_columns_analyzed: number;
  columns_with_outliers_count: number;
  total_iqr_outliers: number;
  profiles: ColumnOutlierProfile[];
  recommendation: string;
}

export interface CorrelationPair {
  feature_a: string;
  feature_b: string;
  pearson_r: number;
  pearson_p_value: number;
  spearman_rho: number;
  spearman_p_value: number;
  strength: string;
  direction: string;
  is_statistically_significant: boolean;
  plain_english: string;
  evidence_summary: Record<string, any>;
}

export interface CorrelationMatrix {
  columns: string[];
  pearson_matrix: number[][];
  spearman_matrix: number[][];
  top_correlations: CorrelationPair[];
  notable_negative_correlations: CorrelationPair[];
}

export interface HypothesisTestResult {
  test_name: string;
  feature_a: string;
  feature_b: string;
  null_hypothesis: string;
  alt_hypothesis: string;
  statistic_name: string;
  statistic_value: number;
  p_value: number;
  alpha: number;
  is_rejected: boolean;
  interpretation: string;
  assumptions_note: string;
}

export interface ProblemDetection {
  problem_type: "regression" | "binary_classification" | "multiclass_classification" | "clustering" | "time_series" | "exploratory";
  target_column: string | null;
  confidence: string;
  reason: string;
  target_details: Record<string, any>;
  alternative_targets: PotentialTarget[];
}

export interface RegressionModelResult {
  model_name: string;
  display_name: string;
  r2_test: number;
  mae_test: number;
  mse_test: number;
  rmse_test: number;
  cv_r2_mean: number;
  cv_r2_std: number;
  is_best_model: boolean;
  feature_importances: { feature: string; importance: number; signed_coefficient?: number }[];
  predictions_vs_actual: { actual: number; predicted: number }[];
  residuals: { predicted: number; residual: number }[];
}

export interface ClassificationModelResult {
  model_name: string;
  display_name: string;
  accuracy_test: number;
  precision_macro: number;
  recall_macro: number;
  f1_macro: number;
  f1_weighted: number;
  roc_auc: number | null;
  cv_score_mean: number;
  cv_score_std: number;
  is_best_model: boolean;
  confusion_matrix: number[][];
  confusion_matrix_labels: string[];
  feature_importances: { feature: string; importance: number }[];
}

export interface ModelingResult {
  target_column: string;
  classes?: string[];
  train_samples: number;
  test_samples: number;
  has_class_imbalance?: boolean;
  imbalance_warning?: string | null;
  models: (RegressionModelResult | ClassificationModelResult)[];
  best_model_name: string;
  summary_table: Record<string, any>[];
  insight: string;
}

export interface ClusterProfile {
  cluster_id: number;
  name: string;
  size: number;
  percentage: number;
  feature_means: Record<string, number>;
}

export interface ClusterResult {
  algorithm_name: string;
  num_clusters: number;
  silhouette: number | null;
  cluster_profiles: ClusterProfile[];
  noise_count: number;
  scatter_2d: { pca_x: number; pca_y: number; cluster: number; cluster_label: string }[];
}

export interface ClusteringSuiteResult {
  features_used: string[];
  sample_count: number;
  optimal_k: number;
  kmeans_result: ClusterResult;
  dbscan_result: ClusterResult | null;
  summary_insight: string;
}

export interface PCALoading {
  feature: string;
  pc1_loading: number;
  pc2_loading: number;
}

export interface PCAResult {
  features_analyzed: string[];
  explained_variance_ratio: number[];
  cumulative_variance_explained: number;
  loadings: PCALoading[];
  points_2d: { pc1: number; pc2: number }[];
  summary: string;
}

export interface TimeSeriesResult {
  datetime_column: string;
  metric_column: string;
  total_observations: number;
  adf_statistic: number;
  adf_p_value: number;
  is_stationary: boolean;
  critical_values: Record<string, number>;
  stationarity_interpretation: string;
  lag_autocorrelations: { lag: number; autocorrelation: number }[];
  chart_series: { timestamp: string; value: number }[];
  trend_summary: string;
}

export interface StructuredInsight {
  id: string;
  category: string;
  title: string;
  summary: string;
  plain_english: string;
  confidence: string;
  evidence: Record<string, any>;
  calculation_details: string;
}

export interface AnalysisResponse {
  dataset_id: string;
  dataset_name: string;
  health_score: number;
  schema: {
    row_count: number;
    column_count: number;
    memory_formatted: string;
    columns: ColumnSummary[];
    numerical_columns: string[];
    categorical_columns: string[];
    datetime_columns: string[];
    text_columns: string[];
    constant_columns: string[];
    high_cardinality_columns: string[];
    id_columns: string[];
    potential_targets: PotentialTarget[];
  };
  quality: {
    missing: MissingProfile;
    duplicates: DuplicateProfile;
    outliers: OutlierProfile;
    cardinality: {
      constant_columns: string[];
      quasi_constant_columns: string[];
      high_cardinality_categorical_columns: string[];
      recommendation: string;
    };
  };
  descriptive_statistics: {
    numerical: NumericalDistribution[];
    categorical: CategoricalDistribution[];
  };
  correlations: CorrelationMatrix;
  hypothesis_tests: HypothesisTestResult[];
  problem_detection: ProblemDetection;
  plan: {
    problem_type: string;
    target_column: string | null;
    planned_analyses: { name: string; category: string; description: string }[];
    skipped_analyses: { name: string; category: string; reason: string }[];
    feature_columns: string[];
    can_run_ml: boolean;
    summary: string;
  };
  modeling: ModelingResult | null;
  clustering: ClusteringSuiteResult | null;
  pca: PCAResult | null;
  timeseries: TimeSeriesResult | null;
  insights: StructuredInsight[];
  preview_rows?: Record<string, any>[];
  reports: {
    markdown: string;
    html: string;
  };
}
