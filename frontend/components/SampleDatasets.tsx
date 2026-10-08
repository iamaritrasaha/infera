"use client";

import React, { useState } from "react";
import { SampleDatasetInfo, UploadResponse } from "@/lib/types";
import { loadSampleDataset } from "@/lib/api";
import { BarChart3, Database, Home, Loader2, TrendingUp, Users } from "lucide-react";

interface SampleDatasetsProps {
  onLoadSample: (res: UploadResponse) => void;
}

const SAMPLE_ICONS: Record<string, React.ElementType> = {
  housing: Home,
  customer_churn: Users,
  student_performance: BarChart3,
  retail_sales: TrendingUp,
};

export function SampleDatasets({ onLoadSample }: SampleDatasetsProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const samples: SampleDatasetInfo[] = [
    {
      id: "housing",
      name: "Housing Sales",
      description: "250 properties with sqft, rooms, and price. Benchmarks 7 regression models.",
      row_count: 250,
      column_count: 11,
      recommended_target: "price",
      suggested_problem_type: "regression",
    },
    {
      id: "customer_churn",
      name: "Telecom Churn",
      description: "300 subscriber accounts. Benchmarks binary classification, ROC-AUC, and imbalance.",
      row_count: 300,
      column_count: 10,
      recommended_target: "churned",
      suggested_problem_type: "binary_classification",
    },
    {
      id: "student_performance",
      name: "Student Scores",
      description: "250 student study habits and exam tiers. Multiclass & continuous testing.",
      row_count: 250,
      column_count: 10,
      recommended_target: "performance_tier",
      suggested_problem_type: "multiclass_classification",
    },
    {
      id: "retail_sales",
      name: "Retail Store Sales",
      description: "200 chronological records with seasonal holidays and fuel price indicators.",
      row_count: 200,
      column_count: 9,
      recommended_target: "weekly_sales",
      suggested_problem_type: "time_series",
    },
  ];

  const handleSelect = async (sampleId: string) => {
    setLoadingId(sampleId);
    try {
      const result = await loadSampleDataset(sampleId);
      onLoadSample(result);
    } catch (err: any) {
      alert(err.message || "Failed to load sample dataset");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-medium text-slate-300">Or explore instantly with a pre-packaged benchmark:</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {samples.map((s) => {
          const Icon = SAMPLE_ICONS[s.id] || Database;
          const isLoading = loadingId === s.id;

          return (
            <button
              key={s.id}
              onClick={() => handleSelect(s.id)}
              disabled={loadingId !== null}
              className="text-left bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-slate-800 rounded-lg text-slate-300 group-hover:text-blue-400 transition-colors">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    {s.suggested_problem_type.replace("_", " ")}
                  </span>
                </div>

                <div>
                  <h5 className="text-xs font-semibold text-slate-100 group-hover:text-white">{s.name}</h5>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{s.description}</p>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                <span>Target: <strong className="text-slate-400">{s.recommended_target}</strong></span>
                <span className="text-blue-400 font-medium group-hover:underline">Launch &rarr;</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
