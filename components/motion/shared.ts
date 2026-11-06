// Shared helpers and tokens for the motion binders (loaded only inside the lazy runtime).

export type Binding = { revert(): void };
export const NOOP: Binding = { revert() {} };

/** Mouse/trackpad devices only (tilt, magnetic, spotlight, cursor glow). */
export const FINE = "(hover: hover) and (pointer: fine)";
/** Desktop layout breakpoint (Tailwind `lg`). */
export const DESKTOP = "(min-width: 1024px)";
/** Horizontal-scroll pin: desktop with enough height for the track to fit under the header. */
export const HSCROLL = "(min-width: 1024px) and (min-height: 640px)";
export const NOT_HSCROLL = "not all and (min-width: 1024px) and (min-height: 640px)";

/** Shared easing token: expo.out = cubic-bezier(.16,1,.3,1). */
export const EXPO = "expo.out";

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Already on screen (or scrolled past) when the runtime bound it: never hide what was seen. */
export const seen = (el: Element) => el.getBoundingClientRect().top < window.innerHeight * 0.92;
