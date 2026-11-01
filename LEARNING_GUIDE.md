# Learning Infera

Infera is designed as a clear, readable teaching codebase.
Execution starts at **`infera/main.py`** in function **`upload_csv_file`**.

---

## 1. Complete Workflow Example

Here is the exact journey of your data from a file on your disk to charts on your screen:

```
[User Selects File]
       │
       ▼
1. Upload CSV
   • frontend: DatasetWorkspace.tsx calls uploadDatasetFile() in lib/api.ts
   • backend: upload_csv_file() in infera/main.py receives the file
       │
       ▼
2. Read with pandas
   • load_dataset() & load_csv() in infera/data_loader.py read content via pd.read_csv()
   • validate_dataframe() verifies row limits, unique columns, and finite numbers
   • store_dataset() in infera/main.py saves (df, name) in the in-memory DATASETS map
   • _build_upload_response() returns schema metadata and preview rows
       │
       ▼
3. Calculate Statistics & Models
   • frontend: User clicks "Launch Full Analysis", calling executeFullAnalysis() in lib/api.ts
   • backend: analyze_dataset() in infera/main.py invokes run_full_analysis() in infera/analysis.py:
     a. compute_quality_profile() (infera/data_loader.py) audits missing, duplicates, and outliers
     b. compute_descriptive_statistics() (infera/statistics.py) computes mean, median, IQR, histograms
     c. compute_correlations() (infera/correlation.py) computes Pearson & Spearman r and p-values
     d. train_regression_models() (infera/regression.py) trains Linear, Ridge, and Random Forest pipelines
     e. generate_markdown_report() & generate_html_report() (infera/reporting.py) generate evidence reports
       │
       ▼
4. Return Result
   • analyze_dataset() caches the payload in RESULTS[dataset_id]
   • FastAPI serializes AnalysisResponse (defined in infera/models.py) as JSON
       │
       ▼
5. Display in Frontend
   • lib/api.ts validates the JSON payload with Zod (lib/response-schemas.ts)
   • DatasetWorkspace.tsx switches to AnalysisView.tsx
   • Tab components render metrics and charts (OverviewTab, StatisticsTab, MachineLearningTab, ExploreTab)
```

---

## 2. File Responsibilities

| File | Exact Responsibility |
| --- | --- |
| `infera/main.py` | FastAPI routes, local loopback checks, in-memory cache (`DATASETS`, `RESULTS`), and session ownership |
| `infera/models.py` | Pydantic data schemas defining every API input and output structure |
| `infera/data_loader.py` | File decoding (CSV, XLSX, Parquet, JSON), input bounds checking, schema inference, and data quality auditing |
| `infera/analysis.py` | Coordinates the pipeline: quality → statistics → correlations → regression → discovery → reports |
| `infera/statistics.py` | Computes column metrics (mean, std, IQR, skewness, kurtosis) and histogram bins using pandas & SciPy |
| `infera/correlation.py` | Computes pairwise Pearson and Spearman correlation coefficients and significance p-values |
| `infera/regression.py` | Preprocessing inside folds, 80/20 holdout evaluation, 5-fold CV selection, and feature importances |
| `infera/exploration.py` | Filtered descriptive group summaries, time trends, and pairwise relationship scatter sampling |
| `infera/reporting.py` | Generates standalone Markdown and HTML reports from analysis results |
| `frontend/lib/api.ts` | Browser HTTP client with session tokens, timeout handling, error classifications, and schema parsing |
| `frontend/components/DatasetWorkspace.tsx` | Main interface for uploading files, inspecting initial schema, and selecting target variables |
| `frontend/components/AnalysisView.tsx` | Analysis dashboard organizing findings into 7 inspectable tabs |

---

## 3. Recommended Study Order

1. **`infera/main.py`**: Trace the route decorators `@app.post("/api/upload")` and `@app.post("/api/analyze")`.
2. **`infera/data_loader.py`**: See how `load_csv()` and `validate_dataframe()` guard against bad inputs.
3. **`infera/statistics.py`**: Learn how pandas Series are summarized into numeric distributions.
4. **`infera/regression.py`**: Observe how scikit-learn pipelines avoid data leakage by fitting imputers and scalers only on training folds.
5. **`infera/analysis.py`**: See how pure Python functions are chained together to build an end-to-end analytical result.

---

## 4. Practical Exercises for Learners

1. **Add a Range Metric**:
   Extend `calculate_numerical_column_stats` in `infera/statistics.py` to calculate `range_val = max_val - min_val`. Add `range_metric: float | None` to `NumericalColumnStats` in `infera/models.py`.

2. **Add a Missingness Flag**:
   In `inspect_columns` in `infera/data_loader.py`, flag columns where more than 50% of values are null. Verify how the UI and reports represent this.

3. **Single-Column Statistics Route**:
   Add a `@app.get("/api/datasets/{dataset_id}/columns/{column_name}")` endpoint in `infera/main.py` that returns the descriptive stats of just one column.

4. **Baseline Dummy Regressor**:
   In `infera/regression.py`, add `DummyRegressor(strategy="mean")` to `candidates` to benchmark whether Ridge and Random Forest actually outperform the simplest possible baseline.
