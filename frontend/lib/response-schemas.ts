/** Validate untrusted API payloads before the dashboard reads nested values. */
import { z } from "zod";
const n = z.number().finite();
const s = z.string();
const scalar = z.union([s, n, z.boolean(), z.null()]);
const record = z.record(s, z.unknown());
const target = z.object({ column: s, suggested_type: s });
const column = z.object({ name: s, dtype: s.optional(), original_dtype: s.optional(), inferred_type: z.enum(["numerical", "categorical", "datetime", "text", "boolean"]), null_count: n, null_percentage: n, unique_count: n, sample_values: z.array(scalar) }).transform(c => ({ ...c, dtype: c.dtype ?? c.original_dtype ?? "unknown" }));
export const samplesSchema = z.array(z.object({ id: s, name: s, description: s, row_count: n, column_count: n, recommended_target: s, suggested_problem_type: s }));
export const uploadSchema = z.object({ dataset_id: s, dataset_name: s, row_count: n, column_count: n, memory_formatted: s, health_score: n, columns: z.array(column), potential_targets: z.array(target), recommended_target: s.nullable().optional(), preview_rows: z.array(z.record(s, scalar)) });
const importance = z.object({ feature: s, importance: n, signed_coefficient: n.optional() });
const modelBase = { model_name: s, display_name: s, is_best_model: z.boolean(), feature_importances: z.array(importance) };
const regression = z.object({ ...modelBase, r2_test: n, mae_test: n, mse_test: n, rmse_test: n, cv_r2_mean: n.nullable(), cv_r2_std: n.nullable(), predictions_vs_actual: z.array(z.object({ actual: n, predicted: n })), residuals: z.array(z.object({ predicted: n, residual: n })) });
const classification = z.object({ ...modelBase, accuracy_test: n, precision_macro: n, recall_macro: n, f1_macro: n, f1_weighted: n, roc_auc: n.nullable(), cv_score_mean: n.nullable(), cv_score_std: n.nullable(), confusion_matrix: z.array(z.array(n)), confusion_matrix_labels: z.array(s) });
const cluster = z.object({ algorithm_name: s, num_clusters: n, silhouette: n.nullable(), noise_count: n, cluster_profiles: z.array(z.object({ cluster_id: n, name: s, size: n, percentage: n, feature_means: z.record(s, n) })), scatter_2d: z.array(z.object({ pca_x: n, pca_y: n, cluster: n, cluster_label: s })) });
const pair = z.object({ feature_a: s, feature_b: s, pearson_r: n, pearson_p_value: n, spearman_rho: n, spearman_p_value: n, strength: s, direction: s, is_statistically_significant: z.boolean(), plain_english: s, evidence_summary: record });
const insightChart = z.object({
  kind: z.enum(["line", "bar", "histogram", "scatter"]),
  title: s,
  x_label: s,
  y_label: s,
  points: z.array(z.object({ x: z.union([s, n]), y: n, detail: s.nullable().optional() })),
});
const keyFinding = z.object({
  id: s,
  category: z.enum(["time", "group", "relationship", "distribution", "model"]),
  finding_type: z.enum(["observed", "association", "prediction"]),
  title: s,
  summary: s,
  interpretation: s,
  limitation: s,
  confidence: z.enum(["high", "moderate", "exploratory"]),
  evidence: record,
  chart: insightChart.nullable(),
});
const insightFocus = z.object({ metric_column: s.nullable(), date_column: s.nullable(), group_column: s.nullable(), question: z.enum(["automatic", "time", "groups", "relationships", "distributions"]) });
const insightDiscovery = z.object({
  dataset_overview: s,
  status: s,
  selected_focus: insightFocus,
  options: z.object({ metric_columns: z.array(s), date_columns: z.array(s), group_columns: z.array(s) }),
  important_metrics: z.array(z.object({ label: s, value: s, detail: s })),
  key_findings: z.array(keyFinding),
  suggested_questions: z.array(s),
});
export const analysisSchema = z.object({
  dataset_id: s, dataset_name: s, health_score: n,
  schema: z.object({ row_count: n, column_count: n, memory_formatted: s, columns: z.array(column), numerical_columns: z.array(s), categorical_columns: z.array(s), datetime_columns: z.array(s), text_columns: z.array(s), constant_columns: z.array(s), high_cardinality_columns: z.array(s), id_columns: z.array(s), potential_targets: z.array(target) }),
  quality: z.object({
    missing: z.object({ total_cells: n, total_missing_cells: n, overall_missing_percentage: n, total_rows: n, complete_rows_count: n, complete_rows_percentage: n, rows_with_missing_count: n, rows_with_missing_percentage: n, columns_with_missing_count: n, column_profiles: z.array(z.object({ column: s, missing_count: n, missing_percentage: n, status: z.enum(["clean", "minor", "moderate", "severe"]) })), recommendation: s }),
    duplicates: z.object({ total_rows: n, duplicate_rows_count: n, duplicate_rows_percentage: n, unique_rows_count: n, status: z.enum(["clean", "moderate", "severe"]), has_key_column_collisions: z.boolean(), key_column_name: s.nullable(), key_collision_count: n, recommendation: s }),
    outliers: z.object({ total_numerical_columns_analyzed: n, columns_with_outliers_count: n, total_iqr_outliers: n, recommendation: s, profiles: z.array(z.object({ column: s, total_valid_count: n, iqr_outlier_count: n, iqr_outlier_percentage: n, iqr_lower_bound: n, iqr_upper_bound: n, zscore_outlier_count: n, zscore_outlier_percentage: n, severity: z.enum(["none", "mild", "notable", "extreme"]), context_note: s })) }),
    cardinality: z.object({ constant_columns: z.array(s), quasi_constant_columns: z.array(s), high_cardinality_categorical_columns: z.array(s), recommendation: s }),
  }),
  descriptive_statistics: z.object({
    numerical: z.array(z.object({ column: s, count: n, null_count: n, mean: n.nullable(), median: n.nullable(), std: n.nullable(), variance: n.nullable(), min: n, max: n, q25: n, q75: n, iqr: n, skewness: n.nullable(), skewness_interpretation: s, kurtosis: n.nullable(), kurtosis_interpretation: s, histogram: z.array(z.object({ bin_start: n, bin_end: n, count: n, label: s })) })),
    categorical: z.array(z.object({ column: s, total_count: n, null_count: n, unique_count: n, mode: s, mode_frequency: n, mode_percentage: n, is_imbalanced: z.boolean(), frequencies: z.array(z.object({ category: s, count: n, percentage: n })) })),
  }),
  correlations: z.object({ columns: z.array(s), pearson_matrix: z.array(z.array(n.nullable())), spearman_matrix: z.array(z.array(n.nullable())), top_correlations: z.array(pair), notable_negative_correlations: z.array(pair) }),
  hypothesis_tests: z.array(z.object({ test_name: s, feature_a: s, feature_b: s, null_hypothesis: s, alt_hypothesis: s, statistic_name: s, statistic_value: n, p_value: n, alpha: n, is_rejected: z.boolean(), interpretation: s, assumptions_note: s })),
  problem_detection: z.object({ problem_type: z.enum(["regression", "binary_classification", "multiclass_classification", "clustering", "time_series", "exploratory"]), target_column: s.nullable(), confidence: s, reason: s, target_details: record, alternative_targets: z.array(target) }),
  plan: z.object({ problem_type: s, target_column: s.nullable(), planned_analyses: z.array(z.object({ name: s, category: s, description: s })), skipped_analyses: z.array(z.object({ name: s, category: s, reason: s })), feature_columns: z.array(s), can_run_ml: z.boolean(), summary: s }),
  modeling: z.object({ target_column: s, classes: z.array(s).optional(), train_samples: n, test_samples: n, has_class_imbalance: z.boolean().optional(), imbalance_warning: s.nullable().optional(), models: z.array(z.union([regression, classification])), best_model_name: s, summary_table: z.array(z.record(s, scalar)), insight: s, preparation: record, cv_folds: n, selection_method: s, failed_models: z.array(s) }).nullable(),
  clustering: z.object({ features_used: z.array(s), sample_count: n, optimal_k: n, kmeans_result: cluster, dbscan_result: cluster.nullable(), summary_insight: s, original_rows: n, excluded_missing_rows: n, sampling_note: s }).nullable(),
  pca: z.object({ features_analyzed: z.array(s), explained_variance_ratio: z.array(n), cumulative_variance_explained: n, loadings: z.array(z.object({ feature: s, pc1_loading: n, pc2_loading: n })), points_2d: z.array(z.object({ pc1: n, pc2: n })), summary: s, sample_count: n, excluded_missing_rows: n }).nullable(),
  timeseries: z.object({ datetime_column: s, metric_column: s, total_observations: n, adf_statistic: n.nullable(), adf_p_value: n.nullable(), is_stationary: z.boolean().nullable(), critical_values: z.record(s, n), stationarity_interpretation: s, lag_autocorrelations: z.array(z.object({ lag: n, autocorrelation: n })), chart_series: z.array(z.object({ timestamp: s, value: n })), trend_summary: s }).nullable(),
  insights: z.array(z.object({ id: s, category: s, title: s, summary: s, plain_english: s, confidence: s, evidence: record, calculation_details: s })),
  insight_discovery: insightDiscovery,
  preview_rows: z.array(z.record(s, scalar)).optional(), reports: z.object({ markdown: s, html: s }),
});
