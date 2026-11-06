"use client";

// Hero scene: a glowing 3D neural network (5 layers in depth). Forward-pass waves
// sweep input → output: edges carry a travelling pulse and the nodes they reach flash;
// signal particles stream along real routes, turning from AI blue to orange as they
// near the output. Nodes near the cursor are drawn toward it and brighten; the network
// leans toward the pointer and breathes slowly over a soft aura and drifting dust.
// Four draw calls; all motion is in shaders (no per-frame allocation or node loops).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LineSegments,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type Camera,
  type IUniform,
  type Texture,
} from "three";
import { isLight, makeGlowTexture, setColor, setGlowBlending } from "../fx";
import { BASE_PITCH, BASE_YAW, heroLayout, isPortrait, LAYERS, PARTICLES, type HeroLayout } from "../hero-layout";
import type { SceneProps } from "../types";

const COMMON = /* glsl */ `
uniform float uTime;
uniform float uWeight;
uniform float uLight;
uniform vec3 uPointer;
uniform float uPointerOn;
uniform vec3 uIn;
uniform vec3 uAi;
uniform vec3 uOut;
uniform vec3 uHot;
float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
// Forward-pass wave: sweeps layer coordinate -0.5 → 5.5 every 5 s.
float wave() { return fract(uTime * 0.2) * 6.0 - 0.5; }
float cycle() { return floor(uTime * 0.2); }
vec3 attract(vec3 p) {
  vec3 d = uPointer - p;
  return p + d * exp(-dot(d, d) * 0.22) * uPointerOn * 0.2;
}
float near(vec3 p) {
  vec3 d = uPointer - p;
  return exp(-dot(d, d) * 0.5) * uPointerOn;
}
`;

const NODE_VERT = /* glsl */ `
${COMMON}
uniform float uSize;
attribute vec3 aPos;
attribute float aLayer;
attribute float aSeed;
varying vec2 vUv;
varying vec3 vColor;
varying float vI;
void main() {
  vec3 p = attract(aPos);
  float fire = step(0.3, hash(aSeed * 7.13 + cycle()));
  float act = exp(-pow((wave() - aLayer) * 2.4, 2.0)) * fire;
  float hot = near(aPos);
  float breathe = 0.86 + 0.14 * sin(uTime * 1.6 + aSeed * 40.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * uSize * breathe * (1.0 + 0.6 * act + 0.5 * hot);
  gl_Position = projectionMatrix * mv;
  vec3 base = aLayer < 0.5 ? uIn : (aLayer > 3.5 ? uOut : uAi);
  vColor = mix(base, uHot, clamp(0.3 * act + 0.5 * hot, 0.0, 1.0));
  vI = 0.7 + 0.8 * act + 0.6 * hot;
  vUv = uv;
}`;

