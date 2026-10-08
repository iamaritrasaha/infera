"use client";

import React, { useState } from "react";
import {
  AnalysisResponse,
  ClassificationModelResult,
  RegressionModelResult,
} from "@/lib/types";
import { ActualVsPredictedChart } from "@/components/charts/ActualVsPredictedChart";
import { ClusterScatterChart } from "@/components/charts/ClusterScatterChart";
import { ConfusionMatrixGrid } from "@/components/charts/ConfusionMatrixGrid";
import { FeatureImportanceChart } from "@/components/charts/FeatureImportanceChart";
import { ResidualChart } from "@/components/charts/ResidualChart";
import {
  AlertTriangle,
  Award,
  CheckCircle,
  Cpu,
  Info,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";

interface MachineLearningTabProps {
  data: AnalysisResponse;
  onReAnalyze: (targetCol: string) => Promise<void>;
}

export function MachineLearningTab({ data, onReAnalyze }: MachineLearningTabProps) {
  const { problem_detection, plan, modeling, clustering, schema } = data;
  const [selectedTarget, setSelectedTarget] = useState<string>(
    problem_detection.target_column || ""
  );
  const [isReRunning, setIsReRunning] = useState(false);

  const handleTargetChange = async (newTarget: string) => {
    setSelectedTarget(newTarget);
    setIsReRunning(true);
    try {
      await onReAnalyze(newTarget);
    } finally {
      setIsReRunning(false);
    }
  };

  const isRegression = problem_detection.problem_type === "regression";
  const isClassification =
    problem_detection.problem_type === "binary_classification" ||
    problem_detection.problem_type === "multiclass_classification";

  // Pick best model
  const models = modeling?.models || [];
  const championModel = models.find((m) => m.is_best_model) || models[0];

  return (
    <div className="space-y-6">
      {/* Problem Formulation & Target Selector Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30">
                {problem_detection.problem_type.replace("_", " ")}
              </span>
              <span className="text-xs text-slate-400">
                Confidence: <strong className="text-slate-200 capitalize">{problem_detection.confidence}</strong>
              </span>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Target Objective: <span className="text-blue-400">{problem_detection.target_column || "Unsupervised"}</span>
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl">{problem_detection.reason}</p>
          </div>

          {/* Switch Target dropdown */}
          <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800 shrink-0">
            <span className="text-xs text-slate-400 whitespace-nowrap pl-1">Target:</span>
            <select
              value={selectedTarget}
              disabled={isReRunning}
              onChange={(e) => handleTargetChange(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1 focus:outline-none focus:border-blue-500 font-medium"
            >
              {schema.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.inferred_type})
                </option>
              ))}
            </select>
            {isReRunning && <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
          </div>
        </div>

        {/* Class imbalance warning if applicable */}
        {modeling?.has_class_imbalance && modeling.imbalance_warning && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2.5 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Class Imbalance Warning:</strong> {modeling.imbalance_warning}
            </div>
          </div>
        )}
      </div>

      {/* Supervised Models Benchmark */}
      {modeling && modeling.models.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-semibold text-white">Model Benchmarking &amp; Validation</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluated on {modeling.train_samples} train / {modeling.test_samples} held-out test observations with cross-validation
              </p>
            </div>
            {modeling.best_model_name && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5" /> Champion: {modeling.best_model_name}
              </span>
            )}
          </div>

          {/* Model Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">Model Architecture</th>
                  {isRegression ? (
                    <>
                      <th className="py-2.5 px-3 text-right">R² (Test)</th>
                      <th className="py-2.5 px-3 text-right">RMSE</th>
                      <th className="py-2.5 px-3 text-right">MAE</th>
                      <th className="py-2.5 px-3 text-right">5-Fold CV R²</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2.5 px-3 text-right">Accuracy</th>
                      <th className="py-2.5 px-3 text-right">Macro F1</th>
                      <th className="py-2.5 px-3 text-right">Precision</th>
                      <th className="py-2.5 px-3 text-right">Recall</th>
                      <th className="py-2.5 px-3 text-right">ROC-AUC</th>
                      <th className="py-2.5 px-3 text-right">5-Fold CV F1</th>
                    </>
                  )}
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {modeling.summary_table.map((row, idx) => {
                  const isBest = row.is_best;
                  return (
                    <tr
                      key={idx}
                      className={`transition-colors ${
                        isBest ? "bg-emerald-950/20 font-semibold" : "hover:bg-slate-800/30"
                      }`}
                    >
                      <td className="py-2.5 px-3 font-sans text-slate-200">
                        <div className="flex items-center gap-2">
                          {isBest && <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          <span>{row.model}</span>
                        </div>
                      </td>
                      {isRegression ? (
                        <>
                          <td className={`py-2.5 px-3 text-right ${isBest ? "text-emerald-400 font-bold" : "text-slate-200"}`}>
                            {row.r2}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300">{row.rmse}</td>
                          <td className="py-2.5 px-3 text-right text-slate-300">{row.mae}</td>
                          <td className="py-2.5 px-3 text-right text-slate-400">{row.cv_r2}</td>
                        </>
                      ) : (
                        <>
                          <td className={`py-2.5 px-3 text-right ${isBest ? "text-emerald-400 font-bold" : "text-slate-200"}`}>
                            {row.accuracy}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-200 font-semibold">{row.f1_macro}</td>
                          <td className="py-2.5 px-3 text-right text-slate-300">{row.precision}</td>
                          <td className="py-2.5 px-3 text-right text-slate-300">{row.recall}</td>
                          <td className="py-2.5 px-3 text-right text-slate-300">{row.roc_auc}</td>
                          <td className="py-2.5 px-3 text-right text-slate-400">{row.cv_f1}</td>
                        </>
                      )}
                      <td className="py-2.5 px-3 text-center font-sans">
                        {isBest ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Champion
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Benchmark</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-300">
            <strong>Validation Finding:</strong> {modeling.insight}
          </div>
        </div>
      )}

      {/* Model Diagnostics & Visualizations */}
      {championModel && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            <h4 className="text-sm font-semibold text-white">Diagnostics &amp; Interpretability ({championModel.display_name})</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isRegression && "predictions_vs_actual" in championModel && (
              <>
                <ActualVsPredictedChart
                  data={(championModel as RegressionModelResult).predictions_vs_actual}
                  targetName={modeling?.target_column || "Target"}
                />
                <ResidualChart data={(championModel as RegressionModelResult).residuals} />
              </>
            )}

            {isClassification && "confusion_matrix" in championModel && (
              <ConfusionMatrixGrid
                matrix={(championModel as ClassificationModelResult).confusion_matrix}
                labels={(championModel as ClassificationModelResult).confusion_matrix_labels}
              />
            )}

            {championModel.feature_importances && championModel.feature_importances.length > 0 && (
              <FeatureImportanceChart
                importances={championModel.feature_importances}
                title={`Feature Importance (${championModel.display_name})`}
              />
            )}
          </div>
        </div>
      )}

      {/* Unsupervised Clustering / Segmentation if available */}
      {clustering && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Unsupervised Segmentation Analysis</h3>
              <p className="text-xs text-slate-400">
                K-Means clustering (optimal k = {clustering.optimal_k}, Silhouette = {clustering.kmeans_result.silhouette || "N/A"})
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-purple-950/50 text-purple-300 border border-purple-800 rounded-full font-medium">
              Empirical Segments
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <ClusterScatterChart points={clustering.kmeans_result.scatter_2d} />

            {/* Discovered Cluster Profiles */}
            <div className="space-y-3">
              <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Discovered Segment Profiles
              </h5>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {clustering.kmeans_result.cluster_profiles.map((cp, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{cp.name}</span>
                      <span className="font-mono text-purple-400">
                        {cp.size} observations ({cp.percentage}%)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                      {Object.entries(cp.feature_means).slice(0, 4).map(([f, meanVal]) => (
                        <span key={f} className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {f}: <strong className="text-slate-200">{meanVal}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execution Plan: Admissible vs Skipped Algorithms */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-1">Analysis Planner &amp; Admissibility Ledger</h3>
        <p className="text-xs text-slate-400 mb-4">
          Every algorithm execution is determined with principled statistical admissibility rules.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Planned */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
            <h5 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> Admissible Algorithms ({plan.planned_analyses.length})
            </h5>
            <ul className="text-xs space-y-1.5 text-slate-300">
              {plan.planned_analyses.map((p, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">&bull;</span>
                  <div>
                    <strong className="text-slate-200">{p.name}:</strong>{" "}
                    <span className="text-slate-400 text-[11px]">{p.description}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Skipped */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
            <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> Skipped Analyses ({plan.skipped_analyses.length})
            </h5>
            <ul className="text-xs space-y-1.5 text-slate-400">
              {plan.skipped_analyses.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-slate-600 font-bold">&bull;</span>
                  <div>
                    <strong className="text-slate-300">{s.name}:</strong>{" "}
                    <span className="text-slate-400 text-[11px]">{s.reason}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
