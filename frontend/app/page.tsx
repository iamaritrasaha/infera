import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  Binary,
  Braces,
  ChartNoAxesCombined,
  CheckCheck,
  CircleDot,
  Code2,
  Database,
  FileText,
  FlaskConical,
  GitBranch,
  Layers,
  ScanLine,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { ProductPreview } from "@/components/ProductPreview";

export const metadata: Metadata = {
  title: "Turn Data Into Evidence",
  description: "Explore structured data with Python-computed statistics, transparent limitations, and downloadable evidence reports.",
  alternates: { canonical: "/" },
};

const capabilities = [
  [
    Database,
    "Data Profiling",
    "Know what you’re working with.",
    "Inspect types, cardinality, distributions, and the shape of every column.",
  ],
  [
    ScanLine,
    "Data Quality",
    "Find the friction in your data.",
    "Measure missingness, duplicates, and IQR outliers before interpreting results.",
  ],
  [
    FlaskConical,
    "Statistical Testing",
    "Test the question, not a hunch.",
    "Compare groups with documented tests, p-values, and assumption checks.",
  ],
  [
    ChartNoAxesCombined,
    "Regression",
    "Compare continuous predictions.",
    "Benchmark regressors against a dummy baseline with held-out errors and training cross-validation.",
  ],
  [
    GitBranch,
    "Classification",
    "Understand every prediction.",
    "Compare class-aware metrics, inspect confusion matrices, and check imbalance.",
  ],
  [
    Layers,
    "Clustering",
    "Explore structure without labels.",
    "Compare clustering methods and inspect computed PCA projections.",
  ],
  [
    CircleDot,
    "Explainable Insights",
    "Follow a finding to its evidence.",
    "Expand supporting calculations, numerical evidence, and statistical context.",
  ],
  [
    FileText,
    "Report Generation",
    "Take the evidence with you.",
    "Export computed findings, methodology, and limitations in Markdown or HTML.",
  ],
] as const;

export default function HomePage() {
  return (
    <div className="landing">
      <section className="hero-section">
        <div className="science-grid" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-cross">+</span> INDEPENDENT. OPEN SOURCE.
              PYTHON FIRST.
            </p>
            <h1>
              Turn data
              <br />
              into <span>evidence.</span>
            </h1>
            <p className="hero-description">
              A clearer path from raw datasets to grounded insights. Profile,
              test, model, and explain with real Python computations.
            </p>
            <div className="hero-actions">
              <a href="/dashboard" className="button-primary">
                Start Analyzing <ArrowRight size={17} />
              </a>
              <a
                href="https://github.com/iamaritrasaha/infera"
                target="_blank"
                rel="noreferrer"
                className="button-secondary"
              >
                <Code2 size={17} />
                View on GitHub
              </a>
            </div>
            <div className="hero-note">
              <ShieldCheck size={15} />
              <span>
                Inspectable calculations. Transparent limitations.
                <br className="sm:hidden" /> No paid APIs.
              </span>
            </div>
          </div>
          <div className="hero-product">
            <div className="preview-coordinate" aria-hidden="true">
              FIG. 01 / FROM DATA TO EVIDENCE
            </div>
            <ProductPreview />
          </div>
        </div>
        <div className="engine-stack">
          <span>THE COMPUTATIONAL FOUNDATION</span>
          <div>
            <span>pandas</span>
            <span>NumPy</span>
            <span>SciPy</span>
            <span>statsmodels</span>
            <span>scikit-learn</span>
            <span>FastAPI</span>
          </div>
        </div>
      </section>
      <section className="landing-section" id="capabilities">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 / CAPABILITIES</p>
            <h2>
              One workspace.
              <br />A complete analytical perspective.
            </h2>
          </div>
          <p>
            Move from understanding your data to evaluating its signals. Every
            step carries the context you need to interpret it.
          </p>
        </div>
        <div className="capability-grid">
          {capabilities.map(([Icon, title, heading, text], i) => (
            <article className="capability-card" key={title}>
              <div className="flex items-center justify-between">
                <Icon size={21} />
                <span className="font-mono text-xs text-slate-500">
                  0{i + 1}
                </span>
              </div>
              <h3>{title}</h3>
              <p className="capability-heading">{heading}</p>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="process-section">
        <div className="landing-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">02 / THE WORKFLOW</p>
              <h2>
                Less setup.
                <br />
                More understanding.
              </h2>
            </div>
            <Link href="/docs" className="text-link">
              Explore the documentation <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="process-grid">
            {[
              [
                "01",
                Database,
                "Bring your data",
                "Upload CSV, Excel, JSON, or Parquet. Or start with a synthetic sample.",
              ],
              [
                "02",
                Workflow,
                "Ask a better question",
                "Inspect the profile and choose a target. Infera selects applicable tests and models.",
              ],
              [
                "03",
                CheckCheck,
                "Inspect the evidence",
                "Explore computed results, compare baselines, and export an evidence report.",
              ],
            ].map(([n, Icon, title, text]) => {
              const Symbol = Icon as typeof Database;
              return (
                <article key={String(n)}>
                  <span className="process-number">{String(n)}</span>
                  <Symbol size={23} />
                  <h3>{String(title)}</h3>
                  <p>{String(text)}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <section className="landing-section methodology-section">
        <div>
          <p className="eyebrow">03 / SCIENTIFIC METHODOLOGY</p>
          <h2>
            Infera doesn’t guess.
            <br />
            <span className="text-slate-400">
              It computes, validates,
              <br />
              and explains.
            </span>
          </h2>
          <p className="methodology-copy">
            Automation should make the method easier to inspect. Results include
            assumptions, baselines, and limitations so you can decide what the
            evidence supports.
          </p>
          <Link href="/about" className="text-link">
            The philosophy behind Infera <ArrowRight size={16} />
          </Link>
        </div>
        <div className="methodology-list">
          {[
            [
              FlaskConical,
              "Assumptions before conclusions",
              "Documented variance checks and applicable statistical tests. A p-value is evidence to interpret, not a verdict.",
            ],
            [
              ShieldCheck,
              "Validation without leakage",
              "Preprocessing fits on training data. Model comparisons include dummy baselines, cross-validation, and held-out metrics.",
            ],
            [
              Braces,
              "Computation you can inspect",
              "Open Python source, fixed random seeds where applicable, and expandable numerical evidence. No generated statistics.",
            ],
          ].map(([Icon, title, text]) => {
            const Symbol = Icon as typeof Database;
            return (
              <article key={String(title)}>
                <Symbol size={21} />
                <div>
                  <h3>{String(title)}</h3>
                  <p>{String(text)}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="landing-section">
        <div className="open-source-panel">
          <div>
            <p className="eyebrow">
              <Binary size={16} /> BUILT IN THE OPEN
            </p>
            <h2>
              Independent by design.
              <br />
              Open for exploration.
            </h2>
            <p>
              Created and developed by Aritra Saha. Infera is a Python-first
              project with source you can read, run, and contribute to.
            </p>
          </div>
          <a
            className="button-secondary"
            href="https://github.com/iamaritrasaha/infera"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 size={17} />
            Explore the source <ArrowUpRight size={16} />
          </a>
        </div>
      </section>
      <section className="final-cta">
        <p className="eyebrow">YOUR NEXT FINDING STARTS HERE</p>
        <h2>
          Let the data speak.
          <br />
          Bring the evidence.
        </h2>
        <a href="/dashboard" className="button-primary">
          Start Analyzing <ArrowRight size={17} />
        </a>
        <p>Free to use. No account required.</p>
      </section>
    </div>
  );
}
