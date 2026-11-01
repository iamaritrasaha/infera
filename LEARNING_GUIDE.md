# Infera Learning Guide

Welcome to Infera! This codebase is built to teach Python, pandas, FastAPI, and machine learning by reading and modifying clean, working code.

There are no confusing abstract layers, enterprise patterns, or hidden magic. Everything is plain functions, familiar standard libraries, and readable control flow.

---

## 1. The Architecture at a Glance

```text
infera/
    __init__.py    # Package version
    main.py        # FastAPI web routes and request handling (~200 lines)
    analysis.py    # pandas CSV parsing, descriptive stats, correlations, report (~225 lines)
    ml.py          # scikit-learn Linear Regression with proper train/test split (~130 lines)

frontend/
    app/
        page.tsx   # Single main analysis page
        layout.tsx # Dark mode root layout with Navbar & Footer
    components/
        Upload.tsx # Drag-and-drop CSV upload and Sample loader
        Results.tsx# KPI cards, data tables, correlations, regression studio & SVG chart
        Navbar.tsx # Brand and live engine health indicator
        Footer.tsx # Simple footer
    lib/
        api.ts     # Direct fetch functions and TypeScript types

tests/
    test_analysis.py # Unit tests for parsing, statistics, correlations, and ML
    test_api.py      # HTTP route tests using FastAPI TestClient
```

---

## 2. The Data Journey: From CSV to Screen

### Step 1: Python Execution Starts
Execution begins in [`infera/main.py`](infera/main.py):
```bash
uv run uvicorn infera.main:app --reload
```
FastAPI creates the `app` instance, configures CORS middleware, and exposes HTTP endpoints:
- `GET /api/health` — Checks that the backend engine is running.
- `POST /api/upload` — Receives and analyzes an uploaded CSV file.
- `POST /api/sample` — Creates a built-in 120-row sample housing dataset for instant testing.
- `POST /api/regression` — Fits an ordinary least-squares Linear Regression model.
- `GET /api/report/{dataset_id}` — Returns a downloadable Markdown summary report.

### Step 2: FastAPI Receives the Uploaded File
In [`infera/main.py`](infera/main.py):
```python
@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    filename = file.filename or "uploaded.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files (.csv) are supported.")

    content = await file.read()
    df = read_csv(content, filename=filename)
    summary = compute_summary(df)
    correlations = compute_correlations(df)
    dataset_id = _save_dataset(filename, df, summary, correlations)
    return {
        "dataset_id": dataset_id,
        "filename": filename,
        "summary": summary,
        "correlations": correlations,
    }
```
`file: UploadFile` is an asynchronous file stream. FastAPI validates the file boundary and `await file.read()` extracts the raw bytes in memory.

### Step 3: pandas Reads and Analyzes the DataFrame
In [`infera/analysis.py`](infera/analysis.py):
1. **Reading CSV**:
   `io.BytesIO(file_bytes)` turns raw bytes into an in-memory stream, and `pd.read_csv()` parses it into a pandas `DataFrame`. We check that the dataset is non-empty, has at least 1 row, and does not exceed safety caps (100,000 rows, 100 columns).
2. **Computing Summary & Statistics**:
   `compute_summary(df)` iterates through the DataFrame columns:
   - For every column, it tracks data type (`series.dtype`), missing counts (`series.isna().sum()`), and unique count (`series.nunique()`).
   - For numeric columns, it calls `series.describe()` to get standard statistics: `count`, `mean`, `std`, `min`, `25%` (Q1), `50%` (median), `75%` (Q3), and `max`.
   - It captures the first 10 rows (`df.head(10)`) for preview in the UI.
3. **Computing Pearson Correlations**:
   `compute_correlations(df)` isolates columns where `pd.api.types.is_numeric_dtype` is true. It runs `df[numeric_cols].corr(method="pearson")` to get pairwise linear correlation coefficients ranging from -1.0 (strong negative) to +1.0 (strong positive).

### Step 4: How Linear Regression Works in Infera
In [`infera/ml.py`](infera/ml.py):
When the user clicks **Train Model** on a target column (e.g. `price`):
1. **Target and Feature Selection**:
   The chosen target column $y$ is isolated, and all other numeric columns become the feature matrix $X$.
2. **Train/Test Split (80% / 20%)**:
   ```python
   X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
   ```
   **Why this matters**: Evaluating a machine learning model on the same data it was trained on gives overly optimistic, dishonest results. An 80/20 train/test split reserves 20% of the data to test generalization.
