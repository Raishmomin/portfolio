// The contact globe as plain three.js objects driven by `frame()` (no per-frame React work
// or allocation): a dotted Earth (real land, the real day/night terminator for this moment)
// with the profile city lit and a green availability beacon; one satellite per contact
// channel on its own orbit; and message routes, glowing ribbons that carry a packet from
// where a message leaves the page (the contact form, the copy-email button) to the city,
// landing with a shockwave.
// Placement is in screen space, like the experience path: the globe sits in the free rect
// the director measured for the scene (framing.sceneFrames.contact), shrunk by the
// visibility guard (framing.clearRect) so it never sits under content, and is lifted into
// the world through the live camera every frame.
// DOM → scene: data-focus-id="contact:<channel>" lights that channel's satellite and its
// link to the city; "cp:contact" window events (components/pages/contact/signal.ts) from
// the form and the copy button launch packets.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  LineSegments,
  Matrix4,
  Mesh,
  NearestFilter,
  PlaneGeometry,
  Quaternion,
  RedFormat,
  ShaderMaterial,
  SphereGeometry,
  UnsignedByteType,
  Vector3,
  Vector4,
  type Camera,
  type PerspectiveCamera,
} from "three";
import { clearRect, framing, sceneFrames, type Rect } from "../../framing";
import type { NeuralData, ScenePalette } from "../../types";
import { Sprites, clamp01, isLightBg, paletteColor, setGlowBlending, smooth01 } from "../stack/gl";
import type { LabelLayer } from "../stack/labels";
import { CITY_GEO, clockAt, geoDir, subsolar, zoneName } from "./geo";
import { LAND_H, LAND_W, decodeLand } from "./land";
import { ATMO_FRAG, ATMO_VERT, GLOBE_FRAG, GLOBE_VERT, LINES_FRAG, LINES_VERT, ROUTE_FRAG, ROUTE_VERT } from "./shaders";

/** A DOM signal (components/pages/contact/signal.ts): what happened and where (client px). */
export type ContactSignal = { kind: "focus" | "blur" | "type" | "copy" | "send" | "sent" | "error"; x?: number; y?: number; el?: Element };

const HEADER_PX = 64;
const SPAN_X = 1.62; // half-width of globe + orbits + labels, in globe radii
const SPAN_Y = 1.38;
const MAX_R = 300; // px
const ROUTES = 12; // route slots (0 = the guide)
const SEG = 40; // ribbon segments per route
const TRAIL = 10; // sprites behind each packet head
const MAX_SATS = 4;
const ORBIT_SEG = 96;
const LINK_SEG = 24;
const YAW_FRONT = 0.5; // the city faces the viewer, turned toward the page's content (rad)
const PITCH = 0.36; // north tilted toward the viewer (rad)
const SPIN_IN = 2.4; // rad of spin when the globe arrives
const BEACON_EVERY = 2.4; // s

/** Packet kinds (route shader uR.w): 0 keystroke spark, 1 copied email, 2 sent message, 3 guide. */
const SPARK = 0;
const COPY = 1;
const SEND = 2;
const GUIDE = 3;
const DUR = [0.95, 1.25, 1.7];
const TAIL = [0.22, 0.4, 0.62];
const HEAD_PX = [11, 20, 30];

/** Channel orbits: radius (globe radii), inclination, node, speed (rad/s), all distinct. */
const ORBITS = [
  { a: 1.3, inc: 0.42, node: 0.5, speed: 0.16 },
  { a: 1.46, inc: -0.62, node: 2.2, speed: 0.12 },
  { a: 1.38, inc: 1.05, node: -1.0, speed: 0.14 },
  { a: 1.54, inc: -0.2, node: 3.7, speed: 0.1 },
];

// Scratch (module level: no per-frame allocation).
const v0 = new Vector3();
const v1 = new Vector3();
const v2 = new Vector3();
const v3 = new Vector3();
const ray = new Vector3();
const q0 = new Quaternion();
const ID = new Matrix4();
const pxRect: Rect = { l: 0, t: 0, r: 0, b: 0 };
const clear: Rect = { l: 0, t: 0, r: 0, b: 0 };
const sun = { lat: 0, lon: 0 };
const ALIGN_R = { x: 0, y: -0.5, dx: 12 };
const ALIGN_L = { x: -1, y: -0.5, dx: -12 };

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Point on channel k's orbit at angle th (globe-local, radius units). */
function orbitPoint(k: number, th: number, out: Vector3): Vector3 {
  const o = ORBITS[k];
  const x = Math.cos(th) * o.a;
  const z = Math.sin(th) * o.a;
  // tilt about x (inclination), then turn about y (node)
  const y1 = -z * Math.sin(o.inc);
  const z1 = z * Math.cos(o.inc);
  const cn = Math.cos(o.node);
  const sn = Math.sin(o.node);
  return out.set(x * cn + z1 * sn, y1, -x * sn + z1 * cn);
}

/** Cubic Bézier point. */
function bez(a: Vector3, b: Vector3, c: Vector3, d: Vector3, t: number, out: Vector3) {
  const u = 1 - t;
  const k0 = u * u * u;
  const k1 = 3 * u * u * t;
  const k2 = 3 * u * t * t;
  const k3 = t * t * t;
  return out.set(
    a.x * k0 + b.x * k1 + c.x * k2 + d.x * k3,
    a.y * k0 + b.y * k1 + c.y * k2 + d.y * k3,
    a.z * k0 + b.z * k1 + c.z * k2 + d.z * k3,
  );
}

/** Cubic Bézier tangent (unnormalised). */
function bezTan(a: Vector3, b: Vector3, c: Vector3, d: Vector3, t: number, out: Vector3) {
  const u = 1 - t;
  const k0 = -3 * u * u;
  const k1 = 3 * u * u - 6 * u * t;
  const k2 = 6 * u * t - 3 * t * t;
  const k3 = 3 * t * t;
  return out.set(
    a.x * k0 + b.x * k1 + c.x * k2 + d.x * k3,
    a.y * k0 + b.y * k1 + c.y * k2 + d.y * k3,
    a.z * k0 + b.z * k1 + c.z * k2 + d.z * k3,
  );
}

