// Public API of the cluster module. UI lanes import from "@/components/cluster";
// pages that only need the static subpage motif import "@/components/cluster/motif"
// instead (server-only, ships no client code).
// ClusterMonitor is a Server Component: the frame, the SVG poster and the default
// caption are in the server HTML. The client island adds the gated, lazy R3F scene.
import type { ClusterVariant, FormationData } from "./types";
import { ClusterIsland } from "./cluster-island";
import { POSTER_PRESETS } from "./config";
import { ClusterMotif } from "./motif";
import { ClusterPoster } from "./poster";
import { cn } from "@/lib/utils";

export type { FormationData, FormationKey, ClusterVariant, SkillGroupKey } from "./types";
export { toFormationData } from "./formation-data";
export { SectionSpy } from "./section-spy";
export { ClusterMotif } from "./motif";

export function ClusterMonitor({
  data,
  variant = "sticky",
  className,
}: {
  data: FormationData;
  variant?: ClusterVariant;
  className?: string;
}) {
  // Subpage motif: static SVG only, never a canvas.
  if (variant === "motif") return <ClusterMotif data={data} className={className} />;

  // The poster draws exactly what the scene will: the sticky panel's instance budget
  // steps up at xl, so it ships one poster per budget and CSS shows the matching one.
  const { count, wideCount } = POSTER_PRESETS[variant];
  const fill = "absolute inset-0 h-full w-full";
  const poster = wideCount ? (
    <>
      <ClusterPoster data={data} variant={variant} count={count} className={`${fill} xl:hidden`} />
      <ClusterPoster data={data} variant={variant} count={wideCount} className={`${fill} hidden xl:block`} />
    </>
  ) : (
    <ClusterPoster data={data} variant={variant} className={fill} />
  );

  return (
    <div
      data-cluster={variant}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-card",
        variant === "sticky" ? "h-full w-full" : "w-full",
        className,
      )}
    >
      <ClusterIsland data={data} variant={variant} poster={poster} />
    </div>
  );
}
