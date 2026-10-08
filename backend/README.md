# Infera Python engine and API

Independently created and maintained by Aritra Saha. FastAPI exposes real dataset profiling, SciPy/Statsmodels statistical analysis, scikit-learn model comparisons, evidence templates, and Markdown/HTML reports.

Install runtime dependencies with `pip install -r requirements.txt`, then `pip install -e '.[dev]'` for development. From this directory, use `pytest -q tests` and `ruff check .`. Run one worker with `uvicorn app.main:app --host 127.0.0.1 --port 8000`.

See the root [README](../README.md) for limits and methodology and [DEPLOYMENT](../DEPLOYMENT.md) for Render deployment. Uploaded datasets are temporary and require anonymous session ownership. No external LLM or paid API is required.
