<p align="center"><img src="assets/infera-icon.svg" width="64" height="64" alt="Infera icon"></p>

# Infera

**Turn data into evidence.**

Infera is an open-source automated data science platform that turns structured datasets into inspectable statistical findings, model comparisons, and downloadable evidence reports. It is independently created and maintained by **Aritra Saha**.

I built Infera to make statistical analysis and machine learning accessible without writing extensive processing code for every dataset. Its Python-first engine performs the computations; the Next.js interface presents the results and their limitations.

> Infera doesn't guess. It computes, validates, and explains.

## Live application

- Frontend: https://infera-omega.vercel.app
- Python API: https://infera-backend-tjg3.onrender.com
- API health: https://infera-backend-tjg3.onrender.com/health

The production site is publicly accessible and uses Render Free with the existing Vercel Hobby frontend. Live browser workflows, including CSV/Excel uploads and session isolation, have been verified. See [PRODUCTION_VERIFICATION.md](PRODUCTION_VERIFICATION.md) for evidence and limits.

## Available analysis

- Schema inference, missing values, duplicate records, identifier heuristics, cardinality, and IQR/Z-score outlier diagnostics.
- Descriptive statistics and histograms, Pearson/Spearman correlations, t-tests, Mann-Whitney U, ANOVA, Kruskal-Wallis, and chi-square tests.
- Regression: median baseline, linear, Ridge, Lasso, ElasticNet, random forest, and gradient boosting. Metrics include R², MAE, and RMSE.
- Classification: prior baseline, logistic regression, random forest, and gradient boosting. Metrics include accuracy, macro precision/recall/F1, weighted F1, ROC-AUC when applicable, and confusion matrices.
- K-Means/DBSCAN clustering, two-component PCA, and time-series ADF/autocorrelation diagnostics. No forecasts are generated.
- Expandable evidence drawers, Markdown/HTML report downloads, clipboard export, and browser printing to PDF.
- Four bundled **synthetic** examples: housing, customer churn, student performance, and retail sales. Their dimensions are read from the actual files.

Unavailable analyses are explained instead of supplied with invented scores. Schema, target, and health-score judgments are heuristics. Statistical tests are exploratory, use unadjusted p-values, and do not establish causation.

## Architecture

```text
Browser: Next.js 16 + TypeScript + Tailwind
    | HTTPS API requests with anonymous session ownership header
FastAPI + Pydantic
    | bounded temporary dataset and result caches
Python: Pandas + NumPy + SciPy + Statsmodels + scikit-learn
    | computed profiles, statistics, model evaluations, evidence templates
Dashboard and Markdown/HTML reports
```

All computation runs in the backend. The frontend does not require a paid API, external LLM, or database. Python dependencies belong on Render or the local machine; Vercel deploys only `frontend/`.

| Directory | Purpose |
| --- | --- |
| `frontend/app`, `frontend/components` | Pages, dataset workspace, charts, analysis tabs |
| `frontend/lib` | API client, TypeScript types, runtime response validation |
| `frontend/tests` | Playwright tests against the real local or deployed API |
| `backend/app/api` | Upload, sample, analysis, result, report, health endpoints |
| `backend/app/analysis` | Profiling, statistics, modeling, insights, reports |
| `backend/app/core`, `backend/app/services` | Configuration, stream limits, session ownership, caches |
| `backend/tests` | pytest integration and scientific regression tests |
| `sample_data` | Synthetic CSV samples and reproducible generator |
| `assets` | Existing Infera mark reused for GitHub |

## Local development

Requires Python 3.12 and Node.js 24 with npm. The audit used Python 3.12.3 and Node.js 24.21.0 on Linux. Runtime Python dependencies are pinned in `backend/requirements.lock`; the frontend uses `package-lock.json`.

```bash
git clone https://github.com/iamaritrasaha/infera.git
cd infera
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python -m pip install -e 'backend[dev]'
```

Start the API from the repository root:

```bash
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The API health endpoint is `http://localhost:8000/health`, and API documentation is `http://localhost:8000/docs`.

`NEXT_PUBLIC_API_URL` is a build-time public **origin**, such as `http://localhost:8000` locally. It must be set to the actual public HTTPS FastAPI origin for deployment. Missing production configuration produces a readable configuration error. Changing the environment variable requires a new frontend build.

