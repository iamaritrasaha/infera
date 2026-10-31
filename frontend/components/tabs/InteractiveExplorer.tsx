"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Download, Filter, Loader2, Play, Plus, RotateCcw, X } from "lucide-react";
import { InsightChart } from "@/components/charts/InsightChart";
import { errorMessage, getExplorationOptions, runExploration } from "@/lib/api";
import type {
  AnalysisResponse,
  ExploreAggregation,
  ExploreMode,
  ExplorationFilter,
  ExplorationOptions,
  ExplorationResponse,
  KeyFinding,
  TrendFrequency,
} from "@/lib/types";

export interface ExplorationDrilldown {
  finding: KeyFinding;
  nonce: number;
}

interface InteractiveExplorerProps {
  data: AnalysisResponse;
  drilldown?: ExplorationDrilldown | null;
  onResultChange?: (result: ExplorationResponse | null) => void;
}

interface FilterDraft {
  id: number;
  column: string;
  values: string[];
  minimum: string;
  maximum: string;
  start: string;
  end: string;
}

const AGGREGATIONS: { value: ExploreAggregation; label: string }[] = [
  { value: "mean", label: "Mean" },
  { value: "median", label: "Median" },
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum (additive measures only)" },
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" },
];

const FREQUENCIES: { value: TrendFrequency; label: string }[] = [
  { value: "D", label: "Daily" },
  { value: "W", label: "Weekly" },
  { value: "M", label: "Monthly" },
  { value: "Q", label: "Quarterly" },
  { value: "Y", label: "Yearly" },
];
const FREQUENCY_DAYS: Record<TrendFrequency, number> = {
  D: 1,
  W: 7,
  M: 30.4375,
  Q: 91.3125,
  Y: 365.25,
};

function meaningfulFrequencies(options: ExplorationOptions | null) {
  if (
    !options
    || options.kind !== "date"
    || (options.observation_count ?? 0) < 2
    || (options.span_days ?? 0) <= 0
    || options.median_interval_days == null
  ) return [];
  return FREQUENCIES.filter(({ value }) => {
    const bucketDays = FREQUENCY_DAYS[value];
    const estimatedPeriods = Math.floor((options.span_days ?? 0) / bucketDays) + 1;
    return estimatedPeriods >= 2
      && estimatedPeriods <= 500
      && options.median_interval_days! <= bucketDays * 1.5;
  });
}