const NODE_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uWeight;
uniform float uLight;
varying vec2 vUv;
varying vec3 vColor;
varying float vI;
void main() {
  vec4 t = texture2D(uMap, vUv);
  if (uLight < 0.5) {
    vec3 c = vColor * t.g * 0.85 * vI + mix(vColor, vec3(1.0), 0.6) * t.r * min(vI, 1.4);
    gl_FragColor = vec4(c * uWeight, 0.0);
  } else {
    float a = max(t.r, t.g * 0.24 * min(vI, 1.6));
    gl_FragColor = vec4(vColor, a * uWeight);
  }
}`;

const LINE_VERT = /* glsl */ `
${COMMON}
attribute float aT;
attribute float aLayer;
attribute float aSeed;
varying float vT;
varying float vL;
varying float vS;
varying float vHot;
void main() {
  vT = aT;
  vL = aLayer;
  vS = aSeed;
  vHot = near(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(attract(position), 1.0);
}`;

const LINE_FRAG = /* glsl */ `
${COMMON}
uniform float uBase;
varying float vT;
varying float vL;
varying float vS;
varying float vHot;
void main() {
  float w = wave() - vL;
  float fire = step(0.4, hash(vS + cycle()));
  float pulse = exp(-pow((vT - w) * 5.0, 2.0)) * fire;
  float a = uBase + pulse * 0.9 + vHot * 0.35;
  vec3 c = mix(uAi, mix(uAi, uOut, smoothstep(2.6, 3.4, vL + vT)), pulse);
  if (uLight < 0.5) gl_FragColor = vec4(c * a * uWeight, 0.0);
  else gl_FragColor = vec4(c, min(a, 1.0) * uWeight);
}`;

const PARTICLE_VERT = /* glsl */ `
${COMMON}
uniform float uPSize;
attribute vec3 aA;
attribute vec3 aB;
attribute vec3 aC;
attribute vec3 aD;
attribute vec3 aE;
attribute vec2 aPh;
varying vec2 vUv;
varying vec3 vColor;
varying float vLife;
vec3 route(float t) {
  float f = fract(t);
  if (t < 1.0) return mix(aA, aB, f);
  if (t < 2.0) return mix(aB, aC, f);
  if (t < 3.0) return mix(aC, aD, f);
  return mix(aD, aE, f);
}
void main() {
  float t = fract(uTime * aPh.y + aPh.x) * 3.999;
  vec4 head = modelViewMatrix * vec4(attract(route(t)), 1.0);
  vec4 tail = modelViewMatrix * vec4(attract(route(max(t - 0.16, 0.0))), 1.0);
  vec2 dir = head.xy - tail.xy;
  float len = length(dir);
  dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
  vec2 side = vec2(-dir.y, dir.x);
  vLife = smoothstep(0.0, 0.35, t) * (1.0 - smoothstep(3.55, 3.999, t));
  vec4 mv = mix(tail, head, 0.5);
  mv.xy += dir * position.x * (len + uPSize) + side * position.y * uPSize;
  gl_Position = projectionMatrix * mv;
  vColor = mix(uAi, uOut, smoothstep(2.6, 3.4, t));
  vUv = uv;
}`;

const PARTICLE_FRAG = /* glsl */ `
uniform float uWeight;
uniform float uLight;
varying vec2 vUv;
varying vec3 vColor;
varying float vLife;
void main() {
  float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
  float body = across * across * (0.08 + 0.92 * vUv.x * vUv.x * vUv.x);
  float a = body * vLife * uWeight;
  if (uLight < 0.5) gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.35 * vUv.x) * a * 1.6, 0.0);
  else gl_FragColor = vec4(vColor, min(a * 1.3, 1.0));
}`;

// Ambient depth: a soft AI-blue aura behind the network and slow drifting dust motes.
const AMBIENT_VERT = /* glsl */ `
${COMMON}
uniform float uSize;
attribute vec3 aPos;
attribute float aSeed;
varying vec2 vUv;
varying float vI;
void main() {
  vec3 p = aPos + vec3(sin(uTime * 0.11 + aSeed * 50.0), cos(uTime * 0.07 + aSeed * 31.0), 0.0) * 0.35;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float aura = step(aSeed, -0.5);
  mv.xy += position.xy * (aura > 0.5 ? 15.0 : uSize);
  gl_Position = projectionMatrix * mv;
  vI = aura > 0.5 ? -1.0 : 0.25 + 0.2 * sin(uTime * 0.8 + aSeed * 90.0);
  vUv = uv;
}`;

const AMBIENT_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uMap;
varying vec2 vUv;
varying float vI;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float aura = vI < 0.0 ? 1.0 : 0.0;
  float a = aura > 0.5 ? pow(t.g, 1.6) * (uLight > 0.5 ? 0.07 : 0.13) : (t.r * 0.8 + t.g * 0.4) * vI;
  vec3 c = aura > 0.5 ? mix(uAi, uOut, 0.12) : uAi;
  if (uLight < 0.5) gl_FragColor = vec4(c * a * uWeight, 0.0);
  else gl_FragColor = vec4(c, a * uWeight);
}`;

type Uniforms = Record<string, IUniform>;

