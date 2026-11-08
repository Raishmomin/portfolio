// The contact globe's poster: the same dotted Earth as the 3D scene
// (components/neural/scenes/contact/rig.ts), in its resting pose, as a server-rendered SVG.
// It shows wherever the live globe does not: without JS, with 3D off, before the canvas
// fades in, and after a fallback (app/globals.css, the fm3-contact block, hides it while the
// canvas is live). No time-dependent drawing (the HTML is cached): no terminator, no clock.
// Ahmedabad's green beacon pulses and the channel satellites light when their link is
// pointed at or focused, in CSS (:has), so even the static globe answers the page.
// Server Component, aria-hidden: it carries no content. ~4 KB of markup.
import { PROFILE, SOCIAL_PROFILES } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { CITY_GEO } from "../../neural/scenes/contact/geo";
import { LAND_H, LAND_W, decodeLand } from "../../neural/scenes/contact/land";

// The scene's resting pose (rig.ts): YAW_FRONT, PITCH + the globe group's 0.1 tilt, ORBITS.
const YAW_FRONT = 0.5;
const TILT = 0.36 + 0.1;
const ORBITS = [
  { a: 1.3, inc: 0.42, node: 0.5 },
  { a: 1.46, inc: -0.62, node: 2.2 },
  { a: 1.38, inc: 1.05, node: -1.0 },
  { a: 1.54, inc: -0.2, node: 3.7 },
];
const R = 200; // globe radius, SVG units
const ROWS = 54; // dot rows pole to pole (the scene uses ~90 at this size; the poster stays light)

type V = [number, number, number];
const r0 = (v: number) => Math.round(v);

