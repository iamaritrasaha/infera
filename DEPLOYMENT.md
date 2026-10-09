# Infera deployment guide

Infera runs a Next.js frontend on Vercel and a Python/FastAPI analysis service on Render. It uses deterministic Python analysis and does not require paid APIs or paid hosting. Free-tier sleep, resource limits, and temporary storage still apply.

## Verified production configuration (9 October 2026)

- Repository: [iamaritrasaha/infera](https://github.com/iamaritrasaha/infera), branch `main`.
- Frontend: [infera-omega.vercel.app](https://infera-omega.vercel.app), served by the existing Vercel `infera` Next.js project. Production deployment for commit `abd96ff5d8b871078dcaa2b9dad352585cd1e111` is READY.
- Backend: [infera-backend-tjg3.onrender.com](https://infera-backend-tjg3.onrender.com), existing Render service `srv-db405tei0phs73egmstg`, Free plan, Oregon, one Uvicorn worker. Current live deploy `dep-db4ag4jbc2fs73b6epe0` runs commit `abd96ff5d8b871078dcaa2b9dad352585cd1e111`.
- `GET /health` returns HTTP 200 with the FastAPI health payload. Render's configured health path is `/health`.
- The service builds from the repository root so `sample_data/` stays available; it installs pinned requirements from `backend/requirements.txt` and starts `app.main:app` on `0.0.0.0:$PORT` with one worker. Python 3.12.3 and the scientific dependencies installed successfully.
- Vercel Production's `NEXT_PUBLIC_API_URL` is `https://infera-backend-tjg3.onrender.com`. CORS permits the exact production frontend origin and the session header.
- GitHub's combined deployment status on the verified commit shows only the intended Vercel success check. The extra Vercel project named `backend` was disconnected from Git and retained; it is not part of the production request path.
- No paid service, database, disk, external AI API, or additional hosting resource was provisioned.

## Render backend: current Git connection and deployment

The existing service is still using its public-repository source. Its Settings > Build > Source editor offers a Git Provider tab with **Connect Git provider**, while the Public Git Repository tab is the current source type. The service's `On Commit` setting alone did not deploy the verified push. Render documents that public-URL sources do not provide the normal Git-triggered auto-deploy integration.

To enable automatic deployments without replacing the service or its URL, the account owner must:

1. Open the existing service's [Render settings](https://dashboard.render.com/web/srv-db405tei0phs73egmstg/settings).
2. Under **Build > Source**, select **Edit > Git Provider > GitHub**.
3. Complete GitHub's Render-app authorization for `iamaritrasaha/infera`, then select that repository and branch `main` when returned to Render.
4. Keep **Auto-Deploy: On Commit**, the existing Free plan, blank root directory, and current build filters (`backend/**`, `render.yaml`). Verify that the next push starts a deployment and that its commit matches GitHub.

The GitHub authorization step must be completed by the account owner in the browser. Do not paste credentials or OTPs into chat. Until this is done, use the existing service's **Manual Deploy > Deploy latest commit**, then inspect the deployed SHA, build/runtime logs, `/health`, and a real analysis. A push to the public-repository source is not proof of an automatic Render deployment. The Render and Vercel deployments are independent.

## Render service settings

| Setting | Value |
| --- | --- |
| Plan | Free |
| Runtime | Python |
| Branch | `main` |
| Root directory | Blank (repository root) |
| Build command | `cd backend && pip install -r requirements.txt && pip install --no-deps .` |
| Start command | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1` |
| Health check path | `/health` |
| Python | 3.12.3 |
| Build include filters | `backend/**`, `render.yaml` |

Keep the root directory blank because the sample catalog uses the repository's `sample_data/`. Render supplies `$PORT`; do not replace it with a fixed port. `render.yaml` records the service's resource and CORS configuration. Limits include one concurrent analysis, bounded rows and payloads, and single-threaded native numerical libraries to reduce memory and CPU pressure.

## Vercel frontend

Keep using the existing `infera` project; do not attach the Python service to Vercel. Its production configuration is Next.js with the repository's frontend root. `NEXT_PUBLIC_API_URL` must contain the real Render HTTPS origin without `/api`. Next.js embeds the value during build, so rebuild after changing it. The extra `backend` Vercel project is unused and must remain disconnected from Git unless the architecture changes deliberately; it was not deleted.

For later frontend changes, verify the Vercel production deployment and alias independently from Render. On commit `abd96ff`, the GitHub check list contained the frontend Vercel success check only.

## Production verification

Check the API directly before relying on the website:

```bash
curl --fail --max-time 130 https://infera-backend-tjg3.onrender.com/health
curl --fail --max-time 130 https://infera-backend-tjg3.onrender.com/api/samples
```

The first request after an idle period can take over a minute on Render Free. The frontend uses bounded retries for the cold-start window, shows distinct starting, connected, temporarily unavailable, deployment failure, and incompatible-response states, and provides a manual retry. It never substitutes a fabricated health response or a production localhost URL.

Then use the public frontend to load a sample, run an analysis, read its evidence, and download the Markdown and HTML reports. Confirm the browser requests go to the Render origin, allowed CORS is exact, and the session header remains on protected dataset/result/report requests. A 200 from Vercel alone does not prove the backend works.

Render Free services may sleep after inactivity and restart without preserving in-memory datasets/results. Caches and session-owned results are temporary. Monitoring sampled about 196 MiB during the verified housing workflow against the service's 512 MiB memory limit; this is not a large-file or concurrency stress test. See [Render Free service limits](https://render.com/docs/free), [Git-backed web services](https://render.com/docs/web-services), [health checks](https://render.com/docs/health-checks), and [deploys](https://render.com/docs/deploys).

Created and maintained by Aritra Saha.
