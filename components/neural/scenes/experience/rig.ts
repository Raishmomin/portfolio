// The experience timeline as plain three.js objects driven by `frame()` (no per-frame
// React work or allocation). A light trail draws along a fixed 3D path as the section
// scrolls; it threads one ring per company, and the group moves so the trail head stays
// centred (the camera appears to dolly along the path).
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Camera,
} from "three";
import type { ScenePalette } from "../../types";
import { GLOW_OUT, Sprites, clamp01, fitScale, hash01, isLightBg, paletteColor, setGlowBlending, smooth01 } from "../stack/gl";
import type { LabelLayer } from "../stack/labels";
import { FLOOR_Y, curve, headOf, pointAt, type Timeline } from "./path";

const TILT_X = 0.5; // rad: look down onto the path, so its weave through depth reads
const TURN_Y = 0.36; // rad: the future recedes into depth
const ANCHOR = new Vector3(-0.6, -0.1, 0); // where the head is held on screen
const RING_R = 0.52;
const TAIL_N = 26;
const DUST_N = 140;
const WAVE_S = 1.1; // s per activation shockwave
const PULSE_EVERY = 2.4; // s between the current role's pulses

const TUBE_VERT = /* glsl */ `
  varying float vU;
  varying float vFacing;
  void main() {
    vU = uv.x;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;
// mode 0 = core trail, 1 = glow sheath, 2 = the dotted path still to come
const TUBE_FRAG = /* glsl */ `
  uniform float uHead;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uLight;
  uniform float uMode;
  uniform vec3 uColor;
  uniform vec3 uHot;
  varying float vU;
  varying float vFacing;
  void main() {
    float a;
    vec3 c = uColor;
    if (uMode < 1.5) {
      if (vU > uHead) discard;
      float near = smoothstep(uHead - 0.22, uHead, vU);
      float shimmer = 0.5 + 0.5 * sin(vU * 140.0 - uTime * 6.0);
      if (uMode < 0.5) {
        a = 0.5 + 0.5 * near + 0.12 * shimmer;
        c = mix(uColor, uHot, near * 0.55);
      } else {
        a = pow(vFacing, 3.0) * (0.06 + 0.3 * near);
      }
    } else {
      if (vU < uHead) discard;
      float dash = step(0.55, fract(vU * 220.0));
      a = dash * (0.28 + 0.2 * smoothstep(uHead + 0.25, uHead, vU)) * (uLight > 0.5 ? 1.3 : 1.0);
    }
    a *= uOpacity;
    ${GLOW_OUT}
  }
`;

const RING_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vFacing;
  void main() {
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    vColor = aColor;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * mv;
  }
`;
const RING_FRAG = /* glsl */ `
  uniform float uOpacity;
  uniform float uLight;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vFacing;
  void main() {
    if (vAlpha <= 0.001) discard;
    float a = vAlpha * uOpacity * (0.55 + 0.45 * vFacing);
    vec3 c = vColor * (uLight > 0.5 ? 1.0 : 0.8 + 0.6 * vFacing);
    ${GLOW_OUT}
  }
`;

// The floor plane follows the head (uOff = head xz in path space); its grid is computed in
// path space, so the lines stay fixed while the plane slides under them.
const FLOOR_VERT = /* glsl */ `
  uniform vec2 uOff;
  varying vec2 vP;
  varying vec2 vL;
  void main() {
    vL = position.xy;
    vP = vec2(position.x + uOff.x, -position.y + uOff.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FLOOR_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uLight;
  varying vec2 vP;
  varying vec2 vL;
  float lines(vec2 p) {
    vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }
  void main() {
    float d = length(vL);
    float fade = exp(-d * d / 30.0);
    float minor = lines(vP * 2.0) * 0.35;
    float major = lines(vP * 0.5);
    float a = max(minor, major) * fade * uOpacity * (uLight > 0.5 ? 0.45 : 0.13);
    vec3 c = uColor;
    ${GLOW_OUT}
  }
`;

