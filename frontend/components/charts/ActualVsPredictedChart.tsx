import { ScientificScatter } from "./ScientificScatter";

export function ActualVsPredictedChart({
  data,
  targetName,
}: {
  data: { actual: number; predicted: number }[];
  targetName: string;
}) {
  return (
    <ScientificScatter
      title={`Predicted vs Actual (${targetName})`}
      xLabel="Actual"
      yLabel="Predicted"
      diagonal
      points={(data || []).map((p) => ({
        x: p.actual,
        y: p.predicted,
        label: targetName,
      }))}
    />
  );
}
