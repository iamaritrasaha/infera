# Infera production verification

Verified on 9 October 2026 (Asia/Kolkata). Infera is independently created and maintained by Aritra Saha.

## Live application

| Component | Verified URL | Status |
| --- | --- | --- |
| Frontend, existing Vercel Hobby project | https://infera-omega.vercel.app | Public HTTP 200; browser workflows pass without login or a bypass |
| Python backend, Render Free | https://infera-backend-tjg3.onrender.com | Live; real Python computations succeed |
| Health | https://infera-backend-tjg3.onrender.com/health | HTTP 200: status ok, project Infera, version 0.1.0 |
| Repository | https://github.com/iamaritrasaha/infera | Main branch; history preserved |

## What changed

1. Both Render connector links resolved to the same existing workspace. No service existed there. A single Free Python web service, `srv-db405tei0phs73egmstg`, was created from GitHub main, using the committed build/start commands and limits. No paid service, database, disk, worker, or subscription was added.
2. Python 3.12.3 installed the pinned scientific dependencies successfully. Runtime logs show one Uvicorn worker listening on `0.0.0.0:10000`, with Render supplying PORT. Initial deploy `dep-db405tmi0phs73egmu8g` became live from Git commit `6cd6a46`.
3. Vercel Production received the actual public origin as `NEXT_PUBLIC_API_URL`. Redeployment `dpl_5AFsTwawmQ38ZCYfNDgmSSUhbtYT` rebuilt commit `6cd6a46` with the variable, became READY, and acquired the stable production alias. The frontend root remains frontend; Python runs only on Render.
4. Vercel Authentication changed from protection of the production domain to Standard Protection. The stable domain is public; preview and generated deployment URLs remain protected. No access bypass is needed for the production tests.
5. Production CORS was configured for exactly the frontend origin. The application uses an anonymous session header, not cross-site session cookies. Cookie credentials are omitted. The random per-tab token stays in browser session storage and never enters dataset/report URLs.
6. Playwright now accepts an explicit deployed base URL, adds an actual Excel fixture workflow and an independent-browser ownership test, and writes local/production JSON summaries. A test observer initially attempted to read the upload response before its body was available; the corrected test obtains the dataset identifier from the actual analysis request, after the frontend has consumed and validated the upload response. This was a test timing issue, not a backend failure.
7. A push deployed automatically on Vercel but created no Render deployment. The directly created backend uses a public repository URL without connected Git provider credentials. Render's auto-deploy flag alone does not enable push-triggered deployment for this source. The final backend revision is deployed manually through the connector; future backend updates require Manual Deploy until the Git provider is connected. See [DEPLOYMENT.md](DEPLOYMENT.md) for exact account-linking steps.

## Tests executed and results

| Check | Observed result |
| --- | --- |
| pytest with one native thread | 65 passed in 18.37 seconds; one upstream TestClient deprecation warning |
| Ruff backend lint | Passed |
| Frontend ESLint | Passed |
| TypeScript `tsc --noEmit` | Passed |
| Production Next.js build | Passed locally and on Vercel |
| Local Playwright suite | 29 passed in 32.5 seconds, zero unexpected/flaky/skipped tests |
| Production-target Playwright suite | 29 passed in 173.0 seconds, zero unexpected/flaky/skipped tests |
| Allowed CORS preflight | HTTP 200; allow-origin exactly https://infera-omega.vercel.app; session header accepted |
| Unapproved CORS origin | HTTP 400 with no allow-origin header |
| Independent session access | Another browser session receives 404 for analysis, results, and HTML reports; owner receives 200 |
| Public frontend and backend health | HTTP 200 without account credentials |
| Browser console/network checks | No critical console/page errors or failed requests in normal workflows |
| Resource monitoring | Sampled memory maximum about 197.5 MiB against a 512 MiB limit; observed CPU limit 0.15 core |

The 29 checks contain 12 API client contracts and 17 browser tests. Availability/invalid-response failures are deliberately simulated and identified; normal analyses, uploads, and exports run through the deployed Render engine. Browser fixtures and bundled samples contain generated or synthetic data only. No private user dataset was used.

## Confirmed working through the public frontend

