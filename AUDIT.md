# Infera audit: 9 October 2026

Created and maintained by Aritra Saha. This audit preserves the existing Python/FastAPI engine and Next.js frontend.

## Verified issues, in priority order

1. **Production connectivity:** Vercel has no environment variables; the client falls back to localhost in production. The creator confirmed Render is not deployed. Deployment `dpl_33bBxjkFtbpUDAT7feQj1riPC1RL` is READY at commit `4806303`, but that is not evidence of working analysis. Vercel Authentication protects the production domain.
2. **Dataset privacy:** dataset IDs alone authorize analysis, result access, and report download. No independent session ownership check exists.
3. **Resource limits:** upload bodies are fully read before validation; caches described as thread-safe have no locks or byte budget; categorical matrices and DBSCAN can exhaust free-tier memory.
4. **Scientific correctness:** CV failures reuse test scores and report zero uncertainty; correlation matrices initialize uncomputed pairs as perfect correlation; uniqueness marks continuous measurements as IDs; failed ADF tests invent a statistic and p-value. Duplicate observations may cross validation partitions.
5. **Broken/misleading UI:** dashboard sample links do not select samples; the landing page chooses the first target instead of the recommended target; static example scores appear as results; sample dimensions are fabricated; PCA and time-series results are computed but not shown; reports lack accurate table headings.
6. **Branding and accessibility:** About says “Why We Built Infera” and omits the creator. Mobile navigation has no compact layout, focus indicators are inconsistent, uploads are mouse-only, and download failures cannot be explained.
7. **Verification gaps:** original backend baseline is 27 passing tests. Frontend lint fails (14 errors, 36 warnings). No browser suite exists. Docker injects a build-time public variable at runtime.

## Repairs and their root causes

| Area | Root cause | Implemented repair |
| --- | --- | --- |
| Deployment | Missing Render service and public build variable; runtime Docker variable cannot change a Next.js browser bundle | Corrected Vercel project settings, documented actual provisioning steps, validated production API configuration, and added Docker build arguments. Python remains on Render. |
| Privacy | Dataset IDs were treated as authorization | Added separate random browser session credentials, hashed ownership checks on dataset/result/report routes, private response caching headers, and cross-session tests. Credentials stay out of URLs. |
| Uploads | Size checks happened after the entire request was parsed | Added an ASGI streaming limit, early declared-size rejection, upload admission control, safe names, parser dimension/decoded-size checks, duplicate-header rejection, and compressed XLSX expansion limits. |
| Free-tier performance | Unbounded memory caches, category encoding, and concurrent native computation | Added locked TTL/LRU caches with byte budgets, shared heavy-work admission control, training/encoding limits, deterministic subset limits, one worker, and native thread limits. |
| Supervised models | Invalid targets and duplicates could reach splitting; failed CV reused holdout scores | Remove missing targets and duplicate observations before partitioning, reject unsuitable targets and rare classes, isolate preprocessing within CV folds, report unavailable CV as null, and compare real baseline models. |
| Statistical results | Undefined correlations/moments and failed ADF tests acquired fabricated values | Represent unavailable results as null, preserve tiny p-values and valid negative silhouette values, use scale-invariant correlation checks, and explain exploratory tests and ADF requirements. |
| Dashboard | Separate dashboard did not execute the actual upload/sample workflow | Reused the existing workflow as a shared component, fixed sample/target selection, connected all result tabs and exports, and removed fabricated example metrics. |
| Charts and reports | Missing result views, unsafe assumptions about numeric payloads, and incomplete/misaligned report tables | Added PCA/time-series views, finite-value guards, missing-correlation labels, chart error containment, complete metric tables and evidence, escaped HTML, and authenticated downloads. |
| Usability | Mouse-only uploads, mobile overflow risk, incomplete tab focus behavior and export feedback | Added keyboard uploads and tab navigation, focus/skip links, responsive layouts, explicit loading/error/empty states, safe retries, clipboard feedback, and printable report styles. |
| Identity | Public copy implied team ownership; navbar used a development-stage label and favicon differed from the website | Rewrote About and documentation for independent creator Aritra Saha, changed the badge to Open Source, removed maintained em dashes, and exported the existing website mark into all icon formats without redesigning it. |
| Reproducibility | No browser tests and unpinned production scientific dependency installation | Added real Python-backed Playwright workflows and API contracts, expanded pytest coverage, and committed the tested Python 3.12 runtime lock. |

No working analysis method was replaced with mock data. The four existing synthetic sample files remain explicitly described as examples. No external LLM, paid service, database, or account subscription was added.

## Validation executed

The original backend baseline had 27 passing tests. Final validation used Python 3.12.3, Node 24, Next.js 16.4, and Playwright Chromium. Frontend browser tests start a real FastAPI server and a production Next.js server.

