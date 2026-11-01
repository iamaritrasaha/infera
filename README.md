# Infera

Infera is a local data-analysis learning application using Python, FastAPI, pandas, SciPy, scikit-learn and a Next.js/React dashboard. The canonical Windows workspace is `D:\Development\infera`.

## Windows setup (PowerShell 7)

Verified with Python 3.13.16, Node.js 26.13.0, uv 0.13.6 and PowerShell 7.6.5. Install uv and Node.js first. From the root:

```powershell
Set-Location D:\Development\infera
uv sync --frozen --extra dev
uv run uvicorn infera.main:app --host 127.0.0.1 --port 8000 --reload
```

uv uses `.python-version` and creates `.venv`; activation is unnecessary. Root `pyproject.toml` and `uv.lock` are authoritative. Do not create another environment under `backend`.

In a second terminal:

```powershell
Set-Location D:\Development\infera\frontend
npm ci
Copy-Item .env.example .env.local
npm run dev -- --hostname 127.0.0.1
```

Open [the dashboard](http://127.0.0.1:3000/dashboard), [API docs](http://127.0.0.1:8000/docs), or [health](http://127.0.0.1:8000/health). Stop with Ctrl+C. No Linux directory or WSL is needed.

The frontend reads `NEXT_PUBLIC_API_URL` from `frontend/.env.local`. Restart development or rebuild production after changing it. Backend limits are explicit constants in `infera/data_loader.py` and `infera/main.py`; legacy backend environment variables are not read. No credentials are needed.

## Functionality

- CSV, XLSX (first sheet), JSON records/table, Parquet uploads and four bundled samples.
- Schema detection, missing/duplicate/outlier profiles, numerical/categorical summaries, histograms and Pearson/Spearman correlations.
- Numeric regression with Linear Regression, Ridge and Random Forest. Missing predictors are imputed and standardized inside a scikit-learn pipeline fitted separately in every training fold. Missing targets are dropped.
- A fixed-seed 80/20 holdout; training five-fold CV selects the model. With 10-12 usable rows, CV is unavailable and fixed candidate order selects the fallback. Outputs include R-squared, MAE, MSE, RMSE, residuals and model-specific importance.
- Filtered group, trend and relationship exploration, focus controls, charts, browser snapshots and Markdown/HTML downloads.

Categorical predictors are excluded from regression; encode them deliberately when learning preprocessing. Identical modeling observations are deduplicated before splitting. Random splits assume independent observations; repeated-person or chronological observations can inflate scores. This is not forecasting. Importance describes a model, not causation. Linear coefficients are per training standard deviation. Correlation p-values are exploratory and unadjusted for multiple comparisons.

Classification, clustering, PCA, stationarity diagnostics and hypothesis-test suites were removed in refactor `80f2126`. They are recoverable in Git but **not implemented in this version**. The plan/report identify them as skipped. Descriptive time aggregation works through the explorer. Old frontend chart components remain for future work; null fields are not algorithm implementations.

## Architecture and request flow

`frontend/app/dashboard/page.tsx` renders `DatasetWorkspace`. `frontend/lib/api.ts` sends multipart `POST /api/upload` to `infera/main.py:upload_csv_file`. `data_loader.load_dataset` validates a file and returns a DataFrame. Upload returns a UUID and preview. `POST /api/analyze` sends UUID and optional target/focus to `analysis.run_full_analysis`. Statistics, correlations, optional regression and reports return together. Results/downloads use `/api/results/{dataset_id}`. Zod schemas in `frontend/lib/response-schemas.ts` validate JSON before charts render.

Nine functional Python modules plus `__init__.py`: main, models, data_loader, analysis, statistics, correlation, regression, reporting and exploration. `backend/app/main.py` is a compatibility import only. Install from the root.

## Checks

From the root:

```powershell
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run ty check infera
```

From `frontend`:

```powershell
npm run lint
npm run typecheck
$env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:8001'
npm run build
npx playwright install chromium firefox
npm run test:e2e
```

Playwright starts its own backend at 8001 and built frontend at 3100; both ports must be free. It uses native uv. Live production tests are skipped unless explicitly configured. See `docs/WINDOWS_AUDIT.md` for exact results and limitations.

## Local security and retention

Use one trusted user on one machine, loopback binding and **one Uvicorn worker**. Do not use a tunnel or reverse proxy. Middleware rejects non-loopback clients, unexpected Host headers and foreign browser origins. CORS permits the documented local frontend ports. A small owner map honors existing browser ownership headers without a session framework. Tokenless API clients share a local namespace; this is not public authentication.

Limits: 15 MiB/file, 5,000 rows, 100 columns, finite numeric magnitudes no greater than 1e50, and 50 MiB expanded XLSX/Parquet data. Eight datasets and their latest reports remain in FIFO process memory. Restarting clears them; no TTL or persistence. Concurrent model analyses receive 429. Parsing/modeling is bounded but not isolated from hostile local code. Browser snapshots persist independently until deleted in that browser.

Public deployment is unsupported. Legacy Render/Compose configurations are preserved under `docs/legacy/*.disabled`. Historical deployment reports describe old code. No public service was changed.

## Git and learning

Remote history is restored as `origin/main`; local refactor history remains on `master`. They are unrelated histories: do not blindly merge or force-push. Baseline: `backup/pre-audit-20261101`; repairs: `codex/windows-audit`. Recovery bundle: `D:\Development\infera-recovery-20261101.bundle`. Read `LEARNING_GUIDE.md` next.
