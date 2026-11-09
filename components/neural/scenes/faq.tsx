"use client";
// FAQ scene: every answer becomes a picture made from real data (tasks/fullmotion-v3.md).
// Idle, it is a question field: one node per question, level with its card, threads
// converging on a slow answer core; the hovered question's node is pulled forward. Opening
// a question folds the nodes into a rail on the window's edge (the open card's connector
// meets its node), a beam carries it in and the core unfolds into that answer's visual:
// the career as year rings (experience), the most-used skills as a constellation (stack),
// a status beacon (availability), a globe with the live local time (time zone), or gauges
// of the figures the answer quotes (response, pricing, process). It lives in the section's
// empty window beside the cards (faq/rig.ts), never under text; labels are aria-hidden
// duplicates of the page's text. Three instanced draw calls; nothing allocates per frame.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import type { SceneProps } from "../types";
import { FaqRig } from "./faq/rig";
import { LabelLayer } from "./stack/labels";

export default function FaqScene({ data, weight, focus, palette, quality }: SceneProps) {
  const host = useThree((s) => s.gl.domElement.parentElement);
  const canvas = useThree((s) => s.gl.domElement);
  const rig = useMemo(() => new FaqRig(data, quality), [data, quality]);
  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => rig.attach(), [rig]);
  useEffect(() => rig.setPalette(palette), [rig, palette]);
  useEffect(() => {
    if (!host) return;
    const layer = new LabelLayer(host);
    rig.attachLabels(layer);
    return () => {
      rig.attachLabels(null);
      layer.dispose();
    };
  }, [rig, host]);

  useFrame((state, dt) => {
    rig.frame(state.clock.elapsedTime, dt, state.camera, state.size, canvas, weight, focus);
  });

  return <primitive object={rig.root} />;
}