| Check | Final observed result |
| --- | --- |
| `.venv/bin/python -m pytest -q` from `backend/`, with native threads limited to one | **65 passed**; one upstream Starlette TestClient deprecation warning |
| `backend/.venv/bin/ruff check backend` | Passed |
| `npm run lint` from `frontend/` | Passed, zero errors/warnings |
| `npm run typecheck` | Passed |
| `NEXT_PUBLIC_API_URL=http://127.0.0.1:8001 npm run build` | Passed; Next.js production routes and icons generated |
| `npm run test:e2e` | **27 passed**: 12 API client contracts and 15 real browser workflow checks |
| `npm audit --omit=dev` | Zero known production dependency vulnerabilities |
| Full `npm audit` | Five high-severity findings in the development lint dependency chain; see remaining issues |
| `uvx pip-audit --no-deps --disable-pip -r backend/requirements.lock --progress-spinner off` | No known runtime Python vulnerabilities |
| `uv pip check --python backend/.venv/bin/python` | Installed packages compatible |
| `uv build --wheel backend --out-dir /tmp/infera-wheel-check` and wheel inspection | Passed; report SVG included in packaged application |
| `git diff --check` and changed-file credential-pattern scan | Passed |
| Maintained-source em dash scan and identical SVG regression test | Passed |
| Chromium responsive checks | 375, 768, 1366, and 1920 px; no whole-page horizontal overflow; screenshots visually inspected |
| Native browser printing | Button triggered beforeprint; generated housing report is nine A4 pages, with report title and content verified |

The local build embeds the **explicit test-only** API origin. It is not a deployable production configuration or proof of production connectivity. A deployment must rebuild from source with the actual Render HTTPS origin.

Backend tests cover all supported formats (CSV/XLSX/flat JSON/Parquet), invalid/empty/oversized uploads including chunked streaming, resource limits, schema inference, correlation correctness, train-only preprocessing, fold isolation, classification metrics, baselines, clustering/PCA/ADF edge cases, session isolation, safe retries, HTML injection protection, and report completeness. Every bundled sample runs through the full pipeline.

Browser checks exercise landing/About/dashboard navigation; samples; actual CSV upload, keyboard chooser and drag-and-drop; every analysis tab; baseline/model results, PCA/clustering/time series; evidence drawers; report downloads; clipboard and printing; keyboard tab navigation; icon routes; invalid API responses; unavailable backend retry; insufficient-data explanations; and skewed, missing, constant, negative and large values. Normal workflows produced no critical console/page errors or failed network requests. Intentional failure tests simulate unavailable or invalid API responses and assess their user messages.

## Deployment status and external blockers

- Existing frontend: https://infera-omega.vercel.app. Vercel reports the original deployment READY at `4806303`; authenticated inspection returned HTTP 200. Public access requires Vercel Authentication. That verifies the old frontend response, not the new source changes or analysis.
- Vercel project settings were accepted as Next.js with `frontend` root, `npm install`, `npm run build`, default output, and source files outside root disabled. Existing deployment logs already excluded Python backend files and showed a successful Next.js build. A future deployment still requires its own log and HTTP checks.
- Vercel has no configured `NEXT_PUBLIC_API_URL`. The creator explicitly confirmed that **Render is not deployed**. No backend URL is invented, and no production upload, statistics, models, report download, CORS handshake, or cold start can be verified until it exists.
- Render account/deployment access was unavailable. Exact Free-plan creation, environment, CORS, health-check, and smoke-test steps are in [DEPLOYMENT.md](DEPLOYMENT.md).
- GitHub social preview is prepared as `assets/infera-social-preview.png`, using the unchanged website icon. The available browser is signed out and cannot open repository settings. The README icon can be published through Git; the settings upload remains a separate manual step.
- Docker is not installed on the audit machine. Container configuration was inspected and Python packaging tested; Docker build/run remains unverified.

## Remaining issues and practical limitations

