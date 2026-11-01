# Infera frontend

Use the root README.md for the canonical Windows setup and exact verification results. Python calculations run in the local FastAPI process.

In PowerShell: npm ci; Copy-Item .env.example .env.local; npm run dev -- --hostname 127.0.0.1.

Set NEXT_PUBLIC_API_URL before production builds. Local browser verification builds with http://127.0.0.1:8001, then npm run test:e2e starts the real backend and frontend. Live production tests remain opt-in; do not configure remote targets without approval. Public deployment is unsupported for the current backend.
