# Infera deployment guide

Infera uses a separate Python/FastAPI backend and Next.js frontend. No paid APIs, persistent database, or paid hosting plan is required for this configuration. Free platform quotas and cold starts still apply.

## Verified state on 9 October 2026

- Repository: [iamaritrasaha/infera](https://github.com/iamaritrasaha/infera), branch `main`.
- Public frontend: [infera-omega.vercel.app](https://infera-omega.vercel.app). Anonymous requests return HTTP 200, and real browser workflows use the deployed API.
- Backend: [infera-backend-tjg3.onrender.com](https://infera-backend-tjg3.onrender.com), Render service `srv-db405tei0phs73egmstg` in the existing workspace. The running service plan is **Free**, with one Python worker. No database, disk, worker, paid API, or new paid infrastructure was created.
- The backend installed the pinned Python dependencies and listens on `0.0.0.0:10000`, using Render's supplied `$PORT`. [GET /health](https://infera-backend-tjg3.onrender.com/health) returns HTTP 200 with `status: ok`, `project: Infera`, and version `0.1.0`.
- Vercel Production has `NEXT_PUBLIC_API_URL=https://infera-backend-tjg3.onrender.com`. It was rebuilt after adding the variable. Next.js 16.4 builds successfully without Python files or scientific dependencies being packaged.
- Vercel uses Standard Protection: the stable production domain is public; preview and generated deployment URLs remain protected. Anonymous Playwright checks require no bypass token or login.
- Production CORS allows exactly `https://infera-omega.vercel.app` and the session header. An allowed preflight returned HTTP 200; an unapproved origin returned HTTP 400 without an allow-origin header.
- Local validation: 65 backend tests and 29 frontend checks pass. Production-target validation: 29 checks pass, including 17 browser tests and 12 API client contracts. Transport-failure simulations are explicitly identified in the tests. See [PRODUCTION_VERIFICATION.md](PRODUCTION_VERIFICATION.md).

## 1. Reuse the existing Render Free backend

Use the existing [Render service](https://dashboard.render.com/web/srv-db405tei0phs73egmstg). It builds GitHub `main` from a public repository URL. This connection requires a manual deploy: no deployment appeared after the verified push, despite the API's auto-deploy flag. Do not create a duplicate service for this deployment.

For subsequent backend updates, push the verified changes, open the existing service's Deploys page, and select **Manual Deploy > Deploy latest commit**. Inspect the deployed commit and logs, then verify `/health` and an actual analysis. [Render's deploy documentation](https://render.com/docs/deploys) confirms that public repository URLs require manual deployment until Git provider credentials are connected.

To enable automatic backend deployment, sign in to Render Dashboard, connect the GitHub account under Account Settings > Git Deployment Credentials, grant the Render GitHub app access to `iamaritrasaha/infera`, and select those credentials under the existing service's Settings > Git Credentials. Keep branch `main`, Auto-Deploy On Commit, and instance **Free**. Verify the next push actually creates a deploy before relying on automation. This account authorization cannot be completed through the available connector; the browser is currently signed out. Vercel already deploys pushes to `main` automatically.

`render.yaml` remains the reproducible configuration for a future Blueprint deployment. If intentionally recreating the infrastructure, use Render Dashboard > New > Blueprint, review the file, and verify the instance plan is **Free** before applying it. The connected service was created directly with the same runtime, build/start commands, resource variables, and production CORS.

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

The direct-creation connector does not expose the HTTP health-check-path setting, and the signed-out browser cannot edit the Dashboard. Render’s default readiness check successfully made this service live; `/health` is independently verified over HTTPS. To align the platform HTTP check with the Blueprint, set Health Check Path to `/health` in the service settings when Dashboard access is available. This does not require a paid plan.

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

The production domain is now public under Standard Protection, as requested. Keep the preview/generated URL protection policy unless intentionally changing it. The Vercel project API setting is `ssoProtection.deploymentType = prod_deployment_urls_and_all_previews`. [Vercel Authentication documentation](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication) describes this policy.

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

Vercel and Render free service terms/quotas apply. Billing settings and payment methods were not changed. Keep usage within included bandwidth and build minutes for a strict ₹0 budget; account-level automatic overage settings are separate from selecting the Free service plan. The default Starter build pipeline is distinct from a paid Starter web-service compute plan and includes monthly minutes on Hobby workspaces. [Render build pipeline documentation](https://render.com/docs/build-pipeline) explains included minutes and overages. These limits reduce resource use but cannot guarantee an entire scientific Python process stays within the free instance's memory allowance. The production browser suite has run on Render Free. Sampled memory during verification peaked at approximately 197.5 MiB against a 512 MiB limit. This is a one-minute monitoring sample, not a measured instantaneous peak or a large-dataset stress test. [Render free-service documentation](https://render.com/docs/free) describes current platform limits.

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
