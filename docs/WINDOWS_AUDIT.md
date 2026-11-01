# Windows audit and repair evidence

Audit date: 1 November 2026 (Asia/Calcutta). Canonical workspace: `D:\Development\infera`.

## Baseline and refactor claims

The working tree was clean at `80f21262f46ab2f48710a973225dc217092d1730`. A backup branch, `backup/pre-audit-20261101`, preserves that commit. Work is on `codex/windows-audit`.

| Claim | Independent finding |
| --- | --- |
| More than 35 backend modules simplified to about eight | Confirmed: `1af4cce` has 58 Python files under backend/app, 41 nonempty. `80f2126` introduces eight functional infera modules plus package init and retains a backend import shim. Repairs add one cohesive exploration module. |
| Endpoints and storage simplified | Confirmed: direct DATASETS/RESULTS dictionaries; separate session/security/TTL/service/concurrency modules deleted. |
| Statistics, correlations, regression and reports reorganized | Confirmed; implementations existed but had correctness and contract defects listed below. |
| Legacy analysis removed | Confirmed: classification, clustering, PCA, stationarity and formal hypothesis-test suites deleted. Explorer endpoints also disappeared while their UI remained. |
| Learning guide created | Confirmed in the refactor diff, but contained stale function references and solved exercises. Rewritten against actual code. |
| 28 tests and Ruff passed | Reproduced: 28 passed, one dependency deprecation warning; Ruff lint passed. Ruff format check failed on eight files. The old backend tests were deleted: 92 test definitions remain recoverable in `1af4cce`, not in the active suite. |

