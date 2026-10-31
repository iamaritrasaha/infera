# Infera Learner's Guide

Welcome to the internal source code guide for **Infera**.

This guide is written for beginner-to-intermediate Python learners. It explains how the application is designed, how requests move through the code, and how you can independently explore, debug, and extend it.

---

## 1. What Infera Does

Infera is an automated data science analysis engine.

When you give Infera a dataset (such as a CSV file of housing prices, student test scores, or retail sales), it performs four primary tasks:

1. **Data Quality Audit**: Checks for missing values, duplicate rows, data types, and extreme outliers.
2. **Descriptive Statistics**: Calculates central tendencies (mean, median), spread (standard deviation, IQR), and distribution shape (skewness, kurtosis, histogram bins).
3. **Correlation Discovery**: Measures how numerical columns move together using Pearson and Spearman correlation coefficients.
4. **Predictive Modeling**: If a numeric target variable is specified (like `price`), it automatically benchmarks three scikit-learn algorithms (Linear Regression, Ridge Regression, and Random Forest) to predict the outcome.
5. **Evidence Reporting**: Generates a clean Markdown and HTML report summarizing all findings.

---

## 2. What Each Important File Does

The refactored code lives in the `infera/` folder. Every file has one primary responsibility:

| File | Primary Responsibility |
| --- | --- |
| `infera/models.py` | Defines data schemas using Pydantic (what inputs look like, what outputs look like). |
| `infera/data_loader.py` | Reads CSV files safely into pandas DataFrames, inspects column types, and audits data health. |
| `infera/statistics.py` | Computes mathematical summaries (mean, median, standard deviation, quartiles, histograms). |
| `infera/correlation.py` | Computes pairwise correlations between numerical columns and explains them in plain English. |
| `infera/regression.py` | Trains machine learning models (Linear, Ridge, Random Forest) using scikit-learn. |
| `infera/reporting.py` | Assembles findings into clean, readable Markdown and HTML text reports. |
| `infera/analysis.py` | The master conductor that calls the modules above in order and packages the final result. |
| `infera/main.py` | The FastAPI web server that defines URL routes and handles HTTP requests. |

---

## 3. Where the Application Begins

The application starts in **`infera/main.py`**.

When you run:
```bash
uv run uvicorn infera.main:app --reload
```

Here is what happens:
1. Python executes `infera/main.py`.
2. Line 35 initializes the FastAPI application object:
   ```python
   app = FastAPI(title="Infera", version="0.5.0", ...)
   ```
3. CORS middleware is attached so web browsers can connect.
4. Two in-memory dictionaries are initialized:
   - `DATASETS: dict[str, tuple[pd.DataFrame, str]] = {}` (stores uploaded datasets)
   - `RESULTS: dict[str, dict[str, Any]] = {}` (stores computed analysis results)
5. FastAPI registers all endpoint functions decorated with `@app.get` and `@app.post`.
6. The web server (Uvicorn) starts listening on `http://127.0.0.1:8000`.

---

## 4. How a CSV Upload Travels Through the Application

Here is the exact lifecycle of a dataset from file upload to analysis:

```text
[User Browser / curl]
       │
       ▼  1. POST /api/upload (sends raw CSV bytes)
[infera/main.py: upload_csv_file()]
       │
       ▼  2. Calls load_csv(content)
[infera/data_loader.py: load_csv()]
       │  - Validates non-empty & size limit
       │  - Reads into pd.DataFrame
       │
       ▼  3. Stores df in DATASETS[dataset_id]
[infera/main.py: returns UploadResponse]
       │
       ▼  4. POST /api/analyze {"dataset_id": "...", "target_column": "price"}
[infera/main.py: analyze_dataset()]
       │
       ▼  5. Calls run_full_analysis(df, name, user_target)
[infera/analysis.py: run_full_analysis()]
       ├──► inspect_schema(df)                (infera/data_loader.py)
       ├──► compute_descriptive_statistics(df)(infera/statistics.py)
       ├──► compute_correlations(df)          (infera/correlation.py)
       ├──► train_regression_models(df)       (infera/regression.py)
       └──► generate_markdown_report(payload) (infera/reporting.py)
       │
       ▼  6. Saves payload in RESULTS[dataset_id]
[infera/main.py: returns AnalysisResponse]
       │
       ▼  7. Browser renders dashboard & charts!
```

---

## 5. Which Functions Call Which Other Functions

Here is the straightforward call graph:

- **`infera.main.upload_csv_file`**
  - calls `infera.data_loader.load_csv`
  - calls `infera.data_loader.get_dataset_schema`
  - calls `infera.data_loader.calculate_health_score`
  - calls `infera.data_loader.inspect_columns`

