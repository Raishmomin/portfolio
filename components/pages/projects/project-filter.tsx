"use client";

// Filter chips for /projects. Leaf island: every project stays in the server HTML;
// filtering only toggles the `hidden` attribute on [data-categories] items inside
// #project-index. Without JS the chips are inert and every project is shown.
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Chip } from "./categories";

const ITEM_SELECTOR = "#project-index [data-categories]";

function apply(filter: string): number {
  let shown = 0;
  document.querySelectorAll<HTMLElement>(ITEM_SELECTOR).forEach((el) => {
    const match = filter === "all" || (el.dataset.categories ?? "").split(" ").includes(filter);
    el.hidden = !match;
    if (match) shown += 1;
  });
  return shown;
}

export function ProjectFilter({ chips, total }: { chips: Chip[]; total: number }) {
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(total);

  const select = useCallback((id: string) => {
    setFilter(id);
    setShown(apply(id));
  }, []);

  // A /projects#<slug> link must never land on a hidden project.
  useEffect(() => {
    const onHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (target?.hidden) {
        select("all");
        requestAnimationFrame(() => target.scrollIntoView());
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [select]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div role="group" aria-label="Filter projects by category" className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const active = filter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={active}
              onClick={() => select(chip.id)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-mono text-xs uppercase tracking-[0.12em] transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {chip.label}
              <span className="tabular-nums">{chip.count}</span>
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
        {shown}/{total} shown
      </p>
    </div>
  );
}
