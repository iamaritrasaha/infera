# Infera frontend

Next.js 16, TypeScript, Tailwind CSS, and the existing Infera mark. Independently designed and developed by Aritra Saha.

See the root [README](../README.md) for development/testing and [DEPLOYMENT](../DEPLOYMENT.md) for Vercel setup. Python calculations run in FastAPI, outside Vercel.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_API_URL` before production builds. For browser verification, build with `http://127.0.0.1:8001` and run `npm run test:e2e`; Playwright starts the real local API and Next.js server.
