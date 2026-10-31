import { ScientificScatter } from "./ScientificScatter";

export function ResidualChart({
  data,
}: {
  data: { predicted: number; residual: number }[];
}) {
  return (
    <ScientificScatter
      title="Residuals vs Predicted"
      xLabel="Predicted"
      yLabel="Residual"
      zeroLine
      points={(data || []).map((p) => ({
        x: p.predicted,
        y: p.residual,
        label: "Test observation",
      }))}
    />
  );
}
