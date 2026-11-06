"use client";
// EXPERIENCE scene: a glowing 3D timeline (tasks/neural-spec.md). One ring per company,
// oldest → newest along a rising path through depth; each role's segment is as long as
// the months spent there (quarter-year ticks make that visible). As the section scrolls
// (`progress` 0 → 1) a light trail draws along the path and threads the rings; the scene
// keeps the trail head centred, so the camera appears to dolly along the path. The
// current role pulses in the status colour. Labels ("Company · years", role) are
// aria-hidden duplicates of the section's server-rendered text. `weight` fades it.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import type { SceneProps } from "../types";
import { layoutTimeline } from "./experience/path";
import { ExperienceRig } from "./experience/rig";
import { LabelLayer } from "./stack/labels";

export { cameraTarget } from "./experience/path";

export default function ExperienceScene({ data, progress, weight, pointer, palette, quality }: SceneProps) {
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
    if (rig.frame(state.clock.elapsedTime, dt, state.camera, state.size, progress, weight, pointer)) state.invalidate();
  });

  return (
    <primitive object={rig.root}>
      <primitive object={rig.frameGroup} />
    </primitive>
  );
}