type Packet = { kind: number; t0: number; sx: number; sy: number; land: number; live: boolean };

export class ContactRig {
  /** World-space container (identity): the globe group, routes and sprites. */
  readonly root = new Group();
  private readonly globe = new Group();
  private readonly earth: Mesh;
  private readonly earthMat: ShaderMaterial;
  private readonly atmo: Mesh;
  private readonly atmoMat: ShaderMaterial;
  private readonly lines: LineSegments;
  private readonly linesMat: ShaderMaterial;
  private readonly linkPos: BufferAttribute;
  private readonly routes: Mesh;
  private readonly routeMat: ShaderMaterial;
  private readonly routePos: BufferAttribute;
  private readonly routeTan: BufferAttribute;
  private readonly uR: Vector4[];
  private readonly land: DataTexture;
  private readonly sprites: Sprites;
  private readonly dustSeed: Float32Array;
  private readonly nDust: number;
  // sprite index ranges
  private readonly sPin = 0;
  private readonly sHalo = 1;
  private readonly sCharge = 2;
  private readonly sFlash = 3;
  private readonly sSat = 4;
  private readonly sHead = 4 + MAX_SATS;
  private readonly sTrail = 4 + MAX_SATS + ROUTES;
  private readonly sDust = 4 + MAX_SATS + ROUTES + ROUTES * TRAIL;

  private readonly channels: string[];
  private readonly nSat: number;
  private readonly city: string;
  private readonly offsetMin: number;
  private readonly pinLocal = new Vector3(0, 0, 1);
  private readonly hasPin: boolean;
  private readonly pinW = new Vector3();
  private readonly pinN = new Vector3();
  private readonly b0 = new Vector3();
  private readonly b1 = new Vector3();
  private readonly b2 = new Vector3();
  private readonly b3 = new Vector3();
  private readonly phase = new Float32Array(MAX_SATS);
  private readonly frontPhase = new Float32Array(MAX_SATS);
  private readonly hot = new Float32Array(MAX_SATS);
  private readonly flash = new Float32Array(MAX_SATS);
  private readonly satVis = new Float32Array(MAX_SATS);
  private readonly satX = new Float32Array(MAX_SATS);
  private readonly packets: Packet[];
  private readonly queue: ContactSignal[] = [];

  private colSat = new Color();
  private colHot = new Color();
  private colOk = new Color();
  private colSpark = new Color();
  private colSend = new Color();
  private colDust = new Color();
  private light = false;
  private palette: ScenePalette | null = null;

  // layout (px, eased) and world placement
  private cx = 0;
  private cy = 0;
  private r = 0;
  private placed = false;
  private room = 0;
  private rows = 0;
  private dt = 0.016;
  private readonly C = new Vector3();
  private Rw = 1;
  private per = 0.01;
  private cam: Camera | null = null;
  private W = 1;
  private H = 1;

  // motion state
  private yaw = 0;
  private pitch = PITCH;
  private arrived = -1;
  private charge = 0;
  private chargeOn = 0;
  private boost = 0;
  private gx = 0;
  private gy = 0;
  private gSet = false;
  /** The focused form field: the guide route leaves the page beside it (re-measured live). */
  private gEl: Element | null = null;
  private gAt = 0;
  private lastSpark = -1;
  private shockAt = -1e9;
  private deliveredAt = -1e9;
  private sunAt = -1e9;
  private clockText = "";
  private focusK = -1;

  // labels
  private labels: LabelLayer | null = null;
  private lCity = -1;
  private lDone = -1;
  private lSat = -1;
  private readonly satSide = new Int8Array(MAX_SATS);
  private readonly satLit = new Int8Array(MAX_SATS);

