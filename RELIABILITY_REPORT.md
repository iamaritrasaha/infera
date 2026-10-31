# Infera v0.4.0 Reliability & Intelligence Engineering Report

**Project:** Infera  
**Tagline:** Turn data into evidence.  
**Developer:** Aritra Saha  
**Target Version:** v0.4.0  
**Budget:** Strict ₹0 (Render Free + Vercel Hobby, no paid infrastructure, no paid external APIs)  

---

## 1. Executive Summary

This report documents the investigation, root-cause resolution, and feature delivery for Infera v0.4.0. Prior versions exhibited a verified user-visible failure where visitors to the production website encountered:
> *"Engine temporarily unavailable"*  
> *"The analysis engine could not be reached."*  
> followed by *"Automatic checks have stopped."*

This failure occurred because Render Free instances spin down after 15 minutes of inactivity, taking 50 to 90 seconds to cold start. The frontend connection handler previously gave up after rigid bounded retry sequences, leaving the interface in a permanent error state and blocking all user interaction, even when the server subsequently became available. Furthermore, the backend initialization was weighed down by eager module-level imports of heavy scientific packages (`scikit-learn`, `scipy`, `statsmodels`) during FastAPI startup.

In v0.4.0, Infera decouples startup health checks from analytical heavy lifting, modernizes connection recovery with automatic visibility/online rechecks, adheres to the anti-gatekeeper principle (user actions are never permanently blocked by stale connection indicators), and introduces an intelligent insights-first exploration workflow.

---

## 2. Root Cause Analysis

| Factor | Mechanism | Production Impact | Fix Applied in v0.4.0 |
| :--- | :--- | :--- | :--- |
| **Render Free Inactivity Sleep** | Render spins down instances after 15m idle. Waking requires 50-90s. | HTTP 502/503 returned while Uvicorn initializes. | Bounded exponential backoff ([2s, 4s, 8s, 12s, 16s, 20s, 20s, 20s]) totaling ~102s. |
| **Eager Heavy Imports** | `app.main` eagerly imported heavy ML & stats modules during startup. | Prolonged container startup, risking port-binding timeouts on 512MB RAM. | Lazy-loaded analytical modules (`run_full_analysis`) on first request. Python startup time reduced by ~3.5x. |
| **Permanent UI Gatekeeper** | Connection state blocked user interaction when checks stopped. | Users could not upload files or explore data even after the backend awoke. | Anti-gatekeeper design: Uploads, sample runs, and local file previews remain accessible; rechecks trigger on user action. |
| **Stale State Recovery** | No listeners for network recovery or tab focus. | Returning to the tab left the page stuck on "Automatic checks have stopped." | Added `online` and `visibilitychange` event listeners to automatically retry when connectivity or tab focus returns. |
| **Diagnostic Opacity** | Users only saw generic "Unavailable" error with zero context. | No way to distinguish cold start, schema mismatch, or network outage. | Built expandable diagnostic drawer with state, attempt count, elapsed time, uptime, and latency metrics. |

---

## 3. Backend Architecture & Startup Optimization

### 3.1 Lazy Dependency Loading
- In `backend/app/services/analysis_service.py`, `run_full_analysis` is loaded lazily inside `execute_analysis`:
  ```python
  from app.analysis.pipeline.runner import run_full_analysis
  ```
- Fast endpoints (`GET /health`, `GET /api/samples`, `GET /api/diagnostic`) respond instantly without loading heavy ML trees.
- Module-level health score calculation was extracted into a lightweight module `backend/app/analysis/profiler/health.py`, eliminating cyclical dependencies and profiler bloat.

### 3.2 Safe Operational Telemetry (`/api/diagnostic`)
- Added `/api/diagnostic` (and `/diagnostic` fallback) returning sanitized operational metrics without exposing sensitive dataset contents or file paths:
  - `status`: "ok" | "degraded"
  - `project`: "Infera"
  - `version`: "0.4.0"
  - `uptime_seconds`: process uptime
  - `memory_mb`: process RSS memory in MB
  - `python_version`: runtime version
  - `max_concurrent_analyses`: 1 (Render Free constraint)
  - `environment`: "production" | "development"

### 3.3 Request Tracking & Headers
- Added ASGI middleware tracking `X-Request-ID` and `X-Response-Time-Ms` on all responses.

---

## 4. Frontend Engine Connection & UX Redesign

