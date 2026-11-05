// Public API of the cluster module. UI lanes import ONLY from "@/components/cluster".
// ClusterMonitor is a Server Component: the frame, the SVG poster and the default
// caption are in the server HTML. The client island adds the gated, lazy R3F scene.
import type { ClusterVariant, FormationData } from "./types";
import { ClusterIsland } from "./cluster-island";
import { ClusterPoster } from "./poster";
import { cn } from "@/lib/utils";

export type { FormationData, FormationKey, ClusterVariant, SkillGroupKey } from "./types";
export { toFormationData } from "./formation-data";
export { SectionSpy } from "./section-spy";

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
  if (variant === "motif") {
    return (
      <div aria-hidden="true" className={cn("aspect-square w-full max-w-xs", className)}>
        <ClusterPoster data={data} variant="motif" className="h-full w-full" />
      </div>
    );
  }

  return (
    <div
      data-cluster={variant}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-card",
        variant === "sticky" ? "h-full w-full" : "w-full",
        className,
      )}
    >
      <ClusterIsland
        data={data}
        variant={variant}
        poster={<ClusterPoster data={data} variant={variant} className="absolute inset-0 h-full w-full" />}
      />
    </div>
  );
}