3. **Imputation Without Data Leakage**:
   ```python
   imputer = SimpleImputer(strategy="mean")
   X_train_imp = imputer.fit_transform(X_train)
   X_test_imp = imputer.transform(X_test)
   ```
   Notice that `fit_transform` is called **only on `X_train`**. The test set is only transformed using the training means. The model never peeks at test statistics!
4. **Fitting the Model**:
   `LinearRegression().fit(X_train_imp, y_train)` calculates the Ordinary Least Squares line:
   $$y = \beta_0 + \beta_1 X_1 + \beta_2 X_2 + \dots + \beta_k X_k$$
5. **Evaluation Metrics**:
   We predict on `X_test_imp` and calculate:
   - **$R^2$ Score**: Proportion of variance in the target explained by the features ($1.0$ is perfect).
   - **MAE (Mean Absolute Error)**: Average dollar or unit difference between predicted and actual values.
   - **RMSE (Root Mean Squared Error)**: Standard deviation of residuals; gives heavier weight to large errors.
6. **Feature Coefficients & Chart Points**:
   The weights $\beta_i$ are extracted for each feature and sorted by absolute magnitude. Up to 50 test sample points (actual vs. predicted) are returned for plotting.

### Step 5: How Results Reach React
1. FastAPI serializes the dictionaries into a clean JSON response.
2. In `frontend/lib/api.ts`, `uploadCSV()` or `runLinearRegression()` uses standard browser `fetch()` to call the backend.
3. In `frontend/app/page.tsx`, React state holds the data:
   `const [dataset, setDataset] = useState<DatasetResponse | null>(null);`
4. When `dataset` is set, `Results.tsx` renders:
   - Metric cards (rows, columns, nulls, correlation pairs).
   - Data preview table and descriptive statistics table.
   - Pearson correlation ranking and correlation matrix heatmap.
   - Linear Regression studio with metrics, feature weight bars, and an inline SVG scatter plot showing the ideal $y=x$ reference line.
   - A single-click **Download Report (.md)** button calling `/api/report/{dataset_id}`.

---

## 3. Five Exercises You Can Build Independently

Here are five practical learning exercises to practice modifying this codebase yourself:

### Exercise 1: Add Spearman Rank Correlation
- **Goal**: Allow users to see Spearman correlation (which detects monotonic relationships) alongside Pearson (which detects linear relationships).
- **Where to edit**: In [`infera/analysis.py`](infera/analysis.py), modify `compute_correlations(df, method="pearson")` to accept `method`. In [`infera/main.py`](infera/main.py), accept an optional `?method=spearman` query parameter.

### Exercise 2: Add Median Absolute Error (MedAE)
- **Goal**: Compare MAE with MedAE, which is more robust to extreme target outliers.
- **Where to edit**: In [`infera/ml.py`](infera/ml.py), import `median_absolute_error` from `sklearn.metrics`. Add `"medae": round(float(median_absolute_error(y_test, y_test_pred)), 4)` to the `metrics` dictionary. Then display it in [`frontend/components/Results.tsx`](frontend/components/Results.tsx).

### Exercise 3: Add a Custom Train/Test Split Slider
- **Goal**: Let users choose the split ratio (e.g. 70/30, 80/20, or 90/10) from the UI.
- **Where to edit**:
  1. In `infera/main.py`, add `test_size: float = 0.2` to `RegressionRequest`.
  2. In `infera/ml.py`, pass `test_size` into `train_test_split()`.
  3. In `frontend/components/Results.tsx`, add a simple slider or radio buttons for test size!

### Exercise 4: Show Top Categories for Categorical Columns
- **Goal**: For non-numeric text columns, display the 3 most frequent categories and their counts.
- **Where to edit**: In [`infera/analysis.py`](infera/analysis.py#L51), within `compute_summary()`, if `not is_num`, compute `series.value_counts().head(3).to_dict()` and include it in `columns_info`. Display it in `Results.tsx`.

### Exercise 5: Add Ridge Regression (L2 Regularization)
- **Goal**: See how L2 regularization shrinks coefficients when features are collinear.
- **Where to edit**: In [`infera/ml.py`](infera/ml.py), import `Ridge` from `sklearn.linear_model`. Add a parameter `model_type: str = "linear"`. If `"ridge"`, fit `Ridge(alpha=1.0)`. Compare how the feature weights change!