- **`infera.main.analyze_dataset`**
  - calls `infera.analysis.run_full_analysis`
    - calls `infera.data_loader.get_dataset_schema`
    - calls `infera.data_loader.compute_quality_profile`
    - calls `infera.data_loader.calculate_health_score`
    - calls `infera.statistics.compute_descriptive_statistics`
      - calls `infera.statistics.calculate_numerical_column_stats`
      - calls `infera.statistics.calculate_categorical_column_stats`
    - calls `infera.correlation.compute_correlations`
      - calls `infera.correlation.classify_correlation`
      - calls `infera.correlation.explain_correlation`
    - calls `infera.regression.train_regression_models`
      - calls `infera.regression.prepare_regression_data`
      - calls `infera.regression.train_and_evaluate_single_model`
    - calls `infera.reporting.generate_markdown_report`
    - calls `infera.reporting.generate_html_report`

Notice there are **zero circular dependencies**, no hidden listeners, and no background event queues. Everything is a normal, synchronous Python function call.

---

## 6. What Each Function Receives and Returns

Understanding function contracts is key to reading code. Here are the core signatures:

### Data Loading (`data_loader.py`)

```python
def load_csv(source: bytes | str | Path) -> pd.DataFrame:
    """Receives: Raw file bytes or file path.
    Returns: A validated pandas DataFrame with whitespace-stripped column names.
    Raises: ValueError if the file is empty or malformed.
    """

def calculate_health_score(df: pd.DataFrame) -> int:
    """Receives: A pandas DataFrame.
    Returns: An integer from 0 to 100 representing data cleanliness.
    """
```

### Statistics (`statistics.py`)

```python
def calculate_numerical_column_stats(series: pd.Series, column_name: str) -> NumericalColumnStats:
    """Receives: A single pandas Series containing numbers.
    Returns: A NumericalColumnStats object with mean, median, min, max, std, IQR,
             skewness, kurtosis, and 10 histogram bins.
    """

def calculate_categorical_column_stats(series: pd.Series, column_name: str) -> CategoricalColumnStats:
    """Receives: A single pandas Series containing categories or strings.
    Returns: A CategoricalColumnStats object with unique count, mode, mode frequency,
             and value count percentages.
    """
```

### Correlation (`correlation.py`)

```python
def compute_correlations(df: pd.DataFrame, numerical_columns: list[str]) -> CorrelationResult:
    """Receives: A DataFrame and a list of numerical column names.
    Returns: CorrelationResult containing 2D Pearson/Spearman matrices and
             ranked top positive and negative correlation pairs.
    """
```

### Regression (`regression.py`)

```python
def train_regression_models(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: list[str] | None = None,
) -> ModelingResult:
    """Receives: A DataFrame, the target column to predict, and optional feature columns.
    Returns: ModelingResult containing benchmark comparison table, R² scores,
             MAE, RMSE, residuals, and feature importances for Linear, Ridge,
             and Random Forest regressors.
    """
```

---

## 7. How to Run and Debug Locally

### Running the API

```bash
uv run uvicorn infera.main:app --reload --port 8000
```
`--reload` means every time you edit and save any `.py` file, the server automatically restarts with your changes!

### Using the Interactive Swagger UI

