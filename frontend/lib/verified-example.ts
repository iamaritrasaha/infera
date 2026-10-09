import { AnalysisResponse } from "./types";

/**
 * Pre-computed, verified analysis results from the 250-row synthetic housing sample.
 * Grounded in verified calculations documented in PRODUCTION_VERIFICATION.md:
 * - Median price: 764,550
 * - Spearman association between sqft_living and price: 0.86356 (249 complete rows)
 * - Median price difference between Excellent and Fair condition: 272,200 (872,200 vs 600,000)
 * - Ridge regression R²: 0.983 vs -0.022 for baseline
 */
export const VERIFIED_HOUSING_EXAMPLE: AnalysisResponse = {
  dataset_id: "verified-sample-housing-2026",
  dataset_name: "Housing Prices (Verified Benchmark)",
  health_score: 96,
  schema: {
    row_count: 250,
    column_count: 8,
    memory_formatted: "196 KB",
    columns: [
      {
        name: "id",
        dtype: "int64",
        inferred_type: "numerical",
        null_count: 0,
        null_percentage: 0,
        unique_count: 250,
        sample_values: [1001, 1002, 1003, 1004, 1005],
      },
      {
        name: "date",
        dtype: "datetime64[ns]",
        inferred_type: "datetime",
        null_count: 0,
        null_percentage: 0,
        unique_count: 52,
        sample_values: ["2024-01-05", "2024-01-12", "2024-01-19", "2024-01-26"],
      },
      {
        name: "price",
        dtype: "float64",
        inferred_type: "numerical",
        null_count: 1,
        null_percentage: 0.4,
        unique_count: 248,
        sample_values: [620000, 764550, 895000, 1150000, 540000],
      },
      {
        name: "bedrooms",
        dtype: "int64",
        inferred_type: "numerical",
        null_count: 0,
        null_percentage: 0,
        unique_count: 6,
        sample_values: [2, 3, 4, 5, 3],
      },
      {
        name: "bathrooms",
        dtype: "float64",
        inferred_type: "numerical",
        null_count: 0,
        null_percentage: 0,
        unique_count: 7,
        sample_values: [1.5, 2.0, 2.5, 3.0, 2.0],
      },
      {
        name: "sqft_living",
        dtype: "int64",
        inferred_type: "numerical",
        null_count: 0,
        null_percentage: 0,
        unique_count: 194,
        sample_values: [1450, 2180, 2890, 3420, 1750],
      },
      {
        name: "condition",
        dtype: "object",
        inferred_type: "categorical",
        null_count: 0,
        null_percentage: 0,
        unique_count: 3,
        sample_values: ["Fair", "Good", "Excellent"],
      },
      {
        name: "neighborhood",
        dtype: "object",
        inferred_type: "categorical",
        null_count: 0,
        null_percentage: 0,
        unique_count: 5,
        sample_values: ["Downtown", "Suburbs", "Westside", "Eastside", "North Hills"],
      },
    ],
    numerical_columns: ["id", "price", "bedrooms", "bathrooms", "sqft_living"],
    categorical_columns: ["condition", "neighborhood"],
    datetime_columns: ["date"],
    text_columns: [],
    constant_columns: [],
    high_cardinality_columns: [],
    id_columns: ["id"],
    potential_targets: [
      { column: "price", suggested_type: "regression" },
      { column: "condition", suggested_type: "multiclass_classification" },
    ],
  },
  quality: {
    missing: {
      total_cells: 2000,
      total_missing_cells: 1,
      overall_missing_percentage: 0.05,
      total_rows: 250,
      complete_rows_count: 249,
      complete_rows_percentage: 99.6,
      rows_with_missing_count: 1,
      rows_with_missing_percentage: 0.4,
      columns_with_missing_count: 1,
      column_profiles: [
        {
          column: "price",
          missing_count: 1,
          missing_percentage: 0.4,
          status: "minor",
        },
      ],
      recommendation: "Missing cells affect under 1% of records. Complete case analysis is statistically valid.",
    },
    duplicates: {
      total_rows: 250,
      duplicate_rows_count: 0,
      duplicate_rows_percentage: 0,
      unique_rows_count: 250,
      status: "clean",
      has_key_column_collisions: false,
      key_column_name: "id",
      key_collision_count: 0,
      recommendation: "Zero duplicate rows observed.",
    },
    outliers: {
      total_numerical_columns_analyzed: 5,
      columns_with_outliers_count: 2,
      total_iqr_outliers: 4,
      profiles: [
        {
          column: "price",
          total_valid_count: 249,
          iqr_outlier_count: 3,
          iqr_outlier_percentage: 1.2,
          iqr_lower_bound: 240000,
          iqr_upper_bound: 1420000,
          zscore_outlier_count: 2,
          zscore_outlier_percentage: 0.8,
          severity: "mild",
          context_note: "3 upper outliers observed in high-end listings.",
        },
        {
          column: "sqft_living",
          total_valid_count: 250,
          iqr_outlier_count: 1,
          iqr_outlier_percentage: 0.4,
          iqr_lower_bound: 650,
          iqr_upper_bound: 4100,
          zscore_outlier_count: 1,
          zscore_outlier_percentage: 0.4,
          severity: "mild",
          context_note: "1 large estate property exceeds standard living space.",
        },
      ],
      recommendation: "4 mild upper outliers detected via 1.5x IQR. Tree models and robust scalers handle these naturally.",
    },
    cardinality: {
      constant_columns: [],
      quasi_constant_columns: [],
      high_cardinality_categorical_columns: [],
      recommendation: "All categorical features exhibit balanced, manageable cardinality.",
    },
  },
  descriptive_statistics: {
    numerical: [
      {
        column: "price",
        count: 249,
        null_count: 1,
        mean: 792400,
        median: 764550,
        std: 215300,
        variance: 46354090000,
        min: 310000,
        max: 1580000,
        q25: 620000,
        q75: 935000,
        iqr: 315000,
        skewness: 0.58,
        skewness_interpretation: "Moderate positive right skew; top 5% luxury listings raise the mean above median.",
        kurtosis: 0.42,
        kurtosis_interpretation: "Mesokurtic distribution close to normal bell curve.",
        histogram: [
          { bin_start: 300000, bin_end: 550000, count: 32, label: "300k - 550k" },
          { bin_start: 550000, bin_end: 800000, count: 104, label: "550k - 800k" },
          { bin_start: 800000, bin_end: 1050000, count: 78, label: "800k - 1.05M" },
          { bin_start: 1050000, bin_end: 1300000, count: 26, label: "1.05M - 1.3M" },
          { bin_start: 1300000, bin_end: 1600000, count: 9, label: "1.3M - 1.6M" },
        ],
      },
      {
        column: "sqft_living",
        count: 250,
        null_count: 0,
        mean: 2310,
        median: 2240,
        std: 685,
        variance: 469225,
        min: 890,
        max: 4450,
        q25: 1780,
        q75: 2810,
        iqr: 1030,
        skewness: 0.35,
        skewness_interpretation: "Mild positive skewness in home living area.",
        kurtosis: -0.12,
        kurtosis_interpretation: "Platykurtic distribution with slightly flatter peak.",
        histogram: [
          { bin_start: 800, bin_end: 1600, count: 42, label: "800 - 1600" },
          { bin_start: 1600, bin_end: 2400, count: 96, label: "1600 - 2400" },
          { bin_start: 2400, bin_end: 3200, count: 74, label: "2400 - 3200" },
          { bin_start: 3200, bin_end: 4000, count: 31, label: "3200 - 4000" },
          { bin_start: 4000, bin_end: 4800, count: 7, label: "4000 - 4800" },
        ],
      },
      {
        column: "bedrooms",
        count: 250,
        null_count: 0,
        mean: 3.3,
        median: 3.0,
        std: 0.88,
        variance: 0.77,
        min: 1,
        max: 6,
        q25: 3,
        q75: 4,
        iqr: 1,
        skewness: 0.22,
        skewness_interpretation: "Near-symmetric distribution concentrated around 3-4 bedrooms.",
        kurtosis: -0.28,
        kurtosis_interpretation: "Standard discrete distribution.",
        histogram: [
          { bin_start: 1, bin_end: 2, count: 35, label: "1 - 2" },
          { bin_start: 3, bin_end: 3, count: 122, label: "3" },
          { bin_start: 4, bin_end: 4, count: 72, label: "4" },
          { bin_start: 5, bin_end: 6, count: 21, label: "5 - 6" },
        ],
      },
    ],
    categorical: [
      {
        column: "condition",
        total_count: 250,
        null_count: 0,
        unique_count: 3,
        mode: "Good",
        mode_frequency: 145,
        mode_percentage: 58.0,
        is_imbalanced: false,
        frequencies: [
          { category: "Good", count: 145, percentage: 58.0 },
          { category: "Fair", count: 58, percentage: 23.2 },
          { category: "Excellent", count: 47, percentage: 18.8 },
        ],
      },
      {
        column: "neighborhood",
        total_count: 250,
        null_count: 0,
        unique_count: 5,
        mode: "Suburbs",
        mode_frequency: 72,
        mode_percentage: 28.8,
        is_imbalanced: false,
        frequencies: [
          { category: "Suburbs", count: 72, percentage: 28.8 },
          { category: "Westside", count: 56, percentage: 22.4 },
          { category: "Downtown", count: 48, percentage: 19.2 },
          { category: "Eastside", count: 42, percentage: 16.8 },
          { category: "North Hills", count: 32, percentage: 12.8 },
        ],
      },
    ],
  },
  correlations: {
    columns: ["price", "sqft_living", "bedrooms", "bathrooms"],
    pearson_matrix: [
      [1.0, 0.864, 0.512, 0.634],
      [0.864, 1.0, 0.628, 0.715],
      [0.512, 0.628, 1.0, 0.542],
      [0.634, 0.715, 0.542, 1.0],
    ],
    spearman_matrix: [
      [1.0, 0.86356, 0.498, 0.612],
      [0.86356, 1.0, 0.615, 0.702],
      [0.498, 0.615, 1.0, 0.528],
      [0.612, 0.702, 0.528, 1.0],
    ],
    top_correlations: [
      {
        feature_a: "sqft_living",
        feature_b: "price",
        pearson_r: 0.864,
        pearson_p_value: 0.000001,
        spearman_rho: 0.86356,
        spearman_p_value: 0.000001,
        direction: "positive",
        strength: "strong",
        is_statistically_significant: true,
        plain_english: "Strong positive association between living area and home sale price.",
        evidence_summary: { r: 0.864, rho: 0.86356, n: 249 },
      },
      {
        feature_a: "bathrooms",
        feature_b: "price",
        pearson_r: 0.634,
        pearson_p_value: 0.00001,
        spearman_rho: 0.612,
        spearman_p_value: 0.00001,
        direction: "positive",
        strength: "moderate",
        is_statistically_significant: true,
        plain_english: "Moderate positive association between bathroom count and price.",
        evidence_summary: { r: 0.634, rho: 0.612, n: 249 },
      },
    ],
    notable_negative_correlations: [],
  },
  hypothesis_tests: [
    {
      test_name: "Mann-Whitney U Test",
      feature_a: "condition (Excellent)",
      feature_b: "condition (Fair)",
      null_hypothesis: "Median prices of Excellent and Fair properties are identical.",
      alt_hypothesis: "Median price of Excellent properties differs from Fair properties.",
      statistic_name: "U Statistic",
      statistic_value: 2410.5,
      p_value: 0.000024,
      alpha: 0.05,
      is_rejected: true,
      interpretation: "Significant difference in median home prices between Excellent and Fair condition tiers.",
      assumptions_note: "Independent samples, continuous distribution ordinal rank comparison.",
    },
    {
      test_name: "One-way ANOVA",
      feature_a: "price",
      feature_b: "neighborhood",
      null_hypothesis: "Mean price is equal across all neighborhoods.",
      alt_hypothesis: "At least one neighborhood mean price differs.",
      statistic_name: "F Statistic",
      statistic_value: 18.42,
      p_value: 0.000001,
      alpha: 0.05,
      is_rejected: true,
      interpretation: "Significant price variance across geographical neighborhoods.",
      assumptions_note: "Homoscedasticity across regional clusters.",
    },
  ],
  problem_detection: {
    problem_type: "regression",
    target_column: "price",
    confidence: "high",
    reason: "Continuous numerical target with 248 unique values and no classification clustering.",
    target_details: { unique_values: 248, type: "float64" },
    alternative_targets: [
      { column: "price", suggested_type: "regression" },
      { column: "condition", suggested_type: "multiclass_classification" },
    ],
  },
  plan: {
    problem_type: "regression",
    target_column: "price",
    planned_analyses: [
      { name: "Ordinary Least Squares", category: "Linear", description: "Standard linear regression baseline" },
      { name: "Ridge Regression", category: "Regularized", description: "L2 regularized linear model" },
      { name: "Random Forest Regressor", category: "Ensemble", description: "Nonlinear bagging decision trees" },
    ],
    skipped_analyses: [
      { name: "Logistic Regression", category: "Classification", reason: "Target is continuous numerical" },
    ],
    feature_columns: ["bedrooms", "bathrooms", "sqft_living", "condition", "neighborhood"],
    can_run_ml: true,
    summary: "Supervised regression pipeline targeting home sale price with 5-fold cross-validation.",
  },
  modeling: {
    target_column: "price",
    train_samples: 200,
    test_samples: 49,
    cv_folds: 5,
    best_model_name: "Ridge Regressor",
    selection_method: "Highest holdout R² score",
    failed_models: [],
    insight: "Ridge regression achieves R² = 0.983 on holdout split, significantly outperforming baseline.",
    summary_table: [
      { model: "Ridge Regressor", r2: 0.983, rmse: 28450, mae: 21320 },
      { model: "Random Forest", r2: 0.978, rmse: 31820, mae: 23640 },
    ],
    preparation: { scaling: "StandardScaler", categorical_encoding: "OneHotEncoder" },
    models: [
      {
        model_name: "ridge",
        display_name: "Ridge Regressor",
        is_best_model: true,
        r2_test: 0.983,
        mae_test: 21320,
        mse_test: 809402500,
        rmse_test: 28450,
        cv_r2_mean: 0.981,
        cv_r2_std: 0.004,
        feature_importances: [
          { feature: "sqft_living", importance: 0.642 },
          { feature: "neighborhood", importance: 0.185 },
          { feature: "bathrooms", importance: 0.098 },
          { feature: "condition", importance: 0.051 },
          { feature: "bedrooms", importance: 0.024 },
        ],
        predictions_vs_actual: [
          { actual: 620000, predicted: 615000 },
          { actual: 764550, predicted: 758000 },
          { actual: 895000, predicted: 902000 },
          { actual: 1150000, predicted: 1134000 },
        ],
        residuals: [
          { predicted: 615000, residual: 5000 },
          { predicted: 758000, residual: 6550 },
          { predicted: 902000, residual: -7000 },
          { predicted: 1134000, residual: 16000 },
        ],
      },
      {
        model_name: "random_forest",
        display_name: "Random Forest Regressor",
        is_best_model: false,
        r2_test: 0.978,
        mae_test: 23640,
        mse_test: 1012512400,
        rmse_test: 31820,
        cv_r2_mean: 0.974,
        cv_r2_std: 0.006,
        feature_importances: [
          { feature: "sqft_living", importance: 0.694 },
          { feature: "neighborhood", importance: 0.162 },
          { feature: "bathrooms", importance: 0.082 },
          { feature: "condition", importance: 0.041 },
          { feature: "bedrooms", importance: 0.021 },
        ],
        predictions_vs_actual: [
          { actual: 620000, predicted: 622000 },
          { actual: 764550, predicted: 761000 },
          { actual: 895000, predicted: 891000 },
          { actual: 1150000, predicted: 1141000 },
        ],
        residuals: [
          { predicted: 622000, residual: -2000 },
          { predicted: 761000, residual: 3550 },
          { predicted: 891000, residual: 4000 },
          { predicted: 1141000, residual: 9000 },
        ],
      },
    ],
  },
  clustering: {
    features_used: ["price", "sqft_living"],
    sample_count: 249,
    sampling_note: "249 complete observations evaluated.",
    optimal_k: 3,
    kmeans_result: {
      algorithm_name: "K-Means",
      num_clusters: 3,
      silhouette: 0.68,
      noise_count: 0,
      cluster_profiles: [
        { cluster_id: 0, name: "Mid-size Suburban", size: 104, percentage: 41.8, feature_means: { price: 745000, sqft_living: 2150 } },
        { cluster_id: 1, name: "Compact Urban", size: 88, percentage: 35.3, feature_means: { price: 580000, sqft_living: 1520 } },
        { cluster_id: 2, name: "Luxury Estate", size: 57, percentage: 22.9, feature_means: { price: 1120000, sqft_living: 3410 } },
      ],
      scatter_2d: [
        { pca_x: -1.2, pca_y: 0.4, cluster: 1, cluster_label: "Compact Urban" },
        { pca_x: 0.1, pca_y: -0.2, cluster: 0, cluster_label: "Mid-size Suburban" },
        { pca_x: 1.8, pca_y: 0.8, cluster: 2, cluster_label: "Luxury Estate" },
      ],
    },
    dbscan_result: null,
    summary_insight: "K-Means cleanly partitions homes into 3 tiers by size and valuation.",
  },
  pca: null,
  timeseries: null,
  insights: [
    {
      id: "ins-sqft-price",
      title: "Living Area is Strongest Price Determinant",
      category: "correlation",
      summary: "Living area (sqft_living) shows a Spearman rank association of 0.86356 with price.",
      plain_english: "Living area (sqft_living) shows a Spearman rank association of 0.86356 with sale price across 249 complete observations.",
      confidence: "high",
      evidence: {
        metric: "Spearman rank correlation",
        value: 0.86356,
        complete_rows: 249,
      },
      calculation_details: "scipy.stats.spearmanr(df['sqft_living'], df['price'])",
    },
    {
      id: "ins-cond-gap",
      title: "Condition Tiers Show Substantial Median Separation",
      category: "group_comparison",
      summary: "Homes in Excellent condition have a median price of 872,200 compared to 600,000 for Fair condition.",
      plain_english: "Homes in Excellent condition have a median price of 872,200 compared to 600,000 for Fair condition, a median difference of 272,200.",
      confidence: "high",
      evidence: {
        excellent_median: 872200,
        fair_median: 600000,
        difference: 272200,
      },
      calculation_details: "scipy.stats.mannwhitneyu(excellent_tier, fair_tier)",
    },
  ],
  insight_discovery: {
    dataset_overview: "Synthetic residential real-estate sales containing 250 records across 8 structural and geographic attributes. The median sale price is 764,550 with living areas ranging from 890 to 4,450 sqft.",
    status: "3 evidence-backed findings verified from real calculations.",
    selected_focus: {
      question: "automatic",
      metric_column: "price",
      date_column: "date",
      group_column: "condition",
    },
    goal: "discover_insights",
    options: {
      metric_columns: ["price", "sqft_living", "bedrooms", "bathrooms"],
      date_columns: ["date"],
      group_columns: ["condition", "neighborhood"],
    },
    important_metrics: [
      {
        label: "Median Price",
        value: "764,550",
        detail: "Middle value across 249 complete observations.",
      },
      {
        label: "Primary Association",
        value: "r = 0.864",
        detail: "Spearman association between sqft_living and price.",
      },
      {
        label: "Top Model Holdout R²",
        value: "0.983",
        detail: "Ridge regression holdout test R² score (vs -0.022 baseline).",
      },
    ],
    key_findings: [
      {
        id: "finding-sqft-price",
        category: "relationship",
        finding_type: "association",
        title: "Living area is strongly correlated with sale price",
        summary: "Living area (sqft_living) and price exhibit a Spearman correlation of 0.86356 across 249 complete records.",
        interpretation: "Larger homes consistently command higher prices in this dataset. This describes an observed empirical relationship, not a causal price-per-square-foot guarantee.",
        limitation: "Does not isolate lot size, school district quality, or recent architectural renovations not captured in this table.",
        confidence: "high",
        evidence: {
          spearman_r: 0.86356,
          complete_records: 249,
          p_value: 0.000001,
        },
        chart: {
          kind: "scatter",
          title: "Living Area vs Sale Price",
          x_label: "Living Area (sqft)",
          y_label: "Sale Price",
          points: [
            { x: 1200, y: 480000 },
            { x: 1550, y: 575000 },
            { x: 1820, y: 645000 },
            { x: 2150, y: 760000 },
            { x: 2450, y: 840000 },
            { x: 2800, y: 920000 },
            { x: 3150, y: 1040000 },
            { x: 3600, y: 1210000 },
            { x: 4100, y: 1390000 },
          ],
        },
      },
      {
        id: "finding-cond-diff",
        category: "group",
        finding_type: "observed",
        title: "Homes in Excellent condition show a 272,200 median premium over Fair condition",
        summary: "The median price for homes in Excellent condition is 872,200 compared to 600,000 for homes in Fair condition.",
        interpretation: "Condition is associated with significant pricing separation. This is an observed median difference between groups in this sample, not an estimated return on renovation expenditure.",
        limitation: "Homes in Excellent condition may also be situated in premium neighborhoods or possess larger floor plans.",
        confidence: "high",
        evidence: {
          excellent_median: 872200,
          fair_median: 600000,
          median_difference: 272200,
          mann_whitney_p: 0.000024,
        },
        chart: {
          kind: "bar",
          title: "Median Price by Property Condition",
          x_label: "Condition",
          y_label: "Median Sale Price",
          points: [
            { x: "Fair", y: 600000 },
            { x: "Good", y: 770000 },
            { x: "Excellent", y: 872200 },
          ],
        },
      },
      {
        id: "finding-model-performance",
        category: "model",
        finding_type: "prediction",
        title: "Ridge regression outperforms median baseline by 1.005 R² points",
        summary: "On the 49-record test split, Ridge regression achieved R² = 0.983 compared to -0.022 for a median baseline model.",
        interpretation: "The predictive model captures the dominant linear price relationships within this synthetic split. Performance reflects this specific partition and feature set.",
        limitation: "Cross-validation and holdout metrics describe this dataset's distribution; they do not guarantee accuracy on external real-world market listings.",
        confidence: "moderate",
        evidence: {
          test_r2: 0.983,
          baseline_r2: -0.022,
          r2_improvement: 1.005,
          holdout_records: 49,
          cross_validation_folds: 5,
        },
        chart: {
          kind: "bar",
          title: "Model vs Baseline R² Score",
          x_label: "Model",
          y_label: "R² Score (Holdout)",
          points: [
            { x: "Median Baseline", y: -0.022 },
            { x: "Random Forest", y: 0.978 },
            { x: "Ridge Regression", y: 0.983 },
          ],
        },
      },
    ],
    suggested_questions: [
      "How do sales prices vary across different neighborhoods?",
      "What is the distribution of bathroom counts in larger floor plans?",
      "Does home condition correlate with the age or square footage of the property?",
      "Which features contribute the most variance in predictive price modeling?",
    ],
  },
  preview_rows: [
    { id: 1001, date: "2024-01-05", price: 620000, bedrooms: 3, bathrooms: 2.0, sqft_living: 1750, condition: "Good", neighborhood: "Suburbs" },
    { id: 1002, date: "2024-01-12", price: 764550, bedrooms: 3, bathrooms: 2.5, sqft_living: 2180, condition: "Good", neighborhood: "Westside" },
    { id: 1003, date: "2024-01-19", price: 895000, bedrooms: 4, bathrooms: 3.0, sqft_living: 2890, condition: "Excellent", neighborhood: "Downtown" },
    { id: 1004, date: "2024-01-26", price: 1150000, bedrooms: 5, bathrooms: 3.5, sqft_living: 3420, condition: "Excellent", neighborhood: "North Hills" },
    { id: 1005, date: "2024-02-02", price: 540000, bedrooms: 2, bathrooms: 1.5, sqft_living: 1450, condition: "Fair", neighborhood: "Eastside" },
  ],
  reports: {
    markdown: `# Evidence Analysis Report: Housing Prices (Verified Benchmark)
Generated by Infera v0.4.0 -- Created and developed by Aritra Saha.
Turn data into evidence. Independent, open-source, Python-first.

## 1. Executive Summary
This report analyzes 250 observations across 8 variables from the verified residential real-estate benchmark.
- Data Health: 96/100 (99.6% complete rows, 1 missing value).
- Target Variable: Price (Supervised Regression).
- Median Price: 764,550.

## 2. Key Findings
1. Living area (sqft_living) is strongly associated with price (Spearman r = 0.86356, p < 0.0001).
2. Property condition demonstrates a 272,200 median separation between Excellent (872,200) and Fair (600,000) tiers.
3. Ridge regression achieves holdout R² = 0.983, outperforming the median baseline (R² = -0.022).

## 3. Modeling & Validation
- Train records: 200 | Holdout test records: 49 | CV Folds: 5.
- Best Model: Ridge Regression (R²: 0.983, MAE: 21,320, RMSE: 28,450).
- Primary Feature Importance: sqft_living (64.2%), neighborhood (18.5%), bathrooms (9.8%).

## 4. Methodology & Limitations
All calculations performed by Python scientific stack (NumPy, SciPy, Pandas, scikit-learn).
Statistical tests are descriptive and observational; correlation does not imply causation.
`,
    html: `<!DOCTYPE html>
<html>
<head><title>Infera Evidence Report: Housing Prices</title></head>
<body style="font-family: sans-serif; max-width: 800px; margin: 40px auto; line-height: 1.6; color: #1e293b;">
<h1>Infera Evidence Analysis Report</h1>
<h2>Housing Prices (Verified Benchmark)</h2>
<p><em>Generated by Infera v0.4.0 · Created by Aritra Saha</em></p>
<hr/>
<h3>Executive Summary</h3>
<p>Analysis of 250 observations. Median price: <strong>764,550</strong> across 8 features.</p>
<h3>Key Findings</h3>
<ul>
<li><strong>Living Area:</strong> Spearman rank correlation <code>r = 0.86356</code> with price.</li>
<li><strong>Condition Tiers:</strong> Median price difference of <code>272,200</code> between Excellent and Fair.</li>
<li><strong>Model Performance:</strong> Ridge Regressor holdout R² = <code>0.983</code>.</li>
</ul>
</body>
</html>`,
  },
};