function recommendedFrequency(options: ExplorationOptions | null): TrendFrequency {
  const available = meaningfulFrequencies(options);
  const chartFriendly = available.find(({ value }) =>
    Math.floor((options?.span_days ?? 0) / FREQUENCY_DAYS[value]) + 1 <= 160,
  );
  return chartFriendly?.value ?? available[0]?.value ?? "M";
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const content = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\ufeff${content}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function format(value: number | null | undefined) {
  return value == null || !Number.isFinite(value)
    ? "Unavailable"
    : new Intl.NumberFormat(undefined, { maximumSignificantDigits: 6 }).format(value);
}

function FilterRow({
  datasetId,
  columns,
  draft,
  onChange,
  onRemove,
}: {
  datasetId: string;
  columns: { name: string; kind: "category" | "number" | "date" }[];
  draft: FilterDraft;
  onChange: (draft: FilterDraft) => void;
  onRemove: () => void;
}) {
  const [options, setOptions] = useState<ExplorationOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => () => requestController.current?.abort(), []);

  const chooseColumn = (column: string) => {
    requestController.current?.abort();
    setOptions(null);
    setError(null);
    onChange({ ...draft, column, values: [], minimum: "", maximum: "", start: "", end: "" });
    if (!column) return;
    const nextController = new AbortController();
    requestController.current = nextController;
    setLoading(true);
    getExplorationOptions(datasetId, column, nextController.signal)
      .then((next) => { if (!nextController.signal.aborted) setOptions(next); })
      .catch((reason) => { if (!nextController.signal.aborted) setError(errorMessage(reason)); })
      .finally(() => { if (!nextController.signal.aborted) setLoading(false); });
  };

  const columnKind = columns.find((column) => column.name === draft.column)?.kind;
  const set = (patch: Partial<FilterDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="grid gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 md:grid-cols-[minmax(150px,0.7fr)_minmax(220px,1fr)_auto] md:items-start">
      <label className="space-y-1 text-xs text-slate-300">
        <span>Filter column</span>
        <select
          aria-label="Filter column"
          value={draft.column}
          onChange={(event) => chooseColumn(event.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
        >
          <option value="">Choose a column</option>
          {columns.map((column) => <option key={column.name} value={column.name}>{column.name}</option>)}
        </select>
      </label>

      <div className="min-w-0 space-y-1 text-xs text-slate-300" aria-live="polite">
        {!draft.column && <p className="pt-6 text-slate-500">Choose a column to set its filter.</p>}
        {loading && <p className="pt-6 text-slate-400">Loading available values…</p>}
        {error && <p className="pt-2 text-rose-300">{error}</p>}
        {options?.kind === "category" && (
          <>
            <label htmlFor={`filter-values-${draft.id}`} className="block">Values to include</label>
            <select
              id={`filter-values-${draft.id}`}
              aria-label={`Values to include for ${draft.column}`}
              multiple
              size={Math.min(4, Math.max(2, options.values.length))}
              value={draft.values}
              onChange={(event) => set({ values: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })}
              className="max-h-28 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              {options.values.map((value) => <option key={value} value={value}>{value || "<empty>"}</option>)}
            </select>
            <p className="text-[11px] text-slate-500">Use Ctrl or Command to select more than one value.{options.truncated ? " Showing the 100 most frequent values." : ""}</p>
          </>
        )}
        {options?.kind === "number" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">Minimum ({format(options.minimum)})
              <input aria-label={`Minimum for ${draft.column}`} type="number" value={draft.minimum} onChange={(event) => set({ minimum: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
            </label>
            <label className="space-y-1">Maximum ({format(options.maximum)})
              <input aria-label={`Maximum for ${draft.column}`} type="number" value={draft.maximum} onChange={(event) => set({ maximum: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
            </label>
          </div>
        )}
        {options?.kind === "date" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">From ({options.start ?? "no dates"})
              <input aria-label={`Start date for ${draft.column}`} type="date" value={draft.start} min={options.start ?? undefined} max={options.end ?? undefined} onChange={(event) => set({ start: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
            </label>
            <label className="space-y-1">Through ({options.end ?? "no dates"})
              <input aria-label={`End date for ${draft.column}`} type="date" value={draft.end} min={options.start ?? undefined} max={options.end ?? undefined} onChange={(event) => set({ end: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
            </label>
          </div>
        )}
      </div>

      <button type="button" onClick={onRemove} aria-label={`Remove ${draft.column || "empty"} filter`} className="justify-self-end rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
        <X size={16} />
      </button>
      {columnKind && <span className="sr-only">Filter type: {columnKind}</span>}
    </div>
  );
}

export function InteractiveExplorer({ data, drilldown, onResultChange }: InteractiveExplorerProps) {
  const metrics = useMemo(
    () => data.schema.numerical_columns.filter((column) => !data.schema.id_columns.includes(column) && !data.schema.constant_columns.includes(column)),
    [data.schema],
  );
  const groupColumns = useMemo(() => {
    const candidates = new Set([
      ...data.schema.categorical_columns,
      ...data.schema.columns.filter((column) => column.inferred_type === "boolean").map((column) => column.name),
    ]);
    return [...candidates].filter((column) =>
      !data.schema.id_columns.includes(column)
      && !data.schema.constant_columns.includes(column)
      && (data.schema.columns.find((item) => item.name === column)?.unique_count ?? 0) <= 50,
    );
  }, [data.schema]);
  const filterColumns = useMemo(() => {
    const columns: { name: string; kind: "category" | "number" | "date" }[] = [];
    for (const column of data.schema.columns) {
      if (data.schema.id_columns.includes(column.name) || data.schema.constant_columns.includes(column.name)) continue;
      if (column.inferred_type === "numerical") columns.push({ name: column.name, kind: "number" });
      else if (column.inferred_type === "datetime") columns.push({ name: column.name, kind: "date" });
      else if ((column.inferred_type === "categorical" || column.inferred_type === "boolean") && column.unique_count <= 100)
        columns.push({ name: column.name, kind: "category" });
    }
    return columns;
  }, [data.schema]);

  const focus = data.insight_discovery.selected_focus;
  const findingEvidence = drilldown?.finding.evidence;
  const findingText = (key: string) => typeof findingEvidence?.[key] === "string" ? findingEvidence[key] as string : undefined;
  const findingMetric = findingText("metric_column") ?? findingText("feature_a");
  const findingGroup = findingText("group_column");
  const findingDate = findingText("time_column");
  const findingFirst = findingText("feature_a");
  const findingSecond = findingText("feature_b");
  const findingMetricValid = findingMetric && metrics.includes(findingMetric) ? findingMetric : undefined;
  const findingGroupValid = findingGroup && groupColumns.includes(findingGroup) ? findingGroup : undefined;
  const findingDateValid = findingDate && data.schema.datetime_columns.includes(findingDate) && findingMetricValid ? findingDate : undefined;
  const findingRelationshipValid = findingFirst && findingSecond && metrics.includes(findingFirst) && metrics.includes(findingSecond);
  const initialMetric = findingGroupValid && !findingMetricValid
    ? ""
    : findingMetricValid ?? (focus.metric_column && metrics.includes(focus.metric_column) ? focus.metric_column : metrics[0] ?? "");
  const initialGroup = findingGroupValid
    ? findingGroupValid
    : focus.group_column && groupColumns.includes(focus.group_column) ? focus.group_column : groupColumns[0] ?? "";
  const initialDate = findingDateValid
    ? findingDateValid
    : focus.date_column && data.schema.datetime_columns.includes(focus.date_column) ? focus.date_column : data.schema.datetime_columns[0] ?? "";
  const initialMode: ExploreMode = findingDateValid ? "trend"
    : findingGroupValid ? "group"
      : findingRelationshipValid ? "relationship"
        : groupColumns.length ? "group" : "trend";
  const drilldownHasRoute = !!findingDateValid || !!findingGroupValid || !!findingRelationshipValid;
  const [mode, setMode] = useState<ExploreMode>(initialMode);
  const [metric, setMetric] = useState(initialMetric);
  const [group, setGroup] = useState(initialGroup);
  const [dateColumn, setDateColumn] = useState(initialDate);
  const [compare, setCompare] = useState(findingSecond && metrics.includes(findingSecond) ? findingSecond : metrics.find((column) => column !== initialMetric) ?? "");
  const [aggregation, setAggregation] = useState<ExploreAggregation>(findingGroupValid && !findingMetricValid ? "count" : findingGroupValid ? "median" : "mean");
  const [frequency, setFrequency] = useState<TrendFrequency>("M");
  const [dateCoverageResult, setDateCoverageResult] = useState<{
    column: string;
    options: ExplorationOptions | null;
    error: string | null;
  } | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<ExplorationFilter[]>([]);
  const [drafts, setDrafts] = useState<FilterDraft[]>([]);
  const [result, setResult] = useState<ExplorationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(drilldown && drilldownHasRoute
    ? "Finding controls loaded from its evidence. Run the exploration to compute the result for this session."
    : drilldown && findingMetric
      ? `Selected ${findingMetric}. Its full-dataset distribution and diagnostics are shown below; use the filters above to calculate a new comparison.`
      : drilldown
        ? "This finding does not provide a supported metric and dimension pair. Review its evidence and use the selectors to continue exploring."
        : null);
  const controller = useRef<AbortController | null>(null);
  const dateCoverageController = useRef<AbortController | null>(null);
  const currentDateCoverageResult = dateCoverageResult?.column === dateColumn ? dateCoverageResult : null;
  const dateCoverage = currentDateCoverageResult?.options ?? null;
  const dateCoverageLoading = mode === "trend" && !!dateColumn && !currentDateCoverageResult;
  const dateCoverageError = currentDateCoverageResult?.error ?? null;

  useEffect(() => () => {
    controller.current?.abort();
    dateCoverageController.current?.abort();
  }, []);

  useEffect(() => {
    dateCoverageController.current?.abort();
    if (mode !== "trend" || !dateColumn) return;
    const requestController = new AbortController();
    dateCoverageController.current = requestController;
    getExplorationOptions(data.dataset_id, dateColumn, requestController.signal)
      .then((coverage) => {
        if (requestController.signal.aborted) return;
        setDateCoverageResult({ column: dateColumn, options: coverage, error: null });
        setFrequency(recommendedFrequency(coverage));
      })
      .catch((reason) => {
        if (!requestController.signal.aborted) {
          setDateCoverageResult({ column: dateColumn, options: null, error: errorMessage(reason) });
        }
      });
    return () => requestController.abort();
  }, [data.dataset_id, dateColumn, mode]);

  const run = async (
    selectedMode: ExploreMode = mode,
    override: Partial<{
      metric_column: string;
      group_column: string;
      time_column: string;
      compare_column: string;
      aggregation: ExploreAggregation;
      frequency: TrendFrequency;
      filters: ExplorationFilter[];
    }> = {},
  ) => {
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setLoading(true);
    setError(null);
    setNotice(null);
    setResult(null);
    onResultChange?.(null);
    try {
      let selectedFrequency = override.frequency ?? frequency;
      const selectedTimeColumn = (override.time_column ?? dateColumn) || null;
      let selectedCoverage = dateCoverage?.column === selectedTimeColumn ? dateCoverage : null;
      if (selectedMode === "trend" && selectedTimeColumn && !selectedCoverage) {
        selectedCoverage = await getExplorationOptions(data.dataset_id, selectedTimeColumn, nextController.signal);
        if (nextController.signal.aborted) return;
        setDateCoverageResult({ column: selectedTimeColumn, options: selectedCoverage, error: null });
      }
      if (selectedMode === "trend" && selectedTimeColumn) {
        const choices = meaningfulFrequencies(selectedCoverage);
        if (!choices.length) {
          throw new Error("This date field needs at least two distinct, spaced observations for a trend comparison.");
        }
        if (!choices.some((choice) => choice.value === selectedFrequency)) {
          selectedFrequency = recommendedFrequency(selectedCoverage);
          setFrequency(selectedFrequency);
        }
      }
      const payload = {
        dataset_id: data.dataset_id,
        mode: selectedMode,
        metric_column: (override.metric_column ?? metric) || null,
        group_column: (override.group_column ?? group) || null,
        time_column: selectedTimeColumn,
        compare_column: (override.compare_column ?? compare) || null,
        aggregation: override.aggregation ?? aggregation,
        frequency: selectedFrequency,
        filters: override.filters ?? appliedFilters,
      };
      const response = await runExploration(payload, nextController.signal);
      if (!nextController.signal.aborted) {
        setResult(response);
        onResultChange?.(response);
      }
    } catch (reason) {
      if (!nextController.signal.aborted) setError(errorMessage(reason));
    } finally {
      if (!nextController.signal.aborted) setLoading(false);
    }
  };

  const applyQuestion = (question: string) => {
    const referenced = [...question.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    const referencedMetric = referenced.find((column) => metrics.includes(column));
    const referencedGroup = referenced.find((column) => groupColumns.includes(column));
    const referencedDate = referenced.find((column) => data.schema.datetime_columns.includes(column));
    setNotice(null);
    if (/vary across/i.test(question) && referencedMetric && referencedGroup) {
      setMode("group"); setMetric(referencedMetric); setGroup(referencedGroup); setAggregation("median");
      void run("group", { metric_column: referencedMetric, group_column: referencedGroup, aggregation: "median" });
      return;
    }
    if (/(evolve|over the observed dates)/i.test(question) && referencedMetric && referencedDate) {
      setMode("trend"); setMetric(referencedMetric); setDateColumn(referencedDate);
      void run("trend", { metric_column: referencedMetric, time_column: referencedDate });
      return;
    }
    if (/correlat/i.test(question) && referencedMetric) {
      const strongest = data.correlations.top_correlations.find((pair) => pair.feature_a === referencedMetric || pair.feature_b === referencedMetric);
      const other = strongest
        ? (strongest.feature_a === referencedMetric ? strongest.feature_b : strongest.feature_a)
        : metrics.find((column) => column !== referencedMetric);
      if (other && metrics.includes(other)) {
        setMode("relationship"); setMetric(referencedMetric); setCompare(other);
        void run("relationship", { metric_column: referencedMetric, compare_column: other });
        return;
      }
    }
    setNotice("This suggested question is not supported by the columns in the current result. Choose a metric and comparison above.");
  };

  const addFilter = () => setDrafts((current) => [...current, {
    id: Date.now() + current.length, column: "", values: [], minimum: "", maximum: "", start: "", end: "",
  }]);

  const applyFilters = () => {
    const next: ExplorationFilter[] = [];
    for (const draft of drafts) {
      if (!draft.column) continue;
      const kind = filterColumns.find((item) => item.name === draft.column)?.kind;
      if (kind === "category") {
        if (!draft.values.length) { setError(`Choose one or more values for ${draft.column}, or remove that filter.`); return; }
        next.push({ column: draft.column, kind, values: draft.values });
      } else if (kind === "number") {
        if (!draft.minimum && !draft.maximum) { setError(`Set a minimum or maximum for ${draft.column}, or remove that filter.`); return; }
        next.push({ column: draft.column, kind, minimum: draft.minimum ? Number(draft.minimum) : null, maximum: draft.maximum ? Number(draft.maximum) : null });
      } else if (kind === "date") {
        if (!draft.start && !draft.end) { setError(`Set a start or end date for ${draft.column}, or remove that filter.`); return; }
        next.push({ column: draft.column, kind, start: draft.start || null, end: draft.end || null });
      }
    }
    setAppliedFilters(next);
    void run(mode, { filters: next });
  };

  const clearFilters = () => {
    setDrafts([]);
    setAppliedFilters([]);
    void run(mode, { filters: [] });
  };

  const resetAll = () => {
    const nextMetric = focus.metric_column && metrics.includes(focus.metric_column) ? focus.metric_column : metrics[0] ?? "";
    const nextGroup = focus.group_column && groupColumns.includes(focus.group_column) ? focus.group_column : groupColumns[0] ?? "";
    const nextDate = focus.date_column && data.schema.datetime_columns.includes(focus.date_column) ? focus.date_column : data.schema.datetime_columns[0] ?? "";
    const nextMode: ExploreMode = groupColumns.length ? "group" : "trend";
    setMode(nextMode); setMetric(nextMetric); setGroup(nextGroup); setDateColumn(nextDate);
    setCompare(metrics.find((column) => column !== nextMetric) ?? ""); setAggregation("mean"); setFrequency("M");
    setDrafts([]); setAppliedFilters([]); setResult(null); setError(null); setNotice(null);
    onResultChange?.(null);
  };

  const invalidateResult = () => {
    setResult(null);
    onResultChange?.(null);
  };

  const currentMetricName = metric.toLocaleLowerCase();
  const canSum = !/(percent|percentage|pct|rate|ratio|share|fraction)/.test(currentMetricName);
  const aggregationOptions = AGGREGATIONS.filter((option) => option.value !== "sum" || canSum);
  const dateOptions = data.schema.datetime_columns;

  return (
    <section className="space-y-5 rounded-xl border border-cyan-800/40 bg-slate-900/70 p-4 sm:p-5" aria-labelledby="interactive-explorer-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">FILTERED PYTHON CALCULATIONS</p>
          <h2 id="interactive-explorer-title" className="mt-1 text-lg font-semibold text-white">Interactive Data Explorer</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">Choose what to compare, apply filters, and recalculate the visible evidence on the selected rows. No meaning or units are inferred from column names.</p>
        </div>
        <div className="rounded-md border border-blue-800/70 bg-blue-950/40 px-2.5 py-1.5 text-[11px] text-blue-200">Current scope: selected filters</div>
      </div>

      {data.insight_discovery.suggested_questions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-200">Questions this dataset can answer</h3>
          <div className="flex flex-wrap gap-2">
            {data.insight_discovery.suggested_questions.map((question) => (
              <button key={question} type="button" onClick={() => applyQuestion(question)} className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-left text-xs text-slate-300 hover:border-cyan-500/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
                {question} <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">These deterministic suggestions map to the group, date, or correlation calculations below. This is not an open-ended chatbot.</p>
        </div>
      )}

      <div role="tablist" aria-label="Exploration type" className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {([
          ["group", "Group comparison", groupColumns.length > 0],
          ["trend", "Trend explorer", dateOptions.length > 0],
          ["relationship", "Relationship", metrics.length > 1],
        ] as const).map(([value, label, available]) => (
          <button key={value} type="button" role="tab" aria-selected={mode === value} disabled={!available} onClick={() => { invalidateResult(); setMode(value); }} className={`rounded-lg px-3 py-2 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:cursor-not-allowed disabled:opacity-40 ${mode === value ? "bg-cyan-950 text-cyan-100 ring-1 ring-cyan-700" : "bg-slate-950 text-slate-400 hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs text-slate-300">
          <span>Metric</span>
          <select aria-label="Exploration metric" value={metric} onChange={(event) => { invalidateResult(); setMetric(event.target.value); }} disabled={!metrics.length} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
            <option value="">Count rows</option>{metrics.map((column) => <option key={column} value={column}>{column}</option>)}
          </select>
        </label>
        {mode === "group" && <>
          <label className="space-y-1 text-xs text-slate-300"><span>Group by</span>
            <select aria-label="Group column" value={group} onChange={(event) => { invalidateResult(); setGroup(event.target.value); }} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
              <option value="">Choose a group</option>{groupColumns.map((column) => <option key={column} value={column}>{column}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-300"><span>Calculate</span>
            <select aria-label="Group aggregation" value={aggregation} onChange={(event) => { invalidateResult(); setAggregation(event.target.value as ExploreAggregation); }} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
              {aggregationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </>}
        {mode === "trend" && <>
          <label className="space-y-1 text-xs text-slate-300"><span>Time column</span>
            <select aria-label="Time column" value={dateColumn} onChange={(event) => { invalidateResult(); setDateColumn(event.target.value); }} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
              <option value="">Choose a date column</option>{dateOptions.map((column) => <option key={column} value={column}>{column}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-300"><span>Period</span>
            <select aria-label="Trend period" value={frequency} disabled={dateCoverageLoading || !meaningfulFrequencies(dateCoverage).length} onChange={(event) => { invalidateResult(); setFrequency(event.target.value as TrendFrequency); }} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-50">
              {meaningfulFrequencies(dateCoverage).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-300"><span>Calculate</span>
            <select aria-label="Trend aggregation" value={aggregation} onChange={(event) => { invalidateResult(); setAggregation(event.target.value as ExploreAggregation); }} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
              {aggregationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </>}
        {mode === "relationship" && <label className="space-y-1 text-xs text-slate-300"><span>Compare with</span>
          <select aria-label="Second metric" value={compare} onChange={(event) => { invalidateResult(); setCompare(event.target.value); }} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
            {metrics.filter((column) => column !== metric).map((column) => <option key={column} value={column}>{column}</option>)}
          </select>
        </label>}
      </div>
      {mode === "trend" && dateCoverageLoading && <p role="status" className="text-[11px] text-slate-500">Checking the observed date range and spacing…</p>}
      {mode === "trend" && dateCoverageError && <p role="status" className="text-[11px] text-amber-200">{dateCoverageError} Trend interval choices will refresh when the date field loads.</p>}
      {mode === "trend" && !dateCoverageLoading && dateCoverage && !meaningfulFrequencies(dateCoverage).length && <p role="status" className="text-[11px] text-amber-200">At least two distinct, spaced observations are needed for a date comparison.</p>}
      {aggregation === "sum" && <p className="text-[11px] text-amber-200">Sum adds every selected row. Use it only when the measure is additive; percentages and rates cannot be summed.</p>}

      <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200"><Filter size={14} className="text-cyan-300" /> Filters</div>
          <button type="button" onClick={addFilter} disabled={!filterColumns.length || drafts.length >= 8} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"><Plus size={13} /> Add filter</button>
        </div>
        {drafts.map((draft) => <FilterRow key={draft.id} datasetId={data.dataset_id} columns={filterColumns} draft={draft} onChange={(next) => setDrafts((current) => current.map((item) => item.id === next.id ? next : item))} onRemove={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))} />)}
        {appliedFilters.length > 0 && <div className="flex flex-wrap gap-1.5" aria-label="Active filters">
          {appliedFilters.map((filter) => <span key={filter.column} className="rounded-full border border-cyan-900 bg-cyan-950/50 px-2.5 py-1 text-[11px] text-cyan-100">{filter.column}: {filter.kind === "category" ? filter.values?.join(", ") : filter.kind === "number" ? `${filter.minimum ?? "−∞"} to ${filter.maximum ?? "∞"}` : `${filter.start ?? "earliest"} to ${filter.end ?? "latest"}`}</span>)}
        </div>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={applyFilters} disabled={loading} className="button-primary inline-flex items-center gap-1.5 text-xs disabled:opacity-50"><Filter size={13} /> Apply filters</button>
          <button type="button" onClick={clearFilters} disabled={loading || (!drafts.length && !appliedFilters.length)} className="button-secondary text-xs disabled:opacity-50">Clear filters</button>
          <button type="button" onClick={resetAll} disabled={loading} className="button-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-50"><RotateCcw size={13} /> Reset all</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
        <button type="button" onClick={() => void run()} disabled={loading} className="button-primary inline-flex items-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={14} />} {loading ? "Computing…" : "Run exploration"}
        </button>
        <span className="text-[11px] text-slate-500">Each run recalculates on the backend; results are capped for the free service.</span>
      </div>

      {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-200"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">{notice}</p>}

      {result && <div className="space-y-4 border-t border-slate-800 pt-4" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Computed result</h3>
            <p className="mt-1 text-xs text-slate-400">{result.filtered_rows.toLocaleString()} of {result.dataset_rows.toLocaleString()} rows matched the filters; {result.usable_rows.toLocaleString()} usable observations contributed to this calculation.</p>
          </div>
          {result.mode === "group" && result.groups.length > 0 && <button type="button" onClick={() => downloadCsv("infera-group-exploration.csv", ["group", result.aggregation, "sample_size"], result.groups.map((row) => [row.group, row.value, row.sample_size]))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"><Download size={13} /> Download aggregate CSV</button>}
          {result.mode === "trend" && result.periods.length > 0 && <button type="button" onClick={() => downloadCsv("infera-trend-aggregates.csv", ["period", result.aggregation, "sample_size"], result.periods.map((row) => [row.period, row.value, row.sample_size]))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"><Download size={13} /> Download period CSV</button>}
        </div>

        {result.status === "empty" ? <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-100">{result.interpretation}</p> : <>
          {result.chart && <InsightChart chart={result.chart} id="interactive-explorer-chart" />}
          <p className="rounded-lg border border-cyan-900/70 bg-cyan-950/20 p-3 text-sm leading-6 text-cyan-50">{result.interpretation}</p>
          {result.mode === "group" && result.groups.length > 0 && <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[440px] text-left text-xs"><caption className="sr-only">Group summary and sample sizes</caption><thead className="bg-slate-900 text-slate-300"><tr><th className="px-3 py-2">{result.group_column}</th><th className="px-3 py-2">{result.aggregation} {result.metric_column || "records"}</th><th className="px-3 py-2">Sample size</th></tr></thead><tbody className="divide-y divide-slate-800">{result.groups.map((row) => <tr key={row.group}><th scope="row" className="max-w-[240px] truncate px-3 py-2 font-medium text-slate-200" title={row.group}>{row.group}</th><td className="px-3 py-2 font-mono text-slate-300">{format(row.value)}</td><td className="px-3 py-2 font-mono text-slate-400">{row.sample_size.toLocaleString()}</td></tr>)}</tbody></table>
          </div>}
          {result.mode === "trend" && result.periods.length > 0 && <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Observed range", `${result.first_period?.period ?? "unavailable"} to ${result.last_period?.period ?? "unavailable"}`],
                ["First to last change", format(result.absolute_change)],
                ["Percentage change", result.percentage_change == null ? "Undefined from zero baseline" : `${format(result.percentage_change)}%`],
                ["Missing periods", result.missing_periods.toLocaleString()],
                ["Highest period", `${result.highest_period?.period ?? "unavailable"}: ${format(result.highest_period?.value)}`],
                ["Lowest period", `${result.lowest_period?.period ?? "unavailable"}: ${format(result.lowest_period?.value)}`],
                ["Period-to-period change", format(result.period_over_period_change)],
                ["Period variability (SD)", format(result.variability)],
              ].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-100">{value}</p></div>)}
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full min-w-[440px] text-left text-xs"><caption className="sr-only">Computed value by observed period</caption><thead className="bg-slate-900 text-slate-300"><tr><th className="px-3 py-2">Period</th><th className="px-3 py-2">{result.aggregation} {result.metric_column || "records"}</th><th className="px-3 py-2">Sample size</th></tr></thead><tbody className="divide-y divide-slate-800">{result.periods.map((row) => <tr key={row.period}><th scope="row" className="px-3 py-2 font-medium text-slate-200">{row.period}</th><td className="px-3 py-2 font-mono text-slate-300">{format(row.value)}</td><td className="px-3 py-2 font-mono text-slate-400">{row.sample_size.toLocaleString()}</td></tr>)}</tbody></table>
            </div>
            {result.unusual_changes.length > 0 && <p className="text-xs text-amber-200">{result.unusual_changes.length} period-to-period change(s) were large relative to the median absolute change. This is a screening signal, not a verified anomaly cause.</p>}
          </>}
          {result.mode === "relationship" && <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[11px] text-slate-500">Pearson linear correlation</p><p className="mt-1 font-mono text-lg text-cyan-100">{format(result.pearson_r)}</p></div><div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[11px] text-slate-500">Spearman rank correlation</p><p className="mt-1 font-mono text-lg text-cyan-100">{format(result.spearman_rho)}</p></div><div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[11px] text-slate-500">Complete pairs</p><p className="mt-1 font-mono text-lg text-cyan-100">{result.valid_pairs.toLocaleString()}</p></div></div>}
        </>}
        <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <h4 className="text-xs font-semibold text-slate-200">How to read this result</h4>
          <ul className="list-disc space-y-1 pl-4 text-[11px] leading-5 text-slate-400">{result.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
        </div>
      </div>}
    </section>
  );
}
