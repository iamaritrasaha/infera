<p align="center"><img src="assets/infera-icon.svg" width="64" height="64" alt="Infera icon"></p>

# Infera

**A readable, beginner-friendly Python data science analysis engine.**

Infera is an open-source educational data science application built with **FastAPI**, **pandas**, **NumPy**, **SciPy**, and **scikit-learn**. It ingests CSV datasets, audits data quality, computes descriptive statistics, discovers correlations, benchmarks regression models, and generates evidence reports.

The codebase has been refactored specifically for human comprehension:
- **No overengineering**: No unnecessary background workers, dependency injection containers, abstract base classes, or complex session tokens.
- **Pure, straightforward Python**: Functions do one thing well, variable names are descriptive, and control flow is easy to trace.
- **Educational mathematical clarity**: Built-in explanations for what each calculation means, with an explicit reminder that correlation does not imply causation.

---

## Architecture Overview

```text
User uploads CSV (or picks bundled sample)
    ↓
FastAPI receives request (infera/main.py)
    ↓
Read & validate dataset into DataFrame (infera/data_loader.py)
    ↓
Master analysis coordinator (infera/analysis.py)
    ├─► Compute column metrics & histograms (infera/statistics.py)
    ├─► Pairwise Pearson & Spearman matrices (infera/correlation.py)
    └─► Benchmark Linear, Ridge & Random Forest (infera/regression.py)
    ↓
Generate Markdown & HTML report (infera/reporting.py)
    ↓
Return typed JSON payload (infera/models.py)
    ↓
Interactive Next.js Dashboard or Swagger UI (/docs)
```

---

## Directory Structure

```text
infera/
├── infera/                      # Core Python application package
│   ├── main.py                  # FastAPI server and HTTP endpoints
│   ├── data_loader.py           # CSV loading, validation, and quality auditing
│   ├── statistics.py            # Numerical & categorical descriptive stats
│   ├── correlation.py           # Pairwise Pearson & Spearman correlation
│   ├── regression.py            # Supervised modeling (Linear, Ridge, Random Forest)
│   ├── reporting.py             # Markdown and HTML report generation
│   ├── analysis.py              # Master pipeline coordinator
│   └── models.py                # Pydantic request and response schemas
├── tests/                       # Beginner-friendly pytest test suite
│   ├── test_data_loader.py      # Tests for CSV parsing and quality checks
│   ├── test_statistics.py       # Tests for mean, median, IQR, histograms
│   ├── test_correlation.py      # Tests for r = 1.0, r = -1.0, and interpretations
│   ├── test_regression.py       # Tests for R², MAE, RMSE, and feature importance
│   └── test_api.py              # Tests for FastAPI endpoints
├── sample_data/                 # Pre-loaded educational CSV datasets
│   ├── housing.csv              # Real estate regression (predict price)
│   ├── customer_churn.csv       # Subscriber churn dataset
│   ├── student_performance.csv  # Exam scores & study habits
│   └── retail_sales.csv         # Weekly department store transactions
├── frontend/                    # Optional Next.js browser interface
├── LEARNING_GUIDE.md            # Complete architecture walkthrough & exercises
├── pyproject.toml               # Python project configuration
└── README.md                    # This document
```

---

## Quick Start (Local Setup)

### Prerequisites

- Python 3.11, 3.12, or 3.13
- Package manager: [`uv`](https://github.com/astral-sh/uv) (recommended) or standard `pip`

### 1. Run the Python Backend

Using `uv` (recommended):

```bash
# Start the FastAPI server with auto-reload
uv run uvicorn infera.main:app --reload --port 8000
```

Or using standard `pip`:

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Start server
uvicorn infera.main:app --reload --port 8000
```

Open your browser to:
- **Interactive API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

### 2. Run the Test Suite

```bash
# Run all tests
uv run pytest

# Or with verbose output
uv run pytest -v
```

All 28 tests run in approximately 3 seconds using clear, readable synthetic datasets.

### 3. (Optional) Run the Next.js Frontend

If you want the visual graphical dashboard:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the interactive dashboard.

---

## How to Learn From This Project

Read [`LEARNING_GUIDE.md`](LEARNING_GUIDE.md) for:
1. A step-by-step trace of how a CSV request travels through the code.
2. An explanation of what every function receives and returns.
3. How to use a Python debugger (pdb / breakpoint).
4. **Five hands-on coding exercises** to practice modifying and extending Infera.