function buildNetwork(layout: HeroLayout, routeCount: number, uniforms: Uniforms, map: Texture) {
  const { nodes, layer, edges, routes, layers } = layout;
  const count = layer.length;

  // Nodes: one instanced billboard quad per node.
  const quad = new PlaneGeometry(1, 1);
  const nodeGeo = new InstancedBufferGeometry();
  nodeGeo.index = quad.index;
  nodeGeo.setAttribute("position", quad.getAttribute("position"));
  nodeGeo.setAttribute("uv", quad.getAttribute("uv"));
  nodeGeo.setAttribute("aPos", new InstancedBufferAttribute(nodes, 3));
  nodeGeo.setAttribute("aLayer", new InstancedBufferAttribute(Float32Array.from(layer), 1));
  nodeGeo.setAttribute("aSeed", new InstancedBufferAttribute(Float32Array.from({ length: count }, (_, i) => (i * 0.618034) % 1), 1));
  nodeGeo.instanceCount = count;
  const nodeMat = new ShaderMaterial({
    uniforms: { ...uniforms, uMap: { value: map }, uSize: { value: 0.85 } },
    vertexShader: NODE_VERT,
    fragmentShader: NODE_FRAG,
  });
  const nodeMesh = new Mesh(nodeGeo, nodeMat);

  // Edges: one LineSegments; per-vertex t (0 at source, 1 at target), layer and seed.
  const segs = edges.length / 2;
  const pos = new Float32Array(segs * 6);
  const t = new Float32Array(segs * 2);
  const lay = new Float32Array(segs * 2);
  const seed = new Float32Array(segs * 2);
  for (let e = 0; e < segs; e++) {
    const a = edges[e * 2];
    const b = edges[e * 2 + 1];
    pos.set(nodes.subarray(a * 3, a * 3 + 3), e * 6);
    pos.set(nodes.subarray(b * 3, b * 3 + 3), e * 6 + 3);
    t[e * 2 + 1] = 1;
    lay[e * 2] = lay[e * 2 + 1] = layer[a];
    seed[e * 2] = seed[e * 2 + 1] = e * 0.137;
  }
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  lineGeo.setAttribute("aT", new Float32BufferAttribute(t, 1));
  lineGeo.setAttribute("aLayer", new Float32BufferAttribute(lay, 1));
  lineGeo.setAttribute("aSeed", new Float32BufferAttribute(seed, 1));
  const lineMat = new ShaderMaterial({
    uniforms: { ...uniforms, uBase: { value: 0.16 } },
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
  });
  const lines = new LineSegments(lineGeo, lineMat);

  // Signal particles: streaks along routes; the route's five nodes are instance attributes.
  const partGeo = new InstancedBufferGeometry();
  partGeo.index = quad.index;
  partGeo.setAttribute("position", quad.getAttribute("position"));
  partGeo.setAttribute("uv", quad.getAttribute("uv"));
  const names = ["aA", "aB", "aC", "aD", "aE"];
  for (let l = 0; l < layers; l++) {
    const arr = new Float32Array(routeCount * 3);
    for (let r = 0; r < routeCount; r++) arr.set(nodes.subarray(routes[r * layers + l] * 3, routes[r * layers + l] * 3 + 3), r * 3);
    partGeo.setAttribute(names[l], new InstancedBufferAttribute(arr, 3));
  }
  const ph = new Float32Array(routeCount * 2);
  for (let r = 0; r < routeCount; r++) {
    ph[r * 2] = (r * 0.381966) % 1;
    ph[r * 2 + 1] = 0.13 + ((r * 0.7548777) % 1) * 0.09;
  }
  partGeo.setAttribute("aPh", new InstancedBufferAttribute(ph, 2));
  partGeo.instanceCount = routeCount;
  const partMat = new ShaderMaterial({
    uniforms: { ...uniforms, uPSize: { value: 0.11 } },
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
  });
  const particles = new Mesh(partGeo, partMat);

  // Ambient: instance 0 is the aura (seed -1), the rest are dust motes in a loose box.
  const dust = Math.round(routeCount * 2.2);
  const ambGeo = new InstancedBufferGeometry();
  ambGeo.index = quad.index;
  ambGeo.setAttribute("position", quad.getAttribute("position"));
  ambGeo.setAttribute("uv", quad.getAttribute("uv"));
  const ambPos = new Float32Array((dust + 1) * 3);
  const ambSeed = new Float32Array(dust + 1);
  ambSeed[0] = -1;
  for (let d = 1; d <= dust; d++) {
    const h = (n: number) => (Math.sin(d * 12.9898 + n * 78.233) * 43758.5453) % 1;
    ambPos[d * 3] = Math.abs(h(1)) * 22 - 11;
    ambPos[d * 3 + 1] = Math.abs(h(2)) * 12 - 6;
    ambPos[d * 3 + 2] = Math.abs(h(3)) * 10 - 6;
    ambSeed[d] = Math.abs(h(4));
  }
  ambGeo.setAttribute("aPos", new InstancedBufferAttribute(ambPos, 3));
  ambGeo.setAttribute("aSeed", new InstancedBufferAttribute(ambSeed, 1));
  ambGeo.instanceCount = dust + 1;
  const ambMat = new ShaderMaterial({
    uniforms: { ...uniforms, uMap: { value: map }, uSize: { value: 0.16 } },
    vertexShader: AMBIENT_VERT,
    fragmentShader: AMBIENT_FRAG,
  });
  const ambient = new Mesh(ambGeo, ambMat);
  ambient.renderOrder = -1;

  for (const o of [ambient, lines, particles, nodeMesh]) o.frustumCulled = false;
  lines.renderOrder = 0;
  particles.renderOrder = 1;
  nodeMesh.renderOrder = 2;
  const materials = [nodeMat, lineMat, partMat, ambMat];
  return {
    objects: [ambient, lines, particles, nodeMesh],
    materials,
    dispose() {
      quad.dispose();
      nodeGeo.dispose();
      lineGeo.dispose();
      partGeo.dispose();
      ambGeo.dispose();
      materials.forEach((m) => m.dispose());
    },
  };
}

