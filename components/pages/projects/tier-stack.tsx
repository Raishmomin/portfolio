// A project's real stack, grouped by architecture tier (client, server, data, infra, AI),
// exactly as the work scene builds it (NeuralData.work[i].stack). Server Component. Each
// chip carries data-arch-tech="<technology key>": hovering it lights that technology's
// node in 3D, and while its project is the active one ([data-arch-active], set by the
// motion runtime's architecture spy) the chips light up in their tier colour, one after
// another. Without JS it is a plain, readable list.
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { ARCH_TIERS, type ArchTech, type ArchTier } from "../../neural/types";

export const TIER_LABEL: Record<ArchTier, string> = { client: "Client", server: "Server", data: "Data", infra: "Infra", ai: "AI" };

export function TierStack({ stack, compact = false, className }: { stack: ArchTech[]; compact?: boolean; className?: string }) {
  let k = 0;
  const groups = ARCH_TIERS.map((tier) => ({ tier, items: stack.filter((t) => t.tier === tier) })).filter((g) => g.items.length);
  if (!groups.length) return null;
  return (
    <dl className={cn("tier-stack grid", compact ? "gap-y-1" : "gap-y-1.5", className)}>
      {groups.map((g) => (
        <div key={g.tier} data-tier={g.tier} className="flex min-w-0 items-start gap-3">
          <dt
            className={cn(
              "flex shrink-0 items-center gap-1.5 font-mono uppercase text-muted-foreground",
              compact ? "w-[3.25rem] pt-[3px] text-[9.5px] tracking-[0.14em]" : "w-[3.75rem] pt-[5px] text-[10px] tracking-[0.16em]",
            )}
          >
            <span aria-hidden="true" className="tier-dot" />
            {TIER_LABEL[g.tier]}
          </dt>
          <dd className="min-w-0">
            <ul data-card-part="pop" className="flex flex-wrap gap-1.5">
              {g.items.map((t) => (
                <li
                  key={t.key}
                  data-arch-tech={t.key}
                  className={cn("pill arch-chip", compact && "px-2 py-0 text-[10px]")}
                  style={{ "--k": k++ } as CSSProperties}
                >
                  {t.name}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  );
}
