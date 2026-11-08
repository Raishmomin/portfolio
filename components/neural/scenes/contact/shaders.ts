// GLSL for the contact globe (scenes/contact/rig.ts). No textures besides the 1° land mask.

/**
 * The planet: an even dot grid over the land mask (dots computed per pixel, so they stay
 * crisp at any size), lit by the real sun (day/night terminator), with the city's beacon
 * rings, the landing shockwave and the reveal wave drawn on the surface itself.
 */
export const GLOBE_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
void main() {
  vObj = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

export const GLOBE_FRAG = /* glsl */ `
#define PI 3.14159265
#define TAU 6.2831853
uniform sampler2D uLand;
uniform float uRows;
uniform float uDotR;
uniform float uPxAng;
uniform vec3 uSun;
uniform vec3 uPin;
uniform float uTime;
uniform float uReveal;
uniform float uShock;
uniform float uHot;
uniform float uOpacity;
uniform float uLight;
uniform vec3 uOceanDay;
uniform vec3 uOceanNight;
uniform vec3 uDotDay;
uniform vec3 uDotNight;
uniform vec3 uRim;
uniform vec3 uOk;
uniform vec3 uAccent;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
void main() {
  vec3 n = normalize(vObj);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float lon = atan(n.x, n.z);
  float stp = PI / uRows;
  float i = floor((lat + PI * 0.5) / stp);
  float latC = -PI * 0.5 + (i + 0.5) * stp;
  float cnt = max(1.0, floor(TAU * cos(latC) / stp));
  float lstp = TAU / cnt;
  float j = floor((lon + PI) / lstp);
  float lonC = -PI + (j + 0.5) * lstp;
  float d = length(vec2(lat - latC, (lon - lonC) * cos(lat)));
  float land = texture2D(uLand, vec2((lonC + PI) / TAU, (PI * 0.5 - latC) / PI)).r;
  vec3 V = normalize(vV);
  vec3 N = normalize(vN);
  float facing = clamp(dot(N, V), 0.0, 1.0);
  float aa = uPxAng / max(facing, 0.25);
  float sunD = dot(n, uSun);
  float day = smoothstep(-0.1, 0.16, sunD);
  float dusk = exp(-sunD * sunD * 180.0);
  float c = dot(n, uPin);
  float near = sqrt(max(2.0 - 2.0 * c, 0.0));
  float home = 1.0 - smoothstep(0.035, 0.15, near);
  float shown = 1.0;
  float front = 0.0;
  if (uReveal < 3.4) {
    float ang = acos(clamp(c, -1.0, 1.0));
    shown = 1.0 - smoothstep(uReveal - 0.18, uReveal, ang);
    float q = (ang - uReveal) * 9.0;
    front = exp(-q * q) * step(0.0, uReveal) * (1.0 - step(3.3, uReveal));
  }
  float r = stp * uDotR * (1.0 + 0.35 * home + 0.6 * front);
  float dotA = (1.0 - smoothstep(r - aa, r + aa, d)) * land * shown;
  float rings = 0.0;
  if (c > 0.966) {
    for (int k = 0; k < 3; k++) {
      float f = fract(uTime * 0.42 + float(k) / 3.0);
      float rr = 0.012 + f * 0.2;
      float e = (near - rr) * 75.0;
      rings += exp(-e * e) * (1.0 - f) * (1.0 - f);
    }
  }
  float shock = 0.0;
  if (uShock >= 0.0 && c > 0.66) {
    float rr = 0.02 + uShock * 0.75;
    float e = (near - rr) * 40.0;
    shock = exp(-e * e) * (1.0 - uShock) * (1.0 - uShock);
  }
  float fr = 1.0 - facing;
  float rim = fr * fr * sqrt(fr);
  vec3 ocean = mix(uOceanNight, uOceanDay, day);
  vec3 dotC = mix(uDotNight, uDotDay, day);
  dotC = mix(dotC, uOk, home * 0.85);
  dotC = mix(dotC, uAccent, front * 0.8 + uHot * home * 0.4);
  vec3 col;
  float a;
  if (uLight > 0.5) {
    col = ocean;
    col = mix(col, uAccent, dusk * 0.06);
    col = mix(col, uRim, rim * 0.5);
    col = mix(col, dotC, dotA);
    col = mix(col, uOk, clamp(rings * 0.8, 0.0, 1.0));
    col = mix(col, uAccent, clamp(shock, 0.0, 1.0));
    a = 1.0;
  } else {
    col = ocean + uAccent * dusk * 0.045 + uRim * rim * 0.55;
    col = mix(col, dotC, dotA);
    col += uOk * rings * 0.9 + uAccent * shock * 0.95;
    a = 0.96;
  }
  gl_FragColor = vec4(col, a * uOpacity);
  #include <colorspace_fragment>
}
`;

/** Atmosphere: a camera-facing glow ring hugging the limb (behind the planet), in globe radii. */
export const ATMO_VERT = /* glsl */ `
uniform float uSize;
varying vec2 vP;
void main() {
  vP = position.xy * uSize;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize * length(modelViewMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
}
`;
export const ATMO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uWarm;
uniform float uOpacity;
uniform float uLight;
uniform vec2 uSunXY;
varying vec2 vP;
void main() {
  float r = length(vP);
  float out1 = max(r - 1.0, 0.0);
  float limb = smoothstep(0.88, 1.0, r) * exp(-out1 * 10.0);
  float haze = exp(-out1 * 3.2) * smoothstep(0.8, 1.0, r) * 0.1;
  float lit = 0.6 + 0.4 * clamp(dot(normalize(vP + 1e-4), uSunXY), -1.0, 1.0);
  vec3 c = mix(uColor, uWarm, 0.18 * max(dot(normalize(vP + 1e-4), uSunXY), 0.0));
  float a = (limb * 0.52 + haze) * lit * (1.0 - smoothstep(1.25, 1.55, r)) * uOpacity;
  if (uLight > 0.5) {
    gl_FragColor = vec4(c, a * 0.55);
  } else {
    gl_FragColor = vec4(c * a, a);
  }
  #include <colorspace_fragment>
}
`;

/**
 * Orbits and links (one LineSegments): each channel's orbit, with a light trail that
 * follows its satellite; a hot channel's orbit brightens and its link to the city flows.
 */
export const LINES_VERT = /* glsl */ `
attribute float aK;
attribute float aT;
attribute float aLink;
uniform float uPhase[4];
uniform float uHot[4];
uniform float uTime;
varying float vA;
varying float vHot;
void main() {
  int k = int(aK + 0.5);
  float hot = uHot[k];
  float behind = fract(uPhase[k] - aT);
  float trail = exp(-behind * 7.0);
  float orbit = (0.13 + 0.22 * trail + 0.4 * hot * (0.4 + 0.6 * trail)) * (1.0 - aLink);
  float flow = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(aT * 26.0 - uTime * 7.0), 3.0);
  float link = aLink * hot * flow * smoothstep(0.0, 0.08, aT) * 0.95;
  vA = orbit + link;
  vHot = max(hot, aLink);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
export const LINES_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHotColor;
uniform float uOpacity;
uniform float uLight;
varying float vA;
varying float vHot;
void main() {
  vec3 c = mix(uColor, uHotColor, vHot);
  float a = vA * uOpacity;
  if (uLight > 0.5) gl_FragColor = vec4(c, min(1.0, a * 1.6));
  else gl_FragColor = vec4(c * a, a);
  #include <colorspace_fragment>
}
`;

/**
 * Message routes: camera-facing ribbons from where a message leaves the page to the
 * city. Per route (uR[p] = head, tail length, alpha, kind): the part behind the head
 * glows, fading over the tail; "guide" routes (kind 3) are a flowing dashed line.
 */
export const ROUTE_VERT = /* glsl */ `
attribute vec3 aTan;
attribute float aSide;
attribute float aT;
attribute float aP;
uniform vec4 uR[12];
uniform float uWidth;
varying float vT;
varying float vSide;
varying vec4 vR;
void main() {
  vR = uR[int(aP + 0.5)];
  vT = aT;
  vSide = aSide;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 tv = mat3(modelViewMatrix) * aTan;
  vec3 side = cross(tv, mv.xyz);
  float l = length(side);
  side = l > 1e-6 ? side / l : vec3(0.0, 1.0, 0.0);
  float w = vR.w > 2.5 ? 0.45 : (vR.w > 1.5 ? 1.0 : 0.7);
  mv.xyz += side * aSide * uWidth * w * (vR.z > 0.0 ? 1.0 : 0.0);
  gl_Position = projectionMatrix * mv;
}
`;
export const ROUTE_FRAG = /* glsl */ `
uniform vec3 uSpark;
uniform vec3 uSend;
uniform vec3 uHotCore;
uniform float uTime;
uniform float uOpacity;
uniform float uLight;
varying float vT;
varying float vSide;
varying vec4 vR;
void main() {
  if (vR.z <= 0.001) discard;
  float head = vR.x;
  float behind = head - vT;
  if (behind < 0.0) discard;
  float across = exp(-vSide * vSide * 3.2);
  float core = exp(-vSide * vSide * 26.0);
  float a;
  vec3 c;
  if (vR.w > 2.5) {
    float dash = smoothstep(0.35, 0.55, fract(vT * 22.0 - uTime * 1.6));
    a = (core * 0.8 + across * 0.2) * dash * 0.55;
    c = uSpark;
  } else {
    float fall = clamp(1.0 - behind / max(vR.y, 1e-3), 0.0, 1.0);
    a = (across * 0.55 + core * 0.9) * fall * fall;
    c = vR.w > 0.5 ? uSend : uSpark;
    c = mix(c, uHotCore, core * fall * (uLight > 0.5 ? 0.0 : 0.6));
  }
  a *= vR.z * uOpacity;
  if (uLight > 0.5) gl_FragColor = vec4(c, a);
  else gl_FragColor = vec4(c * a, a);
  #include <colorspace_fragment>
}
`;