const DROP_VERT = /* glsl */ `
  attribute float aT;
  attribute float aAlpha;
  varying float vT;
  varying float vAlpha;
  void main() {
    vT = aT;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const DROP_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uLight;
  varying float vT;
  varying float vAlpha;
  void main() {
    float a = (1.0 - vT) * 0.55 * vAlpha * uOpacity * step(0.4, fract(vT * 18.0));
    vec3 c = uColor;
    ${GLOW_OUT}
  }
`;

// Scratch objects (module level: no per-frame allocation).
const p0 = new Vector3();
const p1 = new Vector3();
const tan = new Vector3();
const Z = new Vector3(0, 0, 1);
const sc = new Vector3();
const m4 = new Matrix4();

export class ExperienceRig {
  /** Weight fade/scale. */
  readonly root = new Group();
  /** Tilted path space; moved every frame so the trail head stays centred. */
  readonly frameGroup = new Group();

  private readonly tl: Timeline;
  private readonly core: Mesh;
  private readonly glow: Mesh;
  private readonly future: Mesh;
  private readonly tubeMats: ShaderMaterial[];
  private readonly rings: InstancedMesh;
  private readonly waves: InstancedMesh;
  private readonly ringMat: ShaderMaterial;
  private readonly waveMat: ShaderMaterial;
  private readonly ringColor: InstancedBufferAttribute;
  private readonly ringAlpha: InstancedBufferAttribute;
  private readonly waveColor: InstancedBufferAttribute;
  private readonly waveAlpha: InstancedBufferAttribute;
  private readonly floor: Mesh;
  private readonly floorMat: ShaderMaterial;
  private readonly drops: LineSegments;
  private readonly dropMat: ShaderMaterial;
  private readonly dropAlpha: BufferAttribute;
  private readonly sprites: Sprites;
  private readonly dust: Sprites;
  private readonly fadeMats: ShaderMaterial[];
  private readonly anchors: Vector3[];
  private readonly quats: Quaternion[];
  private readonly reached: boolean[];
  private readonly waveStart: Float32Array;
  // sprite index ranges
  private readonly sNode = 0;
  private readonly sBase: number;
  private readonly sNow: number;
  private readonly sHead: number;
  private readonly sTail: number;
  private readonly sTick: number;
  private colPast = new Color();
  private colNow = new Color();
  private colTodo = new Color();
  private colTrail = new Color();
  private colTick = new Color();
  private head = -1;
  private px = 0;
  private py = 0;
  private labels: LabelLayer | null = null;
  private label0 = 0;
  private palette: ScenePalette | null = null;

