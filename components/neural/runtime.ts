// Browser-only helpers shared by the island (initial JS) and the lazy stage chunk:
// the capability gate, idle scheduling and the page's single WebGL-context slot.
// Ported from the former cluster island (tri-state motion contract).

/** Run `fn` in an idle period (timeout fallback); returns a cancel function. */
export function onIdle(fn: () => void, timeout = 1000): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 50);
  return () => window.clearTimeout(id);
}
export const nextIdle = (timeout?: number) => new Promise<void>((resolve) => void onIdle(resolve, timeout));

type Nav = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };

export const REDUCED = "(prefers-reduced-motion: reduce)";

let webgl2: boolean | undefined;
/** Hardware WebGL2 only: software rasterisers fail `failIfMajorPerformanceCaveat`. */
export function hasWebGL2(): boolean {
  if (webgl2 === undefined) {
    try {
      const gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
      webgl2 = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webgl2 = false;
    }
  }
  return webgl2;
}

export type MotionPref = "on" | "off" | "auto";

/** The header's 3D toggle: html[data-motion] wins, then localStorage; nothing saved = "auto". */
export function motionPref(): MotionPref {
  const attr = document.documentElement.dataset.motion;
  if (attr === "on" || attr === "off") return attr;
  try {
    const saved = localStorage.getItem("cp:3d");
    if (saved === "on" || saved === "off") return saved;
  } catch {
    // storage blocked: fall through to auto
  }
  return "auto";
}

/** May this visitor get the WebGL stage? An explicit "on" overrides reduced motion / Save-Data. */
export function capable(pref: MotionPref = motionPref()): boolean {
  if (pref === "off") return false;
  const nav = navigator as Nav;
  if (pref === "auto" && (matchMedia(REDUCED).matches || nav.connection?.saveData)) return false;
  // Only genuinely weak devices skip it up front; the frame monitor handles the rest.
  if ((nav.deviceMemory ?? 8) < 4 || (nav.hardwareConcurrency ?? 8) < 4) return false;
  return hasWebGL2();
}

/**
 * Token of the stage holding the page's single WebGL context: set when its context is
 * created, cleared once that context is lost (or shortly after unmount). The island
 * mounts a stage only while this is null, so two contexts never overlap.
 */
let owner: string | null = null;
const listeners = new Set<() => void>();
export const contextOwner = {
  get: () => owner,
  set(next: string | null) {
    if (next === owner) return;
    owner = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};
