import React from "react";
import {
  BookOpen,
  Cpu,
  Database,
  FlaskConical,
  Layers,
  ShieldCheck,
} from "lucide-react";

export default function DocsPage() {
  return (
    <div className="docs-page max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-12 text-slate-300 text-sm leading-relaxed">
      {/* Header */}
      <div className="space-y-3 border-b border-slate-900 pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Infera Architecture &amp; Methodology Specification</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          System Documentation &amp; Scientific Protocol
        </h1>
        <p className="text-slate-400 text-base">
          How Infera ingests, profiles, validates, models, and explains
          structured tabular datasets with inspectable computational evidence.
        </p>
      </div>

      {/* 1. Core Philosophy */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" /> 1. The Core
          Philosophy
        </h2>
        <blockquote className="p-4 bg-slate-900/60 border-l-4 border-blue-500 rounded-r-lg font-serif italic text-slate-200">
          &ldquo;Infera doesn&apos;t guess. It computes, validates, and
          explains.&rdquo;
        </blockquote>
        <p>
          Infera uses a modular, testable Python analysis engine. Numerical
          claims (such as Pearson coefficients, p-values, R² scores, or
          silhouette coefficients) originate strictly from actual SciPy and
          scikit-learn executions.
        </p>
      </section>

      {/* 2. Profiling Engine */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-400" /> 2. Data Profiling &amp;
          Hygiene Engine
        </h2>
        <p>
          Upon file upload (CSV, XLSX, JSON, or Parquet), Infera immediately
          parses the matrix in-memory and extracts:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-slate-400">
          <li>
            <strong className="text-slate-200">Schema Inference:</strong>{" "}
            Distinguishes numerical, categorical, datetime, free-form text,
            boolean, constant, and identifier columns.
          </li>
          <li>
            <strong className="text-slate-200">Missing Values:</strong>{" "}
            Calculates total missing cells, complete observations percentage,
            and assigns per-attribute hygiene status (&lt;5% minor, 5-20%
            moderate, &gt;20% severe).
          </li>
          <li>
            <strong className="text-slate-200">Duplicate Records:</strong>{" "}
            Detects exact row duplicates and flags primary key collisions on
            identified ID columns.
          </li>
          <li>
            <strong className="text-slate-200">Statistical Outliers:</strong>{" "}
            Evaluates Tukey&apos;s Interquartile Range (IQR) fences (Q1 -
            1.5&times;IQR to Q3 + 1.5&times;IQR) alongside Z-scores (|z| &gt;
            3.0), distinguishing statistical extremes from corrupt entries.
          </li>
          <li>
            <strong className="text-slate-200">Health Score:</strong>{" "}
            Deterministic 0-100 score penalizing missing data, duplications, and
            extreme tail concentrations.
          </li>
        </ul>
      </section>

      {/* 3. Statistical Testing */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-purple-400" /> 3. Formal
          Hypothesis Testing Suite
        </h2>
        <p>
          Infera automatically discovers suitable variable pairings and applies
          exploratory statistical tests at &alpha; = 0.05:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
            <strong className="text-white block mb-1">
              Welch&apos;s / Student&apos;s t-Test
            </strong>
            <span>
              Evaluates group mean differences across 2-level categorical
              factors after verifying variance homogeneity with Levene&apos;s
              test.
            </span>
          </div>
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
            <strong className="text-white block mb-1">
              Mann-Whitney U Test
            </strong>
            <span>
              Non-parametric rank-sum test robust to heavy outliers and skewed
              non-Gaussian distributions.
            </span>
          </div>
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
            <strong className="text-white block mb-1">
              One-Way ANOVA &amp; Kruskal-Wallis
            </strong>
            <span>
              Parametric F-test and non-parametric H-test across categorical
              features with &ge; 3 levels.
            </span>
          </div>
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
            <strong className="text-white block mb-1">
              Pearson Chi-Square (&chi;&sup2;)
            </strong>
            <span>
              Tests statistical independence between pairs of discrete
              categorical attributes via contingency tables.
            </span>
          </div>
        </div>
      </section>

      <p className="text-xs text-amber-300">
        Tests are exploratory, use unadjusted p-values, and do not establish
        causation. Repeated comparisons increase false-positive risk. Schema and
        target detection are heuristics that should be reviewed.
      </p>

      {/* 4. Machine Learning */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Cpu className="w-5 h-5 text-amber-400" /> 4. Machine Learning
          Benchmark &amp; Leakage Prevention
        </h2>
        <p>Infera enforces strict data isolation to prevent data leakage:</p>
        <ul className="list-disc pl-5 space-y-2 text-slate-400">
          <li>
            <strong className="text-slate-200">Partitioning:</strong>{" "}
            Approximately 80/20 train/test split; classification keeps every
            eligible class represented. Missing targets and duplicate modeling
            observations are removed before splitting.
          </li>
          <li>
            <strong className="text-slate-200">
              Preprocessing Transformers:
            </strong>{" "}
            Imputers (median for numeric, mode for categorical) and
            StandardScalers / OneHotEncoders are fitted strictly on the training
            partition and transformed onto test data.
          </li>
          <li>
            <strong className="text-slate-200">Regression Benchmark:</strong>{" "}
            DummyRegressor (baseline), Linear Regression, Ridge (L2), Lasso
            (L1), ElasticNet (L1+L2), Random Forest, and Gradient Boosting.
            Evaluates R², RMSE, MAE, and up to 5-fold training cross-validation.
          </li>
          <li>
            <strong className="text-slate-200">
              Classification Benchmark:
            </strong>{" "}
            DummyClassifier (prior baseline), Logistic Regression, Random
            Forest, and Gradient Boosting. Evaluates Accuracy, Macro F1,
            Precision, Recall, and ROC-AUC.
          </li>
        </ul>
      </section>

      <p className="text-xs text-slate-400">
        Models are selected by available training cross-validation scores,
        including the baseline. If CV is unavailable, the holdout-based
        selection is explicitly labeled as potentially optimistic. Results
        describe one split. Numeric modeling uses at most 5,000
        deterministically sampled eligible rows, and clustering uses at most
        1,500 complete rows. PCA and time-series diagnostics are exploratory;
        forecasts are not generated.
      </p>

      {/* 5. Privacy & Zero-Budget Stack */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" /> 5. Privacy &amp; Free
          Deployment
        </h2>
        <p>
          Infera is designed to run for ₹0 during both local development and
          cloud deployment:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-slate-400">
          <li>
            Uploaded datasets are parsed in memory and held in a bounded
            temporary cache (one hour of inactivity, with earlier eviction under
            memory pressure). Anonymous sessions authorize access independently
            of dataset IDs. No persistent database is required.
          </li>
          <li>
            No external paid LLM APIs (OpenAI, Anthropic) are called. All
            explanations use deterministic, evidence-backed templates.
          </li>
          <li>
            The backend targets Render Free (or local Docker) and the frontend
            targets Vercel Hobby. Cold starts, limited memory, and service
            quotas apply.
          </li>
        </ul>
      </section>
    </div>
  );
}
