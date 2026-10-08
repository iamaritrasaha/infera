import { DatasetWorkspace } from "@/components/DatasetWorkspace";

export default function DashboardPage() {
  return <>
    <div className="dashboard-heading max-w-6xl mx-auto px-4 sm:px-6 pt-8">
      <h1 className="text-2xl font-bold text-white">Analysis Dashboard</h1>
      <p className="mt-2 text-sm text-slate-400">Upload a dataset or select a synthetic sample. Every result is computed by the Python analysis engine.</p>
    </div>
    <DatasetWorkspace compact />
  </>;
}