function geo(lat: number, lon: number): V {
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
}
/** Globe group tilt about x (the orbits live in this frame). */
function tilt([x, y, z]: V, a = 0.1): V {
  return [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
}

function build() {
  const city = CITY_GEO[PROFILE.location.locality];
  const yaw = -(city ? (city.lon * Math.PI) / 180 : 0) + YAW_FRONT;
  /** Planet frame → view: turn about y, then tilt north toward the viewer. */
  const view = ([x, y, z]: V): V => {
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
    const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    return tilt([x1, y, z1], TILT);
  };

  // Land dots, nearest-neighbour ordered relative moves, in three sizes by how squarely they face us.
  const land = decodeLand();
  const buckets: [number, number][][] = [[], [], []];
  const stp = Math.PI / ROWS;
  for (let i = 0; i < ROWS; i++) {
    const lat = -Math.PI / 2 + (i + 0.5) * stp;
    const cnt = Math.max(1, Math.floor((2 * Math.PI * Math.cos(lat)) / stp));
    const row = Math.min(LAND_H - 1, Math.floor(((Math.PI / 2 - lat) / Math.PI) * LAND_H));
    for (let j = 0; j < cnt; j++) {
      const lon = -Math.PI + (j + 0.5) * ((2 * Math.PI) / cnt);
      const col = Math.min(LAND_W - 1, Math.floor(((lon + Math.PI) / (2 * Math.PI)) * LAND_W));
      if (!land[row * LAND_W + col]) continue;
      const [x, y, z] = view(geo(lat, lon));
      if (z < 0.06) continue;
      buckets[z > 0.5 ? 0 : z > 0.22 ? 1 : 2].push([r0(x * R), r0(-y * R)]);
    }
  }
  const dots = buckets.map((pts) => {
    if (!pts.length) return "";
    const left = pts.slice();
    let [cx, cy] = left.pop()!;
    let d = `M${cx} ${cy}h0`;
    while (left.length) {
      let best = 0;
      let bd = Infinity;
      for (let k = 0; k < left.length; k++) {
        const dd = (left[k][0] - cx) ** 2 + (left[k][1] - cy) ** 2;
        if (dd < bd) {
          bd = dd;
          best = k;
        }
      }
      const [nx, ny] = left.splice(best, 1)[0];
      const dy = ny - cy;
      d += `m${nx - cx}${dy < 0 ? dy : ` ${dy}`}h0`;
      cx = nx;
      cy = ny;
    }
    return d;
  });

  // The city.
  const pin = city ? view(geo((city.lat * Math.PI) / 180, (city.lon * Math.PI) / 180)) : null;

  // Orbits: the projection of each circle is an ellipse whose major axis is where the orbit
  // crosses the view plane; the half toward us is drawn over the planet, the far half behind.
  const orbits = ORBITS.map((o, k) => {
    const cn = Math.cos(o.node);
    const sn = Math.sin(o.node);
    const e1 = tilt([cn, 0, -sn]);
    const e2 = tilt([Math.cos(o.inc) * sn, -Math.sin(o.inc), Math.cos(o.inc) * cn]);
    const n: V = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    // u: in the orbit plane and the view plane (z = 0); w: in-plane, perpendicular to u.
    const ul = Math.hypot(n[1], n[0]) || 1;
    const u: V = [n[1] / ul, -n[0] / ul, 0];
    const w: V = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const s = w[2] >= 0 ? 1 : -1;
    const A = o.a * R;
    const S = [u[0] * A, -u[1] * A];
    const E = [-u[0] * A, u[1] * A];
    const M = [w[0] * A * s, -w[1] * A * s];
    const cross = (M[0] - S[0]) * (E[1] - M[1]) - (M[1] - S[1]) * (E[0] - M[0]);
    const sweep = cross > 0 ? 1 : 0;
    const rx = r0(A);
    const ry = Math.max(1, r0(A * Math.abs(n[2])));
    const rot = r0((Math.atan2(-u[1], u[0]) * 180) / Math.PI);
    const p = (q: number[]) => `${r0(q[0])} ${r0(q[1])}`;
    const front = `M${p(S)}A${rx} ${ry} ${rot} 0 ${sweep} ${p(E)}`;
    const back = `M${p(E)}A${rx} ${ry} ${rot} 0 ${sweep} ${p(S)}`;
    // The satellite where the scene starts it (rig.ts: k / 4 turns + 0.6 rad).
    const th = (k / 4) * Math.PI * 2 + 0.6;
    const loc: V = [Math.cos(th) * o.a, 0, Math.sin(th) * o.a];
    const pt = tilt([loc[0] * cn + loc[2] * Math.cos(o.inc) * sn, -loc[2] * Math.sin(o.inc), -loc[0] * sn + loc[2] * Math.cos(o.inc) * cn]);
    const hidden = pt[2] < 0 && Math.hypot(pt[0], pt[1]) < 1.02;
    return { front, back, sat: hidden ? null : { x: r0(pt[0] * R), y: r0(-pt[1] * R), behind: pt[2] < 0 } };
  });

  return { dots, pin: pin && pin[2] > 0 ? { x: r0(pin[0] * R), y: r0(-pin[1] * R) } : null, orbits };
}

const G = build();
const CHANNELS = ["email", ...SOCIAL_PROFILES.map((s) => s.label.toLowerCase())];

/** The static contact globe, framed by the section's CSS (.cg-poster). */
export function StaticGlobe({ className }: { className?: string }) {
  const { dots, pin, orbits } = G;
  return (
    <div aria-hidden="true" className={cn("cg-poster", className)}>
      <svg viewBox="-330 -290 660 580" fill="none" className="cg-svg">
        <defs>
          <radialGradient id="cg-sea" cx="-70" cy="-80" r="290" gradientUnits="userSpaceOnUse">
            <stop offset="0" className="cg-sea-0" />
            <stop offset="1" className="cg-sea-1" />
          </radialGradient>
          <radialGradient id="cg-air" cx="0" cy="0" r={R * 1.3} gradientUnits="userSpaceOnUse">
            <stop offset="0.74" className="cg-air-0" />
            <stop offset="0.78" className="cg-air-1" />
            <stop offset="1" className="cg-air-0" />
          </radialGradient>
          <radialGradient id="cg-beacon" cx="0" cy="0" r="1">
            <stop offset="0" className="cg-ok" stopOpacity=".55" />
            <stop offset="1" className="cg-ok" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle r={R * 1.3} fill="url(#cg-air)" />
        <g className="cg-orbit">
          {orbits.map((o, k) => (
            <path key={k} data-ch={CHANNELS[k]} d={o.back} className="cg-back" />
          ))}
        </g>
        <circle r={R} fill="url(#cg-sea)" className="cg-planet" />
        <path className="cg-dot" strokeWidth="6.6" d={dots[0]} />
        <path className="cg-dot" strokeWidth="5.2" strokeOpacity=".85" d={dots[1]} />
        <path className="cg-dot" strokeWidth="3.6" strokeOpacity=".6" d={dots[2]} />
        <circle r={R} className="cg-rim" />
        {pin ? (
          <g transform={`translate(${pin.x} ${pin.y})`}>
            <circle r="34" fill="url(#cg-beacon)" />
            <circle r="9" className="cg-ring" />
            <circle r="9" className="cg-ring cg-ring-2" />
            <circle r="6.5" className="cg-pin" />
          </g>
        ) : null}
        <g className="cg-orbit">
          {orbits.map((o, k) => (
            <path key={k} data-ch={CHANNELS[k]} d={o.front} />
          ))}
        </g>
        {orbits.map((o, k) =>
          o.sat ? (
            <circle key={k} data-ch={CHANNELS[k]} cx={o.sat.x} cy={o.sat.y} r="6" className={cn("cg-sat", o.sat.behind && "cg-sat-far")} />
          ) : null,
        )}
      </svg>
    </div>
  );
}
