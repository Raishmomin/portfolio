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
/** Software rasterisers (no GPU): headless/CI Chrome, VMs, broken drivers. Never worth running the scene on. */
const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen|subzero/i;

/**
 * Hardware WebGL2 only. `failIfMajorPerformanceCaveat` alone is not enough: headless Chrome
 * (Lighthouse / PageSpeed Insights) hands out SwiftShader without flagging a caveat, so the
 * unmasked renderer name is checked too.
 */
export function hasWebGL2(): boolean {
  if (webgl2 === undefined) {
    try {
      const gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
      let ok = !!gl;
      if (gl) {
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        const renderer = String(
          (info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || "",
        );
        if (SOFTWARE_GL.test(renderer)) ok = false;
      }
      webgl2 = ok;
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
    // storage blocked: fall through to the default
  }
  // Owner decision (2026-11-06): motion and 3D are on for everyone; "off" is a hidden QA switch.
  return "on";
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
