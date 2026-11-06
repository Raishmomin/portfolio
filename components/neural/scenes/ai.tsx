"use client";
// AI scene (tasks/neural-spec.md): the current AI project as a left→right pipeline.
// Stage nodes (data.ai[i].stages) sit on one glowing pipe; data particles stream
// through it (positions computed in the vertex shader, zero CPU per particle), fan out
// through the LLM's neural cluster and leave orange (the answer). `progress` steps
// through the projects in equal slices and `focus` (a project slug) jumps to one; the
// stage sets morph smoothly (shared stages glide, missing ones grow/shrink in place).
// Text: aria-hidden <Html> stage names + project title that duplicate the DOM section.
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import type { SceneProps } from "../types";
import { buildPipeline, PATH_W, type StageKind } from "./ai/pipeline";
import { AiRig, emptyRegistry, type AiRegistry } from "./ai/rig";
import { isLight, useAfterFirstFrame } from "./ai/shared";

/** Label distance below (landscape) / beside (portrait) each stage, in stage units. */
const LABEL_OFFSET: Record<StageKind, number> = { llm: 0.98, rag: 0.5, io: 0.56, speech: 0.56, agent: 0.6, generic: 0.56 };

/**
 * The look of one stage: a gate ring (in/out), a database stack (retrieval), a tool
 * orbit (agent), sound waves (speech) or the LLM's neural cluster. Its little props
 * animate here; position, scale and presence come from the rig.
 */
function StageBody({ rig, kind, out, active }: { rig: AiRig; kind: StageKind; out: boolean; active: boolean }) {
  const { geo, mats, cluster } = rig;
  const spin = useRef<Group>(null);
  const parts = useRef<(Mesh | null)[]>([]);
  useFrame((state, dt) => {
    if (!active) return;
    const t = state.clock.elapsedTime;
    if (spin.current) spin.current.rotation.x += Math.min(dt, 0.1) * 0.28;
    for (let k = 0; k < 3; k++) {
      const m = parts.current[k];
      if (!m) continue;
      if (kind === "agent") {
        const a = t * 0.9 + (k * Math.PI * 2) / 3;
        m.position.set(0, Math.cos(a) * 0.36, Math.sin(a) * 0.36);
      } else {
        const f = (t * 0.5 + k / 3) % 1;
        m.scale.setScalar(0.45 + f * 1.5);
        rig.setWave(k, 4 * f * (1 - f) * 0.85);
      }
    }
  });
  if (kind === "llm")
    return (
      <group ref={spin}>
        <lineSegments geometry={cluster.lines} material={mats.synapses} frustumCulled={false} />
        <points geometry={cluster.points} material={mats.nodes} frustumCulled={false} />
      </group>
    );
  if (kind === "rag")
    return (
      <group>
        {[-0.13, 0, 0.13].map((y) => (
          <mesh key={y} geometry={geo.disc} material={mats.core} position-y={y} />
        ))}
      </group>
    );
  const core = <mesh geometry={geo.core} material={out ? mats.coreOut : mats.core} />;
  if (kind === "speech")
    return (
      <group>
        {core}
        {[0, 1, 2].map((k) => (
          <mesh
            key={k}
            ref={(m) => {
              parts.current[k] = m;
            }}
            geometry={geo.wave}
            material={mats.waves[k]}
            rotation-y={Math.PI / 2}
          />
        ))}
      </group>
    );
  return (
    <group>
      {core}
      <mesh geometry={geo.ring} material={mats.ring} rotation-y={Math.PI / 2} />
      {kind === "agent"
        ? [0, 1, 2].map((k) => (
            <mesh
              key={k}
              ref={(m) => {
                parts.current[k] = m;
              }}
              geometry={geo.sat}
              material={mats.coreOut}
            />
          ))
        : null}
    </group>
  );
}

export default function AiScene({ data, progress, weight, pointer, focus, palette, quality }: SceneProps) {
  const model = useMemo(() => buildPipeline(data.ai), [data.ai]);
  const light = isLight(palette.bg);
  const rig = useMemo(() => new AiRig(light), [light]);
  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => rig.setPalette(palette, model), [rig, palette, model]);
  useEffect(() => rig.setQuality(quality), [rig, quality]);

  const viewport = useThree((s) => s.viewport);
  const portrait = viewport.aspect < 0.85;
  const fit = portrait
    ? Math.min(viewport.width / 4.4, viewport.height / (PATH_W + 3.6))
    : Math.min(viewport.width / 13.4, viewport.height / 5);
  const scale = Math.min(fit, 1.1);
  const active = weight > 0;
  const llm = model.vocab.findIndex((v) => v.kind === "llm");
  const showText = useAfterFirstFrame() && active && !model.generic;

  const reg = useRef<AiRegistry>(emptyRegistry());
  useFrame((state, dt) => rig.frame(state, dt, { model, progress, weight, pointer, focus, scale, yaw: portrait ? 0 : -0.32 }, reg.current));
  const { geo, mats } = rig;

  const chip = `color-mix(in srgb, ${palette.bg} 78%, transparent)`;
  return (
    <group
      ref={(g) => {
        reg.current.root = g;
      }}
      visible={active}
    >
      <group rotation-z={portrait ? -Math.PI / 2 : 0}>
        <mesh geometry={geo.glow} material={mats.glow} frustumCulled={false} renderOrder={1} />
        <mesh geometry={geo.tube} material={mats.tube} frustumCulled={false} renderOrder={2} />
        <points geometry={geo.halos} material={mats.halos} frustumCulled={false} renderOrder={3} />
        <points geometry={geo.particles} material={mats.particles} frustumCulled={false} renderOrder={4} />
        {model.vocab.map((v, i) => (
          <group
            key={v.name}
            ref={(g) => {
              reg.current.stages[i] = g;
            }}
            visible={false}
          >
            <StageBody rig={rig} kind={v.kind} out={llm >= 0 && i > llm} active={active} />
            {showText ? (
              <Html position={[0, portrait ? LABEL_OFFSET[v.kind] : -LABEL_OFFSET[v.kind], 0]} zIndexRange={[20, 0]} pointerEvents="none">
                <div
                  aria-hidden="true"
                  ref={(el) => {
                    reg.current.labels[i] = el;
                  }}
                  className="pointer-events-none select-none whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase leading-none tracking-[0.14em]"
                  style={{
                    opacity: 0,
                    transform: portrait ? "translate(0,-50%)" : "translate(-50%,0)",
                    color: v.kind === "llm" ? palette.ai : palette.fg,
                    background: chip,
                    borderColor: `color-mix(in srgb, ${v.kind === "llm" ? palette.ai : palette.muted} 45%, transparent)`,
                  }}
                >
                  {v.name}
                </div>
              </Html>
            ) : null}
          </group>
        ))}
      </group>
      {showText ? (
        <Html position={portrait ? [0, PATH_W / 2 + 0.75, 0] : [0, 1.75, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
          <div
            aria-hidden="true"
            className="pointer-events-none grid select-none text-center font-mono text-xs uppercase tracking-[0.16em]"
            style={{ color: palette.fg }}
          >
            {model.projects.map((p, j) => (
              <span
                key={p.slug}
                ref={(el) => {
                  reg.current.titles[j] = el;
                }}
                className="whitespace-nowrap [grid-area:1/1]" style={{ opacity: 0 }}>
                <span style={{ color: palette.ai }}>● </span>
                {p.title}
              </span>
            ))}
          </div>
        </Html>
      ) : null}
    </group>
  );
}
