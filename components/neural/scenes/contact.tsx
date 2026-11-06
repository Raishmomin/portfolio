"use client";
// Contact scene (tasks/neural-spec.md): "let's connect". The whole network — one node
// per real skill, company and project, in a slowly turning spiral of dust — is pulled
// in as `progress` grows, swirling into one bright pulsing node; then a beam of light
// reaches out from it toward the viewer. All motion is in the shaders (one uniform
// drives convergence); no text in the canvas.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { SceneProps } from "../types";
import { isLight } from "./ai/shared";
import { ContactRig, type ContactRegistry } from "./contact/rig";

/** The galaxy is seen from above at this angle (radians), so its spiral reads in depth. */
const TILT = 0.95;

export default function ContactScene({ data, progress, weight, pointer, palette, quality }: SceneProps) {
  const light = isLight(palette.bg);
  const rig = useMemo(() => new ContactRig(data, light), [data, light]);
  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => rig.setPalette(palette), [rig, palette]);
  useEffect(() => rig.setQuality(quality), [rig, quality]);

  const viewport = useThree((s) => s.viewport);
  const scale = Math.min(viewport.width / 13, viewport.height / 8.5, 1.1);
  const active = weight > 0;

  const reg = useRef<ContactRegistry>({ root: null, core: null });
  useFrame((state, dt) => rig.frame(state, dt, { progress, weight, pointer, scale }, reg.current));

  return (
    <group
      ref={(g) => {
        reg.current.root = g;
      }}
      visible={active}
    >
      <group rotation-x={TILT}>
        <lineSegments geometry={rig.lines} material={rig.mats.lines} frustumCulled={false} />
        <points geometry={rig.dust} material={rig.mats.dust} frustumCulled={false} />
        <points geometry={rig.nodes} material={rig.mats.nodes} frustumCulled={false} />
      </group>
      <mesh geometry={rig.quad} material={rig.mats.halo} frustumCulled={false} renderOrder={2} />
      <group
        ref={(g) => {
          reg.current.core = g;
        }}
      >
        <mesh geometry={rig.sphere} material={rig.mats.core} renderOrder={3} />
      </group>
      <mesh geometry={rig.beamGeo} material={rig.mats.beam} frustumCulled={false} renderOrder={4} />
    </group>
  );
}
