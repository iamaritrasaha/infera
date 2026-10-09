# Infera production verification

Verified 9 October 2026 (Asia/Kolkata). Independently developed by Aritra Saha. Infera computes, validates, and explains; it does not call a paid AI service.

## Production state

| Component | Verified state |
| --- | --- |
| Frontend | [infera-omega.vercel.app](https://infera-omega.vercel.app), existing Next.js Vercel project, production READY on commit `abd96ff5d8b871078dcaa2b9dad352585cd1e111` |
| Backend | [infera-backend-tjg3.onrender.com](https://infera-backend-tjg3.onrender.com), existing Render Free Python service, live on the same commit |
| Render deployment | `dep-db4ag4jbc2fs73b6epe0`, live; service `srv-db405tei0phs73egmstg` |
| Health | `GET /health` returned HTTP 200 with the expected FastAPI payload |
| GitHub checks | The verified commit showed the intended Vercel success check only; the obsolete Vercel `backend` project is retained but disconnected from Git |
| Git history | Code commit `abd96ff5d8b871078dcaa2b9dad352585cd1e111` (`feat: surface evidence-backed dataset insights`) is pushed to `main` |

## Deployment diagnosis

The reported GitHub failure came from a second Vercel project named `backend` configured to deploy FastAPI. Its deployment failed with `FASTAPI_ENTRYPOINT_NOT_FOUND`. The architecture does not route production traffic through that project: the live frontend alias belongs to Vercel project `infera`, while the Python API origin is Render. Git was disconnected from only the unused `backend` Vercel project; the project was not deleted. New verified GitHub deployment status shows the intended frontend check.

The Render service was investigated separately. Its build installed pinned Python 3.12 dependencies successfully; runtime logs showed application startup and Uvicorn binding `0.0.0.0:10000` using Render's `$PORT`. There was no import crash, failed health check, startup model load, or out-of-memory event in the observed deployment. Startup monitoring was about 182–200 MB; the housing analysis sample was about 196 MiB against a 512 MiB limit. The first public request after more than 15 minutes without API traffic took 72.31 seconds to reach a healthy `/health` response. Render still reported `not_suspended`, so this is documented as a measured first-contact wake delay, not proof that the platform had suspended the service.

The confirmed deployment automation gap is source configuration: the existing service uses a public Git repository source, not an authenticated Render Git-provider connection. Its `On Commit` flag did not cause a deployment after the verified push. The successful deploy was triggered manually on the existing service. Render documents the public-source auto-deploy limitation. To enable automatic deploys, the account owner must authorize Render's GitHub app for `iamaritrasaha/infera` in the existing service's **Settings > Build > Source > Edit > Git Provider > GitHub**, select `main`, retain **On Commit**, and verify a subsequent push starts a deploy. The service, public URL, and Free plan can be preserved. Exact steps are recorded in [DEPLOYMENT.md](DEPLOYMENT.md). Do not share GitHub credentials or OTPs in chat.

## Production workflow after the idle interval

The browser used [the production frontend](https://infera-omega.vercel.app) and the actual Render origin after the idle interval. It verified:

- `/health` recovered after 72.31 seconds from the first request. The successful health request took about 16.3 seconds after recovery began.
- The sample catalog and housing sample load returned HTTP 200. The real analysis POST returned HTTP 200 in 12.946 seconds; the response had three ranked findings.
- CORS allowed exactly `https://infera-omega.vercel.app`; session ownership headers were present and a protected result read returned HTTP 200.
- Markdown report download returned HTTP 200 (23,970 bytes); HTML report download returned HTTP 200 (50,932 bytes). Both contained the nine insight-first report sections and creator attribution.
- No browser runtime errors occurred during this smoke workflow.

This was a real production analysis and report workflow, not a local test or a Vercel-only health check. The bounded frontend recovery window spans the observed delay. A Free service can still have platform-specific wake variation; one measurement is not a guarantee of every future cold start.

## Insight engine and interface

The Python analysis pipeline now adds a deterministic, bounded insight-discovery layer. It selects a small set of supported findings from numerical, date/time, and categorical evidence; it handles repeated timestamps and missingness, does not treat row order as chronology, ranks findings with coverage and interpretability considerations, and labels associations as non-causal. Findings carry computed evidence, plain-language interpretation, limitations, confidence, and a focused visualization. Model findings compare performance against a simple baseline and avoid claiming causal effects. Optional focus controls allow a user to select a metric, time column, group, or analytical question.

The overview begins with a dataset summary, key findings, context-relevant metrics, and a small number of explanatory charts. Data quality and schema details are available under diagnostics. Existing profiling, statistics, hypothesis tests, regression, classification, clustering, PCA, model comparisons, validation, and report functionality remain available in progressively disclosed technical sections. Markdown and HTML reports now start with an executive summary and findings, followed by trends, comparisons, relationships, statistical evidence, data quality, methodology, and limitations.

Before/after screenshots were captured from the public dashboard:

![Before: schema and quality metadata dominated the overview](/media/hrik/Hrik/Projects/Infera/artifacts/screenshots/infera-before.png)

![After: evidence-backed findings lead the overview](/media/hrik/Hrik/Projects/Infera/artifacts/screenshots/infera-after.png)

## Example computed from the housing sample

The tested 250-row synthetic housing sample produced these independently checked calculations:

- Median `price`: **764,550** (sample data contains no supported currency unit, so none is shown).
- Spearman association between `sqft_living` and `price`: **0.86356**, based on **249 complete rows**. This is a strong positive descriptive association in this synthetic sample; it does not establish causation.
- Median price difference between the `Excellent` and `Fair` condition groups: **272,200** (`872,200` versus `600,000`). This is a sample comparison, not a causal condition premium.
- On this synthetic sample's holdout split, the selected Ridge model had R² about **0.983** versus about **-0.022** for a median baseline. These metrics describe this split and dataset; they do not validate real-world generalization.

These values are computed from the fixture, not hardcoded example copy.

## Automated checks

| Check | Result |
| --- | --- |
| Backend Ruff | Passed |
| Backend pytest | 83 passed; one upstream Starlette TestClient deprecation warning |
| Frontend ESLint | Passed |
| TypeScript | Passed |
| Production Next.js build | Passed with `NEXT_PUBLIC_API_URL` set to the API origin |
| Local Playwright | 39 passed, including bounded cold-start recovery, explicit failure states, analysis workflows, exports, responsive layouts, and session isolation |
| Production browser smoke test | Real post-idle health recovery, analysis, ownership check, and both report downloads passed as detailed above |

The unit and browser suites include known synthetic patterns, empty/insufficient data, date ordering and repeated timestamps, failure responses, and owner-isolated result access. Production verification used a generated public sample, not private user data. A full production Playwright suite was not represented as run; the public production workflow was tested directly.

## Remaining limitations and required account action

- Render GitHub-provider authorization is still pending. Until the owner completes the source-link action in [DEPLOYMENT.md](DEPLOYMENT.md), deploy backend changes through the existing Render service's **Manual Deploy > Deploy latest commit** and verify the deployed SHA.
- Render Free can sleep/restart, and uploaded datasets, results, and caches are temporary and process-local. Do not use them as persistent storage.
- The observed memory figure is a monitoring sample, not an instantaneous peak or a large-dataset/concurrency stress test. Higher memory use remains possible for inputs near configured limits.
- Statistical findings are descriptive and bounded by the available data; they do not by themselves establish causality. Ambiguous metric, time, or group meaning can still benefit from user confirmation.
- Firefox/WebKit and physical-device browser tests were not run in this verification.

Created and maintained by Aritra Saha. Infera doesn't guess. It computes, validates, and explains.