### 4.1 Connection State Machine
The connection system distinguishes 7 distinct operational states:
1. `CHECKING`: Non-blocking silent initial ping; keeps UI uncluttered.
2. `STARTING`: Displayed when waking from sleep with progress feedback (elapsed seconds and attempt count).
3. `CONNECTED`: Engine verified and responsive.
4. `DEGRADED`: Engine responding but under memory pressure or partial capability.
5. `TEMPORARILY_UNAVAILABLE`: Cold-start window exceeded; offers explicit "Retry connection" button and expandable diagnostics.
6. `DEPLOYMENT_ERROR`: Backend URL missing, 404 on `/health`, or schema version incompatibility.
7. `OFFLINE`: Browser has lost network connectivity (`navigator.onLine === false`).

### 4.2 Anti-Gatekeeper Principle
- The connection indicator is informational. A failed health check does **not** disable the file upload zone or sample selection.
- Users can choose files, view client-side previews, or select goals at any time. When they trigger analysis, a fresh connection attempt is made directly.

### 4.3 Safe Client-Side File Preview
- Uploading large or sensitive files is not forced upon connection wait.
- `UploadZone.tsx` safely parses the first 10 rows client-side and renders:
  `Client-side preview -- no data uploaded yet`
- Displays row count, column names, and sample values safely in browser memory.

### 4.4 Verified Instant Analysis Preview
- To ensure users can always experience Infera even before Render finishes waking, `SampleDatasets.tsx` provides an **Instant Preview** button with the pre-computed verified 250-row synthetic housing sales analysis matching `PRODUCTION_VERIFICATION.md`.

---

## 5. Intelligent Analysis Experience (v0.4.0)

### 5.1 Analysis Goal Selector
Users can declare an analytical intent prior to launching analysis:
- **Discover Insights** (default balanced exploration)
- **Trends over Time** (time-series patterns; includes honest explanation if no date column exists)
- **Compare Groups** (cross-category differences and distributions)
- **Explore Relationships** (numerical correlations and associations)
- **Predict Outcome** (target modeling, feature ranking, baseline benchmarking)
- **Explore Everything** (broad multi-category discovery)

### 5.2 Deterministic Candidate Detectors
Added 5 new evidence-backed candidate detectors in `backend/app/analysis/insights/discovery.py`:
1. `time-extremes`: Identifies peak and trough periods across chronological observations.
2. `category-concentration`: Calculates Pareto distributions (e.g. top categories accounting for >70% of observations).
3. `unusual-observations`: IQR and Z-score based identification of notable distribution tails.
4. `model-top-features`: Extracts and ranks top predictive features with relative importance percentages.
5. `model-weak-signal`: Emits explicit cautionary findings when model holdout R2 or Macro-F1 falls below reliable baseline thresholds.

### 5.3 Interactive Two-Variable Exploration
In `ExploreTab.tsx`:
- Two-variable comparative picker allowing ad-hoc bivariate distribution and scatter analysis.
- One-click analytical question chips ("Does X vary by Y?", "How are values distributed?").

### 5.4 Client-Side Chart PNG Export
In `InsightChart.tsx`:
- Built-in "Export PNG" button rendering high-DPI HTML5 Canvas/SVG to downloadable PNG images with transparent/dark theme background and clean margins.

---

## 6. Verification & Quality Assurance Matrix

### 6.1 Backend Test Results
- Total Tests: **89**
- Passed: **89** (100%)
- Failures: **0**
- Execution Time: ~16.1s
- Linter: Ruff check passed with 0 issues.

### 6.2 Playwright End-to-End Suite Results
- Total Tests: **39**
- Passed: **39** (100%)
- Suites Covered:
  - `api-contract.spec.ts`: 12 / 12 passed
  - `connection.spec.ts`: 9 / 9 passed (transient 503 recovery, cold-start backoff, bounded attempt halt, schema incompatibility, missing endpoint, responsive layouts 375px-1920px)
  - `workflows.spec.ts`: 18 / 18 passed (real CSV upload, focus re-computation, Excel ingestion, session isolation, sample benchmarks, skewed distributions)
- Viewports Verified: 375px (mobile), 768px (tablet), 1366px (laptop), 1920px (desktop).
- Horizontal Overflow: Zero page overflow across all tested resolutions.

### 6.3 Compliance Verification
- **Em-Dash Rule:** Verified `chr(8212)` is not present anywhere in codebase files (`.py`, `.ts`, `.tsx`, `.json`, `.css`).
- **Fake Numbers:** Zero invented statistics. Baseline metrics, CV scores, and p-values are strictly computed from real arrays.
- **Budget:** Strict ₹0 maintained. Zero paid cloud resources, zero third-party AI keys.
