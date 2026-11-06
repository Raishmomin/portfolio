"use client";

// The monitor's client island: capability gate, idle + in-view mount of the lazy
// R3F scene, the poster/canvas crossfade (opacity only, inside a contain:strict
// box) and the caption bar. Server HTML = poster + default caption; the canvas
// never mounts under reduced motion, Save-Data, low memory/cores, no WebGL2 or the
// 3D toggle off (tasks/design-spec.md §1.4–1.6).
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { captionFor } from "./captions";
import { POSTER_PRESETS, XL_QUERY } from "./config";
import { clusterStore, reschedule } from "./store";
import type { FormationData } from "./types";

/** Run `fn` in an idle period (timeout fallback); returns a cancel function. */
function onIdle(fn: () => void, timeout = 1000): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 50);
  return () => window.clearTimeout(id);
}
const idle = () => new Promise<void>((resolve) => void onIdle(resolve));

// The 3D chunk loads in steps, each in its own idle period, so no single task has to
// evaluate three, R3F and the scene at once (seo-audit §6.4: no long task > 50 ms).
const Scene = dynamic(
  async () => {
    await import("three");
    await idle();
    await import("@react-three/fiber");
    await idle();
    return import("./scene");
  },
  { ssr: false, loading: () => null },
);

type Nav = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };

const REDUCED = "(prefers-reduced-motion: reduce)";
/** Matches the poster/canvas `duration-700` crossfade. */
const FADE_MS = 700;

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

type MotionPref = "on" | "off" | "auto";

