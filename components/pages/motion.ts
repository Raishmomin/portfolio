// Motion hooks for the subpages (tasks/neural-spec.md "Motion"). Attributes only: the
// motion layer reads them, and the server HTML stays fully visible without it.
import type { CSSProperties } from "react";

/**
 * `[data-reveal]` with a short capped stagger. The delay goes out both as
 * `data-reveal-delay` (ms) and as the `--reveal-delay` CSS variable. The head script adds
 * `data-in` before hydration, hence suppressHydrationWarning.
 */
export function reveal(index = 0, step = 60) {
  const ms = Math.min(index, 4) * step;
  return {
    "data-reveal": "",
    suppressHydrationWarning: true,
    ...(ms ? { "data-reveal-delay": String(ms), style: { "--reveal-delay": `${ms / 1000}s` } as CSSProperties } : {}),
  };
}

/** Word-split entrance for an h2/h3 (never the h1). */
export const split = { "data-split": "" } as const;

/** Count-up for a stat. The element's server text already holds the final value. */
export const count = (value: number) => ({ "data-count": String(value) });

/** Parallax for a decorative element, -1..1. */
export const parallax = (depth: number) => ({ "data-parallax": String(depth) });
