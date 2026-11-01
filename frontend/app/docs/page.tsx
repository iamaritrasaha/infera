import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation and Methodology",
  description: "The current local analysis engine, methods and limitations.",
  alternates: { canonical: "/docs" },
};

const sections = [
  ["Windows setup", "Use the root README.md: uv sync --frozen --extra dev, then uv run uvicorn infera.main:app --host 127.0.0.1 --port 8000 --reload. In frontend, run npm ci and npm run dev -- --hostname 127.0.0.1. Set NEXT_PUBLIC_API_URL in frontend/.env.local before starting or building."],
  ["Data profiling", "CSV, XLSX first sheet, JSON tables and Parquet are supported. Limits are 15 MiB, 5,000 rows and 100 columns. Empty, malformed, duplicate-header and non-finite data are rejected. Missing values remain missing. The engine summarizes types, missingness, duplicate rows, IQR fences and actual Z-score outliers. The 0-100 health score penalizes missing cells and duplicate rows; it is a heuristic, not a probability."],
  ["Statistics and exploration", "Summaries include mean, median, sample variance/std (ddof=1), quartiles, skewness, excess kurtosis and histograms. Entirely missing numeric summaries are unavailable. Pearson and Spearman use complete pairs. P-values are exploratory and unadjusted for multiple comparisons. Filters support group aggregates, descriptive time buckets and relationships. Correlation does not prove causation."],
  ["Regression and leakage", "Linear Regression, Ridge and Random Forest use numerical predictors only. Missing targets are dropped. An 80/20 random split assumes independent rows. Mean imputation and scaling fit only training folds through a scikit-learn pipeline. Five-fold training CV selects the model; test scores do not select it. With fewer than 10 training rows, candidate order provides the fallback. Holdout R-squared, MAE, MSE and RMSE are reported. Negative R-squared means worse than predicting the test mean. Repeated, duplicated or chronological observations need a different validation design. Standardized coefficients and tree importance measure model-specific associations, not causation."],
  ["Removed capabilities", "The beginner refactor removed classification, clustering, PCA, formal hypothesis-test suites and time-series stationarity diagnostics. They are not implemented in this version and are listed as skipped in the plan and report. Their source remains in Git. Descriptive time exploration remains available; it is not forecasting. Categorical predictors require deliberate encoding before regression."],
  ["Reports, privacy and local use", "Markdown and escaped HTML reports can be downloaded. Eight datasets and their latest results stay in FIFO process memory until eviction or server restart. There is no TTL or persistent database. Browser snapshots persist until deleted in that browser. Existing browser ownership headers isolate datasets, while tokenless local API calls share a namespace. Use one worker, bind only to loopback and do not expose the API through tunnels or proxies. Public deployment is unsupported; legacy deployment files are disabled. No external LLM API is called."],
];

export default function DocsPage() {
  return (
    <div className="docs-page max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10 text-slate-300 text-sm leading-relaxed">
      <header className="space-y-3 border-b border-slate-900 pb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Documentation and methodology</h1>
        <p>Current local learning version. Read README.md and LEARNING_GUIDE.md in the project for setup, debugging and exercises.</p>
      </header>
      {sections.map(([title, description]) => (
        <section key={title} className="space-y-3">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p>{description}</p>
        </section>
      ))}
    </div>
  );
}