  constructor(tl: Timeline, quality: "high" | "low") {
    this.tl = tl;
    const M = tl.milestones.length;
    const hi = quality === "high";

    // Trail tubes: core + glow sheath + the dotted path still to come (shared core geometry).
    const coreGeo = new TubeGeometry(curve, hi ? 700 : 320, 0.032, hi ? 8 : 6, false);
    const glowGeo = new TubeGeometry(curve, hi ? 500 : 240, 0.13, hi ? 12 : 8, false);
    const tubeMat = (mode: number) =>
      new ShaderMaterial({
        vertexShader: TUBE_VERT,
        fragmentShader: TUBE_FRAG,
        uniforms: {
          uHead: { value: 0 },
          uTime: { value: 0 },
          uOpacity: { value: 1 },
          uLight: { value: 0 },
          uMode: { value: mode },
          uColor: { value: new Color() },
          uHot: { value: new Color() },
        },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
    this.tubeMats = [tubeMat(0), tubeMat(1), tubeMat(2)];
    this.core = new Mesh(coreGeo, this.tubeMats[0]);
    this.glow = new Mesh(glowGeo, this.tubeMats[1]);
    this.future = new Mesh(coreGeo, this.tubeMats[2]);
    this.core.renderOrder = 3;
    this.glow.renderOrder = 2;
    this.future.renderOrder = 2;

    // Milestones: rings the trail threads through, oriented along the path tangent.
    this.anchors = tl.milestones.map((m) => pointAt(m.f, new Vector3()));
    // Ring normal = between the path tangent (a gate the trail threads) and the view
    // direction (so the ring opens toward the viewer instead of being seen edge-on).
    const view = new Vector3(0, 0, 1).applyQuaternion(
      new Quaternion().setFromEuler(this.frameGroup.rotation.set(TILT_X, -TURN_Y, 0, "YXZ")).invert(),
    );
    this.quats = tl.milestones.map((m) =>
      new Quaternion().setFromUnitVectors(Z, curve.getTangentAt(m.f, tan).normalize().addScaledVector(view, 1.4).normalize()),
    );
    const ringMesh = (tube: number) => {
      const g = new TorusGeometry(RING_R, tube, hi ? 12 : 8, hi ? 96 : 64);
      const color = new InstancedBufferAttribute(new Float32Array(Math.max(1, M) * 3), 3);
      const alpha = new InstancedBufferAttribute(new Float32Array(Math.max(1, M)), 1);
      color.setUsage(DynamicDrawUsage);
      alpha.setUsage(DynamicDrawUsage);
      g.setAttribute("aColor", color);
      g.setAttribute("aAlpha", alpha);
      const mat = new ShaderMaterial({
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        uniforms: { uOpacity: { value: 1 }, uLight: { value: 0 } },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new InstancedMesh(g, mat, Math.max(1, M));
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      return { mesh, mat, color, alpha };
    };
    const r = ringMesh(0.026);
    const w = ringMesh(0.012);
    this.rings = r.mesh;
    this.ringMat = r.mat;
    this.ringColor = r.color;
    this.ringAlpha = r.alpha;
    this.waves = w.mesh;
    this.waveMat = w.mat;
    this.waveColor = w.color;
    this.waveAlpha = w.alpha;
    this.reached = tl.milestones.map(() => false);
    this.waveStart = new Float32Array(Math.max(1, M)).fill(-1e9);

    // Floor grid that follows the head, and dashed drop lines from each milestone to it.
    this.floorMat = new ShaderMaterial({
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      uniforms: { uOff: { value: { x: 0, y: 0 } }, uColor: { value: new Color() }, uOpacity: { value: 1 }, uLight: { value: 0 } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.floor = new Mesh(new PlaneGeometry(44, 44), this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.renderOrder = 0;
    this.floor.frustumCulled = false;

    const dpos = new Float32Array(Math.max(1, M) * 6);
    const dt = new Float32Array(Math.max(1, M) * 2);
    this.anchors.forEach((a, i) => {
      dpos.set([a.x, a.y - RING_R, a.z, a.x, FLOOR_Y, a.z], i * 6);
      dt[i * 2 + 1] = 1;
    });
    const dg = new BufferGeometry();
    dg.setAttribute("position", new BufferAttribute(dpos, 3));
    dg.setAttribute("aT", new BufferAttribute(dt, 1));
    this.dropAlpha = new BufferAttribute(new Float32Array(Math.max(1, M) * 2), 1);
    this.dropAlpha.setUsage(DynamicDrawUsage);
    dg.setAttribute("aAlpha", this.dropAlpha);
    this.dropMat = new ShaderMaterial({
      vertexShader: DROP_VERT,
      fragmentShader: DROP_FRAG,
      uniforms: { uColor: { value: new Color() }, uOpacity: { value: 1 }, uLight: { value: 0 } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.drops = new LineSegments(dg, this.dropMat);
    this.drops.frustumCulled = false;
    this.drops.renderOrder = 1;

    // Sprites: milestone cores, their floor marks, the "now" cap, the head, its comet
    // tail and one tick per quarter-year.
    this.sBase = M;
    this.sNow = 2 * M;
    this.sHead = this.sNow + 1;
    this.sTail = this.sHead + 1;
    this.sTick = this.sTail + TAIL_N;
    this.sprites = new Sprites(this.sTick + tl.ticks.length, { core: 0.22, halo: 0.9, renderOrder: 5 });
    const sp = this.sprites;
    this.anchors.forEach((a, i) => {
      sp.set(this.sNode + i, a.x, a.y, a.z);
      sp.size[this.sNode + i] = 0.62;
      sp.set(this.sBase + i, a.x, FLOOR_Y, a.z);
      sp.size[this.sBase + i] = 0.5;
    });
    pointAt(tl.now, p0);
    sp.set(this.sNow, p0.x, p0.y, p0.z);
    sp.size[this.sNow] = 0.55;
    tl.ticks.forEach((f, k) => {
      pointAt(f, p0);
      sp.set(this.sTick + k, p0.x, p0.y, p0.z);
      sp.size[this.sTick + k] = 0.2;
    });
    sp.flush(5);

    // Ambient dust around the path (static; parallax comes from the moving group).
    this.dust = new Sprites(DUST_N, { core: 0.18, halo: 0.6, renderOrder: 0 });
    for (let i = 0; i < DUST_N; i++) {
      const f = hash01(`d${i}`, 1);
      pointAt(f, p0);
      const ang = hash01(`d${i}`, 2) * Math.PI * 2;
      const rad = 0.8 + hash01(`d${i}`, 3) * 3.2;
      this.dust.set(i, p0.x + Math.cos(ang) * rad * 0.6, p0.y + Math.sin(ang) * rad * 0.7, p0.z + Math.sin(ang * 1.7) * rad);
      this.dust.size[i] = 0.05 + hash01(`d${i}`, 4) * 0.07;
      this.dust.alpha[i] = 0.18 + hash01(`d${i}`, 5) * 0.3;
    }
    this.dust.flush();

    this.fadeMats = [this.ringMat, this.waveMat, this.floorMat, this.dropMat, sp.material, this.dust.material];
    this.frameGroup.rotation.set(TILT_X, -TURN_Y, 0, "YXZ");
    this.frameGroup.add(this.floor, this.drops, this.dust.mesh, this.glow, this.future, this.core, this.rings, this.waves, sp.mesh);
    this.root.visible = false;
  }

  setPalette(p: ScenePalette) {
    this.palette = p;
    const light = isLightBg(p.bg);
    this.colTrail = paletteColor(p.accent);
    this.colPast = paletteColor(p.accent, p.fg, light ? 0.1 : 0.25);
    this.colNow = paletteColor(p.ok);
    this.colTodo = paletteColor(p.muted, p.bg, light ? 0.2 : 0.35);
    this.colTick = paletteColor(p.fg, p.bg, light ? 0.35 : 0.2);
    const hot = light ? paletteColor(p.accent, p.fg, 0.25) : paletteColor(p.accent, "#ffffff", 0.55);
    for (const m of this.tubeMats) {
      (m.uniforms.uColor.value as Color).copy(this.colTrail);
      (m.uniforms.uHot.value as Color).copy(hot);
    }
    (this.tubeMats[2].uniforms.uColor.value as Color).copy(paletteColor(p.fg, p.bg, light ? 0.45 : 0.4));
    (this.floorMat.uniforms.uColor.value as Color).copy(paletteColor(light ? p.muted : p.fg, p.bg, light ? 0.3 : 0.55));
    (this.dropMat.uniforms.uColor.value as Color).copy(paletteColor(p.fg, p.bg, 0.4));
    const dustCol = paletteColor(p.ai, p.fg, 0.3);
    for (let i = 0; i < DUST_N; i++) this.dust.setColor(i, dustCol);
    this.dust.flush(2);
    for (const m of [...this.tubeMats, this.ringMat, this.waveMat, this.floorMat, this.dropMat, this.sprites.material, this.dust.material]) {
      m.uniforms.uLight.value = light ? 1 : 0;
      setGlowBlending(m, light);
    }
    this.head = -1; // recolour on the next frame
    this.styleLabels();
  }

  attachLabels(layer: LabelLayer | null) {
    this.labels = layer;
    if (!layer) return;
    this.label0 = -1;
    this.tl.milestones.forEach((m) => {
      const a = layer.add(`${m.company} · ${m.years}`, "font-size:11px;line-height:14px;letter-spacing:0.02em;", "font-mono", { x: -0.5, y: -1, dy: -15 });
      layer.add(m.role, "font-size:10px;line-height:13px;letter-spacing:0.02em;", "font-mono", { x: -0.5, y: -1 });
      if (this.label0 < 0) this.label0 = a;
    });
    this.styleLabels();
  }

  private styleLabels() {
    const layer = this.labels;
    const p = this.palette;
    if (!layer || !p) return;
    const shadow = `0 0 3px ${p.bg}, 0 0 8px ${p.bg}, 0 0 14px ${p.bg}`;
    this.tl.milestones.forEach((m, i) => {
      layer.style(this.label0 + i * 2, { color: m.current ? p.ok : p.fg, textShadow: shadow, fontWeight: m.current ? "600" : "400" });
      layer.style(this.label0 + i * 2 + 1, { color: p.muted, textShadow: shadow });
    });
  }

  frame(
    time: number,
    dt: number,
    camera: Camera,
    size: { width: number; height: number },
    progress: number,
    weight: number,
    pointer: { x: number; y: number },
  ): boolean {
    if (weight <= 0.001) {
      if (this.root.visible) this.labels?.hideAll();
      this.root.visible = false;
      return false;
    }
    this.root.visible = true;
    const d = Math.min(dt, 0.1);
    const e = smooth01(weight);
    const s = (0.92 + 0.08 * e) * fitScale(camera, size, 4.2, 2.4, 1.15);
    this.root.scale.setScalar(s);

    // Trail head: eased toward the scroll position (first frame snaps).
    const target = headOf(progress);
    const first = this.head < 0;
    this.head = first ? target : this.head + (target - this.head) * (1 - Math.exp(-d * 4.5));
    const h = this.head;

    // Keep the head centred: the group moves, so the path appears to fly past the camera.
    const k = 1 - Math.exp(-d * 3);
    this.px += (pointer.x - this.px) * k;
    this.py += (pointer.y - this.py) * k;
    this.frameGroup.rotation.set(TILT_X - this.py * 0.05, -TURN_Y + this.px * 0.08, 0, "YXZ");
    pointAt(h, p1);
    this.frameGroup.quaternion.setFromEuler(this.frameGroup.rotation);
    p0.copy(p1).applyQuaternion(this.frameGroup.quaternion);
    this.frameGroup.position.copy(ANCHOR).sub(p0);

    // Floor follows the head (its grid is in path space, so lines stay put).
    this.floor.position.set(p1.x, FLOOR_Y, p1.z);
    const off = this.floorMat.uniforms.uOff.value as { x: number; y: number };
    off.x = p1.x;
    off.y = p1.z;

    for (const m of this.tubeMats) {
      m.uniforms.uHead.value = h;
      m.uniforms.uTime.value = time;
      m.uniforms.uOpacity.value = e;
    }
    for (let i = 0; i < this.fadeMats.length; i++) this.fadeMats[i].uniforms.uOpacity.value = e;

    // Milestones: reached → lit (current role pulses in the status colour), else dim.
    const M = this.tl.milestones.length;
    const sp = this.sprites;
    const rc = this.ringColor.array as Float32Array;
    const ra = this.ringAlpha.array as Float32Array;
    const wc = this.waveColor.array as Float32Array;
    const wa = this.waveAlpha.array as Float32Array;
    const da = this.dropAlpha.array as Float32Array;
    for (let i = 0; i < M; i++) {
      const m = this.tl.milestones[i];
      const reached = h >= m.f - 0.004;
      if (reached && !this.reached[i] && !first) this.waveStart[i] = time;
      this.reached[i] = reached;
      const col = !reached ? this.colTodo : m.current ? this.colNow : this.colPast;
      const pulse = reached && m.current ? 0.5 + 0.5 * Math.sin(time * ((Math.PI * 2) / PULSE_EVERY)) : 0;
      // Approach glow: a ring brightens as the head nears it.
      const near = clamp01(1 - Math.abs(h - m.f) / 0.06);
      rc[i * 3] = col.r;
      rc[i * 3 + 1] = col.g;
      rc[i * 3 + 2] = col.b;
      ra[i] = reached ? 0.75 + 0.25 * near + 0.2 * pulse : 0.32 + 0.4 * near;
      const ringScale = 1 + (reached ? 0.06 * pulse : 0) + 0.08 * near;
      sc.setScalar(ringScale);
      m4.compose(this.anchors[i], this.quats[i], sc);
      this.rings.setMatrixAt(i, m4);

      // Shockwave on arrival; the current role repeats it.
      let wt = (time - this.waveStart[i]) / WAVE_S;
      if (reached && m.current && wt > 1) wt = ((time - this.waveStart[i]) % PULSE_EVERY) / WAVE_S;
      const wOn = wt >= 0 && wt <= 1 ? 1 - wt : 0;
      sc.setScalar(1 + 1.4 * smooth01(wt));
      m4.compose(this.anchors[i], this.quats[i], sc);
      this.waves.setMatrixAt(i, m4);
      wc[i * 3] = col.r;
      wc[i * 3 + 1] = col.g;
      wc[i * 3 + 2] = col.b;
      wa[i] = wOn * wOn * 0.9;

      sp.setColor(this.sNode + i, col);
      sp.alpha[this.sNode + i] = reached ? 0.9 + 0.3 * pulse : 0.4;
      sp.size[this.sNode + i] = reached ? 0.62 + 0.12 * pulse : 0.42;
      sp.setColor(this.sBase + i, col);
      sp.alpha[this.sBase + i] = reached ? 0.45 : 0.18;
      da[i * 2] = da[i * 2 + 1] = reached ? 1 : 0.4;
    }
    this.rings.instanceMatrix.needsUpdate = true;
    this.waves.instanceMatrix.needsUpdate = true;
    this.ringColor.needsUpdate = true;
    this.ringAlpha.needsUpdate = true;
    this.waveColor.needsUpdate = true;
    this.waveAlpha.needsUpdate = true;
    this.dropAlpha.needsUpdate = true;

    // "Now" cap at the end of the path, lit once the trail gets there.
    const atNow = h >= this.tl.now - 0.004;
    sp.setColor(this.sNow, atNow ? this.colNow : this.colTodo);
    sp.alpha[this.sNow] = atNow ? 0.8 + 0.2 * Math.sin(time * 2.6) : 0.25;

    // Head + comet tail.
    const headPulse = 1 + 0.08 * Math.sin(time * 5);
    sp.set(this.sHead, p1.x, p1.y, p1.z);
    sp.setColor(this.sHead, this.colTrail);
    sp.size[this.sHead] = 0.95 * headPulse;
    sp.alpha[this.sHead] = h > 0.001 ? 1 : 0.6;
    for (let j = 0; j < TAIL_N; j++) {
      const f = h - (j + 1) * 0.0045;
      const i = this.sTail + j;
      if (f <= 0) {
        sp.alpha[i] = 0;
        continue;
      }
      pointAt(f, p0);
      // a little jitter, so the tail sparkles
      const jit = 0.03 * Math.sin(time * 9 + j * 2.3);
      sp.set(i, p0.x, p0.y + jit, p0.z);
      sp.setColor(i, this.colTrail);
      const fall = 1 - j / TAIL_N;
      sp.size[i] = 0.34 * fall + 0.06;
      sp.alpha[i] = 0.75 * fall * fall;
    }

    // Quarter-year ticks: lit once passed.
    for (let k2 = 0; k2 < this.tl.ticks.length; k2++) {
      const passed = h >= this.tl.ticks[k2];
      sp.setColor(this.sTick + k2, passed ? this.colTrail : this.colTick);
      sp.alpha[this.sTick + k2] = passed ? 0.85 : 0.45;
    }
    sp.flush();

    // Labels: above each ring; upcoming roles are quieter.
    const layer = this.labels;
    if (layer?.begin(weight)) {
      this.root.updateMatrixWorld(true);
      for (let i = 0; i < M; i++) {
        const a = this.anchors[i];
        const o = e * (this.reached[i] ? 1 : 0.5);
        layer.place(this.label0 + i * 2, a.x, a.y + RING_R + 0.12, a.z, this.frameGroup.matrixWorld, camera, size.width, size.height, o);
        layer.place(this.label0 + i * 2 + 1, a.x, a.y + RING_R + 0.12, a.z, this.frameGroup.matrixWorld, camera, size.width, size.height, o * 0.9);
      }
    }
    return true;
  }

  dispose() {
    this.core.geometry.dispose();
    this.glow.geometry.dispose();
    for (const m of this.tubeMats) m.dispose();
    this.rings.geometry.dispose();
    this.waves.geometry.dispose();
    this.rings.dispose();
    this.waves.dispose();
    this.ringMat.dispose();
    this.waveMat.dispose();
    this.floor.geometry.dispose();
    this.floorMat.dispose();
    this.drops.geometry.dispose();
    this.dropMat.dispose();
    this.sprites.dispose();
    this.dust.dispose();
  }
}
