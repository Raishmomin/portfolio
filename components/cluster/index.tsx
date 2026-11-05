// Public API of the cluster module. UI lanes import ONLY from "@/components/cluster".
// STUB (pre-3D): renders the pre-sized frame + caption bar so layouts can be built.
// The 3D lane replaces the internals (poster SVG, capability gate, lazy R3F scene) without changing these exports.
import type { ClusterVariant, FormationData } from "./types";
import { cn } from "@/lib/utils";

export type { FormationData, FormationKey, ClusterVariant, SkillGroupKey } from "./types";
export { toFormationData } from "./formation-data";

export function ClusterMonitor({
  data,
  variant = "sticky",
  className,
}: {
  data: FormationData;
  variant?: ClusterVariant;
  className?: string;
}) {
  void data;
  return (
    <figure
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card",
        variant === "band" && "aspect-[16/10] w-full",
        variant === "sticky" && "h-full w-full",
        variant === "motif" && "aspect-square w-full max-w-xs",
        className,
      )}
    >
      <div className="absolute inset-0 [contain:strict]" />
      {variant !== "motif" ? (
        <figcaption className="absolute inset-x-0 bottom-0 border-t border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          kubectl get pods -A · Running
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Scroll-spy island (stub: renders nothing). Mount once per page that uses data-section. */
export function SectionSpy() {
  return null;
}
