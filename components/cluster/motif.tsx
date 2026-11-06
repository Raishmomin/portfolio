// Server-only entry for the subpage motif: the static SVG cluster in the home
// monitor's hairline frame, with a static mono caption. No client imports, so a page
// that renders only this ships none of the 3D island (import it from
// "@/components/cluster/motif", not the barrel). Decorative: aria-hidden throughout.
import { captionFor } from "./captions";
import { POSTER_PRESETS } from "./config";
import { ClusterPoster } from "./poster";
import type { FormationData } from "./types";
import { cn } from "@/lib/utils";

export function ClusterMotif({
  data,
  className,
}: {
  data: FormationData;
  /** Accepted for drop-in parity with <ClusterMonitor variant="motif">. */
  variant?: "motif";
  className?: string;
}) {
  const { cmd, value } = captionFor("hero", data, POSTER_PRESETS.motif.count);
  return (
    <div
      aria-hidden="true"
      className={cn("w-full max-w-xs overflow-hidden rounded-lg border border-border bg-card", className)}
    >
      {/* Portrait box for the portrait formation (block layout: no flex min-height surprises). */}
      <div className="aspect-[4/5] w-full p-2">
        <ClusterPoster data={data} variant="motif" className="h-full w-full" />
      </div>
      {/* Same tiers as the monitor's caption: the value never clips (11px mono ≈ 8.1px a character). */}
      <div className="flex h-9 items-center border-t border-border px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground [container-type:inline-size]">
        <span className="min-w-0 truncate tabular-nums">
          <span className="hidden [@container(min-width:290px)]:inline">kubectl </span>
          <span className="hidden [@container(min-width:226px)]:inline">{cmd} · </span>
          {value}
        </span>
      </div>
    </div>
  );
}
