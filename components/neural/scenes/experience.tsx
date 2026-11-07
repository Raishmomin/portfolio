"use client";
// EXPERIENCE scene: the career path (tasks/neural-spec.md). One glowing ring per company,
// oldest → newest, on a trail that weaves through depth; quarter-year ticks along each
// role's stretch count the time spent there, data packets run along the drawn trail and
// the current role pulses in the status colour. On the home journey every ring sits on its
// role's rail dot and the trail draws with the horizontal scroll; elsewhere the path is
// laid out in the free band above the content and never under it (experience/rig.ts).
// Labels ("Company · years", role) are aria-hidden duplicates of the server-rendered text.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import type { SceneProps } from "../types";
import { layoutTimeline } from "./experience/path";
import { ExperienceRig } from "./experience/rig";
import { LabelLayer } from "./stack/labels";

export default function ExperienceScene({ data, progress, weight, palette, quality }: SceneProps) {
  const host = useThree((s) => s.gl.domElement.parentElement);
  const timeline = useMemo(() => layoutTimeline(data), [data]);
  const rig = useMemo(() => new ExperienceRig(timeline, quality), [timeline, quality]);
  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => {
    if (!host) return;
    const layer = new LabelLayer(host);
    rig.attachLabels(layer);
    return () => {
      rig.attachLabels(null);
      layer.dispose();
    };
  }, [rig, host]);
  useEffect(() => rig.setPalette(palette), [rig, palette]);

  useFrame((state, dt) => {
    if (rig.frame(state.clock.elapsedTime, dt, state.camera, state.size, state.gl.getPixelRatio(), progress, weight)) state.invalidate();
  });

  return <primitive object={rig.root} />;
}
