# Infera deployment guide

Infera uses a separate Python/FastAPI backend and Next.js frontend. No paid APIs, persistent database, or paid hosting plan is required for this configuration. Free platform quotas and cold starts still apply.

## Verified state on 9 October 2026

- Repository: [iamaritrasaha/infera](https://github.com/iamaritrasaha/infera).
- Frontend: [infera-omega.vercel.app](https://infera-omega.vercel.app), updated production deployment READY at validated commit `b566348` after the creator confirmed pushing to main. Authenticated About inspection returned HTTP 200 and verified the updated solo attribution, badge, and icon references. Public access is protected by Vercel Authentication.
- Updated deployment logs show a successful Next.js 16.4 build, exclusion of 71 backend files, and completed deployment. Missing backend infrastructure/configuration still prevents live analysis. Python scientific dependencies were not packaged by Vercel.
- Vercel environment inspection returned no variables, including no `NEXT_PUBLIC_API_URL`.
- The creator confirmed Render is **not deployed**. No backend public URL has been verified.
- Vercel settings were updated to Next.js, `frontend` root, `npm run build` (runs `next build`), `npm install`, framework-default output directory, and no source files outside the root. The platform accepted the update; the resulting production build and authenticated HTTP response have now been verified.
- Source changes are pushed to main and the updated frontend is live. See [AUDIT.md](AUDIT.md) for validation, deployment evidence, and remaining blockers. Backend workflows have been verified locally against real Python computation, not on Render.

## 1. Create the backend on Render Free

Use [Render Dashboard](https://dashboard.render.com) > New > Blueprint, connect this repository, and select the branch containing the validated changes. Review `render.yaml`, ensure the instance plan is **Free**, and apply it.

For a manual Web Service use these same settings:

| Setting | Value |
| --- | --- |
| Runtime | Python |
| Root Directory | Leave empty, so `sample_data/` remains available |
| Build command | `cd backend && pip install -r requirements.txt && pip install --no-deps .` |
| Start command | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1` |
| Health check | `/health` |
| Python version | `3.12.3` as audited; retest before changing |
| Instance | Free |

The root directory matters: the sample catalog reads the repository's `sample_data/` directory. Do not restrict the service checkout to `backend/`. Render supplies `PORT`; do not override it with a fixed local port.

Use the environment settings in `render.yaml`. In particular:

```text
CORS_ORIGINS=["https://infera-omega.vercel.app"]
MAX_CONCURRENT_ANALYSES=1
OMP_NUM_THREADS=1
OPENBLAS_NUM_THREADS=1
MKL_NUM_THREADS=1
MAX_MODEL_ROWS=5000
MAX_CLUSTER_ROWS=1500
```

Copy the **actual public service origin shown by Render** once it exists. No example hostname in this repository proves that a service exists. Inspect build/runtime logs and verify `/health` before configuring the frontend. Avoid logging uploaded data or session tokens.

## 2. Configure Vercel Hobby

Open the existing `infera` project rather than creating another project. Set:

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Root Directory | `frontend` |
| Include source files outside root | Off |
| Install command | `npm install` |
| Build command | `npm run build`, which runs `next build` |
| Output Directory | Framework default, leave override empty |
| Node.js | 24.x |

The root `.vercelignore` excludes `backend/`, `sample_data/`, `render.yaml`, and Docker Compose. There is no Vercel Services configuration. The `services` key in `render.yaml` is Render's Blueprint syntax and is unrelated to the Vercel framework preset.

Add `NEXT_PUBLIC_API_URL` to Production and any Preview environments you intend to test. Its value must be the actual Render **HTTPS origin**, without `/api`, credentials, queries, or fragments. A trailing slash is normalized. This is a public variable; never put credentials in it.

Redeploy the validated Git commit after setting the variable. Next.js embeds it during the build; changing a runtime variable alone does not repair an existing bundle. Read deployment logs and confirm no Python build or scientific dependencies appear.

Production currently requires Vercel Authentication. If the site is meant to be publicly accessible, review Project Settings > Deployment Protection and choose the intended access policy. The audit did not silently disable that account setting.

For a preview domain, add that exact origin to Render's `CORS_ORIGINS` only if it should access datasets. Avoid a wildcard. Production needs only the deployed production origin; local development origins can be configured separately.

## 3. Verify the actual deployment

Set the copied service origin locally in a task-specific shell variable:

```bash
INFERA_API_ORIGIN='paste-the-actual-https-origin-here'
curl --fail --max-time 90 "$INFERA_API_ORIGIN/health"
curl --fail --max-time 90 "$INFERA_API_ORIGIN/api/samples"
curl --include --request OPTIONS "$INFERA_API_ORIGIN/api/upload" \
  --header 'Origin: https://infera-omega.vercel.app' \
  --header 'Access-Control-Request-Method: POST' \
  --header 'Access-Control-Request-Headers: content-type,x-infera-session'
```

Health must return `status: ok`, `project: Infera`, and a version. The preflight must allow the exact frontend origin and session header. An unapproved origin must not receive an allow-origin header. HTTP success alone does not verify analysis.

In the real browser:

1. Open the dashboard and check the Network/Console panels. Confirm requests go to the copied Render origin and no private data appears in URLs.
2. Select Housing Prices, verify the recommended `price` target, run analysis, and visit every tab. Inspect R²/MAE/RMSE and baseline comparison.
3. Run customer churn and student performance. Inspect macro precision/recall/F1, ROC-AUC when applicable, confusion matrices, and imbalance warnings.
4. Run retail sales and inspect the time-series chart and the stated ADF limitations.
5. Upload a real CSV, test drag-and-drop, test empty/unsupported/oversized uploads, and confirm retry works.
6. Expand evidence, download Markdown and HTML, and verify all reported values agree with the dashboard.
7. Open an independent browser session. Its token must not be able to read the first session's dataset/results/reports even when the dataset ID is known.
8. Check 375/768/1366/1920 px widths, keyboard access, loading states, and charts. Allow internal tables/tab bars to scroll, without whole-page horizontal overflow.
9. Wait for a cold start or server restart, retry, and verify unavailable/expired results are explained accurately.

If Render cannot start, record the exact deployment error and keep production analysis marked unverified. If Vercel succeeds while Render is absent, only the frontend has deployed.

## Configuration and free-tier limits

Backend settings accept comma-separated or JSON-array CORS origins. `backend/.env.example` and `app/core/config.py` list upload, dimensional, decoded-memory, cache, encoding, model, and clustering limits. Do not raise them on a free instance without measuring memory and runtime.

Render Free can sleep after inactivity and restart without retaining datasets. A cold start may take around a minute; the UI explains that the engine may be starting or unavailable and provides a safe retry. Caches are temporary, bounded, and process-local. Use one Uvicorn worker, because multiple workers would not share sessions or result caches.

Vercel and Render free service terms/quotas apply. These limits reduce resource use but cannot guarantee an entire scientific Python process stays within the free instance's memory allowance. No production load test has been run while Render remains absent. [Render free-service documentation](https://render.com/docs/free) describes current platform limits.

## Docker

From the repository root:

```bash
docker compose up --build
```

The compose file bakes `http://localhost:8000` into the frontend for a local browser. The Docker service hostname `backend` is not a browser-reachable API origin. Use the external origin when hosting elsewhere, and rebuild after changing it. Do not copy `.env` secrets into an image.

Docker execution was unavailable on the audit machine because Docker was not installed. Container files were reviewed; a successful container build/run remains a separate verification step.

## Existing icon on GitHub

The repository README displays `assets/infera-icon.svg`, the same existing mark used by the app. `assets/infera-social-preview.png` (1280 × 640, the unchanged icon centered on the existing dark background) is available for Repository Settings > General > Social preview > Edit > Upload an image. GitHub repositories have no independently configurable avatar like a user account. The available browser reached GitHub’s signed-out 404 page for repository settings, so the social preview upload is pending. [GitHub’s documented upload steps](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview) require repository settings access; this is separate from committing the README asset. No personal GitHub avatar should be replaced as part of this task.

Created and maintained by Aritra Saha.
