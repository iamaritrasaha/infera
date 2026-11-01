<p align="center"><img src="assets/infera-icon.svg" width="64" height="64" alt="Infera icon"></p>

# Infera

**Turn data into evidence.**

Infera is an open-source data analysis platform that turns structured datasets into inspectable statistical findings, visualizations, predictive models, and downloadable evidence reports. It is independently created and maintained by **Aritra Saha**.

I built Infera to make statistical analysis and machine learning accessible without writing extensive processing code for every dataset. Its Python-first engine performs the computations; the Next.js interface presents the results and their limitations.

> Infera doesn't guess. It computes, validates, and explains.

## Available analysis

- **CSV datasets:** Upload a CSV or generate a synthetic housing dataset to explore the application.
- **Data overview:** Row and column counts, column types, missing values, unique values, and a ten-row preview.
- **Descriptive statistics:** Count, mean, standard deviation, minimum, quartiles, median, and maximum for numeric columns.
- **Pearson correlations:** Ranked relationships between numeric columns and a visual correlation matrix.
- **Linear regression:** Choose a numeric target, train a scikit-learn model, and inspect coefficients, actual-versus-predicted values, R², MAE, MSE, and RMSE.
- **Reports:** Download a Markdown report with the computed results.

The current code supports one regression algorithm rather than an automated comparison of many algorithms. Previous releases offered other analyses; those implementations remain available in Git history.

## Architecture

```text
Browser: Next.js + React + TypeScript
    |
    | HTTP requests
    v
FastAPI (infera/main.py)
    |
    +-- pandas (infera/analysis.py)
    |     CSV parsing, statistics, correlations, reports
    |
    +-- scikit-learn (infera/ml.py)
          Linear regression and model evaluation
```

The frontend renders results computed by Python. Infera does not require an external AI API or a database.

## Repository structure

| Path | Purpose |
| --- | --- |
| `infera/main.py` | FastAPI application, uploads, dataset cache, endpoints |
| `infera/analysis.py` | CSV parsing, statistics, correlations, and Markdown reports |
| `infera/ml.py` | Train and evaluate linear regression |
| `frontend/app/` | Next.js page, layout, and styling |
| `frontend/components/` | Upload form, results display, navigation |
| `frontend/lib/api.ts` | Browser requests to FastAPI and response types |
| `tests/` | Python API and analysis tests |
| `frontend/tests/` | Browser end-to-end tests |
| `assets/`, `frontend/public/` | Brand and interface assets |
| `sample_data/` | Synthetic example data and a generator |

The repository also contains historical release reports, deployment configurations, and a compatibility `backend/` directory from earlier versions. They are not the starting point for the current application.

## Local development

Requirements: Python 3.11 or newer, [uv](https://docs.astral.sh/uv/), Node.js, and npm.

From the repository root, install Python dependencies and start the API:

```powershell
uv sync --frozen --extra dev
uv run uvicorn infera.main:app --host 127.0.0.1 --port 8000 --reload
```

In a second terminal, start the frontend:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. API documentation is available at `http://127.0.0.1:8000/docs` and the health endpoint at `http://127.0.0.1:8000/health`.

The frontend reads `NEXT_PUBLIC_API_URL` from `frontend/.env.local`. If the API address changes, update the value and restart the frontend.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health`, `/api/health` | Check API status |
| POST | `/api/upload` | Upload and analyze a CSV |
| POST | `/api/sample` | Generate a sample housing dataset |
| POST | `/api/regression` | Train linear regression for a selected target |
| GET | `/api/report/{dataset_id}` | Download the Markdown report |

## Methodology and limits

- CSV uploads are limited to 20 MiB, 100,000 rows, and 100 columns.
- Datasets and the latest regression result are held in process memory and disappear when the API restarts.
- Linear regression uses an 80/20 train/test split. Missing predictor values are imputed using means fitted on training data only.
- A random split assumes independent observations and is not appropriate for every time series or grouped dataset. Correlation and model coefficients do not establish causation.
- The current API has no public-user authentication and uses permissive development CORS settings. Do not expose it to untrusted networks without hardening it first.

## Testing

From the repository root:

```powershell
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run ty check infera
```

From `frontend/`:

```powershell
npm run lint
npm run typecheck
$env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:8001'
npm run build
npx playwright install chromium
npm run test:e2e
```

The Playwright suite starts the API on port 8001 and the built frontend on port 3100. Ensure both ports are free.

## Releases and deployment

Earlier release and production-verification reports remain in the repository for reference. They describe the architecture and functionality of those historical releases, not necessarily the current implementation.

The current application can be developed and tested locally. Public deployment requires configuring a compatible backend and reviewing the API's security and operational limits; publishing the frontend alone does not deploy the Python service.

Created and maintained by **Aritra Saha**. Distributed under the [MIT License](LICENSE).