  constructor(data: NeuralData, quality: "high" | "low") {
    const hi = quality === "high";
    const facts = data.facts;
    this.city = facts.city;
    this.offsetMin = facts.utcOffsetMin;
    this.channels = facts.channels.slice(0, MAX_SATS);
    this.nSat = this.channels.length;
    const geo = CITY_GEO[facts.city];
    this.hasPin = !!geo;
    if (geo) geoDir(geo.lat, geo.lon, this.pinLocal);

    // Planet: the land mask as an R8 texture sampled at each dot's centre.
    this.land = new DataTexture(decodeLand(), LAND_W, LAND_H, RedFormat, UnsignedByteType);
    this.land.magFilter = this.land.minFilter = NearestFilter;
    this.land.generateMipmaps = false;
    this.land.needsUpdate = true;
    this.earthMat = new ShaderMaterial({
      vertexShader: GLOBE_VERT,
      fragmentShader: GLOBE_FRAG,
      uniforms: {
        uLand: { value: this.land },
        uRows: { value: 96 },
        uDotR: { value: 0.3 },
        uPxAng: { value: 0.004 },
        uSun: { value: new Vector3(0, 0, 1) },
        uPin: { value: this.pinLocal },
        uTime: { value: 0 },
        uReveal: { value: -1 },
        uShock: { value: -1 },
        uHot: { value: 0 },
        uOpacity: { value: 1 },
        uLight: { value: 0 },
        uOceanDay: { value: new Color() },
        uOceanNight: { value: new Color() },
        uDotDay: { value: new Color() },
        uDotNight: { value: new Color() },
        uRim: { value: new Color() },
        uOk: { value: new Color() },
        uAccent: { value: new Color() },
      },
      transparent: true,
      depthWrite: true,
      toneMapped: false,
    });
    this.earth = new Mesh(new SphereGeometry(1, hi ? 96 : 64, hi ? 64 : 40), this.earthMat);
    this.earth.rotation.order = "XYZ";
    this.earth.renderOrder = 2;
    this.earth.frustumCulled = false;

    // Atmosphere: a billboard glow ring around the limb, drawn first.
    this.atmoMat = new ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: {
        uSize: { value: 3.2 },
        uColor: { value: new Color() },
        uWarm: { value: new Color() },
        uOpacity: { value: 1 },
        uLight: { value: 0 },
        uSunXY: { value: [1, 0] },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    this.atmo = new Mesh(new PlaneGeometry(1, 1), this.atmoMat);
    this.atmo.renderOrder = 1;
    this.atmo.frustumCulled = false;

    // Orbits (static, one per channel) + links to the city (rewritten while a channel is hot).
    const nOrbit = MAX_SATS * ORBIT_SEG * 2;
    const nLink = MAX_SATS * LINK_SEG * 2;
    const pos = new Float32Array((nOrbit + nLink) * 3);
    const aK = new Float32Array(nOrbit + nLink);
    const aT = new Float32Array(nOrbit + nLink);
    const aLink = new Float32Array(nOrbit + nLink);
    let n = 0;
    for (let k = 0; k < MAX_SATS; k++)
      for (let s = 0; s < ORBIT_SEG; s++)
        for (let e = s; e <= s + 1; e++) {
          if (k < this.nSat) orbitPoint(k, (e / ORBIT_SEG) * Math.PI * 2, v0).toArray(pos, n * 3);
          aK[n] = k;
          aT[n] = e / ORBIT_SEG;
          n++;
        }
    for (let k = 0; k < MAX_SATS; k++)
      for (let s = 0; s < LINK_SEG; s++)
        for (let e = s; e <= s + 1; e++) {
          aK[n] = k;
          aT[n] = e / LINK_SEG;
          aLink[n] = 1;
          n++;
        }
    const lg = new BufferGeometry();
    const lp = new BufferAttribute(pos, 3);
    lp.setUsage(DynamicDrawUsage);
    lg.setAttribute("position", lp);
    lg.setAttribute("aK", new BufferAttribute(aK, 1));
    lg.setAttribute("aT", new BufferAttribute(aT, 1));
    lg.setAttribute("aLink", new BufferAttribute(aLink, 1));
    lg.setDrawRange(0, this.nSat * ORBIT_SEG * 2);
    this.linkPos = lp;
    this.linesMat = new ShaderMaterial({
      vertexShader: LINES_VERT,
      fragmentShader: LINES_FRAG,
      uniforms: {
        uPhase: { value: [0, 0, 0, 0] },
        uHot: { value: [0, 0, 0, 0] },
        uTime: { value: 0 },
        uColor: { value: new Color() },
        uHotColor: { value: new Color() },
        uOpacity: { value: 1 },
        uLight: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.lines = new LineSegments(lg, this.linesMat);
    this.lines.renderOrder = 3;
    this.lines.frustumCulled = false;

    // Message routes: one ribbon strip per slot (SEG + 1 points, two sides).
    const pts = ROUTES * (SEG + 1) * 2;
    const rPos = new BufferAttribute(new Float32Array(pts * 3), 3);
    const rTan = new BufferAttribute(new Float32Array(pts * 3), 3);
    rPos.setUsage(DynamicDrawUsage);
    rTan.setUsage(DynamicDrawUsage);
    const side = new Float32Array(pts);
    const rt = new Float32Array(pts);
    const rp = new Float32Array(pts);
    const index: number[] = [];
    for (let p = 0; p < ROUTES; p++)
      for (let i = 0; i <= SEG; i++) {
        const b = (p * (SEG + 1) + i) * 2;
        side[b] = -1;
        side[b + 1] = 1;
        rt[b] = rt[b + 1] = i / SEG;
        rp[b] = rp[b + 1] = p;
        if (i < SEG) index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    const rg = new BufferGeometry();
    rg.setAttribute("position", rPos);
    rg.setAttribute("aTan", rTan);
    rg.setAttribute("aSide", new BufferAttribute(side, 1));
    rg.setAttribute("aT", new BufferAttribute(rt, 1));
    rg.setAttribute("aP", new BufferAttribute(rp, 1));
    rg.setIndex(index);
    this.routePos = rPos;
    this.routeTan = rTan;
    this.uR = Array.from({ length: ROUTES }, () => new Vector4(0, 0, 0, 0));
    this.routeMat = new ShaderMaterial({
      vertexShader: ROUTE_VERT,
      fragmentShader: ROUTE_FRAG,
      uniforms: {
        uR: { value: this.uR },
        uWidth: { value: 0.05 },
        uSpark: { value: new Color() },
        uSend: { value: new Color() },
        uHotCore: { value: new Color() },
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uLight: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: DoubleSide, // the strip's winding flips with the route's direction on screen
    });
    this.routes = new Mesh(rg, this.routeMat);
    this.routes.renderOrder = 4;
    this.routes.frustumCulled = false;
    this.packets = Array.from({ length: ROUTES }, () => ({ kind: SPARK, t0: 0, sx: 0, sy: 0, land: -1, live: false }));

    // Sprites: pin, beacon halo, charge, landing flash, satellites, packet heads, trails, dust.
    this.nDust = hi ? 70 : 32;
    this.sprites = new Sprites(this.sDust + this.nDust, { core: 0.2, halo: 0.85, renderOrder: 5 });
    this.sprites.material.depthTest = false;
    this.dustSeed = new Float32Array(this.nDust * 4);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < this.nDust; i++) {
      this.dustSeed[i * 4] = rnd() * Math.PI * 2;
      this.dustSeed[i * 4 + 1] = Math.acos(rnd() * 2 - 1);
      this.dustSeed[i * 4 + 2] = 1.75 + rnd() * 1.6;
      this.dustSeed[i * 4 + 3] = rnd();
    }

    // Satellites start spread out; each knows the point of its orbit that faces the viewer
    // (front-left, away from the page's content), where it comes when its channel is hot.
    for (let k = 0; k < MAX_SATS; k++) {
      this.phase[k] = (k / MAX_SATS) * Math.PI * 2 + 0.6;
      let best = -1e9;
      for (let i = 0; i < 128; i++) {
        const th = (i / 128) * Math.PI * 2;
        orbitPoint(k, th, v0);
        const score = v0.z - 0.55 * v0.x + 0.2 * v0.y;
        if (score > best) {
          best = score;
          this.frontPhase[k] = th;
        }
      }
    }

    this.globe.add(this.atmo, this.earth, this.lines);
    this.root.add(this.globe, this.routes, this.sprites.mesh);
    this.root.visible = false;
  }

  setPalette(p: ScenePalette) {
    this.palette = p;
    const light = isLightBg(p.bg);
    this.light = light;
    const u = this.earthMat.uniforms;
    if (light) {
      (u.uOceanDay.value as Color).copy(paletteColor(p.bg, p.ai, 0.07)).lerp(paletteColor(p.fg), 0.03);
      (u.uOceanNight.value as Color).copy(paletteColor(p.bg, p.ai, 0.16)).lerp(paletteColor(p.fg), 0.1);
      (u.uDotDay.value as Color).copy(paletteColor(p.fg, p.bg, 0.12));
      (u.uDotNight.value as Color).copy(paletteColor(p.ai, p.fg, 0.4));
      (u.uRim.value as Color).copy(paletteColor(p.ai, p.bg, 0.45));
    } else {
      (u.uOceanDay.value as Color).copy(paletteColor(p.bg, p.ai, 0.1));
      (u.uOceanNight.value as Color).copy(paletteColor(p.bg, p.ai, 0.035));
      (u.uDotDay.value as Color).copy(paletteColor(p.fg, p.ai, 0.12));
      (u.uDotNight.value as Color).copy(paletteColor(p.ai, p.bg, 0.5));
      (u.uRim.value as Color).copy(paletteColor(p.ai));
    }
    (u.uOk.value as Color).copy(paletteColor(p.ok));
    (u.uAccent.value as Color).copy(paletteColor(p.accent));
    u.uLight.value = light ? 1 : 0;

    const a = this.atmoMat.uniforms;
    (a.uColor.value as Color).copy(paletteColor(p.ai, p.fg, light ? 0 : 0.15));
    (a.uWarm.value as Color).copy(paletteColor(p.accent));
    a.uLight.value = light ? 1 : 0;
    setGlowBlending(this.atmoMat, light);

    const l = this.linesMat.uniforms;
    (l.uColor.value as Color).copy(light ? paletteColor(p.fg, p.bg, 0.35) : paletteColor(p.ai, p.fg, 0.35));
    (l.uHotColor.value as Color).copy(paletteColor(p.accent));
    l.uLight.value = light ? 1 : 0;
    setGlowBlending(this.linesMat, light);

    const r = this.routeMat.uniforms;
    (r.uSpark.value as Color).copy(light ? paletteColor(p.ai) : paletteColor(p.ai, p.fg, 0.2));
    (r.uSend.value as Color).copy(paletteColor(p.accent));
    (r.uHotCore.value as Color).copy(paletteColor(p.accent, "#ffffff", 0.6));
    r.uLight.value = light ? 1 : 0;
    setGlowBlending(this.routeMat, light);

    this.colSat = light ? paletteColor(p.fg, p.bg, 0.15) : paletteColor(p.fg, p.ai, 0.25);
    this.colHot = paletteColor(p.accent);
    this.colOk = paletteColor(p.ok);
    this.colSpark = light ? paletteColor(p.ai) : paletteColor(p.ai, p.fg, 0.2);
    this.colSend = paletteColor(p.accent);
    this.colDust = light ? paletteColor(p.muted, p.bg, 0.2) : paletteColor(p.ai, p.fg, 0.3);
    this.sprites.material.uniforms.uLight.value = light ? 1 : 0;
    setGlowBlending(this.sprites.material, light);
    this.satLit.fill(-1);
    this.styleLabels();
  }

  attachLabels(layer: LabelLayer | null) {
    this.labels = layer;
    if (!layer) return;
    const mono = "letter-spacing:0.08em;text-transform:uppercase;";
    this.lCity = layer.add(this.city, `font-size:11px;line-height:14px;${mono}`, "font-mono", { x: -1, y: -1, dx: -12, dy: -10 });
    this.lDone = layer.add("Delivered", `font-size:10px;line-height:13px;${mono}`, "font-mono", { x: -1, y: 0, dx: -12, dy: -6 });
    this.lSat = -1;
    this.channels.forEach((c, k) => {
      const i = layer.add(c, `font-size:10px;line-height:13px;${mono}`, "font-mono", ALIGN_R);
      if (k === 0) this.lSat = i;
    });
    this.satSide.fill(1);
    this.satLit.fill(-1);
    this.clockText = "";
    this.styleLabels();
  }

  private styleLabels() {
    const layer = this.labels;
    const p = this.palette;
    if (!layer || !p || this.lCity < 0) return;
    const shadow = `0 0 3px ${p.bg}, 0 0 8px ${p.bg}, 0 0 14px ${p.bg}`;
    layer.style(this.lCity, { color: p.fg, textShadow: shadow, fontWeight: "500" });
    layer.style(this.lDone, { color: p.ok, textShadow: shadow, fontWeight: "600" });
    for (let k = 0; k < this.nSat; k++) layer.style(this.lSat + k, { color: p.muted, textShadow: shadow });
  }

  /** Queue a DOM signal; handled on the next frame. */
  signal(s: ContactSignal) {
    if (this.queue.length < 32) this.queue.push(s);
  }

  /** The channel the DOM focuses ("contact:<channel>"), or none. */
  setFocus(focus: string | null) {
    const id = focus?.startsWith("contact:") ? focus.slice(8) : "";
    this.focusK = id ? this.channels.findIndex((c) => c.toLowerCase() === id) : -1;
  }

  /** Lay out the globe in the scene's free rect (px). False when there is no room. */
  private layout(W: number, H: number): boolean {
    const fr = sceneFrames.contact.rect;
    pxRect.l = fr.l * W;
    pxRect.r = fr.r * W;
    pxRect.t = Math.max(fr.t * H, framing.phone ? 56 : HEADER_PX + 8);
    pxRect.b = Math.min(fr.b * H, H - 8);
    const ok = clearRect(pxRect, framing.phone ? 150 : 220, clear);
    if (!ok) return false;
    const w = clear.r - clear.l;
    const h = clear.b - clear.t;
    const tx = (clear.l + clear.r) / 2;
    const ty = (clear.t + clear.b) / 2;
    const tr = Math.max(40, Math.min(w / (2 * SPAN_X), h / (2 * SPAN_Y), framing.phone ? 140 : MAX_R));
    if (!this.placed) {
      this.cx = tx;
      this.cy = ty;
      this.r = tr;
      this.placed = true;
    } else {
      this.cx = damp(this.cx, tx, 5, this.dt);
      this.cy = damp(this.cy, ty, 5, this.dt);
      this.r = damp(this.r, tr, 5, this.dt);
    }
    return true;
  }

  /** Screen px → world point on the plane z = depth (through the live camera). */
  private lift(px: number, py: number, depth: number, out: Vector3) {
    const cam = this.cam as PerspectiveCamera;
    ray.set((px / this.W) * 2 - 1, 1 - (py / this.H) * 2, 0.5).unproject(cam).sub(cam.position);
    const t = (depth - cam.position.z) / (ray.z || -1e-6);
    return out.copy(cam.position).addScaledVector(ray, t);
  }

  /** World point → screen px, written into v3 (x, y). */
  private toScreen(p: Vector3) {
    v3.copy(p).project(this.cam!);
    return v3.set(((v3.x + 1) / 2) * this.W, ((1 - v3.y) / 2) * this.H, v3.z);
  }

  /** How visible a world point is past the planet, seen from the camera (1 = in front / beside). */
  private visible(p: Vector3): number {
    const o = this.cam!.position;
    ray.copy(p).sub(o);
    const L = ray.length();
    ray.divideScalar(L);
    v3.copy(o).sub(this.C);
    const b = v3.dot(ray);
    const c = v3.lengthSq() - this.Rw * this.Rw;
    const disc = b * b - c;
    if (disc <= 0) return 1;
    const t1 = -b - Math.sqrt(disc);
    if (t1 <= 0 || t1 >= L) return 1;
    return clamp01(1 - Math.sqrt(disc) / (this.Rw * 0.18)); // soft at the limb
  }

  /** The city's world position (a hair above the surface) into pinW, its normal into pinN. */
  private pin() {
    this.pinW.copy(this.pinLocal).multiplyScalar(1.012);
    this.earth.localToWorld(this.pinW);
    this.pinN.copy(this.pinW).sub(this.C).normalize();
  }

  /** A route from a launch point (px) to the city: cubic Bézier control points b0..b3. */
  private route(sx: number, sy: number) {
    const R = this.Rw;
    this.lift(sx, sy, R * 0.5, this.b0);
    this.b3.copy(this.pinW);
    const span = this.b0.distanceTo(this.b3);
    this.b1.copy(this.b0).add(v1.set(-span * 0.18, R * 0.55 + span * 0.12, R * 0.45));
    this.b2.copy(this.b3).addScaledVector(this.pinN, R * 0.75 + span * 0.18);
  }

  private spawn(kind: number, sx: number, sy: number, time: number) {
    let slot = -1;
    let oldest = 1e9;
    for (let p = 1; p < ROUTES; p++) {
      const pk = this.packets[p];
      if (!pk.live) {
        slot = p;
        break;
      }
      if (pk.kind === SPARK && pk.t0 < oldest) {
        oldest = pk.t0;
        slot = p;
      }
    }
    if (slot < 0) return;
    const pk = this.packets[slot];
    pk.kind = kind;
    pk.t0 = time;
    pk.sx = sx;
    pk.sy = sy;
    pk.land = -1;
    pk.live = true;
  }

  private handle(time: number) {
    for (const s of this.queue) {
      const has = typeof s.x === "number" && typeof s.y === "number";
      if (has) {
        this.gx = s.x!;
        this.gy = s.y!;
        this.gSet = true;
      }
      if (s.kind === "focus") {
        this.chargeOn = 1;
        this.gEl = s.el ?? null;
      } else if (s.kind === "blur") {
        this.chargeOn = 0;
        this.gEl = null;
      } else if (s.kind === "type") {
        this.chargeOn = 1;
        this.gEl = s.el ?? this.gEl;
        if (has && time - this.lastSpark > 0.11) {
          this.lastSpark = time;
          this.spawn(SPARK, s.x!, s.y!, time);
        }
      } else if (s.kind === "copy") {
        if (has) this.spawn(COPY, s.x!, s.y!, time);
        const k = this.channels.findIndex((c) => c.toLowerCase() === "email");
        if (k >= 0) this.flash[k] = 1;
      } else if (s.kind === "send") this.boost = 1;
      else if (s.kind === "sent") {
        if (has) this.spawn(SEND, s.x!, s.y!, time);
        this.boost = 0;
        this.chargeOn = 0;
      } else if (s.kind === "error") this.boost = 0;
    }
    this.queue.length = 0;
  }

  frame(
    time: number,
    dt: number,
    camera: Camera,
    size: { width: number; height: number },
    dpr: number,
    weight: number,
    pointer: { x: number; y: number },
  ): boolean {
    if (weight <= 0.001) {
      if (this.root.visible) this.labels?.hideAll();
      this.root.visible = false;
      this.queue.length = 0;
      return false;
    }
    const d = Math.min(dt, 0.1);
    this.dt = d;
    this.cam = camera;
    this.W = size.width;
    this.H = size.height;
    camera.updateMatrixWorld();

    const ok = this.layout(this.W, this.H);
    this.room = damp(this.room, ok ? 1 : 0, 6, d);
    if (!this.placed || (!ok && this.room < 0.01)) {
      this.labels?.hideAll();
      this.root.visible = false;
      this.queue.length = 0;
      return true;
    }
    this.root.visible = true;
    const e = smooth01(weight) * smooth01(this.room);
    this.handle(time);

    // Arrival: the globe spins in and its land lights up in a wave from the city.
    if (this.arrived < 0 && weight > 0.35 && this.room > 0.5) this.arrived = time;
    const since = this.arrived < 0 ? -1 : time - this.arrived;
    const show = since < 0 ? 0 : smooth01((since - 0.2) / 0.8);

    // Placement: centre lifted to the z = 0 plane, radius in world units.
    this.lift(this.cx, this.cy, 0, this.C);
    this.lift(this.cx + 100, this.cy, 0, v0);
    this.per = v0.distanceTo(this.C) / 100;
    const grow = 0.86 + 0.14 * smooth01(weight);
    const rPx = this.r * grow;
    this.Rw = rPx * this.per;
    this.globe.position.copy(this.C);
    this.globe.scale.setScalar(this.Rw);
    // The orbits lean toward the pointer; the planet turns a little with it.
    const par = framing.phone ? 0 : 1;
    this.globe.rotation.set(0.1 - pointer.y * 0.08 * par, pointer.x * 0.14 * par, 0);
    const lon = this.hasPin ? Math.atan2(this.pinLocal.x, this.pinLocal.z) : 0;
    const yawT = -lon + YAW_FRONT + 0.09 * Math.sin(time * 0.21) + pointer.x * 0.22 * par;
    this.yaw = since < 0 ? yawT - SPIN_IN : damp(this.yaw, yawT, 1.5, d);
    this.pitch = damp(this.pitch, PITCH - pointer.y * 0.1 * par, 2, d);
    this.earth.rotation.set(this.pitch, this.yaw, 0);
    this.root.updateMatrixWorld(true);

    // Sun: the real subsolar point now (refreshed every 5 s), in the planet's frame.
    const now = Date.now();
    const u = this.earthMat.uniforms;
    if (now - this.sunAt > 5000) {
      this.sunAt = now;
      subsolar(now, sun);
      geoDir(sun.lat, sun.lon, u.uSun.value as Vector3);
    }
    this.earth.getWorldQuaternion(q0);
    v0.copy(u.uSun.value as Vector3).applyQuaternion(q0).transformDirection(camera.matrixWorldInverse);
    const sxy = this.atmoMat.uniforms.uSunXY.value as number[];
    const sl = Math.hypot(v0.x, v0.y) || 1;
    sxy[0] = v0.x / sl;
    sxy[1] = v0.y / sl;

    // Planet uniforms (the dot grid only changes density on a real size change).
    const rows = Math.round(Math.min(140, Math.max(44, (Math.PI * rPx) / 6.6)) / 4) * 4;
    if (!this.rows || Math.abs(rows - this.rows) / this.rows > 0.18) this.rows = rows;
    u.uRows.value = this.rows;
    u.uPxAng.value = 1 / Math.max(20, rPx * dpr);
    u.uTime.value = time;
    u.uReveal.value = since < 0 ? -1 : since * 1.45 - 0.05;
    const shockT = (time - this.shockAt) / 1.4;
    u.uShock.value = shockT >= 0 && shockT <= 1 ? shockT : -1;
    u.uOpacity.value = e;
    this.atmoMat.uniforms.uOpacity.value = e * (since < 0 ? 0.4 : 0.4 + 0.6 * smooth01(since / 1.5));
    this.linesMat.uniforms.uOpacity.value = e * (since < 0 ? 0 : smooth01((since - 0.5) / 1.2));
    this.linesMat.uniforms.uTime.value = time;
    this.routeMat.uniforms.uOpacity.value = e;
    this.routeMat.uniforms.uTime.value = time;
    const sizeK = Math.max(0.7, Math.min(1.25, rPx / 220));
    const px = this.per * sizeK;
    this.routeMat.uniforms.uWidth.value = 2.4 * px;

    const sp = this.sprites;
    this.pin();
    const pinW = this.pinW;
    v0.copy(pinW).addScaledVector(this.pinN, this.Rw * 0.02);
    const pinVis = this.visible(v0);

    // Charge: while the form has focus, a light waits where messages leave the page and a
    // dashed guide route to the city flows; sending flares it.
    this.charge = damp(this.charge, this.chargeOn, this.chargeOn ? 5 : 2.5, d);
    this.boost = damp(this.boost, 0, 0.8, d);
    if (!this.gSet) {
      this.gx = this.cx + this.r * 1.9;
      this.gy = this.cy;
    }
    // The focused field may scroll (keyboard focus scrolls it into view): follow it.
    const nowMs = performance.now();
    if (this.gEl && nowMs - this.gAt > 90) {
      this.gAt = nowMs;
      if (!this.gEl.isConnected) this.gEl = null;
      else {
        const r = this.gEl.getBoundingClientRect();
        const panel = (this.gEl.closest(".panel") ?? this.gEl).getBoundingClientRect();
        this.gx = panel.left;
        this.gy = Math.min(Math.max(r.top + r.height / 2, 0), this.H);
      }
    }
    const pulse = 0.5 + 0.5 * Math.sin(time * 4.2);
    this.lift(this.gx, this.gy, this.Rw * 0.5, v0);
    sp.set(this.sCharge, v0.x, v0.y, v0.z);
    sp.setColor(this.sCharge, this.colSend);
    sp.size[this.sCharge] = (24 + 10 * pulse + 26 * this.boost) * px;
    sp.alpha[this.sCharge] = Math.min(1, this.charge * (0.55 + 0.3 * pulse) + this.boost) * show;

    // Routes: the guide (slot 0) and packets in flight.
    const pos = this.routePos.array as Float32Array;
    const tan = this.routeTan.array as Float32Array;
    let wrote = false;
    for (let p = 0; p < ROUTES; p++) {
      const R = this.uR[p];
      const pk = this.packets[p];
      let head = 0;
      let alpha = 0;
      let kind = GUIDE;
      let sx = this.gx;
      let sy = this.gy;
      if (p === 0) {
        alpha = this.charge * 0.85 * show;
        head = 1;
      } else if (pk.live) {
        kind = pk.kind;
        sx = pk.sx;
        sy = pk.sy;
        const t = (time - pk.t0) / DUR[kind];
        head = easeInOut(Math.min(1, t));
        if (t >= 1 && pk.land < 0) {
          pk.land = time;
          this.shockAt = time;
          if (kind === SEND) this.deliveredAt = time;
        }
        const after = pk.land < 0 ? 0 : (time - pk.land) / (kind === SEND ? 1.6 : 0.6);
        alpha = after >= 1 ? 0 : 1 - smooth01(after);
        if (after >= 1) pk.live = false;
      }
      R.set(head, kind === GUIDE ? 1 : TAIL[kind], alpha, kind);
      const hs = this.sHead + p;
      const flying = p > 0 && alpha > 0.001 && pk.land < 0;
      if (alpha <= 0.001) R.z = 0;
      else {
        wrote = true;
        this.route(sx, sy);
        for (let i = 0; i <= SEG; i++) {
          const t = i / SEG;
          bez(this.b0, this.b1, this.b2, this.b3, t, v0);
          bezTan(this.b0, this.b1, this.b2, this.b3, t, v2);
          const b = (p * (SEG + 1) + i) * 6;
          pos[b] = pos[b + 3] = v0.x;
          pos[b + 1] = pos[b + 4] = v0.y;
          pos[b + 2] = pos[b + 5] = v0.z;
          tan[b] = tan[b + 3] = v2.x;
          tan[b + 1] = tan[b + 4] = v2.y;
          tan[b + 2] = tan[b + 5] = v2.z;
        }
      }
      // Packet head + comet trail.
      if (!flying) {
        sp.alpha[hs] = 0;
        for (let j = 0; j < TRAIL; j++) sp.alpha[this.sTrail + p * TRAIL + j] = 0;
        continue;
      }
      const col = kind === SPARK ? this.colSpark : this.colSend;
      bez(this.b0, this.b1, this.b2, this.b3, head, v0);
      sp.set(hs, v0.x, v0.y, v0.z);
      sp.setColor(hs, col);
      sp.size[hs] = HEAD_PX[kind] * px * (1 + 0.12 * Math.sin(time * 18 + p));
      sp.alpha[hs] = this.visible(v0);
      for (let j = 0; j < TRAIL; j++) {
        const i = this.sTrail + p * TRAIL + j;
        const f = head - (j + 1) * TAIL[kind] * 0.075;
        if (f <= 0) {
          sp.alpha[i] = 0;
          continue;
        }
        bez(this.b0, this.b1, this.b2, this.b3, f, v0);
        const fall = 1 - j / TRAIL;
        sp.set(i, v0.x, v0.y, v0.z);
        sp.setColor(i, col);
        sp.size[i] = HEAD_PX[kind] * (0.25 + 0.55 * fall) * px;
        sp.alpha[i] = 0.65 * fall * fall * this.visible(v0);
      }
    }
    // Upload only while a route shows (the shader discards the rest).
    if (wrote) {
      this.routePos.needsUpdate = true;
      this.routeTan.needsUpdate = true;
    }

    // The city: pin + availability beacon; flashes when a message lands.
    const landT = (time - this.shockAt) / 0.7;
    const landF = landT >= 0 && landT <= 1 ? 1 - landT : 0;
    const beacon = (time % BEACON_EVERY) / BEACON_EVERY;
    sp.set(this.sPin, pinW.x, pinW.y, pinW.z);
    sp.setColor(this.sPin, this.colOk);
    sp.size[this.sPin] = (15 + 6 * landF) * px;
    sp.alpha[this.sPin] = pinVis * show;
    sp.set(this.sHalo, pinW.x, pinW.y, pinW.z);
    sp.setColor(this.sHalo, this.colOk);
    sp.size[this.sHalo] = (44 + 26 * (1 - beacon)) * px;
    sp.alpha[this.sHalo] = pinVis * show * (0.22 + 0.5 * (1 - beacon) * (1 - beacon));
    sp.set(this.sFlash, pinW.x, pinW.y, pinW.z);
    sp.setColor(this.sFlash, this.colSend);
    sp.size[this.sFlash] = (40 + 120 * (1 - landF)) * px;
    sp.alpha[this.sFlash] = pinVis * landF * landF;
    u.uHot.value = Math.max(landF, this.charge * 0.6);

    // Satellites: one per channel; a hot channel's satellite comes round to the front-left,
    // brightens, and its link to the city flows.
    const ph = this.linesMat.uniforms.uPhase.value as number[];
    const hotU = this.linesMat.uniforms.uHot.value as number[];
    let anyHot = false;
    for (let k = 0; k < MAX_SATS; k++) {
      const sat = this.sSat + k;
      if (k >= this.nSat) {
        sp.alpha[sat] = 0;
        hotU[k] = 0;
        continue;
      }
      this.flash[k] = damp(this.flash[k], 0, 0.9, d);
      const want = this.focusK === k || this.flash[k] > 0.05 ? 1 : 0;
      this.hot[k] = damp(this.hot[k], want, want ? 7 : 3, d);
      if (want) {
        let delta = this.frontPhase[k] - this.phase[k];
        delta = Math.atan2(Math.sin(delta), Math.cos(delta)); // the short way round
        this.phase[k] += delta * (1 - Math.exp(-3.2 * d));
      } else this.phase[k] += ORBITS[k].speed * d;
      const th = this.phase[k];
      ph[k] = (((th / (Math.PI * 2)) % 1) + 1) % 1;
      hotU[k] = this.hot[k];
      if (this.hot[k] > 0.01) anyHot = true;
      orbitPoint(k, th, v0);
      this.globe.localToWorld(v0);
      const vis = this.visible(v0);
      this.satVis[k] = vis;
      sp.set(sat, v0.x, v0.y, v0.z);
      sp.setColor(sat, this.colSat);
      const h = this.hot[k];
      if (h > 0.01) {
        sp.color[sat * 3] += (this.colHot.r - sp.color[sat * 3]) * h;
        sp.color[sat * 3 + 1] += (this.colHot.g - sp.color[sat * 3 + 1]) * h;
        sp.color[sat * 3 + 2] += (this.colHot.b - sp.color[sat * 3 + 2]) * h;
      }
      sp.size[sat] = (17 + 17 * h) * px * (1 + 0.06 * Math.sin(time * 2.3 + k * 1.7));
      sp.alpha[sat] = vis * (0.85 + 0.15 * h) * show;
      this.satX[k] = this.toScreen(v0).x;
    }
    // Links (globe-local): satellite → city, bowed outward.
    if (anyHot) {
      const lp = this.linkPos.array as Float32Array;
      v2.copy(this.pinLocal).multiplyScalar(1.012).applyEuler(this.earth.rotation);
      for (let k = 0; k < this.nSat; k++) {
        if (this.hot[k] <= 0.01) continue;
        orbitPoint(k, this.phase[k], v1);
        v3.copy(v1).add(v2).multiplyScalar(0.5);
        v3.setLength(Math.max(v3.length(), 1) * 1.18);
        for (let s = 0; s < LINK_SEG; s++)
          for (let e2 = 0; e2 < 2; e2++) {
            const t = (s + e2) / LINK_SEG;
            const a = (1 - t) * (1 - t);
            const b = 2 * (1 - t) * t;
            const c = t * t;
            const n = (MAX_SATS * ORBIT_SEG * 2 + (k * LINK_SEG + s) * 2 + e2) * 3;
            lp[n] = v1.x * a + v3.x * b + v2.x * c;
            lp[n + 1] = v1.y * a + v3.y * b + v2.y * c;
            lp[n + 2] = v1.z * a + v3.z * b + v2.z * c;
          }
      }
      this.linkPos.needsUpdate = true;
    }
    this.lines.geometry.setDrawRange(0, anyHot ? MAX_SATS * ORBIT_SEG * 2 + this.nSat * LINK_SEG * 2 : this.nSat * ORBIT_SEG * 2);

    // Dust: a slow shell of specks around the planet.
    for (let i = 0; i < this.nDust; i++) {
      const s = this.sDust + i;
      const a = this.dustSeed[i * 4] + time * (0.02 + 0.03 * this.dustSeed[i * 4 + 3]);
      const pol = this.dustSeed[i * 4 + 1];
      const rad = this.dustSeed[i * 4 + 2];
      v0.set(Math.sin(pol) * Math.cos(a) * rad, Math.cos(pol) * rad * 0.7, Math.sin(pol) * Math.sin(a) * rad);
      this.globe.localToWorld(v0);
      sp.set(s, v0.x, v0.y, v0.z);
      sp.setColor(s, this.colDust);
      sp.size[s] = (3 + 4 * this.dustSeed[i * 4 + 3]) * px;
      sp.alpha[s] = (this.light ? 0.35 : 0.45) * (0.4 + 0.6 * this.dustSeed[i * 4 + 3]) * this.visible(v0) * show;
    }
    sp.material.uniforms.uOpacity.value = e;
    sp.flush();

    // Labels: the city and its local time, "Delivered" after a sent message lands, and
    // each channel beside its satellite (all aria-hidden duplicates of the DOM).
    const layer = this.labels;
    if (layer?.begin(weight)) {
      const clock = `${this.city} · ${clockAt(now, this.offsetMin)} ${zoneName(this.offsetMin)}`;
      if (clock !== this.clockText) {
        this.clockText = clock;
        const el = layer.el.children[this.lCity] as HTMLElement | undefined;
        if (el) el.textContent = clock;
        layer.style(this.lCity, {});
      }
      const lo = e * show;
      if (this.hasPin) layer.place(this.lCity, pinW.x, pinW.y, pinW.z, ID, camera, this.W, this.H, lo * pinVis);
      else layer.hide(this.lCity);
      const sinceDone = time - this.deliveredAt;
      const done = sinceDone >= 0 && sinceDone < 3.2 ? smooth01(sinceDone / 0.3) * (1 - smooth01((sinceDone - 2.6) / 0.6)) : 0;
      if (done > 0) layer.place(this.lDone, pinW.x, pinW.y, pinW.z, ID, camera, this.W, this.H, lo * done * pinVis);
      else layer.hide(this.lDone);
      for (let k = 0; k < this.nSat; k++) {
        const x = this.satX[k];
        const side = x > this.cx + this.r * 0.15 ? 1 : x < this.cx - this.r * 0.15 ? -1 : this.satSide[k];
        if (side !== this.satSide[k]) {
          this.satSide[k] = side;
          layer.setAlign(this.lSat + k, side > 0 ? ALIGN_R : ALIGN_L);
        }
        const lit = this.hot[k] > 0.5 ? 1 : 0;
        if (lit !== this.satLit[k] && this.palette) {
          this.satLit[k] = lit;
          layer.style(this.lSat + k, { color: lit ? this.palette.accent : this.palette.muted });
        }
        orbitPoint(k, this.phase[k], v0);
        this.globe.localToWorld(v0);
        layer.place(this.lSat + k, v0.x, v0.y, v0.z, ID, camera, this.W, this.H, lo * this.satVis[k] * (0.7 + 0.3 * this.hot[k]));
      }
    }
    this.expose(rPx);
    return true;
  }

  /** QA hook: the globe's screen circle and the routes in flight (cheap, throttled). */
  private exposedAt = 0;
  private expose(rPx: number) {
    const now = performance.now();
    if (now - this.exposedAt < 150) return;
    this.exposedAt = now;
    const stage = this.root.parent ? document.querySelector<HTMLElement>("[data-neural-stage]") : null;
    if (!stage) return;
    let live = 0;
    for (let p = 1; p < ROUTES; p++) if (this.packets[p].live) live++;
    stage.dataset.contactGlobe = this.room > 0.5 ? `${this.cx.toFixed(0)},${this.cy.toFixed(0)},${rPx.toFixed(0)}` : "";
    stage.dataset.contactRoutes = String(live);
    stage.dataset.contactHot = this.focusK >= 0 ? this.channels[this.focusK] : "";
  }

  dispose() {
    this.earth.geometry.dispose();
    this.earthMat.dispose();
    this.land.dispose();
    this.atmo.geometry.dispose();
    this.atmoMat.dispose();
    this.lines.geometry.dispose();
    this.linesMat.dispose();
    this.routes.geometry.dispose();
    this.routeMat.dispose();
    this.sprites.dispose();
  }
}