Serena and a general Context7 connector were unavailable in this session. Workspace files, Git objects/diffs, installed source/docs and executable tests were inspected directly instead. API guidance was checked against [scikit-learn's leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html) and [Playwright's context options](https://playwright.dev/docs/api/class-testoptions). Next.js's bundled installation documentation was read before frontend edits. No claim relies on Antigravity's report alone.

## Confirmed defects and repairs

- Missing previews emitted NaN instead of JSON null. Infinite numbers and extreme magnitudes could break statistics/serialization. Entirely missing numeric columns falsely reported zero extrema/quartiles. These paths now return null summaries or clear validation errors.
- Header trimming could create duplicate columns. pandas could interpret malformed row widths unexpectedly. UTF-8, NULs, headers, row widths and shape now have explicit validation.
- The frontend advertised four upload formats while the new backend accepted only CSV. XLSX/JSON/Parquet loading is restored through one loader, reusing bounded validation. Archive/Parquet expansion is checked.
- Boolean columns could enter numeric outlier arithmetic. They now receive categorical profiling. Date inference checks actual parseability rather than only the first five date-shaped strings.
- Z-score outlier fields simply repeated IQR counts. They now calculate absolute population Z-scores above three. Pairwise constant correlations are skipped instead of fabricating r=0.
- Regression imputed before splitting and selected the champion on test R-squared. Imputation/scaling now live inside a scikit-learn Pipeline, including every CV fold. Training CV selects the champion. Identical modeling rows are deduplicated before splitting. Predictor/target overlap, invalid predictors, constant targets, insufficient observations and constant holdouts receive explicit errors/skipped reasons.
- Small regression datasets claimed five-fold CV when it had not run. Actual fold availability and the fixed candidate-order fallback are now explicit. Numeric-only predictors and standardized coefficient units are disclosed.
- Invalid targets were silently ignored, modeling failures were swallowed and the plan could claim models ran when none did. Explicit validation and truthful planned/skipped results replace this behavior.
- Report/insight champion evidence used the first model rather than the selected one. It now follows the champion flag. HTML interpolated unescaped dataset text; it is escaped. Markdown downloads now use text/markdown.
- Runtime Zod validation rejected Random Forest's null signed coefficient. Types/schema/chart inputs now accept it. Entirely missing statistics render as unavailable. Diagnostics include max_concurrent_analyses as expected by the client.
- `/api/explore` and `/api/explore/options` were missing. The historical bounded explorer is adapted into one module, without restoring the old service architecture. Focus controls recompute descriptive findings; suggestions invoke real calculations. Filtered reports and browser snapshots work.
- Sample counts/names were inconsistent with data and UI contracts. Counts are derived from actual files and existing sample names remain compatible. Upload display names preserve filename casing.
- Wildcard CORS, unbounded storage and a 0.0.0.0 local runner created unsafe defaults. Loopback/origin checks, eight-dataset FIFO storage, owner headers and one-analysis locking provide modest local safeguards.
- CI still referenced deleted backend/tests and obsolete installation paths. It now installs/checks the root package on Windows/Linux and runs the Windows browser suite. The workflow itself has not run on GitHub because nothing was pushed.
- Frontend methodology/landing pages and deployment docs advertised removed algorithms and old retention/deployment guarantees. They now describe actual capabilities. Old Render/Compose files are preserved with .disabled filenames.

The old browser assertions that required PCA/clustering/classification output were changed to assert explicit skipped capability disclosure or the retained regression result. No test file was deleted or hidden. Responsive tests set viewport when creating their context: Firefox on this machine stalled when resizing an existing blank page. The same viewport assertions pass with context configuration.

## Features and boundaries

Working: local health/diagnostics, four-format upload, four samples, schema/quality, statistics/histograms, Pearson/Spearman, three numeric regressors, focus/group/trend/relationship exploration, browser snapshots and Markdown/HTML downloads. Actual browser verification includes responsive views, keyboard/drag upload, Excel upload, retry/error states, cached results and dataset ownership.

Deliberately absent after the refactor: supervised classification, KMeans/DBSCAN, PCA, stationarity diagnostics, formal hypothesis-test suites, the seven-model regression benchmark (now three models), categorical predictor encoding, and the previous broader discovery engine. Their source is recoverable. Restoring all of them was rejected as unnecessary scope/complexity; the UI and plan explicitly disclose the current boundary. Descriptive time aggregation is not forecasting.

Regression assumes independent rows. Deduplication prevents exact-row overlap, but related people/groups, chronology, target-derived predictors and domain leakage require user judgment and a different split design. Correlation p-values are exploratory/unadjusted. No production ML claim is made.

## Windows environment

Native PowerShell 7.6.5, Python 3.13.16, uv 0.13.6, Node.js 26.13.0. Root `.python-version` pins the verified Python patch; uv's existing `.venv` works. `uv sync --frozen --extra dev` and `npm ci` install from locks. README.md gives copyable PowerShell commands. `.vscode/launch.json` configures the Python debugger; launching VS Code itself was not tested.

The backend entry is `infera.main:app`; frontend entry is `frontend/app/dashboard/page.tsx` with `DatasetWorkspace`. The root manifest is authoritative. Legacy backend manifests/requirements remain historical artifacts, documented as unsupported installation paths. No WSL dependency or recovered Linux directory is required.

## Version control and recovery

Initially there was no remote, only `1af4cce` (initial snapshot) and `80f2126` (refactor), both created on 31 October. The local history is unrelated to the original remote. This is evidence of repository reinitialization; it does not independently identify who performed it.

The repository URL was found in existing docs: `https://github.com/iamaritrasaha/infera.git`. `git ls-remote` succeeded; origin was restored and fetched. `origin/main` is `99d095809eb1811e049a5296d8f62862d2a381c6`, with 23 commits including `2b2f8ff` and the earlier feature history. `git diff --ignore-space-at-eol 1af4cce origin/main` is empty; their only raw differences are sample CSV line endings. Thus the original committed source is recovered, without overwriting the refactor.

`git fsck --full` passes. A verified complete bundle is saved outside the workspace at `D:\Development\infera-recovery-20261101.bundle`. It includes both histories and the baseline branch. The histories have not been merged or rewritten. Nothing was pushed, force-pushed, published or deployed.

Committed recovery cannot establish whether the deleted Linux directory contained uncommitted work, ignored data or environment files. Those remain unknown. If needed, remaining options are user-held disk images, Windows/OneDrive/File History backups or old machine backups; no deleted Linux files were assumed recoverable.

Repair commits:

- `089fa4c`: dataset validation, numerical/ML correctness, local API safeguards, restored bounded explorer and backend regression tests.
- `63cac29`: frontend contracts, truthful capability documentation, dependency patches and browser workflows.
- The following documentation/workflow commit records final checks, Windows setup, debugger config and disabled deployment files.

## Verification results

Final results follow. Initial failures were investigated and corrected; early runs are not presented as successful final checks.

- Baseline: 28 pytest passed; Ruff lint passed; Ruff formatting failed.
- Current backend: 54 pytest passed; two Starlette deprecation warnings (test client transport and the inherited 413 status alias), no skipped backend tests.
- Ruff lint and format: passed for the whole workspace, 31 checked/formatted files.
- Python type check: `uv run ty check infera` passed.
- Frontend lint, TypeScript and Next.js production build: passed.
- Real native Uvicorn at 127.0.0.1:8000: health, upload, analyze, cached report passed. A known 30-row line yielded mean(x)=14.5, Pearson=1, Linear Regression R-squared=1 and MAE=0.
- Browser results: **58 passed, 4 skipped, 0 failed** in 1.4 minutes. Chromium: 46 local tests passed; Firefox: 12 connection/responsive tests passed. Two opt-in production cases were skipped in each browser. The complete CSV-to-report workflow ran against actual Uvicorn and the production Next.js build in Chromium. See `docs/audit-20261101-results.json` and local `frontend/test-results/local-results.json`.
- npm production audit: zero vulnerabilities after Next.js 16.4.3 and Zod 4.6.6 patches. Full audit still reports 16 moderate development-tool dependency findings through minimatch/ESLint. The suggested force fix downgrades major tooling and was not applied.
- Unexecuted: public/live deployment checks, remote GitHub CI, Docker deployment, VS Code extension launch, and rerunning the historical deleted test suite against the historical application.

## Security/deployment restrictions and blockers

There is no blocker to the verified local workflow. Public deployment remains blocked by design: no public authentication, TTL, persistence, cross-worker state or hostile-input process isolation. Use one worker on loopback without tunnels/proxies. Tokenless local API clients share a namespace; browser-owned data requires its existing header. Eight datasets are retained until eviction/restart; browser snapshots have separate retention. Upload and analysis bounds are learning-app safeguards, not a public-service security boundary.

Historical public deployments may still exist; their live state was not audited or modified. Disabled local configuration does not disable an already-running remote service. Public-service changes require separate authorization.

Start learning at `infera/main.py:upload_csv_file`, then `data_loader.load_dataset`, then `analysis.run_full_analysis`. LEARNING_GUIDE.md contains five practical exercises without solutions.
