# Learning Infera

Start with **`infera/main.py`, function `upload_csv_file`**. Read its inputs and returned `UploadResponse`, then follow the calls you encounter.

## Study order

1. Functions, parameters, return values, conditions, loops and exceptions.
2. Lists, dictionaries, tuples, `None` and comprehensions.
3. Imports, packages, virtual environments and type hints.
4. pandas DataFrames/Series, column selection, missing data and aggregation.
5. Pydantic models and FastAPI route decorators.
6. Train/test splitting, leakage, scikit-learn pipelines and evaluation metrics.

## Important files

| File | Responsibility |
| --- | --- |
| `infera/main.py` | Routes, local-access checks, bounded dictionaries and ownership |
| `infera/models.py` | Input/output schemas; JSON `schema` aliases Python `dataset_schema` |
| `infera/data_loader.py` | File parsing, validation, schema inference, previews and quality |
| `infera/analysis.py` | Calls calculations in order and assembles the response |
| `infera/statistics.py` | Numerical/categorical summaries and histogram bins |
| `infera/correlation.py` | Complete-pair Pearson/Spearman coefficients and p-values |
| `infera/regression.py` | Numeric predictors, train-only preprocessing, CV selection and holdout errors |
| `infera/exploration.py` | Filters, group comparisons, time aggregation and relationships |
| `infera/reporting.py` | Markdown evidence and escaped HTML |
| `frontend/lib/api.ts` | Requests, errors, ownership headers and downloads |
| `frontend/lib/response-schemas.ts` | Runtime validation before charts render |
| `frontend/components/DatasetWorkspace.tsx` | Select/upload data and launch analysis |
| `frontend/components/AnalysisView.tsx` | Tabs, reruns, focus and saved snapshots |

## Trace a CSV request

1. Select a CSV. Local preview is an estimate; the backend validates the full file.
2. `uploadDatasetFile` builds `FormData` containing `file` and sends `POST /api/upload`.
3. `upload_csv_file` reads at most the limit plus one byte, then calls `load_dataset` and `load_csv`.
4. `load_csv` validates UTF-8, header names, row widths, shape and finite numbers, returning a DataFrame.
5. `store_dataset` saves it under a UUID. `UploadResponse` includes schema and JSON-safe preview rows.
6. Select a target and launch. `executeFullAnalysis` sends UUID, target/focus to `POST /api/analyze`.
7. `analyze_dataset` checks ownership, takes the analysis lock and calls `run_full_analysis`.
8. The coordinator computes quality, statistics, correlations and optional regression. The plan explains skipped analyses.
9. Regression splits first. Pipeline means/scales fit only training rows. CV refits the whole pipeline in each fold. Training CV chooses the model; holdout metrics measure unseen performance.
10. Reporting builds Markdown and escaped HTML. The endpoint validates/caches the result and sends JSON.
11. Zod checks fields, then React displays charts. Downloads use `/api/results/{id}/report?format=markdown` or `html`.

Follow functions, not fixed line numbers. Entirely missing numerical summaries use `None`/JSON `null`, not fabricated zeros. Sample variance/std use pandas' `ddof=1`; skewness/excess kurtosis use SciPy's default moment estimators. P-values do not prove causation. README.md describes model assumptions and removed capabilities.

## Windows debugging

Use README.md for setup and two-terminal startup. uv creates `.venv` and runs its interpreter without activation.

Open `D:\Development\infera` in VS Code. Install Microsoft's Python and Python Debugger extensions. Select `.venv\Scripts\python.exe` with **Python: Select Interpreter**, then choose **Debug Infera API** in Run and Debug. The included launch configuration starts Uvicorn without reload so breakpoints stay attached. Start the frontend separately.

Break in `upload_csv_file`; upload a tiny CSV; step into `load_dataset`. Inspect `filename`, `content`, `df.shape` and `df.head()`. Break in `run_full_analysis` and inspect `schema_dict`, `target_column` and `modeling_result`. In `train_and_evaluate_single_model`, compare train/test indices and inspect the fitted imputer under `pipeline.steps`.

Run one test with `uv run pytest tests/test_audit_regressions.py -k preprocessing -v`. README.md lists full lint/type/build/browser checks. Investigate failed assertions instead of deleting them.

## Five exercises (without solutions)

1. Add a numeric range metric. Handle an entirely missing column and test positive, negative, constant and missing inputs. Trace the Python schema through Zod and the UI.
2. Add a mostly-missing flag to upload summaries. Document the threshold and test immediately below, at and above it.
3. Add a one-column statistics endpoint. Validate ownership and column names; test numeric, categorical, unknown and evicted datasets.
4. Add a DummyRegressor baseline. Explain its use, keep holdout data out of selection, and test errors on known data.
5. Add an explicit clear-dataset action. Remove report/owner records too. Test that another browser session cannot clear someone else's data.
