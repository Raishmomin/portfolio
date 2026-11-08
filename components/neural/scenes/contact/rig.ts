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
  Mesh,
  NearestFilter,
  Quaternion,
  RedFormat,
  RingGeometry,
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
import { occluders } from "../../occluders";
import { CITY_GEO, clockAt, geoDir, subsolar, zoneName } from "./geo";
import { GlobeLabels } from "./labels";
import { LAND_H, LAND_W, decodeLand } from "./land";
import { ATMO_FRAG, ATMO_VERT, GLOBE_FRAG, GLOBE_VERT, LINES_FRAG, LINES_VERT, ROUTE_FRAG, ROUTE_VERT } from "./shaders";

/** A DOM signal (components/pages/contact/signal.ts): what happened and where (client px). */
export type ContactSignal = { kind: "focus" | "blur" | "type" | "copy" | "send" | "sent" | "error" | "go"; x?: number; y?: number; el?: Element };

const HEADER_PX = 64;
const SPAN_X = 1.62; // half-width of globe + orbits + labels, in globe radii
const SPAN_X_NARROW = 1.3; // a narrow column (small laptops): the outer orbits may run past it
const SPAN_Y = 1.38;
const MAX_R = 300; // px
const COMPACT_R = 160; // px: the smaller globe beside a call-to-action panel
const COL_GAP = 24; // px kept free between the globe's column and the content column
const SIDE_GAP = 40; // px kept free between a compact globe's room and the content
const DUST_HI = 70;
const DUST_LO = 32;
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
const pxRect: Rect = { l: 0, t: 0, r: 0, b: 0 };
const clear: Rect = { l: 0, t: 0, r: 0, b: 0 };
const sun = { lat: 0, lon: 0 };
const EDGE = 12; // px kept free at the viewport edges for labels

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
  private nDust = DUST_HI;
  private hi = true;
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
  private readonly satY = new Float32Array(MAX_SATS);
  private readonly satZ = new Float32Array(MAX_SATS);
  /** Per satellite label: eased visibility (a label that would overlap a nearer one fades). */
  private readonly tagVis = new Float32Array(MAX_SATS).fill(1);
  private readonly packets: Packet[];
  private readonly queue: ContactSignal[] = [];

  private colSat = new Color();
  private colHot = new Color();
  private colOk = new Color();
  private colSpark = new Color();
  private colSend = new Color();
  private colDust = new Color();
  private light = false;
  private beaconK = 1;
  private satK = 1;

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
  private gDirty = false;
  // The driving section and its content, re-read only after a scroll, a resize or a
  // layout change (no per-frame layout reads while the visitor types).
  private secEl: Element | null = null;
  private secTop = 0;
  private secBottom = 0;
  private secDirty = true;
  /** The content column ([data-contact-col]): left / right edges, vertical middle (px; colR 0 = none). */
  private colL = 0;
  private colR = 0;
  private colY = 0;
  /** No column (a row of cards under a heading): the heading text's right edge, the cards' top. */
  private headR = 0;
  private headB = 0;
  private readonly range = document.createRange();
  /** 1: the globe sits right of the content (the city turns left, toward it); -1: left of it. */
  private side = -1;
  /** Beside a call-to-action / card row: clear of content by construction, drawn over the stage's dimmer. */
  private over = false;
  /** Horizontal room for labels (px). */
  private labL = 0;
  private labR = 0;
  private goAt = -1e9;
  /** While a sent message is in flight and landing, the globe keeps its size. */
  private holdUntil = -1;
  private ro: ResizeObserver | null = null;
  private attached = false;
  private readonly onScroll = () => {
    this.secDirty = true;
    this.gDirty = true;
  };
  private lastSpark = -1;
  private shockAt = -1e9;
  private sparkAt = -1e9;
  private deliveredAt = -1e9;
  private sunAt = -1e9;
  private clockMin = -1;
  private focusK = -1;

  // labels (in the canvas): 0 = city + clock, 1 = "Delivered", 2.. = channels
  private readonly tags: GlobeLabels;
  private readonly satSide = new Int8Array(MAX_SATS);
  private colFg = new Color();
  private colMuted = new Color();
  private readonly colTag = new Color();

  constructor(data: NeuralData) {
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
    this.earth = new Mesh(new SphereGeometry(1, 96, 64), this.earthMat);
    this.earth.rotation.order = "XYZ";
    this.earth.renderOrder = 2;
    this.earth.frustumCulled = false;

    // Atmosphere: a billboard glow ring around the limb, drawn first.
    this.atmoMat = new ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: {
        uSize: { value: 1 },
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
    // An annulus, not a quad: the planet covers the inside and the glow is gone by 1.55
    // radii, so no fragment is shaded where nothing shows (fill rate at 1920 px wide).
    this.atmo = new Mesh(new RingGeometry(0.84, 1.56, 72, 1), this.atmoMat);
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
    this.sprites = new Sprites(this.sDust + DUST_HI, { core: 0.2, halo: 0.85, renderOrder: 5 });
    this.sprites.material.depthTest = false;
    this.dustSeed = new Float32Array(DUST_HI * 4);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < DUST_HI; i++) {
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

    this.tags = new GlobeLabels([this.city, "Delivered", ...this.channels]);
    this.satSide.fill(1);

    this.globe.add(this.atmo, this.earth, this.lines);
    this.root.add(this.globe, this.routes, this.sprites.mesh, this.tags.mesh);
    this.root.visible = false;
  }

  /** DOM hooks (an effect, so StrictMode's mount → cleanup → mount leaves them attached). */
  attach() {
    if (this.attached) return;
    this.attached = true;
    this.ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(this.onScroll);
    this.ro?.observe(document.body); // content above the section growing moves it without a scroll
    if (this.secEl) this.ro?.observe(this.secEl);
    window.addEventListener("scroll", this.onScroll, { passive: true });
    window.addEventListener("resize", this.onScroll, { passive: true });
    occluders.retain(); // the visibility guard (framing.clearRect) reads the occluder registry
    this.secDirty = this.gDirty = true;
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    occluders.release();
    this.ro?.disconnect();
    this.ro = null;
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.onScroll);
  }

  /** Over (true) or under the stage's dimmer, which quiets scenes where a composition puts content. */
  private setOver(on: boolean) {
    if (on === this.over) return;
    this.over = on;
    const k = on ? 1e6 : 0;
    this.atmo.renderOrder = 1 + k;
    this.earth.renderOrder = 2 + k;
    this.lines.renderOrder = 3 + k;
    this.routes.renderOrder = 4 + k;
    this.sprites.mesh.renderOrder = 5 + k;
    this.tags.mesh.renderOrder = 6 + k;
  }

  /**
   * Render quality, applied in place: a drop to "low" mid-visit never rebuilds the rig, so
   * the arrival never replays and a hovered channel or a packet in flight carries on.
   */
  setQuality(quality: "high" | "low") {
    const hi = quality === "high";
    if (hi === this.hi) return;
    this.hi = hi;
    const old = this.earth.geometry;
    this.earth.geometry = new SphereGeometry(1, hi ? 96 : 64, hi ? 64 : 40);
    old.dispose();
    this.nDust = hi ? DUST_HI : DUST_LO;
    for (let i = this.nDust; i < DUST_HI; i++) this.sprites.alpha[this.sDust + i] = 0;
  }

  setPalette(p: ScenePalette) {
    const light = isLightBg(p.bg);
    this.light = light;
    const u = this.earthMat.uniforms;
    if (light) {
      // A cool slate-blue sea (ink dots on the day side, blue dots on the night side), not lilac.
      (u.uOceanDay.value as Color).copy(paletteColor(p.bg, p.ai, 0.14)).lerp(paletteColor(p.fg), 0.1);
      (u.uOceanNight.value as Color).copy(paletteColor(p.bg, p.ai, 0.3)).lerp(paletteColor(p.fg), 0.32);
      (u.uDotDay.value as Color).copy(paletteColor(p.fg, p.ai, 0.12));
      (u.uDotNight.value as Color).copy(paletteColor(p.bg, p.ai, 0.22));
      (u.uRim.value as Color).copy(paletteColor(p.ai, p.fg, 0.2));
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
    (a.uColor.value as Color).copy(paletteColor(p.ai, p.fg, light ? 0.3 : 0.15));
    (a.uWarm.value as Color).copy(paletteColor(p.accent));
    a.uLight.value = light ? 1 : 0;
    setGlowBlending(this.atmoMat, light);

    const l = this.linesMat.uniforms;
    (l.uColor.value as Color).copy(light ? paletteColor(p.fg, p.ai, 0.3) : paletteColor(p.ai, p.fg, 0.35));
    (l.uHotColor.value as Color).copy(paletteColor(p.accent));
    l.uLight.value = light ? 1 : 0;
    setGlowBlending(this.linesMat, light);

    const r = this.routeMat.uniforms;
    (r.uSpark.value as Color).copy(light ? paletteColor(p.ai) : paletteColor(p.ai, p.fg, 0.2));
    (r.uSend.value as Color).copy(paletteColor(p.accent));
    (r.uHotCore.value as Color).copy(paletteColor(p.accent, "#ffffff", 0.6));
    r.uLight.value = light ? 1 : 0;
    setGlowBlending(this.routeMat, light);

    this.colSat = light ? paletteColor(p.fg, p.ai, 0.3) : paletteColor(p.fg, p.ai, 0.25);
    this.colHot = paletteColor(p.accent);
    this.colOk = paletteColor(p.ok);
    this.colSpark = light ? paletteColor(p.ai) : paletteColor(p.ai, p.fg, 0.2);
    this.colSend = paletteColor(p.accent);
    this.colDust = light ? paletteColor(p.muted, p.bg, 0.2) : paletteColor(p.ai, p.fg, 0.3);
    this.sprites.material.uniforms.uLight.value = light ? 1 : 0;
    setGlowBlending(this.sprites.material, light);
    this.colFg = paletteColor(p.fg);
    this.colMuted = paletteColor(p.muted, p.fg, light ? 0.35 : 0.15);
    this.beaconK = light ? 1.5 : 1;
    this.satK = light ? 1.3 : 1;
    // Label plates: opaque paper-white with a hairline in light, near-opaque page colour in dark.
    const tu = this.tags.material.uniforms;
    (tu.uHalo.value as Color).copy(light ? paletteColor(p.bg, "#ffffff", 0.75) : paletteColor(p.bg, p.fg, 0.04));
    (tu.uBorder.value as Color).copy(light ? paletteColor(p.fg, p.bg, 0.78) : paletteColor(p.fg, p.bg, 0.8));
    tu.uPlate.value = light ? 0.94 : 0.86;
    tu.uBorderA.value = light ? 0.9 : 0.55;
  }

  /** Queue a DOM signal; handled on the next frame. */
  signal(s: ContactSignal) {
    if (this.queue.length < 32) this.queue.push(s);
  }

  /** The channel the DOM focuses ("contact:<channel>"), or none. */
  setFocus(focus: string | null) {
    const id = focus?.startsWith("contact:") ? focus.slice(8) : "";
    this.focusK = id ? this.channels.findIndex((c) => c.toLowerCase() === id) : -1;
    // A call-to-action's main button ("contact:go") sends a packet to the city.
    if (id === "go") this.signal({ kind: "go" });
  }

  /** The section's rect and the room its content leaves (after a scroll / resize only). */
  private measure(sec: Element) {
    const sr = sec.getBoundingClientRect();
    this.secTop = sr.top;
    this.secBottom = sr.bottom;
    this.colR = this.headR = 0;
    const col = sec.querySelector("[data-contact-col]");
    if (col) {
      const r = col.getBoundingClientRect();
      this.colL = r.left;
      this.colR = r.right;
      this.colY = (r.top + r.bottom) / 2;
      return;
    }
    const h = sec.querySelector("h2");
    const cards = sec.querySelector("[data-card-group]");
    if (h && cards) {
      this.range.selectNodeContents(h); // the heading's text, not its full-width block
      this.headR = this.range.getBoundingClientRect().right;
      this.headB = cards.getBoundingClientRect().top;
    }
  }

  /** Lay out the globe in the room its section leaves (px). False when there is no room. */
  private layout(W: number, H: number, time: number): boolean {
    const frame = sceneFrames.contact;
    const fr = frame.rect;
    const phone = framing.phone;
    if (frame.el !== this.secEl) {
      if (this.secEl) this.ro?.unobserve(this.secEl);
      this.secEl = frame.el;
      if (this.secEl) this.ro?.observe(this.secEl);
      this.secDirty = true;
    }
    const sec = this.secEl;
    if (sec && this.secDirty) {
      this.secDirty = false;
      this.measure(sec);
    }
    let compact = false;
    let side = -1;
    this.labL = EDGE;
    this.labR = W - EDGE;
    if (phone || !sec || frame.layout === "right") {
      // The composition's free rect (phones: the section's opening), never under the
      // content column: on a narrow desktop (1024 px) the column starts left of the free
      // rect, so the globe takes the room beside it instead of giving up.
      pxRect.l = fr.l * W;
      pxRect.r = fr.r * W;
      pxRect.t = Math.max(fr.t * H, phone ? 56 : HEADER_PX + 8);
      pxRect.b = Math.min(fr.b * H, H - 8);
      if (!phone && this.colR > 0) {
        pxRect.r = Math.min(pxRect.r, this.colL - COL_GAP);
        this.labR = this.colL - EDGE;
      }
    } else {
      // Compact: beside a call-to-action panel (band / full sections), on its wider side;
      // with no panel, beside the heading above a row of cards.
      compact = true;
      pxRect.t = HEADER_PX + 8;
      pxRect.b = H - 8;
      if (this.colR > 0) {
        const lw = this.colL - SIDE_GAP - EDGE;
        const rw = W - EDGE - this.colR - SIDE_GAP;
        side = rw >= lw ? 1 : -1;
        pxRect.l = side > 0 ? this.colR + SIDE_GAP : EDGE;
        pxRect.r = side > 0 ? W - EDGE : this.colL - SIDE_GAP;
      } else if (this.headR > 0) {
        side = 1;
        pxRect.l = this.headR + SIDE_GAP;
        pxRect.r = W - EDGE;
        pxRect.b = Math.min(pxRect.b, this.headB - 12);
      } else return false;
      this.labL = pxRect.l;
      this.labR = pxRect.r;
    }
    // The globe stays inside its own section (the footer's band below it is opaque).
    if (sec && !phone) {
      pxRect.t = Math.max(pxRect.t, this.secTop + 8);
      pxRect.b = Math.min(pxRect.b, this.secBottom - 8);
    }
    if (pxRect.r - pxRect.l < 160) return false;
    const minH = phone || compact ? 150 : 220;
    // Beside a heading the room is clear by construction (its block box spans the row).
    const ok = compact && !this.colR ? (pxRect.b - pxRect.t >= minH ? Object.assign(clear, pxRect) : null) : clearRect(pxRect, minH, clear);
    if (!ok) return false;
    this.side = side;
    this.setOver(compact);
    const w = clear.r - clear.l;
    const h = clear.b - clear.t;
    const spanX = w < 2 * SPAN_X * 140 ? SPAN_X_NARROW : SPAN_X;
    let tr = Math.max(40, Math.min(w / (2 * spanX), h / (2 * SPAN_Y), phone ? 140 : compact ? COMPACT_R : MAX_R));
    const tx = (clear.l + clear.r) / 2;
    // Beside a panel: level with its middle, as far as the room allows.
    const ty = compact && this.colR ? Math.min(Math.max(this.colY, clear.t + tr * SPAN_Y), clear.b - tr * SPAN_Y) : (clear.t + clear.b) / 2;
    // A delivery in flight never sees the globe re-fit under it.
    if (this.placed && time < this.holdUntil) tr = this.r;
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
    const dir = this.C.x >= this.b0.x ? 1 : -1; // leaves the page heading for the globe
    this.b1.copy(this.b0).add(v1.set(dir * span * 0.18, R * 0.55 + span * 0.12, R * 0.45));
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

  /**
   * Apply the queued DOM signals. Inactive (`live` false: another section in view, or no
   * room), only their state is kept (a field's focus / blur, a send's outcome); packets
   * are not launched.
   */
  private handle(time: number, live: boolean) {
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
        this.gDirty = true;
      } else if (s.kind === "blur") {
        this.chargeOn = 0;
        this.gEl = null;
      } else if (s.kind === "type") {
        this.chargeOn = 1;
        this.gEl = s.el ?? this.gEl;
        if (live && has && time - this.lastSpark > 0.11) {
          this.lastSpark = time;
          this.spawn(SPARK, s.x!, s.y!, time);
        }
      } else if (s.kind === "copy") {
        if (!live) continue;
        if (has) this.spawn(COPY, s.x!, s.y!, time);
        const k = this.channels.findIndex((c) => c.toLowerCase() === "email");
        if (k >= 0) this.flash[k] = 1;
      } else if (s.kind === "go") {
        // From the call-to-action panel's edge facing the globe, level with its button.
        const el = this.secEl?.querySelector('[data-focus-id="contact:go"]');
        if (!live || !el || time - this.goAt < 1.2) continue;
        this.goAt = time;
        const r = el.getBoundingClientRect();
        const pr = (el.closest(".panel") ?? el).getBoundingClientRect();
        this.spawn(COPY, this.cx > (pr.left + pr.right) / 2 ? pr.right : pr.left, r.top + r.height / 2, time);
      } else if (s.kind === "send") {
        this.boost = live ? 1 : 0;
        this.holdUntil = time + 10; // until the reply (sent → the landing; error → now)
      } else if (s.kind === "sent") {
        if (live && has) this.spawn(SEND, s.x!, s.y!, time);
        this.boost = 0;
        this.chargeOn = 0;
        this.holdUntil = time + DUR[SEND] + 1.8;
      } else if (s.kind === "error") {
        this.boost = 0;
        this.holdUntil = -1;
      }
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
      this.root.visible = false;
      this.handle(time, false);
      return false;
    }
    const d = Math.min(dt, 0.1);
    this.dt = d;
    this.cam = camera;
    this.W = size.width;
    this.H = size.height;
    camera.updateMatrixWorld();

    const ok = this.layout(this.W, this.H, time);
    this.room = damp(this.room, ok ? 1 : 0, 6, d);
    if (!this.placed || (!ok && this.room < 0.01)) {
      this.root.visible = false;
      this.handle(time, false);
      return true;
    }
    this.root.visible = true;
    const e = smooth01(weight) * smooth01(this.room);
    this.handle(time, true);

    // Arrival: the globe fades in as it spins round and its land lights up in a wave from
    // the city (nothing shows before, so a half-blended section never sees an empty ball).
    if (this.arrived < 0 && weight > 0.15 && this.room > 0.5) this.arrived = time;
    const since = this.arrived < 0 ? -1 : time - this.arrived;
    const appear = since < 0 ? 0 : smooth01(since / 0.7);
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
    const yawT = -lon - YAW_FRONT * this.side + 0.09 * Math.sin(time * 0.21) + pointer.x * 0.22 * par;
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
    u.uOpacity.value = e * appear;
    this.atmoMat.uniforms.uOpacity.value = e * appear * smooth01(since / 1.5);
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
    if (this.gEl && this.gDirty) {
      this.gDirty = false;
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
          // A copied email or a sent message lands with a shockwave; a keystroke just blinks the pin.
          if (kind === SPARK) this.sparkAt = time;
          else this.shockAt = time;
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
    const blinkT = (time - this.sparkAt) / 0.35;
    const blink = blinkT >= 0 && blinkT <= 1 ? 1 - blinkT : 0;
    const beacon = (time % BEACON_EVERY) / BEACON_EVERY;
    sp.set(this.sPin, pinW.x, pinW.y, pinW.z);
    sp.setColor(this.sPin, this.colOk);
    sp.size[this.sPin] = (15 + 6 * landF + 5 * blink) * px * this.beaconK;
    sp.alpha[this.sPin] = pinVis * show;
    sp.set(this.sHalo, pinW.x, pinW.y, pinW.z);
    sp.setColor(this.sHalo, this.colOk);
    sp.size[this.sHalo] = (44 + 26 * (1 - beacon)) * px * this.beaconK;
    sp.alpha[this.sHalo] = pinVis * show * Math.min(1, (0.22 + 0.5 * (1 - beacon) * (1 - beacon)) * (this.light ? 1.6 : 1));
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
      sp.size[sat] = (17 + 17 * h) * px * this.satK * (1 + 0.06 * Math.sin(time * 2.3 + k * 1.7));
      sp.alpha[sat] = vis * (0.85 + 0.15 * h) * show;
      this.toScreen(v0);
      this.satX[k] = v3.x;
      this.satY[k] = v3.y;
      this.satZ[k] = v3.z;
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

    // Labels (in the canvas, behind the content): the city and its local time, "Delivered"
    // after a sent message lands, each channel beside its satellite. Active scene only
    // (weight 0.6 → 0.78), never on phones, never past the viewport edges.
    const tags = this.tags;
    const g = framing.phone ? 0 : smooth01((weight - 0.6) / 0.18);
    const lo = g * e * show;
    // A small globe (a call-to-action's, one leaving the viewport) keeps only the city's label.
    const loCity = lo * smooth01((rPx - 60) / 30);
    const loSat = lo * smooth01((rPx - 105) / 35);
    const minute = Math.floor(now / 60_000);
    if (minute !== this.clockMin) {
      this.clockMin = minute; // the clock label is rebuilt once a minute, not every frame
      tags.setText(0, `${this.city} · ${clockAt(now, this.offsetMin)} ${zoneName(this.offsetMin)}`);
    }
    // The city's label sits left of the pin, or right of it where the room ends.
    this.toScreen(pinW);
    const px0 = v3.x;
    const py0 = v3.y;
    const cityW = Math.max(tags.w[0], tags.w[1]);
    const cityL = px0 - 12 - cityW >= this.labL || px0 + 12 + cityW > this.labR;
    const cOff = (i: number) => (cityL ? -12 - tags.w[i] : 12);
    if (this.hasPin && loCity > 0) tags.set(0, pinW.x, pinW.y, pinW.z, cOff(0), 8, this.colFg, loCity * pinVis);
    else tags.hide(0);
    const sinceDone = time - this.deliveredAt;
    const done = sinceDone >= 0 && sinceDone < 3.2 ? smooth01(sinceDone / 0.3) * (1 - smooth01((sinceDone - 2.6) / 0.6)) : 0;
    if (done > 0 && loCity > 0) tags.set(1, pinW.x, pinW.y, pinW.z, cOff(1), -4 - tags.h[1], this.colOk, loCity * done * pinVis);
    else tags.hide(1);
    // Beside each satellite, on the side away from the planet, flipped where the room
    // (the viewport, the content column) ends.
    for (let k = 0; k < this.nSat; k++) {
      const x = this.satX[k];
      const w = tags.w[2 + k];
      let side = x > this.cx + this.r * 0.15 ? 1 : x < this.cx - this.r * 0.15 ? -1 : this.satSide[k];
      if (side < 0 && x - 16 - w < this.labL) side = 1;
      else if (side > 0 && x + 16 + w > this.labR) side = -1;
      this.satSide[k] = side;
    }
    // Collisions (screen space, four boxes + the city's): a label that would overlap a
    // nearer one, or the city's, fades out until they part. A lit channel always shows.
    const cityOn = this.hasPin && loCity > 0 && pinVis > 0.3;
    const cl = cityL ? px0 - 12 - tags.w[0] : px0 + 12;
    const cr = cl + tags.w[0];
    const cb = py0 - 8;
    const ct = cb - tags.h[0];
    for (let k = 0; k < this.nSat; k++) {
      const i = 2 + k;
      const ak = this.satSide[k] > 0 ? this.satX[k] + 16 : this.satX[k] - 16 - tags.w[i];
      const at = this.satY[k] - tags.h[i] / 2;
      let hide = this.satVis[k] < 0.2;
      if (!hide && this.hot[k] < 0.5) {
        if (cityOn && ak < cr + 4 && ak + tags.w[i] > cl - 4 && at < cb + 4 && at + tags.h[i] > ct - 4) hide = true;
        for (let m = 0; m < this.nSat && !hide; m++) {
          if (m === k || this.satVis[m] < 0.2) continue;
          const j = 2 + m;
          const bm = this.satSide[m] > 0 ? this.satX[m] + 16 : this.satX[m] - 16 - tags.w[j];
          const bt = this.satY[m] - tags.h[j] / 2;
          const overlap = ak < bm + tags.w[j] + 4 && ak + tags.w[i] > bm - 4 && at < bt + tags.h[j] + 2 && at + tags.h[i] > bt - 2;
          // The farther one yields (ties: the higher index), unless the other is lit.
          if (overlap && (this.hot[m] >= 0.5 || this.satZ[k] > this.satZ[m] || (this.satZ[k] === this.satZ[m] && k > m))) hide = true;
        }
      }
      this.tagVis[k] = damp(this.tagVis[k], hide ? 0 : 1, hide ? 14 : 6, d);
      const a = Math.max(loSat, lo * this.hot[k]) * this.satVis[k] * this.tagVis[k];
      if (a <= 0.002) {
        tags.hide(i);
        continue;
      }
      this.colTag.copy(this.colMuted).lerp(this.colHot, this.hot[k]);
      orbitPoint(k, this.phase[k], v0);
      this.globe.localToWorld(v0);
      const side = this.satSide[k];
      tags.set(i, v0.x, v0.y, v0.z, side > 0 ? 16 : -16 - tags.w[i], -tags.h[i] / 2, this.colTag, a * (0.75 + 0.25 * this.hot[k]));
    }
    tags.material.uniforms.uOpacity.value = 1;
    const cam = camera as PerspectiveCamera;
    tags.flush((2 * Math.tan(((cam.fov ?? 40) * Math.PI) / 360)) / Math.max(1, this.H));
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
    const set = (k: "contactGlobe" | "contactRoutes" | "contactHot", v: string) => {
      if (stage.dataset[k] !== v) stage.dataset[k] = v;
    };
    set("contactGlobe", this.room > 0.5 ? `${this.cx.toFixed(0)},${this.cy.toFixed(0)},${rPx.toFixed(0)}` : "");
    set("contactRoutes", String(live));
    set("contactHot", this.focusK >= 0 ? this.channels[this.focusK] : "");
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
    this.tags.dispose();
    this.detach();
  }
}
