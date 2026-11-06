"use client";

import { useSyncExternalStore } from "react";

/*
 * 3D/motion toggle — SHARED CONTRACT with the cluster (3D) lane:
 *  - persisted as localStorage "cp:3d" = "on" | "off", read/written in try/catch;
 *  - the head script (components/reveal.tsx) applies a saved choice before first paint;
 *    no data-motion attribute = "auto": follow the OS prefers-reduced-motion setting;
 *  - an explicit "on" (a visitor's click) overrides the OS setting;
 *  - on change: html[data-motion] = "on" | "off" and
 *    window.dispatchEvent(new CustomEvent("cp:3d", { detail: { enabled } })).
 * CSS reveal animations and the status pulse are disabled under html[data-motion="off"].
 */
export const MOTION_KEY = "cp:3d";
export const MOTION_EVENT = "cp:3d";

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = matchMedia(REDUCED);
  window.addEventListener(MOTION_EVENT, onChange);
  mq.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(MOTION_EVENT, onChange);
    mq.removeEventListener("change", onChange);
  };
}
/** Effective state: an explicit choice wins, otherwise the OS reduced-motion setting decides. */
function getSnapshot() {
  const m = document.documentElement.dataset.motion;
  if (m === "on") return true;
  if (m === "off") return false;
  return !matchMedia(REDUCED).matches;
}
const getServerSnapshot = () => true;

export function MotionToggle() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !enabled;
    try {
      localStorage.setItem(MOTION_KEY, next ? "on" : "off");
    } catch {
      // storage blocked: the choice still applies to this page view
    }
    document.documentElement.dataset.motion = next ? "on" : "off";
    window.dispatchEvent(new CustomEvent(MOTION_EVENT, { detail: { enabled: next } }));
  }

  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label="3D scene and motion"
      title={enabled ? "Turn off 3D and motion" : "Turn on 3D and motion"}
      onClick={toggle}
      className="js-only group inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground aria-pressed:text-foreground"
    >
      <span
        aria-hidden="true"
        className="block h-2 w-2 rounded-[2px] border border-current group-aria-pressed:border-primary group-aria-pressed:bg-primary"
      />
      3D
    </button>
  );
}
