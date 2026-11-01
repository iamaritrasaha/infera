"use client";

import { useState } from "react";
import { Upload } from "@/components/Upload";
import { Results } from "@/components/Results";
import { DatasetResponse } from "@/lib/api";

export default function HomePage() {
  const [dataset, setDataset] = useState<DatasetResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="min-h-full py-12 px-4 sm:px-6">
      {!dataset ? (
        <div className="max-w-4xl mx-auto space-y-10 text-center animate-fade-in">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-100 tracking-tight">
              Turn Data Into <span className="text-blue-400">Evidence</span>
            </h1>
            <p className="max-w-2xl mx-auto text-base text-slate-400">
              Upload any CSV dataset to instantly inspect descriptive statistics, Pearson correlations,
              and train an explainable Linear Regression model with proper train/test validation.
            </p>
          </div>

          <Upload
            onDatasetLoaded={(data) => setDataset(data)}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        </div>
      ) : (
        <Results dataset={dataset} onReset={() => setDataset(null)} />
      )}
    </div>
  );
}
