"use client";

// Filter chips for /projects. Leaf island: every project stays in the server HTML;
// filtering only toggles the `hidden` attribute on [data-categories] items inside
// #project-index. Without JS the chips are inert and every project is shown. The "ai"
// chip matches isAiProject (data-categories is built by projectCategories).
// While the motion runtime is live (html.motion-live), the grid animates the change:
// leaving cards shrink and fade, the rest slide to their new places (FLIP, Web
// Animations on the compositor), arriving cards grow in. Otherwise it is instant.
import { useCallback, useEffect, useState } from "react";
import { cx } from "@/lib/cx";
import { AI_TEXT, NeuralGlyph } from "../ai-badge";
import type { Chip } from "./categories";

const ITEM_SELECTOR = "#project-index [data-categories]";

const EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

const matches = (el: HTMLElement, filter: string) =>
  filter === "all" || (el.dataset.categories ?? "").split(" ").includes(filter);

/** Shows the matching items; returns how many. Animated only while the motion runtime is live. */
async function apply(filter: string): Promise<number> {
  const items = Array.from(document.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
  const next = items.map((el) => matches(el, filter));
  const shown = next.filter(Boolean).length;
  const live = document.documentElement.classList.contains("motion-live") && typeof Element.prototype.animate === "function";
  if (!live) {
    items.forEach((el, i) => (el.hidden = !next[i]));
    return shown;
  }
  // 1. Leaving cards shrink and fade out.
  const leaving = items.filter((el, i) => !el.hidden && !next[i]);
  const outs = leaving.map((el) =>
    el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.92)" }], { duration: 250, easing: "ease-in", fill: "forwards" }),
  );
  await Promise.all(outs.map((a) => a.finished.catch(() => undefined)));
  // 2. FLIP: first rects, apply, last rects, play the inverse.
  const first = new Map(items.filter((el) => !el.hidden).map((el) => [el, el.getBoundingClientRect()]));
  items.forEach((el, i) => (el.hidden = !next[i]));
  outs.forEach((a) => a.cancel());
  items.forEach((el, i) => {
    if (!next[i]) return;
    const a = el.getBoundingClientRect();
    const b = first.get(el);
    if (!b) {
      el.animate([{ opacity: 0, transform: "scale(0.92)" }, { opacity: 1, transform: "none" }], { duration: 450, easing: EXPO });
      return;
    }
    const dx = b.left - a.left;
    const dy = b.top - a.top;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 600, easing: EXPO });
  });
  // The page height changed: let ScrollTrigger re-measure (entrances of newly shown cards).
  window.dispatchEvent(new Event("resize"));
  return shown;
}

export function ProjectFilter({ chips, total }: { chips: Chip[]; total: number }) {
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(total);

  const select = useCallback((id: string) => {
    setFilter(id);
    void apply(id).then(setShown);
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
    <div className="js-only flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div role="group" aria-label="Filter projects by category" className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const active = filter === chip.id;
          const ai = chip.id === "ai";
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={active}
              onClick={() => select(chip.id)}
              className={cx(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-mono text-xs uppercase tracking-[0.12em] transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "border-foreground bg-foreground text-background"
                  : ai
                    ? cx("border-[#3F5BD9]/40 hover:border-[#3F5BD9] dark:border-[#7C9CFF]/40 dark:hover:border-[#7C9CFF]", AI_TEXT)
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {ai ? <NeuralGlyph /> : null}
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
