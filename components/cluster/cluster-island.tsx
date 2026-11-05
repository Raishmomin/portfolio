"use client";

// The monitor's client island: capability gate, idle + in-view mount of the lazy
// R3F scene, the poster/canvas crossfade (opacity only, inside a contain:strict
// box) and the caption bar. Server HTML = poster + default caption; the canvas
// never mounts under reduced motion, Save-Data, low memory/cores, no WebGL2 or the
// 3D toggle off (tasks/design-spec.md §1.4–1.6).
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { captionFor } from "./captions";
import { POSTER_PRESETS } from "./config";
import { clusterStore, reschedule } from "./store";
import type { FormationData } from "./types";

const Scene = dynamic(() => import("./scene"), { ssr: false, loading: () => null });

type Nav = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };

const REDUCED = "(prefers-reduced-motion: reduce)";

let webgl2: boolean | undefined;
function hasWebGL2(): boolean {
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

/** The header's 3D toggle: html[data-motion] wins; no attribute falls back to localStorage, default on. */
function toggleOn(): boolean {
  const attr = document.documentElement.dataset.motion;
  if (attr) return attr !== "off";
  try {
    return localStorage.getItem("cp:3d") !== "off";
  } catch {
    return true;
  }
}

function capable(toggle = toggleOn()): boolean {
  const nav = navigator as Nav;
  if (!toggle || matchMedia(REDUCED).matches || nav.connection?.saveData) return false;
  if ((nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4) return false;
  return hasWebGL2();
}

const getSection = () => clusterStore.getState().section;
const getServerSection = () => "hero" as const;

export function ClusterIsland({
  data,
  variant,
  poster,
}: {
  data: FormationData;
  variant: "sticky" | "band";
  poster: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [idle, setIdle] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [inView, setInView] = useState(false);
  const [seen, setSeen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(POSTER_PRESETS[variant].count);
  const section = useSyncExternalStore(clusterStore.subscribe, getSection, getServerSection);

  // 1. After `load`, then an idle callback (1.5s timeout fallback): evaluate the gate.
  useEffect(() => {
    let idleId = 0;
    let timer = 0;
    const evaluate = () => {
      const nav = navigator as Nav;
      setCount((nav.hardwareConcurrency ?? 8) <= 6 || window.innerWidth < 1280 ? 120 : 200);
      setAllowed(capable());
      setIdle(true);
    };
    const onLoad = () => {
      if (typeof window.requestIdleCallback === "function") idleId = window.requestIdleCallback(evaluate, { timeout: 1500 });
      else timer = window.setTimeout(evaluate, 1500);
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    const mq = matchMedia(REDUCED);
    const reevaluate = () => setAllowed(capable());
    const onToggle = (e: Event) => setAllowed(capable((e as CustomEvent<{ enabled?: boolean }>).detail?.enabled !== false));
    const onVisibility = () => setHidden(document.hidden);
    mq.addEventListener("change", reevaluate);
    window.addEventListener("cp:3d", onToggle);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("load", onLoad);
      if (idleId) window.cancelIdleCallback(idleId);
      window.clearTimeout(timer);
      mq.removeEventListener("change", reevaluate);
      window.removeEventListener("cp:3d", onToggle);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // 2. Only while the box is in view (a display:none variant never intersects, so never mounts).
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const io = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (entry.isIntersecting) setSeen(true);
    });
    io.observe(box);
    return () => io.disconnect();
  }, []);

  const mounted = idle && allowed && !failed && seen;
  const live = mounted && ready;

  useEffect(() => {
    clusterStore.setState({ enabled: live });
  }, [live]);

  // The scene reports true after its first frame and false when it unmounts.
  const onReady = useCallback((value: boolean) => setReady(value), []);
  const onFallback = useCallback(() => setFailed(true), []);

  const caption = captionFor(live ? section : "hero", data, live ? count : POSTER_PRESETS[variant].count);

  return (
    <>
      <div
        ref={boxRef}
        aria-hidden="true"
        role="presentation"
        tabIndex={-1}
        className={variant === "band" ? "relative aspect-[16/10] w-full [contain:strict]" : "relative min-h-0 w-full flex-1 [contain:strict]"}
      >
        <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: live ? 0 : 1 }}>
          {poster}
        </div>
        {mounted ? (
          <div className="pointer-events-none absolute inset-0 transition-opacity duration-700" style={{ opacity: live ? 1 : 0 }}>
            <Scene
              data={data}
              count={count}
              variant={variant}
              active={inView && !hidden}
              onReady={onReady}
              onFallback={onFallback}
            />
          </div>
        ) : null}
      </div>
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-t border-border pl-4 pr-1 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
        <span aria-hidden="true" className="min-w-0 truncate tabular-nums">
          {caption}
        </span>
        {live ? (
        <button
          type="button"
          onClick={reschedule}
          aria-label="Reschedule pods"
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md px-3 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
        >
          <span aria-hidden="true">↻</span>
          Reschedule
        </button>
        ) : null}
      </div>
    </>
  );
}
