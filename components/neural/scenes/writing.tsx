"use client";
// WRITING scene: the latest posts as glass manuscript pages standing on a glowing rail in
// the band above the post cards, each page right above its card. A build terminal at the
// rail's start keeps running; ink tokens leave it along the rail and climb into the
// active page, where a light-cursor types its lines. Hovering or focusing a card (else
// scrolling through the section) steps its page forward in orange with the card's real
// date and title as aria-hidden labels (copied from the server-rendered card). Two draw
// calls; layout and the DOM reads live in writing/rig.ts.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import type { SceneProps } from "../types";
import { WritingRig } from "./writing/rig";

export default function WritingScene({ weight, focus, pointer, palette, quality }: SceneProps) {
  const host = useThree((s) => s.gl.domElement.parentElement);
  const rig = useMemo(() => new WritingRig(), []);
  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => rig.setQuality(quality), [rig, quality]);
  useEffect(() => rig.setPalette(palette), [rig, palette]);
  useEffect(() => {
    rig.setHost(host);
    return () => rig.setHost(null);
  }, [rig, host]);

  // Card positions are cached: re-measured only when the page's layout changes.
  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          rig.measure();
        });
    };
    window.addEventListener("resize", schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
    };
  }, [rig]);

  useFrame((state, dt) => rig.frame(state.camera, state.size, dt, weight, focus, pointer));

  return <primitive object={rig.root} />;
}