Open [http://localhost:8000/docs](http://localhost:8000/docs) in your browser. You can click any endpoint (e.g. `POST /api/samples/housing/load`), click **Try it out**, and click **Execute** to see real requests and responses.

### Debugging with `breakpoint()`

Python has a built-in interactive debugger called `pdb`. To pause execution and inspect variables:

1. Insert `breakpoint()` anywhere in the code. For example, in `infera/regression.py`:
   ```python
   def train_regression_models(...):
       breakpoint()  # Execution will pause here
       X, y, selected_features = prepare_regression_data(...)
   ```
2. Trigger the action via the browser or a test.
3. Your terminal will stop at the prompt `(Pdb)`.
4. You can type variable names like `X.shape`, `y.head()`, or run Python code interactively! Type `c` to continue or `q` to quit.

### Running Specific Tests

Run a single test file:
```bash
uv run pytest tests/test_statistics.py
```

Run a specific test function by name:
```bash
uv run pytest tests/test_regression.py -k "test_linear_regression"
```

---

## 8. How to Modify Existing Features

### Example: Changing the Train/Test Split Ratio

Open `infera/regression.py`. Find line 192:
```python
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
```
If you want to use a 70/30 split instead of 80/20, change `test_size=0.2` to `test_size=0.3`.

### Example: Changing the Outlier Threshold

Open `infera/data_loader.py`. Find the outlier calculation in `compute_quality_profile`:
```python
lower_bound = q25 - (1.5 * iqr)
upper_bound = q75 + (1.5 * iqr)
```
The number `1.5` is John Tukey's standard IQR multiplier. To identify only extreme outliers, you can change `1.5` to `3.0`.

---

## 9. How to Add a Small New Feature

Let's walk through adding a **Median Absolute Deviation (MAD)** metric to numerical statistics:

1. **Open `infera/models.py`**:
   Add `mad: float | None = None` to the `NumericalColumnStats` class:
   ```python
   class NumericalColumnStats(BaseModel):
       column: str
       ...
       iqr: float
       mad: float | None = None  # <--- New field
   ```

2. **Open `infera/statistics.py`**:
   Compute MAD in `calculate_numerical_column_stats`:
   ```python
   # Median Absolute Deviation: median(|x - median(x)|)
   mad_val = float((clean_series - median_val).abs().median())
   ```
   Pass it to the return object:
   ```python
   return NumericalColumnStats(
       ...
       iqr=round(iqr, 4),
       mad=round(mad_val, 4),
   )
   ```

3. **Open `tests/test_statistics.py`**:
   Add an assertion:
   ```python
   assert stats.mad is not None
   ```

4. **Run the test**:
   ```bash
   uv run pytest tests/test_statistics.py
   ```
   You have just added and tested a new statistical calculation!

---

## 10. Key Python Concepts Used in Infera

To read and write code in Infera, here are the core Python building blocks you should review:

1. **Type Hints (`str`, `int`, `list[str]`, `dict[str, Any]`):**
   Helps you know what each parameter is expected to be without guessing.
2. **List Comprehensions (`[c for c in cols if ...] `):**
   A concise, readable way to filter and transform lists.
3. **Pandas Series and DataFrames:**
   - `df["column"]`: Selects a column (Series).
   - `series.mean()`, `series.dropna()`, `series.quantile(0.25)`.
4. **Pydantic Models (`BaseModel`):**
   Validates data types automatically and converts Python objects to JSON dictionaries via `.model_dump()`.
5. **FastAPI Route Decorators (`@app.get`, `@app.post`):**
   Associates a URL endpoint with a Python function.

---

## 11. Hands-On Learning Exercises

These five progressively challenging exercises will help you practice Python and understand Infera's internals.

### Exercise 1: Add a "Range" Metric to Numerical Statistics

- **Objective**: The range of a numerical column is the difference between its maximum and minimum value ($\text{Range} = \text{Max} - \text{Min}$). Add this calculation to Infera.
- **Files to Open**:
  - `infera/models.py` (add `range: float | None = None` to `NumericalColumnStats`)
  - `infera/statistics.py` (calculate `range_val = max_val - min_val` and populate the field)
- **Python Concepts**: Basic arithmetic, modifying Pydantic models.
- **How to Test**:
  Add an assertion in `tests/test_statistics.py`:
  ```python
  # For data [10, 20, 30, 40, 50], range should be 50.0 - 10.0 = 40.0
  assert stats.range == 40.0
  ```
  Run: `uv run pytest tests/test_statistics.py`.

---

### Exercise 2: Flag High Missingness Columns

- **Objective**: If a column has more than 50% missing values, it is rarely useful for analysis. Add a boolean flag `is_mostly_missing: bool` to each column summary.
- **Files to Open**:
  - `infera/models.py` (add `is_mostly_missing: bool = False` to `ColumnSummary`)
  - `infera/data_loader.py` (in `inspect_columns`, set `is_mostly_missing = null_percentage > 50.0`)
- **Python Concepts**: Boolean logic, threshold comparison.
- **How to Test**:
  Create a test DataFrame with 3 nulls out of 4 rows and assert `summary.is_mostly_missing is True`.
  Run: `uv run pytest tests/test_data_loader.py`.

---

### Exercise 3: Add a "Very Strong" Correlation Category

- **Objective**: Currently, correlations with $|r| \ge 0.7$ are classified as "strong". Add a higher tier: if $|r| \ge 0.9$, classify it as "very strong".
- **Files to Open**:
  - `infera/correlation.py` (update `classify_correlation` function)
- **Python Concepts**: `if / elif / else` control flow, constant definitions.
- **How to Test**:
  In `tests/test_correlation.py`, verify `classify_correlation(0.95)` returns `("very strong", "positive")`.
  Run: `uv run pytest tests/test_correlation.py`.

---

### Exercise 4: Add Decision Tree Regressor to Model Benchmarking

- **Objective**: Add `DecisionTreeRegressor` from `scikit-learn` to the list of candidate models in `infera/regression.py`.
- **Files to Open**:
  - `infera/regression.py`
  - Import: `from sklearn.tree import DecisionTreeRegressor`
  - Add `("decision_tree", "Decision Tree Regressor", DecisionTreeRegressor(max_depth=5, random_state=42))` to `candidate_models` list in `train_regression_models()`.
- **Python Concepts**: Machine learning model instantiation, tuples, lists.
- **How to Test**:
  Run `tests/test_regression.py` and verify `len(result.models) == 4`.

---

### Exercise 5: Build a Single-Column Analysis Endpoint

- **Objective**: Create a new API route `GET /api/datasets/{dataset_id}/columns/{column_name}` that returns the statistics for just that specific column.
- **Files to Open**:
  - `infera/main.py`
  - Define a new endpoint function:
    ```python
    @app.get("/api/datasets/{dataset_id}/columns/{column_name}")
    def get_column_analysis(dataset_id: str, column_name: str):
        # 1. Fetch df from DATASETS
        # 2. Check if column_name in df.columns
        # 3. Call calculate_numerical_column_stats or calculate_categorical_column_stats
        # 4. Return result
    ```
- **Python Concepts**: FastAPI path parameters, dictionary lookups, conditional routing.
- **How to Test**:
  Write a test in `tests/test_api.py` calling the endpoint and checking `response.status_code == 200`.
  Run: `uv run pytest tests/test_api.py`.
