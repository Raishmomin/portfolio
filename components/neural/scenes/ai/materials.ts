// Shader materials for the AI scene. Every material shares one uniforms object, so the
// scene updates time/opacity/stage positions once per frame for all of them.
import { Color, DoubleSide, ShaderMaterial, type IUniform } from "three";
import { MAX_STAGES, PATH_GLSL } from "./pipeline";
import { FRESNEL_FRAG, FRESNEL_VERT, glowBlending, POINT_FRAG, POINT_VERT } from "./shared";

export type AiUniforms = {
  uTime: IUniform<number>;
  uOpacity: IUniform<number>;
  uLight: IUniform<number>;
  uStart: IUniform<number>;
  uEnd: IUniform<number>;
  uLlmT: IUniform<number>;
  uLlmP: IUniform<number>;
  uStT: IUniform<Float32Array>;
  uStP: IUniform<Float32Array>;
  uAi: IUniform<Color>;
  uAccent: IUniform<Color>;
  uFg: IUniform<Color>;
  uPx: IUniform<number>;
  uPersp: IUniform<number>;
};

export function makeUniforms(): AiUniforms {
  return {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uLight: { value: 0 },
    uStart: { value: 0.2 },
    uEnd: { value: 0.8 },
    uLlmT: { value: 0.5 },
    uLlmP: { value: 1 },
    uStT: { value: new Float32Array(MAX_STAGES) },
    uStP: { value: new Float32Array(MAX_STAGES) },
    uAi: { value: new Color() },
    uAccent: { value: new Color() },
    uFg: { value: new Color() },
    uPx: { value: 400 },
    uPersp: { value: 1 },
  };
}

const STAGE_GLSL = /* glsl */ `
uniform float uStT[${MAX_STAGES}];
uniform float uStP[${MAX_STAGES}];
float stageGlow(float t, float k) {
  float g = 0.0;
  for (int i = 0; i < ${MAX_STAGES}; i++) {
    float d = (t - uStT[i]) * k;
    g += uStP[i] * exp(-d * d);
  }
  return g;
}
`;

const COMMON = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uLight;
uniform float uStart;
uniform float uEnd;
uniform float uLlmT;
uniform float uLlmP;
uniform vec3 uAi;
uniform vec3 uAccent;
uniform vec3 uFg;
${STAGE_GLSL}
// Data is blue going in and turns orange (the answer) once it leaves the model.
vec3 flowColor(float t) { return mix(uAi, uAccent, smoothstep(uLlmT + 0.03, uLlmT + 0.12, t)); }
float inPipe(float t) {
  return smoothstep(uStart - 0.02, uStart + 0.005, t) * (1.0 - smoothstep(uEnd - 0.005, uEnd + 0.02, t));
}
`;

const TUBE_VERT = /* glsl */ `
varying float vU;
varying vec3 vN;
varying vec3 vV;
void main() {
  vU = uv.x;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const TUBE_FRAG = /* glsl */ `
${COMMON}
varying float vU;
varying vec3 vN;
varying vec3 vV;
void main() {
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float fres = pow(1.0 - facing, 1.5);
  float flow = pow(fract(vU * 24.0 - uTime * 0.75), 6.0);
  float st = stageGlow(vU, 30.0);
  vec3 col = flowColor(vU);
  float a = inPipe(vU) * (0.28 + 0.55 * fres + 0.4 * flow + 0.45 * st);
  vec3 lit = col * (0.9 + 0.7 * flow + 0.5 * st) + uFg * 0.15 * fres;
  gl_FragColor = vec4(mix(lit, col * (0.8 + 0.3 * flow), uLight), clamp(a, 0.0, 1.0) * uOpacity);
  #include <colorspace_fragment>
}
`;

const GLOW_FRAG = /* glsl */ `
${COMMON}
varying float vU;
varying vec3 vN;
varying vec3 vV;
void main() {
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float st = stageGlow(vU, 22.0);
  float a = inPipe(vU) * pow(facing, 2.5) * (0.16 + 0.22 * st) * mix(1.0, 0.55, uLight);
  gl_FragColor = vec4(flowColor(vU), a * uOpacity);
  #include <colorspace_fragment>
}
`;

const PARTICLE_VERT = /* glsl */ `
${COMMON}
${PATH_GLSL}
attribute float aT;
attribute float aSpeed;
attribute vec3 aOff;
attribute float aSize;
uniform float uPx;
uniform float uPersp;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float u = fract(aT + uTime * aSpeed);
  float t = mix(uStart, uEnd, u);
  vec3 p = pathAt(t);
  // Inside the model the stream fans out through the neurons, then regroups.
  float dl = (t - uLlmT) * 16.0;
  float bulge = 1.0 + 7.5 * exp(-dl * dl) * uLlmP;
  float ang = aOff.y + uTime * aOff.z;
  p.y += cos(ang) * aOff.x * bulge;
  p.z += sin(ang) * aOff.x * bulge;
  float st = stageGlow(t, 34.0);
  vColor = flowColor(t) * (1.0 + 0.6 * st * (1.0 - uLight));
  vAlpha = smoothstep(0.0, 0.05, u) * (1.0 - smoothstep(0.93, 1.0, u)) * (0.6 + 0.4 * min(st, 1.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aSize * (1.0 + 0.5 * min(st, 1.0)) * uPx / mix(1.0, -mv.z, uPersp);
  gl_Position = projectionMatrix * mv;
}
`;

const RING_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const RING_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uLight;
uniform vec3 uAi;
uniform vec3 uFg;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  // Three dashes chasing round the gate: the stage is "processing".
  float d = fract(vUv.x * 3.0 - uTime * 0.12);
  if (d > 0.74) discard;
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.2);
  float head = smoothstep(0.45, 0.74, d);
  vec3 col = mix(uAi, mix(uAi, uFg, 0.6), head * (1.0 - uLight));
  gl_FragColor = vec4(col, (0.45 + 0.4 * fres + 0.3 * head) * uOpacity);
  #include <colorspace_fragment>
}
`;

const NODE_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
uniform float uTime;
uniform float uPx;
uniform float uPersp;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = 0.55 + 0.45 * sin(uTime * 2.6 + aPhase * 6.2831853);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPx / mix(1.0, -mv.z, uPersp);
  gl_Position = projectionMatrix * mv;
}
`;

