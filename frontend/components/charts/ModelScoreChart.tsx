import { ClassificationModelResult, RegressionModelResult } from "@/lib/types";
import { formatMetric } from "@/lib/format";

export function ModelScoreChart({
  models,
  regression,
}: {
  models: (ClassificationModelResult | RegressionModelResult)[];
  regression: boolean;
}) {
  const values = models.map((m) => ({
    name: m.display_name,
    best: m.is_best_model,
    value: regression
      ? (m as RegressionModelResult).r2_test
      : (m as ClassificationModelResult).f1_macro,
  }));
  const finite = values.filter(
    (m) => m.value != null && Number.isFinite(m.value),
  );
  if (!finite.length)
    return (
      <p className="chart-empty">No test scores available for comparison.</p>
    );
  const low = Math.min(0, ...finite.map((m) => m.value)),
    high = Math.max(1, ...finite.map((m) => m.value));
  const scale = (v: number) => ((v - low) / (high - low)) * 100;
  const zero = scale(0);
  return (
    <div className="model-score-chart">
      <p className="text-xs text-slate-300 mb-4">
        Held-out {regression ? "R²" : "Macro F1"} · higher is better
      </p>
      <div className="space-y-3">
        {values.map((m) => (
          <div className="model-score-row" key={m.name}>
            <span title={m.name}>{m.name}</span>
            <div className="score-track">
              <i className="score-zero" style={{ left: `${zero}%` }} />
              {m.value != null && Number.isFinite(m.value) && (
                <i
                  className={`score-bar ${m.best ? "selected" : ""}`}
                  style={{
                    left: `${Math.min(zero, scale(m.value))}%`,
                    width: `${Math.abs(scale(m.value) - zero)}%`,
                  }}
                />
              )}
            </div>
            <strong>{formatMetric(m.value)}</strong>
          </div>
        ))}
      </div>
      <div className="score-ticks">
        <span>{formatMetric(low)}</span>
        <span>{formatMetric(high)}</span>
      </div>
      <p className="chart-note mt-3">
        Selection follows the validation method described below. A high test
        score alone does not establish generalization.
      </p>
    </div>
  );
}
