# Infera v0.1.0 — Production Deployment Guide

> **Zero-Budget Architecture:** FastAPI Backend on **Render Free** + Next.js Frontend on **Vercel Hobby**. Total cost: **₹0 / $0**.

---

## Architecture Overview

```text
       Browser / Client
        ┌─────────────┐
        │ Next.js App │  (Deployed on Vercel Hobby)
        └──────┬──────┘
               │ HTTPS (NEXT_PUBLIC_API_URL)
               ▼
        ┌─────────────┐
        │ FastAPI API │  (Deployed on Render Free)
        └──────┬──────┘
               │ In-Memory Processing & Modeling
        ┌──────┴──────┐
        │ SciPy Engine│  (Zero external AI APIs, 512MB RAM safe)
        └─────────────┘
```

---

## Part 1: Backend Deployment (Render Free)

Render Free provides 512 MB RAM and 0.1 shared vCPU with HTTPS termination and automatic SSL certificates.

### Method A: Blueprint Deployment (Recommended)

1. Push your repository to **GitHub**.
2. Log into the [Render Dashboard](https://dashboard.render.com).
3. Click **New** → **Blueprint**.
4. Connect your GitHub repository.
5. Render will detect [`render.yaml`](./render.yaml) at the repository root and automatically populate:
   - **Service Name**: `infera-backend`
   - **Runtime**: Python 3.12
   - **Build Command**: `cd backend && pip install --upgrade pip && pip install .`
   - **Start Command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`
6. Click **Apply**.
7. Note your public backend URL (e.g. `https://infera-backend.onrender.com`).

---

### Method B: Manual Web Service Setup

If setting up without the Blueprint:

1. Click **New** → **Web Service** in Render.
2. Connect your repository.
3. Configure settings:
   - **Name**: `infera-backend`
   - **Region**: Oregon (or nearest to your audience)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install --upgrade pip && pip install .`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
4. Expand **Advanced Settings**:
   - **Health Check Path**: `/health`
5. Under **Environment Variables**, add:
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `PYTHON_VERSION` | `3.12.3` | Python runtime version |
   | `PORT` | `8000` | Fallback port (Render injects `$PORT` dynamically) |
   | `HOST` | `0.0.0.0` | Binds to all network interfaces |
   | `CORS_ORIGINS` | `https://<your-vercel-app>.vercel.app,http://localhost:3000` | Allowed origins |
   | `MAX_UPLOAD_SIZE_BYTES` | `15728640` | 15 MB file size limit |
   | `MAX_ROW_COUNT` | `50000` | Row ingestion limit |
   | `MAX_COLUMN_COUNT` | `100` | Column limit |
   | `MAX_CONCURRENT_ANALYSES`| `1` | Enforces 1 heavy analysis at a time to prevent OOM |
   | `ANALYSIS_SEMAPHORE_TIMEOUT_SECONDS` | `10` | Queue wait time before returning HTTP 429 |
   | `DATASET_CACHE_TTL_SECONDS` | `3600` | In-memory session lifetime (1 hour) |
   | `MAX_CACHED_DATASETS` | `20` | In-memory LRU session capacity |
6. Click **Create Web Service**.

---

## Part 2: Frontend Deployment (Vercel Hobby)

Vercel Hobby provides unlimited preview deployments and high-performance Edge routing for Next.js.

1. Log into the [Vercel Dashboard](https://vercel.com).
2. Click **Add New** → **Project**.
3. Import your GitHub repository.
4. Configure Project Settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click *Edit* and select `frontend`.
5. Under **Environment Variables**, add:
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://infera-backend.onrender.com` | **No trailing slash**. URL of your Render backend. |
6. Click **Deploy**.
7. Vercel will run `npm run build` using Next.js Turbopack and deploy in ~45 seconds.
8. Once deployed, copy your production Vercel domain (e.g. `https://infera.vercel.app`).
9. **Important**: Go back to your Render Dashboard → `infera-backend` → **Environment Variables**, update `CORS_ORIGINS` to include your exact Vercel URL, and trigger a quick redeploy.

---

## Part 3: Environment Variable Matrix

| Variable | Service | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Frontend | **Yes** | `http://localhost:8000` | Base URL of FastAPI backend. Must NOT have a trailing slash. |
| `PORT` | Backend | Auto | `8000` | Injected dynamically by Render. Backend reads this to bind port. |
| `HOST` | Backend | No | `0.0.0.0` | IP interface binding. Must be `0.0.0.0` in container environments. |
| `CORS_ORIGINS` | Backend | **Yes** | `*` | Comma-separated or JSON array of allowed origins for browser security. |
| `MAX_UPLOAD_SIZE_BYTES` | Backend | No | `15728640` | File upload ceiling (15 MB default). Prevents bandwidth & disk abuse. |
| `MAX_ROW_COUNT` | Backend | No | `50000` | Row count ceiling. Rejects oversized tables that would crash memory. |
| `MAX_COLUMN_COUNT` | Backend | No | `100` | Maximum column count to protect $O(M^2)$ correlation matrix footprint. |
| `MAX_CONCURRENT_ANALYSES`| Backend | No | `1` | Max concurrent heavy scikit-learn runs. Keep at 1 on 512 MB RAM. |
| `ANALYSIS_SEMAPHORE_TIMEOUT_SECONDS` | Backend | No | `10.0` | Maximum wait queue time before returning HTTP 429. |
| `DATASET_CACHE_TTL_SECONDS` | Backend | No | `3600` | In-memory session eviction timer (1 hour). |
| `MAX_CACHED_DATASETS` | Backend | No | `20` | In-memory LRU session capacity limit. |

---

## Part 4: Production Smoke-Test Checklist

Run through this checklist after deploying to verify system integrity:

```markdown
- [ ] 1. Health Probe
      curl -s https://<your-backend>.onrender.com/health
      Expect: {"status": "ok", "project": "Infera", "version": "0.1.0"}

- [ ] 2. CORS Preflight Check
      curl -I -X OPTIONS https://<your-backend>.onrender.com/api/samples \
        -H "Origin: https://<your-frontend>.vercel.app" \
        -H "Access-Control-Request-Method: GET"
      Expect: HTTP 200 with access-control-allow-origin header.

- [ ] 3. Sample Dataset Catalog
      Open frontend in browser. Verify sample cards appear on Landing & Dashboard.
      Click "Telecom Customer Churn" -> confirm instant profiling loads.

- [ ] 4. File Upload (CSV, JSON, XLSX, Parquet)
      Drag and drop a valid CSV dataset. Verify column overview table,
      missing values, and initial health score render immediately.

- [ ] 5. Oversized & Corrupted Upload Handling
      - Upload empty 0-byte file -> Expect: Clear error modal ("file is empty").
      - Upload invalid binary file -> Expect: Clear error modal ("unable to parse").
      - Upload file with >50,000 rows -> Expect: Graceful limit notice.

- [ ] 6. Statistical Analysis & Distributions
      Inspect "Explore" and "Statistics" tabs. Verify histograms, skewness,
      excess kurtosis, and correlation matrices display with p-values.

- [ ] 7. Supervised Modeling & Cross-Validation
      Click "Run Full Analysis":
      - Regression (e.g. Housing Prices): Verify all 7 models benchmarked with R²,
        RMSE, MAE, feature importances, and residual scatter plots.
      - Classification (e.g. Telecom Churn): Verify all 4 models benchmarked with F1,
        Accuracy, ROC-AUC, and Confusion Matrix.

- [ ] 8. Report Export & Download
      - Click "Export Evidence Report" -> download Markdown (.md).
      - Download Standalone HTML (.html) -> open in browser, verify clean CSS styling
        and absence of script execution (XSS-safe).

- [ ] 9. Concurrency & Rate Limiting
      Simultaneously trigger two analysis jobs in separate browser tabs.
      Verify the second job either waits smoothly or receives a polite HTTP 429
      notice without crashing the backend service.
```

---

## Part 5: Free-Tier Limitations & Operational Playbook

Be transparent with users regarding free-tier operational parameters:

1. **Inactivity Sleep Cycle**:
   - Render spins down free web services after **15 minutes** of inactivity.
   - When a user visits the frontend after idle, the first request wakes the backend, which takes **30 to 50 seconds**.
   - The Infera frontend includes automated wake detection and informs the user while the server starts up.
2. **In-Memory Transience**:
   - Infera intentionally operates with **zero persistent database storage** (ensuring ₹0 cost and complete data privacy).
   - Datasets exist only in memory during active sessions (1-hour TTL).
   - If the Render free container restarts or sleeps, existing session tokens are cleared. Users simply re-upload their dataset.
3. **Hardware Boundaries**:
   - RAM: **512 MB** total.
   - CPU: **0.1 shared vCPU**.
   - Infera enforces `MAX_CONCURRENT_ANALYSES=1`, `max_categories=20` on one-hot encodings, and `n_estimators=50` on tree ensembles to remain reliably within these boundaries.