/** The network's mutable state: React only wires its lifecycle, nothing re-renders per frame. */
class HeroNet {
  readonly group = new Group();
  private readonly inner = new Group();
  private readonly map = makeGlowTexture();
  private readonly uniforms: Uniforms = {
    uTime: { value: 0 },
    uWeight: { value: 0 },
    uLight: { value: 0 },
    uPointer: { value: new Vector3(0, 0, 100) },
    uPointerOn: { value: 0 },
    uIn: { value: new Vector3() },
    uAi: { value: new Vector3() },
    uOut: { value: new Vector3() },
    uHot: { value: new Vector3() },
  };
  private readonly net: ReturnType<typeof buildNetwork>;
  private lean = 0;
  private tilt = 0;
  private readonly ndc = new Vector3();
  private readonly dir = new Vector3();
  private readonly hit = new Vector3();

  constructor(quality: SceneProps["quality"]) {
    const routeCount = PARTICLES[quality];
    this.net = buildNetwork(heroLayout(LAYERS[quality], routeCount), routeCount, this.uniforms, this.map);
    this.inner.add(...this.net.objects);
    this.group.add(this.inner);
  }

  /** Palette → colours and blending (additive light on dark, alpha on paper). */
  setPalette(p: SceneProps["palette"]) {
    const u = this.uniforms;
    const light = isLight(p.bg);
    u.uLight.value = light ? 1 : 0;
    setColor(u.uIn.value, p.fg, light ? undefined : p.ai, light ? 0 : 0.35);
    setColor(u.uAi.value, p.ai);
    setColor(u.uOut.value, p.accent);
    if (light) setColor(u.uHot.value, p.ai, p.fg, 0.35);
    else setColor(u.uHot.value, p.fg, "#ffffff", 0.5);
    for (const m of this.net.materials) {
      setGlowBlending(m, light);
      if (m.uniforms.uBase) m.uniforms.uBase.value = light ? 0.2 : 0.15;
    }
  }

  frame(camera: Camera, rawDelta: number, aspect: number, { weight, progress, pointer }: SceneProps) {
    const u = this.uniforms;
    const dt = Math.min(rawDelta, 0.1);
    const portrait = isPortrait(aspect);
    const time = (u.uTime.value += dt);
    u.uWeight.value = weight * (portrait ? 0.6 : 1);

    // Breathing rotation + lean toward the pointer; scrolling turns the network a little.
    const k = 1 - Math.exp(-dt / 0.6);
    this.lean += (pointer.x * 0.2 - this.lean) * k;
    this.tilt += (-pointer.y * 0.12 - this.tilt) * k;
    const o = this.group;
    o.rotation.y = BASE_YAW + Math.sin(time * 0.12) * 0.16 + this.lean + progress * 0.5;
    o.rotation.x = (portrait ? 0.55 : BASE_PITCH) + Math.sin(time * 0.09) * 0.05 + this.tilt;
    o.scale.setScalar((portrait ? 0.8 : 1) * (0.94 + 0.06 * weight));
    this.inner.rotation.z = portrait ? -Math.PI / 2 : 0;

    // Pointer → a point on the z = 0 plane → the network's local space.
    const on = Math.abs(pointer.x) + Math.abs(pointer.y) > 0.002 ? 1 : 0;
    u.uPointerOn.value += (on - u.uPointerOn.value) * (1 - Math.exp(-dt / 0.3));
    this.ndc.set(pointer.x, pointer.y, 0.5).unproject(camera);
    this.dir.copy(this.ndc).sub(camera.position).normalize();
    if (Math.abs(this.dir.z) > 1e-4) {
      this.hit.copy(camera.position).addScaledVector(this.dir, -camera.position.z / this.dir.z);
      o.updateMatrixWorld();
      this.inner.worldToLocal((u.uPointer.value as Vector3).copy(this.hit));
    }
  }

  dispose() {
    this.group.removeFromParent();
    this.net.dispose();
    this.map.dispose();
  }
}

export default function Hero(props: SceneProps) {
  const { weight, palette, quality } = props;
  const size = useThree((s) => s.size);
  const net = useMemo(() => new HeroNet(quality), [quality]);
  useEffect(() => () => net.dispose(), [net]);
  useEffect(() => net.setPalette(palette), [net, palette]);

  useFrame((s, delta) => {
    if (props.weight === 0) return;
    net.frame(s.camera, delta, size.width / Math.max(1, size.height), props);
  });

  if (weight === 0) return null;
  return <primitive object={net.group} />;
}
