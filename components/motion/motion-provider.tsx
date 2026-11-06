"use client";

// The site-wide motion loader (see components/motion/index.ts for the hooks). It
// ships almost nothing in the initial bundle: after `load` and an idle period, and
// only while motion is allowed, it imports gsap, ScrollTrigger and the runtime in
// separate idle steps (no long task), then binds the [data-*] hooks. It follows the
// 3D/motion toggle live (window "cp:3d" event, OS reduced-motion changes) and
// re-scans the page after client navigations.
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type Runtime = typeof import("./runtime");

const REDUCED = "(prefers-reduced-motion: reduce)";

/** Tri-state contract: html[data-motion]="on" overrides the OS, "off" disables, absent follows the OS. */
function motionAllowed(): boolean {
  const m = document.documentElement.dataset.motion;
  if (m === "on") return true;
  if (m === "off") return false;
  return !matchMedia(REDUCED).matches;
}

function idle(timeout = 1500): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => resolve(), { timeout });
    else window.setTimeout(resolve, 50);
  });
}

let loading: Promise<Runtime> | null = null;
/** gsap core, ScrollTrigger, then the runtime, each evaluated in its own idle period. */
function loadRuntime(): Promise<Runtime> {
  loading ??= import("gsap")
    .then(() => idle())
    .then(() => import("gsap/ScrollTrigger"))
    .then(() => idle())
    .then(() => import("./runtime"))
    .then(async (rt) => {
      await idle();
      return rt;
    });
  return loading;
}

export function MotionProvider() {
  const pathname = usePathname();
  const runtime = useRef<Runtime | null>(null);

  useEffect(() => {
    let disposed = false;
    let ready = false;

    const sync = () => {
      if (disposed || !ready) return;
      if (!motionAllowed()) {
        runtime.current?.stop();
        return;
      }
      loadRuntime().then(
        (rt) => {
          runtime.current = rt;
          // The toggle may have flipped while the chunk was loading.
          if (!disposed && motionAllowed()) rt.start();
        },
        () => {
          loading = null; // offline or chunk error: the page simply stays static
        },
      );
    };

    const onLoad = () => {
      void idle(2000).then(() => {
        ready = true;
        sync();
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    const mq = matchMedia(REDUCED);
    window.addEventListener("cp:3d", sync);
    mq.addEventListener("change", sync);
    return () => {
      disposed = true;
      window.removeEventListener("load", onLoad);
      window.removeEventListener("cp:3d", sync);
      mq.removeEventListener("change", sync);
      runtime.current?.stop();
    };
  }, []);

  // Client navigation: drop the old page's triggers and bind the new page's hooks.
  useEffect(() => {
    runtime.current?.rescan();
  }, [pathname]);

  return null;
}
