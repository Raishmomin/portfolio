"use client";

// The stage's client island (the only Neural code in the initial bundle): evaluates the
// capability gate after `load` + idle, lazy-loads three → R3F → the stage in separate
// idle periods, crossfades the server poster out once the canvas has drawn, and falls
// back to the poster on a GPU loss or a struggling device. Without the canvas it dims
// the poster once the hero has scrolled away, so section text stays easy to read.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { capable, contextOwner, nextIdle, onIdle, REDUCED } from "./runtime";
import type { NeuralData } from "./types";

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

/** Matches the poster/canvas `duration-700` crossfade. */
const FADE_MS = 700;

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

  // 4. Poster: hidden (and its CSS pulses paused) under a live canvas; otherwise dimmed
  //    while the hero is out of view.
  useEffect(() => {
    const poster = boxRef.current?.parentElement?.querySelector<HTMLElement>("[data-neural-poster]");
    if (!poster) return;
    if (live) {
      poster.style.opacity = "0";
      const timer = window.setTimeout(() => poster.setAttribute("data-paused", ""), FADE_MS);
      return () => window.clearTimeout(timer);
    }
    poster.removeAttribute("data-paused");
    const hero = document.querySelector('[data-section="hero"]');
    if (!hero) {
      poster.style.opacity = "";
      return;
    }
    // "In view" = overlapping the middle third of the viewport.
    const io = new IntersectionObserver(
      ([entry]) => {
        poster.style.opacity = entry.isIntersecting ? "" : "0.35";
      },
      { rootMargin: "-33% 0px -33% 0px" },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, [live]);

  const onReady = useCallback((value: boolean) => setReady(value), []);
  const onFallback = useCallback(() => setFailed(true), []);

  return (
    <div ref={boxRef} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: live ? 1 : 0 }}>
      {mounted ? <Stage data={data} active={want && !hidden} onReady={onReady} onFallback={onFallback} /> : null}
    </div>
  );
}
