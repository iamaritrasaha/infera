# Infera deployment guide

Infera runs a Next.js frontend on Vercel and a Python/FastAPI analysis service on Render. It uses deterministic Python analysis and does not require paid APIs or paid hosting. Free-tier sleep, resource limits, and temporary storage still apply.

## Verified production configuration (9 October 2026)

- Repository: [iamaritrasaha/infera](https://github.com/iamaritrasaha/infera), branch `main`.
- Frontend: [infera-omega.vercel.app](https://infera-omega.vercel.app), served by the existing Vercel `infera` Next.js project. The v0.5 application code commit `2b2f8ff787d9315045bfd38c747427a66229d982` deployed successfully to Production (GitHub deployment ID `6963386420`, status ID `19524554203`).
- Backend: [infera-backend-tjg3.onrender.com](https://infera-backend-tjg3.onrender.com), existing Render service `srv-db405tei0phs73egmstg`, Free plan, Oregon, one Uvicorn worker. Deployment `dep-db4fo6oae00c73a2nkhg` is Live from the same v0.5 application code commit.
- `GET /health` returned HTTP 200 with version `0.5.0` and engine status `ready`. The live browser workflow also completed upload, analysis, exploration, and report export through the public frontend and Render API.
- The service builds from the repository root so `sample_data/` stays available; it installs pinned requirements from `backend/requirements.txt` and starts `app.main:app` on `0.0.0.0:$PORT` with one worker. Python 3.12.3 and the scientific dependencies installed successfully.
- Vercel Production contains `NEXT_PUBLIC_API_URL`; the live browser confirmed it resolves to `https://infera-backend-tjg3.onrender.com`. CORS permits the exact production frontend origin and the session header.
- The existing `infera` Vercel project is linked to GitHub and `main`; the extra Vercel project named `backend` is disconnected from Git and retained. It is not part of the production request path.
- No paid service, database, disk, external AI API, or additional hosting resource was provisioned.

## Render backend: current Git connection and deployment

The existing Render service is GitHub-linked to `iamaritrasaha/infera` on branch `main`, with **Auto-Deploy: On Commit**. Pushing the v0.5 application code started deployment `dep-db4fo6oae00c73a2nkhg` automatically; the dashboard showed **Auto-Deploy** and **Deploy succeeded | Live** for the exact pushed SHA. The Render service's include filters are `backend/**` and `render.yaml`, so frontend-only, documentation, and test changes do not trigger a backend deployment. Verify the deployed commit and service health after backend/runtime changes; a push alone is not proof of a successful deployment. Render and Vercel deployment lifecycles are independent.

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

For later frontend changes, verify the Vercel production deployment and alias independently from Render. On application code commit `2b2f8ff`, the Vercel Production deployment succeeded and the public alias was verified by the live Playwright workflow.

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
