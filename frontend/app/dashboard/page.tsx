import type { Metadata } from "next";
import { DatasetWorkspace } from "@/components/DatasetWorkspace";

export const metadata: Metadata = {
  title: "Analysis Workspace",
  description: "Upload a structured dataset or choose a sample to profile data quality and compute evidence-backed findings.",
  alternates: { canonical: "/dashboard" },
};

export default function DashboardPage() {
  return <DatasetWorkspace />;
}