/** The header's 3D toggle: html[data-motion] wins, then localStorage; nothing saved = "auto". */
function motionPref(): MotionPref {
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

function capable(pref: MotionPref = motionPref()): boolean {
  if (pref === "off") return false;
  const nav = navigator as Nav;
  if (pref === "auto") {
    // Respect the OS reduced-motion / data-saver preference unless the visitor explicitly opted in.
    if (matchMedia(REDUCED).matches || nav.connection?.saveData) return false;
    // Only genuinely weak devices skip the scene up front (a 4-thread laptop is fine);
    // the scene's runtime frame monitor still falls back to the poster if a device struggles.
    if ((nav.deviceMemory ?? 8) < 4 || (nav.hardwareConcurrency ?? 8) < 4) return false;
  }
  // Software-rendered WebGL (no GPU) is never worth it, even when opted in.
  return hasWebGL2();
}

const getSection = () => clusterStore.getState().section;
const getServerSection = () => "hero" as const;
const getOwner = () => clusterStore.getState().owner;
const getServerOwner = () => null;
function subscribeXL(onChange: () => void) {
  const mq = matchMedia(XL_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getXL = () => matchMedia(XL_QUERY).matches;
const getServerXL = () => false;

// Caption tiers by the bar's content width (Geist Mono 12px at 0.14em ≈ 8.7px a
// character; the longest full caption is 38 characters ≈ 330px; the labelled button is
// 120px, icon-only 44px, plus an 8px gap): "kubectl <cmd> · <value>" with the labelled
// button; then with the icon-only button; then without "kubectl"; then the value
// alone. The bar is the query container, so the copy fits its real width.
const SHOW_LABEL = "hidden [@container(min-width:460px)]:inline";
const SHOW_KUBECTL = "hidden [@container(min-width:384px)]:inline";
const SHOW_CMD = "hidden [@container(min-width:316px)]:inline";

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
  const [gated, setGated] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [inView, setInView] = useState(false);
  const [seen, setSeen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const section = useSyncExternalStore(clusterStore.subscribe, getSection, getServerSection);
  const owner = useSyncExternalStore(clusterStore.subscribe, getOwner, getServerOwner);
  const xl = useSyncExternalStore(subscribeXL, getXL, getServerXL);

  const preset = POSTER_PRESETS[variant];
  // Same budget as the poster showing at this width (the sticky poster switches at xl).
  const count = xl && preset.wideCount ? preset.wideCount : preset.count;

  // 1. After `load`, then an idle callback (1.5s timeout fallback): evaluate the gate.
  useEffect(() => {
    let cancel = () => {};
    const evaluate = () => {
      setAllowed(capable());
      setGated(true);
    };
    const onLoad = () => {
      cancel = onIdle(evaluate, 1500);
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    const mq = matchMedia(REDUCED);
    const reevaluate = () => setAllowed(capable());
    const onToggle = (e: Event) =>
      setAllowed(capable((e as CustomEvent<{ enabled?: boolean }>).detail?.enabled === false ? "off" : "on"));
    const onVisibility = () => setHidden(document.hidden);
    mq.addEventListener("change", reevaluate);
    window.addEventListener("cp:3d", onToggle);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("load", onLoad);
      cancel();
      mq.removeEventListener("change", reevaluate);
      window.removeEventListener("cp:3d", onToggle);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // 2. In view (IntersectionObserver) and rendered at all: a display:none variant has no
  //    size (ResizeObserver reports 0×0 when a resize hides it), which drops its canvas.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const io = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (entry.isIntersecting) setSeen(true);
    });
    const ro = new ResizeObserver(([entry]) => setRendered(entry.contentRect.width > 0 && entry.contentRect.height > 0));
    io.observe(box);
    ro.observe(box);
    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  const want = gated && allowed && !failed && seen && rendered;

  // 3. Mount in a later idle period, and only while no other scene holds a WebGL
  //    context (one context per page, including an old one still being torn down).
  useEffect(() => {
    if (!want || mounted || owner !== null) return;
    return onIdle(() => setMounted(true));
  }, [want, mounted, owner]);

  // 4. Unmount once the canvas has faded back out over the poster (3D toggled off,
  //    reduced motion, fallback); a box that is no longer rendered drops it at once.
  useEffect(() => {
    if (want || !mounted) return;
    const timer = window.setTimeout(() => setMounted(false), rendered ? FADE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [want, mounted, rendered]);

  const sceneOn = mounted && rendered;
  const live = sceneOn && ready && want;

  useEffect(() => {
    if (!live) return;
    clusterStore.setState({ enabled: true });
    return () => clusterStore.setState({ enabled: false });
  }, [live]);

  // The scene reports true after its first frame and false when it unmounts.
  const onReady = useCallback((value: boolean) => setReady(value), []);
  const onFallback = useCallback(() => setFailed(true), []);

  const key = live ? section : "hero";
  const caption = captionFor(key, data, preset.count);
  const wide = preset.wideCount ? captionFor(key, data, preset.wideCount).value : caption.value;

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
        {sceneOn ? (
          <div className="pointer-events-none absolute inset-0 transition-opacity duration-700" style={{ opacity: live ? 1 : 0 }}>
            <Scene
              data={data}
              count={count}
              variant={variant}
              active={want && inView && !hidden}
              onReady={onReady}
              onFallback={onFallback}
            />
          </div>
        ) : null}
      </div>
      <div
        data-caption=""
        className="flex h-11 shrink-0 items-center gap-2 border-t border-border pl-4 pr-1 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground [container-type:inline-size]"
      >
        <span aria-hidden="true" data-caption-text="" className="min-w-0 flex-1 truncate tabular-nums">
          <span className={SHOW_KUBECTL}>kubectl </span>
          <span className={SHOW_CMD}>{caption.cmd} · </span>
          {wide === caption.value ? (
            caption.value
          ) : (
            <>
              <span className="xl:hidden">{caption.value}</span>
              <span className="hidden xl:inline">{wide}</span>
            </>
          )}
        </span>
        {live ? (
          <button
            type="button"
            onClick={reschedule}
            aria-label="Reschedule pods"
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1 rounded-md px-2.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
          >
            <span aria-hidden="true">↻</span>
            <span className={SHOW_LABEL}>Reschedule</span>
          </button>
        ) : null}
      </div>
    </>
  );
}
