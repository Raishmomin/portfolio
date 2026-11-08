"use client";

// The stage's client island (the only Neural code in the initial bundle): evaluates the
// capability gate after `load` + idle, lazy-loads three → R3F → the stage in separate
// idle periods, crossfades the server poster out once the canvas has drawn, and falls
// back to the poster on a GPU loss, a struggling device or a stage error. Without the
// canvas it shows the poster of the section in view, on that section's free side.
import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { capable, contextOwner, nextIdle, onIdle, REDUCED } from "./runtime";
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
  const [failed, setFailed] = useState(false);
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
    const timer = window.setTimeout(() => setMounted(false), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [want, mounted]);

  const live = mounted && ready && want;

  // 4. Posters: faded out (and their CSS pulses paused) under a live canvas.
  useEffect(() => {
    const stage = boxRef.current?.parentElement;
    const group = stage?.querySelector<HTMLElement>("[data-neural-posters]");
    const posters = [...(stage?.querySelectorAll<HTMLElement>("[data-neural-poster]") ?? [])];
    if (!group) return;
    if (live) {
      group.style.opacity = "0";
      const timer = window.setTimeout(() => posters.forEach((p) => p.setAttribute("data-paused", "")), FADE_MS);
      return () => window.clearTimeout(timer);
    }
    group.style.opacity = "";
    posters.forEach((p) => p.removeAttribute("data-paused"));
  }, [live]);

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
  const onFallback = useCallback(() => setFailed(true), []);
  const onError = useCallback(() => {
    setReady(false);
    setFailed(true);
  }, []);

  return (
    <div ref={boxRef} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: live ? 1 : 0 }}>
      {mounted ? (
        <StageBoundary onError={onError}>
          <Stage data={data} active={want && !hidden} onReady={onReady} onFallback={onFallback} />
        </StageBoundary>
      ) : null}
    </div>
  );
}
