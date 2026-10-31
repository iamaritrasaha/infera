/** Scientific ticks preserve signs and use exponent notation for extreme magnitudes. */
export function formatMetric(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  const magnitude = Math.abs(value);
  if (magnitude >= 1e6 || (magnitude > 0 && magnitude < 0.001))
    return value.toExponential(2);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: magnitude < 1 ? 3 : 2,
  }).format(value);
}
