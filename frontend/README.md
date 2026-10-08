# Infera frontend

Next.js 16, TypeScript, Tailwind CSS, and the existing Infera mark. Independently designed and developed by Aritra Saha.

See the root [README](../README.md) for development/testing and [DEPLOYMENT](../DEPLOYMENT.md) for Vercel setup. Python calculations run in FastAPI, outside Vercel.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_API_URL` before production builds. For browser verification, build with `http://127.0.0.1:8001` and run `npm run test:e2e`; Playwright starts the real local API and Next.js server.

The production site is https://infera-omega.vercel.app and its API is https://infera-backend-tjg3.onrender.com. Set `INFERA_E2E_BASE_URL` and `INFERA_E2E_API_URL` to those origins to run the same browser suite against production, without local servers. The remote suite uses only generated fixtures and bundled synthetic samples. Run one worker on Render Free. See the root deployment and production verification documents.
