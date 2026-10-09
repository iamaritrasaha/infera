import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Braces,
  Code2,
  Cpu,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="about-page">
      <header className="about-hero">
        <div>
          <p className="eyebrow">THE PROJECT / THE PHILOSOPHY</p>
          <h1>
            Built independently.
            <br />
            <span>Driven by evidence.</span>
          </h1>
          <p>
            Infera is an open-source, Python-first automated data science
            platform. A practical bridge between structured data and
            understandable, verifiable findings.
          </p>
        </div>
        <div className="about-mark">
          <Image
            src="/infera-icon.svg"
            width={100}
            height={100}
            alt="Infera’s established binary mark"
          />
          <span>INFERA / EST. INDEPENDENTLY</span>
        </div>
      </header>
      <div className="about-content">
        <aside>
          <span className="eyebrow">CREATOR</span>
          <p>Aritra Saha</p>
          <span>
            Independent developer
            <br />
            Sole creator of Infera
          </span>
          <a
            href="https://github.com/iamaritrasaha/infera"
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            <Code2 size={15} />
            Source on GitHub
          </a>
        </aside>
        <div className="about-story">
          <section>
            <p className="eyebrow">01 / WHY I CREATED IT</p>
            <h2>Make the method accessible.</h2>
            <p>
              I created Infera to make statistical analysis and machine learning
              more accessible without requiring extensive data-processing code.
              I wanted a workspace where a dataset could become a starting point
              for investigation.
            </p>
            <p>
              The goal is to perform real computations in Python and explain
              their results transparently. Profiling, statistical tests, and
              model comparisons help users inspect evidence, understand
              limitations, and decide what to investigate next.
            </p>
          </section>
          <section>
            <p className="eyebrow">02 / THE ARCHITECTURE</p>
            <h2>Python at the foundation.</h2>
            <p>
              FastAPI exposes the analysis engine. Pandas and NumPy describe the
              data, SciPy and Statsmodels support inference, and scikit-learn
              provides model pipelines. Next.js presents the computed results in
              an interactive workspace.
            </p>
            <div className="architecture-flow">
              <span>Structured dataset</span>
              <ArrowRight size={14} />
              <span>Python engine</span>
              <ArrowRight size={14} />
              <span>Inspectable evidence</span>
            </div>
            <p>
              Infera inspects the schema, profiles quality, detects an
              applicable problem type, and plans an analysis. Tests and models
              run when the data supports them; skipped steps include an
              explanation. Interpretation follows computation.
            </p>
          </section>
          <section>
            <p className="eyebrow">03 / ENGINEERING PRINCIPLES</p>
            <h2>Trust comes from inspection.</h2>
            <div className="about-principles">
              {[
                [
                  FlaskConical,
                  "Reproducible computations",
                  "Documented methods and fixed random seeds where applicable. Open source makes the pipeline available for inspection and rerunning.",
                ],
                [
                  ShieldCheck,
                  "Honest evaluation",
                  "Preprocessing fits on training splits. Dummy baselines, cross-validation, and held-out metrics put model scores in context.",
                ],
                [
                  Braces,
                  "Visible limitations",
                  "Unavailable analyses, statistical assumptions, resource limits, and uncertainty remain part of the result.",
                ],
                [
                  Cpu,
                  "A free, practical foundation",
                  "No paid AI APIs are required. Temporary session-scoped processing and bounded workloads support free hosting.",
                ],
              ].map(([Icon, title, text]) => {
                const Symbol = Icon as typeof Cpu;
                return (
                  <article key={String(title)}>
                    <Symbol size={20} />
                    <h3>{String(title)}</h3>
                    <p>{String(text)}</p>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="about-quote">
            <p className="eyebrow">THE PHILOSOPHY</p>
            <blockquote>
              “Infera doesn’t guess.
              <br />
              It computes, validates,
              <br />
              and explains.”
            </blockquote>
          </section>
          <section>
            <p className="eyebrow">04 / BUILT IN THE OPEN</p>
            <h2>Independent. Inspectable. Open source.</h2>
            <p>
              I designed and developed Infera independently. The project is
              available under the MIT License so its calculations, decisions,
              and limitations can be explored in the source.
            </p>
            <p className="creator-credit">
              Created and developed by Aritra Saha.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link href="/dashboard" className="button-primary">
                Start Analyzing <ArrowRight size={16} />
              </Link>
              <a
                href="https://github.com/iamaritrasaha/infera"
                target="_blank"
                rel="noreferrer"
                className="button-secondary"
              >
                <Code2 size={16} />
                View on GitHub
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
