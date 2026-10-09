import type { AnalysisResponse, ExplorationResponse } from "@/lib/types";

function markdownValue(value: string | number) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}\[\]()#+\-.!>|])/g, "\\$1")
    .replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char] ?? char)
    .replace(/[\r\n]/g, " ");
}

function filterDescription(filter: ExplorationResponse["filters"][number]) {
  const values = filter.values;
  if (filter.kind === "category") {
    return `${filter.column} includes ${Array.isArray(values) ? values.map(markdownValue).join(", ") : "selected categories"}`;
  }
  if (filter.kind === "number") {
    return `${filter.column} from ${filter.minimum ?? "no minimum"} through ${filter.maximum ?? "no maximum"}`;
  }
  return `${filter.column} from ${filter.start ?? "earliest"} through ${filter.end ?? "latest"}`;
}

export function appendExplorationReport(data: AnalysisResponse, result: ExplorationResponse | null) {
  if (!result) return data.reports.markdown;
  const lines = [
    "",
    "## Interactive exploration",
    "",
    `This appendix records the filtered calculation visible in the Interactive Data Explorer. The preceding report describes the full-dataset analysis.`,
    "",
    `- **Calculation:** ${markdownValue(result.mode)}; ${markdownValue(result.aggregation)}${result.metric_column ? ` of \`${markdownValue(result.metric_column)}\`` : " of rows"}`,
    `- **Rows:** ${result.filtered_rows.toLocaleString()} of ${result.dataset_rows.toLocaleString()} matched the filters; ${result.usable_rows.toLocaleString()} usable observations contributed.`,
  ];
  if (result.group_column) lines.push(`- **Group:** \`${markdownValue(result.group_column)}\``);
  if (result.time_column) lines.push(`- **Time column and interval:** \`${markdownValue(result.time_column)}\`; ${markdownValue(result.frequency ?? "not available")}`);
  if (result.compare_column) lines.push(`- **Compared with:** \`${markdownValue(result.compare_column)}\``);
  lines.push("", "### Applied filters", "");
  if (result.filters.length) lines.push(...result.filters.map((filter) => `- ${filterDescription(filter)}`));
  else lines.push("No filters were applied.");
  lines.push("", "### Computed result", "", markdownValue(result.interpretation), "");

  if (result.mode === "group" && result.groups.length) {
    lines.push("| Group | Value | Sample size |", "| --- | ---: | ---: |", ...result.groups.map((row) => `| ${markdownValue(row.group)} | ${row.value} | ${row.sample_size} |`), "");
  } else if (result.mode === "trend" && result.periods.length) {
    lines.push("| Period | Value | Sample size |", "| --- | ---: | ---: |", ...result.periods.map((row) => `| ${markdownValue(row.period)} | ${row.value} | ${row.sample_size} |`), "");
    lines.push(
      `- **First to last change:** ${result.absolute_change ?? "unavailable"}${result.percentage_change == null ? " (percentage is undefined from a zero baseline)" : ` (${result.percentage_change}%)`}`,
      `- **Missing periods:** ${result.missing_periods}`,
      `- **Highest / lowest periods:** ${result.highest_period?.period ?? "unavailable"} / ${result.lowest_period?.period ?? "unavailable"}`,
      `- **Period variability (sample SD):** ${result.variability ?? "unavailable"}`,
      "",
    );
  } else if (result.mode === "relationship") {
    lines.push(
      `- **Pearson correlation:** ${result.pearson_r ?? "unavailable"}`,
      `- **Spearman rank correlation:** ${result.spearman_rho ?? "unavailable"}`,
      `- **Complete pairs:** ${result.valid_pairs}`,
      "",
    );
  }

  if (result.limitations.length) {
    lines.push("### Limitations", "", ...result.limitations.map((limitation) => `- ${markdownValue(limitation)}`), "");
  }
  return `${data.reports.markdown.trimEnd()}\n${lines.join("\n")}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

export function downloadReportText(title: string, format: "markdown" | "html", markdown: string) {
  const safeTitle = title.replace(/[\r\n<>]/g, " ").slice(0, 120) || "Infera evidence report";
  const content = format === "markdown"
    ? markdown
    : `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(safeTitle)}</title><style>body{margin:0;background:#f4f7fb;color:#172033;font:15px/1.7 system-ui,sans-serif}main{max-width:1000px;margin:3rem auto;padding:2rem;background:white;border:1px solid #dbe3ed;border-radius:16px}h1{font-size:1.5rem}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.8 ui-monospace,monospace}</style></head><body><main><h1>${escapeHtml(safeTitle)}</h1><pre>${escapeHtml(markdown)}</pre><footer>Created and maintained by Aritra Saha · Infera</footer></main></body></html>`;
  const mime = format === "markdown" ? "text/markdown;charset=utf-8" : "text/html;charset=utf-8";
  const extension = format === "markdown" ? "md" : "html";
  const filename = safeTitle.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "infera-report";
  const objectUrl = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${filename}.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
