"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { AnalysisResponse, UploadResponse } from "@/lib/types";
import { executeFullAnalysis, errorMessage } from "@/lib/api";
import { UploadZone } from "@/components/UploadZone";
import { SampleDatasets } from "@/components/SampleDatasets";
import { AnalysisView } from "@/components/AnalysisView";
import { ArrowRight, Cpu, FlaskConical, Loader2, Play, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";

export function DatasetWorkspace({ compact = false }: { compact?: boolean }) {
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const uploadSectionRef = useRef<HTMLDivElement>(null);

  const scrollToUpload = () => {
    uploadSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleUploadOrSample = (res: UploadResponse) => {
    setUploadData(res);
    setAnalysisResult(null);
    setErrorMsg(null);
    // Set default target if suggested
    const defaultTarget = res.recommended_target || "";
    setSelectedTarget(defaultTarget);
  };

  const handleRunFullAnalysis = async () => {
    if (!uploadData) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const result = await executeFullAnalysis(
        uploadData.dataset_id,
        selectedTarget || undefined
      );
      setAnalysisResult(result);
    } catch (err) {
      setErrorMsg(errorMessage(err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setUploadData(null);
    setAnalysisResult(null);
    setErrorMsg(null);
  };

  // If full analysis is ready, render the rich analysis dashboard
  if (analysisResult) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <AnalysisView initialData={analysisResult} onReset={handleReset} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      {!compact && <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-slate-900 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Deterministic Computational Engine &bull; Zero External AI APIs</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white">
              Turn data into <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-blue-500">evidence.</span>
            </h1>
            <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Upload a structured dataset and let Infera automatically profile quality, detect hypotheses, benchmark ML models, and explain empirical findings.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={scrollToUpload}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              <span>Analyze a Dataset</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <Link
              href="/docs"
              className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-sm rounded-xl border border-slate-800 transition-colors"
            >
              View Documentation
            </Link>
          </div>

          <div className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              ["Profile", "Inspect missing values, distributions, and schema."],
              ["Validate", "Compare models against baselines and inspect uncertainty."],
              ["Explain", "Trace computed findings and export an evidence report."],
            ].map(([title, description]) => (
              <div key={title} className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
                <h2 className="text-sm font-semibold text-white">{title}</h2>
                <p className="mt-2 text-xs text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>}

      {/* Upload and Dataset Selection Section */}
      <section ref={uploadSectionRef} className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        {!uploadData ? (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-white tracking-tight">Select or Upload a Dataset</h2>
              <p className="text-xs text-slate-400">
                Choose a synthetic example or upload your own structured dataset
              </p>
            </div>

            <UploadZone onUploadSuccess={handleUploadOrSample} />
            <SampleDatasets onLoadSample={handleUploadOrSample} />
          </div>
        ) : (
          /* Staging / Immediate Profile State */
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">{uploadData.dataset_name}</h3>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Health: {uploadData.health_score}/100
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {uploadData.row_count.toLocaleString()} rows &bull; {uploadData.column_count} columns &bull; {uploadData.memory_formatted}
                </p>
              </div>

              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors self-start sm:self-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Upload Different File</span>
              </button>
            </div>

            {/* Target Column Selection */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">Target Prediction Column</h4>
                  <p className="text-xs text-slate-400">
                    Choose the response variable to benchmark ML models against, or leave empty for exploratory/unsupervised clustering.
                  </p>
                </div>

                <select
                aria-label="Analysis target"
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 w-full sm:w-60"
                >
                  <option value="">-- Automatic Inference --</option>
                  {uploadData.columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.inferred_type})
                    </option>
                  ))}
                </select>
              </div>

              {uploadData.potential_targets.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-900 text-xs text-slate-400">
                  <span>Detected Candidates:</span>
                  {uploadData.potential_targets.map((cand) => (
                    <button
                      key={cand.column}
                      onClick={() => setSelectedTarget(cand.column)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors border ${
                        selectedTarget === cand.column
                          ? "bg-blue-600 text-white border-blue-500"
                          : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {cand.column} ({cand.suggested_type.replace("_", " ")})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Launch Action */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="text-xs text-slate-400">
                Infera will profile data quality, execute hypothesis tests, and run up to 5-fold cross-validated ML models.
              </div>

              <button
                onClick={handleRunFullAnalysis}
                disabled={isAnalyzing}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Computing Mathematical Evidence...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Launch Full Analysis</span>
                  </>
                )}
              </button>
            </div>

            {errorMsg && (
              <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                {errorMsg}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Platform Pillars Section */}
      {!compact && <section className="border-t border-slate-900 bg-slate-950 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <h3 className="text-2xl font-extrabold text-white">The Infera Scientific Standard</h3>
            <p className="text-xs text-slate-400">
              Built on the principle that automated data science must be provable, reproducible, and mathematically grounded.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3">
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg w-fit">
                <Cpu className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-white">Isolated Preprocessing</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Preprocessing pipelines (imputers, scalers, encoders) fit strictly on training splits. Models benchmark against honest Dummy baselines and up to 5-fold training cross-validation.
              </p>
            </div>

            <div className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3">
              <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-lg w-fit">
                <FlaskConical className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-white">Principled Hypothesis Tests</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automated tests evaluate Levene variance equality to select Welch&apos;s t-test, Mann-Whitney U, ANOVA, or Chi-Square, documenting exact p-values and assumptions.
              </p>
            </div>

            <div className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg w-fit">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-white">Computed Evidence</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Template explanations use computed evidence. All statistical statements, correlation coefficients, and performance metrics originate from verifiable Python computations.
              </p>
            </div>
          </div>
        </div>
      </section>}
    </div>
  );
}