1. **Production integration is blocked by missing infrastructure.** Provision Render Free, verify its real URL, set the Vercel public build variable, rebuild, and run the documented live workflow checks. Until then the live application cannot perform analysis.
2. **Development dependency advisory:** full npm audit reports five high-severity transitive findings through `braces` / `micromatch` / `fast-glob` / the Next.js ESLint configuration. The audited `braces` release has no patched version available. A forced audit fix would downgrade Next.js rather than supply a verified repair, so it was not applied. Production npm dependencies audited clean. Track [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and update the lint chain when a compatible fix exists.
3. **Privacy uses anonymous bearer sessions**, not user accounts. A leaked token grants access to its temporary datasets. Session/result storage is in memory for one worker, expires, and can be evicted sooner when memory budgets are reached. It is not persistent or distributed authentication/rate limiting.
4. **Resource bounds are practical safeguards**, not a measured guarantee for Render Free. Parsers and native scientific libraries can make transient allocations beyond cache budgets. Production load, peak memory, and cold-start duration remain unmeasured. Limits and deterministic subsampling are disclosed in results and documentation.
5. **Statistical limits remain explicit:** observational associations do not establish causation; exploratory p-values are unadjusted for multiple comparisons; model scores describe this partition; automatic task selection is heuristic. Temporal/group independence is not inferred for every possible dataset. Sampling can exclude observations and reduces scope. Undefined metrics stay unavailable.
6. **Browser coverage is Chromium at four viewport sizes.** Firefox, WebKit, physical mobile devices, and live deployment browser behavior remain separate checks.
7. **GitHub social preview requires a signed-in settings upload.** The existing icon was preserved and all assets prepared. No personal account avatar was changed.

## Git state

Changes were reviewed and validated on `hrik/infera-audit`, preserving the existing history from `480630379e4415d85ca8f894694b8c15c49dd1af`. Source commit and final publication status are recorded after committing below. Publication requires the creator's final confirmation, as requested in the Git rules.


- Validated source commit: `9db81d6bd3cb4b291bf583befddd78e792dc5d91`.
- GitHub push and production redeployment: pending final confirmation.
- The documentation commit is listed in Git history and the final task response; a document cannot include its own eventual commit hash.

## Files modified

The source commit changes 97 files; this audit adds the 98th. The complete source manifest is:

```text
.dockerignore
.env.example
.gitignore
DEPLOYMENT.md
LICENSE
README.md
assets/LUCIDE-LICENSE
assets/README.md
assets/infera-icon.png
assets/infera-icon.svg
assets/infera-social-preview.png
backend/.env.example
backend/Dockerfile
backend/README.md
backend/app/analysis/classification/runner.py
backend/app/analysis/clustering/runner.py
backend/app/analysis/dimensionality/pca.py
backend/app/analysis/explanations/provider.py
backend/app/analysis/pipeline/detector.py
backend/app/analysis/pipeline/planner.py
backend/app/analysis/pipeline/runner.py
backend/app/analysis/pipeline/validator.py
backend/app/analysis/profiler/distributions.py
backend/app/analysis/profiler/outliers.py
backend/app/analysis/profiler/schema.py
backend/app/analysis/regression/runner.py
backend/app/analysis/reporting/infera-icon.svg
backend/app/analysis/reporting/report.py
backend/app/analysis/statistics/correlation.py
backend/app/analysis/statistics/hypothesis.py
backend/app/analysis/timeseries/decomposition.py
backend/app/api/routes/analysis.py
backend/app/api/routes/results.py
backend/app/api/routes/samples.py
backend/app/api/routes/upload.py
backend/app/core/config.py
backend/app/core/limits.py
backend/app/core/security.py
backend/app/core/serialization.py
backend/app/main.py
backend/app/models/schemas.py
backend/app/services/analysis_service.py
backend/app/services/dataset_service.py
backend/app/services/profiling_service.py
backend/requirements.lock
backend/requirements.txt
backend/tests/test_api.py
backend/tests/test_audit_regressions.py
backend/tests/test_edge_cases.py
docker-compose.yml
frontend/.dockerignore
frontend/AGENTS.md
frontend/Dockerfile
frontend/README.md
frontend/app/about/page.tsx
frontend/app/apple-icon.png
frontend/app/dashboard/page.tsx
frontend/app/docs/page.tsx
frontend/app/favicon.ico
frontend/app/globals.css
frontend/app/icon.svg
frontend/app/layout.tsx
frontend/app/page.tsx
frontend/components/AnalysisView.tsx
frontend/components/DatasetWorkspace.tsx
frontend/components/Footer.tsx
frontend/components/Navbar.tsx
frontend/components/SampleDatasets.tsx
frontend/components/UploadZone.tsx
frontend/components/VisualizationBoundary.tsx
frontend/components/charts/ActualVsPredictedChart.tsx
frontend/components/charts/ClusterScatterChart.tsx
frontend/components/charts/ConfusionMatrixGrid.tsx
frontend/components/charts/CorrelationHeatmap.tsx
frontend/components/charts/FeatureImportanceChart.tsx
frontend/components/charts/HistogramChart.tsx
frontend/components/charts/ResidualChart.tsx
frontend/components/charts/TimeSeriesChart.tsx
frontend/components/tabs/DataQualityTab.tsx
frontend/components/tabs/ExploreTab.tsx
frontend/components/tabs/InsightsTab.tsx
frontend/components/tabs/MachineLearningTab.tsx
frontend/components/tabs/OverviewTab.tsx
frontend/components/tabs/ReportTab.tsx
frontend/components/tabs/StatisticsTab.tsx
frontend/eslint.config.mjs
frontend/lib/api.ts
frontend/lib/response-schemas.ts
frontend/lib/types.ts
frontend/package-lock.json
frontend/package.json
frontend/playwright.config.ts
frontend/public/infera-icon.png
frontend/public/infera-icon.svg
frontend/tests/api-contract.spec.ts
frontend/tests/workflows.spec.ts
render.yaml
AUDIT.md
```

Created and maintained by Aritra Saha.
