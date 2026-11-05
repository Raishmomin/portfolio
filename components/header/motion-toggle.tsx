"use client";

import { useSyncExternalStore } from "react";

/*
 * 3D/motion toggle — SHARED CONTRACT with the cluster (3D) lane:
 *  - persisted as localStorage "cp:3d" = "on" | "off" (default "on"), read/written in try/catch;
 *  - the head script (components/reveal.tsx) applies a saved "off" before first paint;
 *    no data-motion attribute means on;
 *  - on change: html[data-motion] = "on" | "off" and
 *    window.dispatchEvent(new CustomEvent("cp:3d", { detail: { enabled } })).
 * CSS reveal animations and the status pulse are disabled under html[data-motion="off"].
 */
export const MOTION_KEY = "cp:3d";
export const MOTION_EVENT = "cp:3d";

function subscribe(onChange: () => void) {
  window.addEventListener(MOTION_EVENT, onChange);
  return () => window.removeEventListener(MOTION_EVENT, onChange);
}
const getSnapshot = () => document.documentElement.dataset.motion !== "off";
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
      className="group inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground aria-pressed:text-foreground"
    >
      <span
        aria-hidden="true"
        className="block h-2 w-2 rounded-[2px] border border-current group-aria-pressed:border-primary group-aria-pressed:bg-primary"
      />
      3D
    </button>
  );
}