## API and privacy

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/health`, `/api/samples` | Public service status/catalog |
| POST | `/api/upload`, `/api/samples/{sample_id}/load` | Anonymous session required |
| POST | `/api/analyze` | Session owning the dataset required |
| GET | `/api/results/{dataset_id}` | Session owning the dataset required |
| GET | `/api/results/{dataset_id}/report?format=markdown` or `html` | Session owning the dataset required |

The browser creates a 256-bit random token in session storage and sends `X-Infera-Session`. The backend stores its hash alongside the dataset. Knowing a dataset ID does not authorize access. Losing the session token requires uploading again; these sessions are not user accounts. Tokens never appear in report URLs.

Uploads are counted while streaming before multipart parsing, with a small multipart envelope allowance. Only one upload body and one heavy parse/profile/analysis operation are admitted at a time. Files are parsed from temporary buffers; multipart parsing may use temporary disk spooling, which is closed after processing. Dataset contents are not logged or permanently saved. Restarting the API clears all caches. Dataset caches expire after one hour of inactivity; result caches expire one hour after computation. Memory pressure can evict entries earlier.

## Limits and methodology

| Default limit | Value |
| --- | --- |
| Uploaded file | 15 MiB, CSV/XLSX/JSON/Parquet |
| Parsed table | 50,000 rows, 100 columns |
| Decoded dataset | 32 MiB |
| Dataset cache / result cache | 64 MiB each, at most 20 entries |
| Estimated encoded modeling memory | 32 MiB |
| Supervised modeling / PCA | Up to 5,000 eligible rows |
| Clustering | Up to 1,500 complete rows |
| Concurrent heavy operations | 1 |
| Admission wait | 10 seconds, then HTTP 429 |

For modeling, missing target values and duplicate predictor/target observations are removed before a deterministic holdout split. Classification uses stratification, checks rare classes, and applies class weighting to logistic regression and random forests. Imputation, scaling, and encoding fit on training data and are refitted within each cross-validation fold. Numeric holdout size is approximately 20%; class representation can increase it for small classification datasets.

Model selection uses available training CV scores, including the baseline. A CV failure is reported as unavailable. If every CV score is unavailable, holdout selection is explicitly labeled as potentially optimistic. The highest score among candidates does not establish useful real-world performance. Temporal and grouped independence are not modeled automatically; use domain-specific validation before relying on predictive results.

High-cardinality categorical predictors are excluded with disclosure. Encoding groups infrequent categories into at most 20 categories per feature. Modeling and clustering samples are deterministic and disclosed. Visualizations contain bounded samples, not every observation. PCA and clustering use complete numerical rows. ADF requires unique, regularly spaced timestamps.

## Testing

From the repository root:

```bash
backend/.venv/bin/pytest -q backend/tests
backend/.venv/bin/ruff check backend
```

For the real browser workflow, install Chromium and build for the test API port. Stop any servers using ports 8001 or 3100 first. Playwright starts its own backend and production frontend:

```bash
cd frontend
npm ci
npx playwright install --with-deps chromium
npm run lint
npm run typecheck
NEXT_PUBLIC_API_URL=http://127.0.0.1:8001 npm run build
npm run test:e2e
```

Tests cover sample selection, CSV upload/drag-and-drop, analysis tabs, regression/classification, PCA/clustering/time-series views, evidence drawers, report downloads, error/retry states, browser errors, and widths 375/768/1366/1920. Expected error simulations are separate from workflows using the real API. [AUDIT.md](AUDIT.md) records executed checks and unresolved infrastructure limitations.

To test the deployed application without starting local servers, run from `frontend/`:

```bash
INFERA_E2E_BASE_URL=https://infera-omega.vercel.app \
INFERA_E2E_API_URL=https://infera-backend-tjg3.onrender.com \
npm run test:e2e -- --output=test-results/production
```

These tests create temporary datasets from synthetic examples and generated fixtures. Run them serially on Render Free; do not point the suite at another deployment without authorization. The suite records browser errors and checks that API requests use the expected backend origin.

## Docker and free deployment

```bash
docker compose up --build
```

Open `http://localhost:3000`; the API is at `http://localhost:8000`. The browser-facing API URL is injected through the frontend Docker **build argument**, not a runtime environment variable. For another hostname, change the build argument and allowed backend origins before rebuilding.

The deployed free architecture is Vercel Hobby for Next.js plus Render Free for FastAPI. The stable frontend is public and connects to the verified backend origin. See [DEPLOYMENT.md](DEPLOYMENT.md) for settings and [PRODUCTION_VERIFICATION.md](PRODUCTION_VERIFICATION.md) for real browser results, session-isolation evidence, and remaining free-tier limitations.

Free service quotas, cold starts, and resource limits apply. Parser and native scientific-library allocations can exceed retained cache sizes, so these limits are safeguards rather than a guarantee of staying below a hosting memory cap. Anonymous concurrency limits are not distributed rate limiting or protection against sustained abuse. Docker execution and production analysis require verification on their actual infrastructure.

Created and maintained by **Aritra Saha**. Distributed under the [MIT License](LICENSE).
