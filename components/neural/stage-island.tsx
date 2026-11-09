"use client";

// The stage's client island (the only Neural code in the initial bundle): evaluates the
// capability gate after `load` + idle, lazy-loads three → R3F → the stage in separate
// idle periods, crossfades the server poster out once the canvas has drawn, and falls
// back to the poster on a GPU loss, a struggling device or a stage error. Without the
// canvas it shows the poster of the section in view, on that section's free side.
import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { capable, contextOwner, nextIdle, onIdle, REDUCED } from "./runtime";
import type { FallbackReason } from "./stage";
import { SCENE_KEYS, type NeuralData } from "./types";

const Stage = dynamic(
  async () => {
    await import("three");
    await nextIdle();
    await import("@react-three/fiber");
    await nextIdle();
    return import("./stage");
  },
  { ssr: false, loading: () => null },
);

/** Scenes with a poster of their own (poster.tsx); any other scene shows the ambient field. */
const POSTERS = ["hero", "contact", "services", "faq"] as const;
const isScene = (v: string | undefined) => !!v && (SCENE_KEYS as readonly string[]).includes(v);

/** Matches the poster/canvas `duration-700` crossfade. */
const FADE_MS = 700;
/**
 * A slow or chunk fallback is retried once per page view, after this cool-down (or as soon
 * as the page is visible again). A chunk failure says nothing about the device: it retries sooner.
 */
const RETRY_MS = 20_000;
const CHUNK_RETRY_MS = 5_000;
const MAX_RETRIES = 1;
/** The page must not be frozen right now: a rAF probe of PROBE_MS over the poster must hold RETRY_FPS (the stage then judges its own cost again). */
const PROBE_MS = 2000;
const RETRY_FPS = 20;

/**
 * Any error inside the stage (a scene, the R3F reconciler, a hot reload that hands new
 * scene code old data) falls back to the poster instead of escaping to the page's root.
 */
class StageBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== "production") console.warn("[neural] stage error, showing the poster:", error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function NeuralIsland({ data }: { data: NeuralData }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [gated, setGated] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [hidden, setHidden] = useState(false);
  // false, or why the stage fell back: "slow" may be retried, "hard" (GPU context lost,
  // stage error) is final for this page view.
  const [failed, setFailed] = useState<false | "slow" | "chunk" | "hard">(false);
  const [retries, setRetries] = useState(0);
  // The retried stage starts on the ladder's last step only after a slow fallback.
  const [retryLow, setRetryLow] = useState(false);
  const [missing, setMissing] = useState(false);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const owner = useSyncExternalStore(contextOwner.subscribe, contextOwner.get, () => null);

  // 1. After `load`, then an idle callback: evaluate the gate; re-evaluate on changes.
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
    const onToggle = (e: Event) => {
      setFailed(false);
      setAllowed(capable((e as CustomEvent<{ enabled?: boolean }>).detail?.enabled === false ? "off" : "on"));
    };
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

  const want = gated && allowed && !failed;

  // 2. Mount in a later idle period, and only while no other stage holds the WebGL context.
  useEffect(() => {
    if (!want || mounted || owner !== null) return;
    return onIdle(() => setMounted(true));
  }, [want, mounted, owner]);

  // 3. Unmount once the canvas has faded back out over the poster.
  useEffect(() => {
    if (want || !mounted) return;
    const timer = window.setTimeout(() => {
      setMounted(false);
      setMissing(false);
    }, FADE_MS);
    return () => window.clearTimeout(timer);
  }, [want, mounted]);

  const live = mounted && ready && want;
  // The leading section's scene failed to load and is being retried: the poster shows
  // through the (transparent there) canvas instead of a blank section.
  const veiled = live && !missing;

  // 4. Posters: faded out (and their CSS pulses paused) under a live canvas, unless the
  //    leading section's scene is missing.
  useEffect(() => {
    const stage = boxRef.current?.parentElement;
    const group = stage?.querySelector<HTMLElement>("[data-neural-posters]");
    const posters = [...(stage?.querySelectorAll<HTMLElement>("[data-neural-poster]") ?? [])];
    if (!group) return;
    if (veiled) {
      group.style.opacity = "0";
      const timer = window.setTimeout(() => posters.forEach((p) => p.setAttribute("data-paused", "")), FADE_MS);
      return () => window.clearTimeout(timer);
    }
    group.style.opacity = "";
    posters.forEach((p) => p.removeAttribute("data-paused"));
  }, [veiled]);

  // 5. Which poster (poster.tsx CSS): the section on the viewport's centre line picks it by
  //    its scene and the side it sits on by its data-stage. A services page's phone room
  //    ([data-svc-room]) is the intro's opening, not a section; a section that draws its
  //    own static poster (.cg-poster, the contact globe) gets none.
  useEffect(() => {
    const stage = boxRef.current?.parentElement;
    if (!stage) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          const scene = isScene(el.dataset.scene) ? el.dataset.scene : el.dataset.section;
          stage.dataset.poster = el.querySelector(".cg-poster")
            ? "none"
            : (POSTERS as readonly (string | undefined)[]).includes(scene)
              ? scene
              : "ambient";
          stage.dataset.posterStage = el.dataset.stage || "left";
        }
      },
      { rootMargin: "-50% 0px -49% 0px" },
    );
    document.querySelectorAll("[data-section]:not([data-svc-room])").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const onReady = useCallback((value: boolean) => setReady(value), []);
  const onFallback = useCallback(
    (reason: FallbackReason) => setFailed((cur) => (cur === "hard" || reason === "lost" ? "hard" : reason)),
    [],
  );
  const onError = useCallback(() => {
    setReady(false);
    setFailed("hard");
  }, []);

  // 6. A slow fallback is not final (a busy moment, another tab, a GC pause), nor is a
  //    chunk fallback (a scene's code failed to load: offline, a flaky network, a deploy in
  //    between): after a cool-down, while the page is visible, a short rAF probe over the
  //    poster must hold RETRY_FPS; then the stage mounts again (after a slow fallback on
  //    the ladder's last step, stage.tsx, from where it may climb back up) and fetches the
  //    missing scene again. Becoming visible again re-probes at once. Never after a lost
  //    GPU context or a stage error (and a software renderer never passes the gate).
  useEffect(() => {
    if ((failed !== "slow" && failed !== "chunk") || retries >= MAX_RETRIES) return;
    const cooldown = failed === "chunk" ? CHUNK_RETRY_MS : RETRY_MS;
    const low = failed === "slow";
    let timer = 0;
    let raf = 0;
    const probe = () => {
      if (document.hidden) return; // visibilitychange re-arms
      const t0 = performance.now();
      let frames = 0;
      const tick = (t: number) => {
        frames += 1;
        if (t - t0 < PROBE_MS) {
          raf = requestAnimationFrame(tick);
          return;
        }
        if ((frames * 1000) / (t - t0) >= RETRY_FPS) {
          setRetries((n) => n + 1);
          setRetryLow(low);
          setFailed(false);
        } else arm(cooldown);
      };
      raf = requestAnimationFrame(tick);
    };
    const arm = (ms: number) => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      timer = window.setTimeout(probe, ms);
    };
    const onVisible = () => {
      if (!document.hidden) arm(1000);
    };
    arm(cooldown << retries);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [failed, retries]);

  // Exposed for QA: why the poster stands in, and how often the stage came back.
  useEffect(() => {
    const stage = boxRef.current?.parentElement;
    if (!stage) return;
    if (failed) stage.setAttribute("data-fallback", failed);
    else stage.removeAttribute("data-fallback");
    stage.setAttribute("data-retries", String(retries));
  }, [failed, retries]);

  return (
    <div ref={boxRef} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: live ? 1 : 0 }}>
      {mounted ? (
        <StageBoundary onError={onError}>
          <Stage
            data={data}
            active={want && !hidden}
            retry={retryLow}
            onReady={onReady}
            onFallback={onFallback}
            onMissing={setMissing}
          />
        </StageBoundary>
      ) : null}
    </div>
  );
}
