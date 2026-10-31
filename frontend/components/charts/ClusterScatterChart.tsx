import { ScientificScatter } from "./ScientificScatter";

type ClusterPoint = {
  pca_x: number;
  pca_y: number;
  cluster: number;
  cluster_label: string;
};
export function ClusterScatterChart({
  points,
  title = "2D PCA Cluster Projection",
}: {
  points: ClusterPoint[];
  title?: string;
}) {
  const labels = new Map<number, string>();
  (points || []).forEach((p) => labels.set(p.cluster, p.cluster_label));
  return (
    <ScientificScatter
      title={title}
      xLabel="Principal component 1"
      yLabel="Principal component 2"
      points={(points || []).map((p) => ({
        x: p.pca_x,
        y: p.pca_y,
        label: p.cluster_label,
        group: p.cluster,
      }))}
      legend={Array.from(labels, ([group, label]) => ({ group, label }))}
    />
  );
}