const SYNAPSE_VERT = /* glsl */ `
attribute float aEnd;
attribute float aPhase;
varying float vEnd;
varying float vPhase;
void main() {
  vEnd = aEnd;
  vPhase = aPhase;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SYNAPSE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uLight;
uniform vec3 uAi;
uniform vec3 uFg;
varying float vEnd;
varying float vPhase;
void main() {
  // A signal runs along a third of the synapses at any moment.
  float firing = step(0.66, fract(vPhase * 7.31 + floor(uTime * 0.5 + vPhase) * 0.37));
  float pulse = pow(fract(vEnd - uTime * 0.9 + vPhase), 14.0) * firing;
  vec3 col = mix(uAi, mix(uAi, uFg, 0.7), pulse * (1.0 - uLight));
  float a = mix(0.09, 0.14, uLight) + pulse * 0.85;
  gl_FragColor = vec4(col, a * uOpacity);
  #include <colorspace_fragment>
}
`;

export type AiMaterials = ReturnType<typeof makeAiMaterials>;

export function makeAiMaterials(U: AiUniforms, light: boolean) {
  const blending = glowBlending(light);
  const glow = { transparent: true, depthWrite: false, blending };
  const solid = () =>
    new ShaderMaterial({
      uniforms: { uColor: { value: new Color() }, uRim: { value: new Color() }, uOpacity: U.uOpacity },
      vertexShader: FRESNEL_VERT,
      fragmentShader: FRESNEL_FRAG,
      transparent: true,
    });
  return {
    tube: new ShaderMaterial({ uniforms: U, vertexShader: TUBE_VERT, fragmentShader: TUBE_FRAG, ...glow }),
    glow: new ShaderMaterial({ uniforms: U, vertexShader: TUBE_VERT, fragmentShader: GLOW_FRAG, ...glow, side: DoubleSide }),
    particles: new ShaderMaterial({ uniforms: U, vertexShader: PARTICLE_VERT, fragmentShader: POINT_FRAG, ...glow }),
    halos: new ShaderMaterial({ uniforms: U, vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, ...glow }),
    nodes: new ShaderMaterial({ uniforms: U, vertexShader: NODE_VERT, fragmentShader: POINT_FRAG, ...glow }),
    synapses: new ShaderMaterial({ uniforms: U, vertexShader: SYNAPSE_VERT, fragmentShader: SYNAPSE_FRAG, ...glow }),
    ring: new ShaderMaterial({ uniforms: U, vertexShader: RING_VERT, fragmentShader: RING_FRAG, ...glow, side: DoubleSide }),
    /** Stage solids before the model (blue) and after it (orange, the answer). */
    core: solid(),
    coreOut: solid(),
    /** Sound-wave rings of a speech stage: one material per ring index (opacity animates). */
    waves: [0, 1, 2].map(
      () =>
        new ShaderMaterial({
          uniforms: { uColor: { value: U.uAi.value }, uRim: { value: U.uFg.value }, uOpacity: { value: 0 } },
          vertexShader: FRESNEL_VERT,
          fragmentShader: FRESNEL_FRAG,
          ...glow,
        }),
    ),
  };
}

export function disposeAll(m: Record<string, { dispose(): void } | { dispose(): void }[]>) {
  for (const v of Object.values(m)) (Array.isArray(v) ? v : [v]).forEach((x) => x.dispose());
}