- Landing, About, dashboard navigation, independent creator attribution, Open Source badge, and the existing icon.
- All four sample datasets, recommended targets, upload previews, profiling, and data quality results.
- Actual CSV uploads, keyboard file selection, drag-and-drop, and Excel uploads.
- Descriptive statistics, hypothesis-test views, correlation charts, null/constant handling, skewed and large values. The Excel fixture's measurement mean is checked against its known value of -0.5.
- Housing and uploaded-data regression, baseline comparisons, R²/MAE/RMSE, residual and prediction charts. Housing displays a real selected Ridge holdout R² of about 0.9833, alongside the median baseline's -0.0221. These are synthetic-sample results, not a claim about real-world predictive performance.
- Binary churn and multiclass student classification, macro F1 and confusion matrices.
- Clustering and PCA charts, segment summaries, and explained sampling limits.
- Retail time-series diagnostics and their stated requirements.
- Evidence drawers, complete report previews, authenticated Markdown/HTML downloads, clipboard export, and browser printing.
- Safe rerun/retry behavior, invalid/empty uploads, insufficient-data explanations, and contained unavailable/invalid API responses.
- Responsive layouts at 375, 768, 1366, and 1920 px, with no whole-page horizontal overflow; keyboard tab navigation.

Screenshots and JSON summaries are local ignored artifacts in frontend/test-results. The production screenshots visibly show Engine Online and numerical model results. API preflights, uploads, analysis, and report requests also appear in Render's runtime logs. The error-filtered log query returned an unusable connector response; the unfiltered recent runtime logs were inspected successfully. No application source repair was needed after the accounts were connected and configuration was corrected.

## Reproduce the live suite

From frontend, after npm ci and installing Playwright Chromium:

```bash
INFERA_E2E_BASE_URL=https://infera-omega.vercel.app \
INFERA_E2E_API_URL=https://infera-backend-tjg3.onrender.com \
npm run test:e2e -- --output=test-results/production
```

The remote configuration starts no local servers. One worker keeps the tests within the backend's concurrency limit. The ownership test asserts the actual browser analysis request uses the expected Render origin. Generated test datasets expire or are evicted from the bounded temporary caches.

## Remaining limitations

- Render Free sleeps and can restart. Datasets/results are temporary, process-local, and expire or can be evicted. They are not permanent user accounts or storage.
- Render currently needs manual deployment after backend changes. Connecting GitHub credentials to the existing service requires a signed-in Dashboard session. Vercel's automatic deployment on main was observed successfully.
- The direct-creation connector cannot set the platform HTTP health-check path. The available browser is signed out of Render, so that setting remains at its default. Render readiness succeeded and the public /health endpoint was independently tested. Set Health Check Path to /health in service settings when Dashboard access is available, to match render.yaml's recommendation.
- Monitoring uses one-minute samples. This test is not a large-file/concurrency stress test, and does not prove every scientific native allocation remains below the memory limit.
- Only Chromium is covered; Firefox/WebKit, physical devices, and a naturally sleeping Render cold start remain separate checks.
- Transport-error contracts simulate specific HTTP/network failures. Real production CORS, ownership denial, successful uploads/computation/downloads, and invalid-input UI states were tested separately.
- Five high-severity transitive development lint advisories remain from the earlier audit. Runtime npm and pinned Python dependency audits were clean at that audit. Docker execution remains untested because Docker is unavailable locally.
- Printing exports the Markdown evidence preview. The HTML download is formatted, with an escaped complete methodology appendix.
- The prepared GitHub social-preview image still needs a signed-in repository settings upload. The GitHub README already uses the unchanged icon.
- Free service selection does not remove platform quotas or account-level overage behavior. No billing settings or payment methods were changed. Keep usage within included minutes/bandwidth for a strict ₹0 budget. [Render Free documentation](https://render.com/docs/free) and [build pipeline documentation](https://render.com/docs/build-pipeline) describe these constraints. No paid resources were provisioned during this task.

## Final repository and deployment revision

The reusable tests, Excel fixture, and deployment records are committed and pushed after verification. They do not alter the application computation or UI source from the fully tested revision. The final Git hash and post-push deployment checks are recorded in the task's final response, rather than a self-referencing document hash. Vercel deploys main automatically; Render's public repository source is deployed manually. Final checks verify matching revisions on both hosts and rerun the critical workflow after restart.

Created and maintained by Aritra Saha. Infera doesn't guess. It computes, validates, and explains.
