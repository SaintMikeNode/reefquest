import * as THREE from "three";
import { MOBILE } from "../lib/device";
import { WATER, WATER_GLSL } from "./props";

export const SUN = new THREE.Vector3(-0.45, 0.8, -0.35).normalize();
export const SKY_TOP = new THREE.Color("#3f8fc4");
export const SKY_HORIZON = new THREE.Color("#bfe3ef");
export const FOG_DENSITY = 0.00055;

const NOISE = /* glsl */ `
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    // Fewer octaves on phones: half the noise lookups per pixel, a slightly smoother texture.
    for (int i = 0; i < ${MOBILE ? 2 : 4}; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
`;

const FOG = /* glsl */ `
  uniform vec3 uHorizon;
  uniform float uFog;
  vec3 haze(vec3 c, float dist) { return mix(c, uHorizon, 1.0 - exp(-dist * uFog)); }
`;

/** Seafloor and land, natural colors from the Allen Coral Atlas classes, seen through clear water. */
export function seafloorMaterial(habitat: THREE.DataTexture, lite: boolean, coverage: THREE.DataTexture, size: [number, number], covCell: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCoverage: { value: coverage },
      uSonar: { value: 1 },
      uSize: { value: new THREE.Vector2(...size) },
      uCovSize: { value: new THREE.Vector2(coverage.image.width * covCell, coverage.image.height * covCell) },
      uHabitat: { value: habitat },
      uTexSize: { value: new THREE.Vector2(habitat.image.width, habitat.image.height) },
      uTime: { value: 0 },
      uSun: { value: SUN },
      uHorizon: { value: SKY_HORIZON },
      uFog: { value: FOG_DENSITY },
      uMapColors: { value: 0 },
      ...WATER,
    },
    vertexShader: /* glsl */ `
      attribute float aH;
      varying float vH;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vW;
      varying float vDist;
      void main() {
        vH = aH; vUv = uv; vN = normalize(normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uHabitat;
      uniform vec2 uTexSize;
      uniform float uTime;
      uniform vec3 uSun;
      uniform float uMapColors;
      uniform sampler2D uCoverage;
      uniform float uSonar;
      uniform vec2 uSize;
      uniform vec2 uCovSize;
      ${WATER_GLSL}
      varying float vH;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vW;
      varying float vDist;
      ${NOISE}
      ${FOG}
      // Bathymetry ramp for surveyed seafloor: "turbo" (red shallow → blue deep, 0–30 m), the palette
      // research vessels use to display multibeam maps. Polynomial fit by A. Mikhailov (Google, 2019).
      vec3 bathy(float d) {
        float x = clamp(1.0 - d / 30.0, 0.04, 0.96);
        vec4 v4 = vec4(1.0, x, x * x, x * x * x);
        vec2 v2 = v4.zw * v4.z;
        return clamp(vec3(
          dot(v4, vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234)) + dot(v2, vec2(-152.94239396, 59.28637943)),
          dot(v4, vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333)) + dot(v2, vec2(4.27729857, 2.82956604)),
          dot(v4, vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771)) + dot(v2, vec2(-89.90310912, 27.34824973))
        ), 0.0, 1.0);
      }
      float iso(float v, float step, float w) {
        float f = abs(fract(v / step + 0.5) - 0.5) * step;
        return 1.0 - smoothstep(0.0, fwidth(v) * w, f);
      }
      float caustic(vec2 p, float t) {
        float a = sin(p.x * 0.55 + sin(p.y * 0.42 + t * 0.9) * 1.6 + t * 1.1);
        float b = sin(p.y * 0.61 + sin(p.x * 0.37 - t * 0.7) * 1.8 - t * 0.9);
        return pow(max(0.0, 1.0 - abs(a + b) * 0.5), 5.0);
      }
      void main() {
        vec2 p = vW.xz;
        // Underwater, anything this far is pure water color: skip all the work.
        if (uRqUnder > 0.5 && vDist > uRqVis * 3.2) {
          gl_FragColor = vec4(uRqFog, 1.0);
          return;
        }
        // Domain-warp the 5 m class lookup so habitat edges look organic instead of square
        // (only where the 5 m cells are big enough on screen to notice).
        vec2 warp = vDist < 280.0 ? (vec2(fbm(p * 0.08), fbm(p * 0.08 + 17.3)) - 0.5) * 9.0 : vec2(0.0);
        vec2 uv = vUv + warp / (uTexSize * 5.0); // habitat pixels are 5 m
        float cls = floor(texture2D(uHabitat, uv).r * 255.0 + 0.5);
        // Fine detail fades with distance (it would alias into stripes); the class color remains.
        float near = 1.0 - smoothstep(60.0, 260.0, vDist);
        float n = mix(0.5, fbm(p * 0.35), near);
        float n2 = mix(0.5, vnoise(p * 1.7), near);
        vec3 c;
        if (vH > 0.0) {
          // Land: beach band, then vegetation.
          vec3 beach = vec3(0.90, 0.85, 0.68);
          vec3 green = mix(vec3(0.16, 0.33, 0.17), vec3(0.30, 0.45, 0.22), n);
          c = mix(beach, green, smoothstep(0.8, 2.2, vH + n * 0.8));
        } else if (uMapColors > 0.5 && cls > 0.5) {
          c = cls < 11.5 ? vec3(1.0, 1.0, 0.75) : cls < 12.5 ? vec3(0.88, 0.82, 0.37) : cls < 13.5 ? vec3(0.69, 0.61, 0.23)
            : cls < 14.5 ? vec3(0.47, 0.65, 0.24) : cls < 15.5 ? vec3(1.0, 0.38, 0.38) : vec3(0.61, 0.8, 0.31);
        } else if (cls < 0.5) {
          c = mix(vec3(0.78, 0.74, 0.62), vec3(0.70, 0.66, 0.55), n);   // unmapped bottom: sandy mud
        } else if (cls < 11.5) {                                          // sand: ripples
          float r = mix(0.5, sin(dot(p, vec2(0.8, 0.45)) * 1.4 + n * 6.0) * 0.5 + 0.5, near);
          c = mix(vec3(0.93, 0.88, 0.72), vec3(0.83, 0.78, 0.62), r * 0.6 + n2 * 0.2);
        } else if (cls < 12.5) {                                          // rubble: speckles
          c = mix(vec3(0.78, 0.72, 0.58), vec3(0.55, 0.50, 0.40), step(0.55, n2));
        } else if (cls < 13.5) {                                          // rock
          c = mix(vec3(0.50, 0.46, 0.38), vec3(0.36, 0.33, 0.28), n);
        } else if (cls < 14.5) {                                          // seagrass: streaks
          float s = mix(0.5, vnoise(vec2(p.x * 2.5, p.y * 0.4)), near) * 0.6 + n * 0.4;
          c = mix(vec3(0.20, 0.33, 0.16), vec3(0.36, 0.48, 0.22), s);
        } else if (cls < 15.5) {                                          // coral / algae: mottled colonies
          vec3 base = mix(vec3(0.55, 0.42, 0.28), vec3(0.42, 0.40, 0.22), n);
          float spots = smoothstep(0.62, 0.7, vnoise(p * 0.9));
          vec3 tint = mix(vec3(0.62, 0.46, 0.58), vec3(0.75, 0.58, 0.30), vnoise(p * 0.3));
          c = mix(base, tint, spots * 0.8);
        } else {                                                          // microalgal mats
          c = mix(vec3(0.50, 0.50, 0.28), vec3(0.42, 0.44, 0.22), n);
        }
        float lambert = clamp(dot(normalize(vN), uSun), 0.0, 1.0);
        c *= 0.45 + 0.7 * lambert;
        if (vH <= 0.0) {
          float d = -vH;
          ${lite ? "" : "c += vec3(0.7, 1.0, 0.95) * caustic(p, uTime) * (uRqUnder > 0.5 ? 0.6 : 0.35) * exp(-d / 9.0) * (1.0 - smoothstep(80.0, 320.0, vDist));"}
          c = rqWaterTint(c, vW);
          // Surveyed seafloor: the multibeam bathymetry is drawn as data, over the natural view (not while diving).
          if (uSonar > 0.5 && uRqUnder < 0.5) {
            float cov = texture2D(uCoverage, (vW.xz + uSize * 0.5) / uCovSize).r;
            if (cov > 0.01) {
              vec3 b = bathy(d) * (0.55 + 0.6 * lambert);
              b = mix(b, vec3(0.04, 0.10, 0.20), iso(d, 5.0, 1.2) * 0.45);
              c = mix(c, haze(b, vDist), smoothstep(0.0, 0.6, cov) * 0.58);
            }
          }
        } else if (uRqUnder > 0.5) {
          c = mix(c, uRqFog, 1.0 - exp(-vDist / uRqVis));
        }
        gl_FragColor = vec4(uRqUnder > 0.5 ? c : haze(c, vDist), 1.0);
      }
    `,
  });
}

/** Sea surface: ripples, fresnel transparency, sun glint, foam on shallow reef crests and shores. */
export function seaMaterial(depthTex: THREE.Texture | null, size: [number, number]) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      ...WATER,
      uDepth: { value: depthTex },
      uHasDepth: { value: depthTex ? 1 : 0 },
      uSize: { value: new THREE.Vector2(...size) },
      uTime: { value: 0 },
      uSun: { value: SUN },
      uHorizon: { value: SKY_HORIZON },
      uFog: { value: FOG_DENSITY },
      uSky: { value: SKY_TOP },
      uGrid: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      varying float vDist;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uDepth;
      uniform float uHasDepth;
      uniform vec2 uSize;
      uniform float uTime;
      uniform vec3 uSun;
      uniform vec3 uSky;
      uniform float uGrid;
      ${WATER_GLSL}
      varying vec3 vW;
      varying float vDist;
      ${NOISE}
      ${FOG}
      void main() {
        vec2 p = vW.xz;
        // 100 m survey grid on the water, fading with distance.
        vec2 gq = abs(fract(p / 100.0 + 0.5) - 0.5) * 100.0;
        vec2 gw = fwidth(p) * 1.2;
        float grid = uGrid * (1.0 - smoothstep(0.0, 1.0, min(gq.x / gw.x, gq.y / gw.y))) * (1.0 - smoothstep(60.0, 380.0, vDist));
        float t = uTime;
        // Ripple normal from a few travelling waves.
        // Ripple normal from a few travelling waves; each fades out before it is small enough on
        // screen to alias into stripes near the horizon.
        vec2 g = vec2(0.0);
        g += vec2(0.6, 0.8) * cos(dot(p, vec2(0.6, 0.8)) * 0.35 + t * 1.3) * 0.35 * (1.0 - smoothstep(120.0, 420.0, vDist));
        g += vec2(-0.7, 0.5) * cos(dot(p, vec2(-0.7, 0.5)) * 0.6 + t * 1.7) * 0.22 * (1.0 - smoothstep(70.0, 260.0, vDist));
        g += vec2(0.2, -0.9) * cos(dot(p, vec2(0.2, -0.9)) * 1.3 + t * 2.3) * 0.12 * (1.0 - smoothstep(50.0, 220.0, vDist));
        vec3 n = normalize(vec3(-g.x * 0.25, 1.0, -g.y * 0.25));
        vec3 v = normalize(cameraPosition - vW);
        if (uRqUnder > 0.5) {
          // From below: Snell's window (the sky squeezed into a ~97° cone overhead), total internal
          // reflection of the water color outside it, and moving ripple highlights.
          float cosT = clamp(-v.y, 0.0, 1.0);
          float wob = dot(n.xz, vec2(0.7, 0.5)) * 3.0;
          float win = smoothstep(0.6, 0.74, cosT + wob * 0.05);
          vec3 skyc = mix(vec3(0.6, 0.9, 0.96), vec3(1.0, 0.99, 0.94), pow(cosT, 8.0));
          vec3 tir = uRqFog * 0.88 + vec3(0.01, 0.03, 0.03) * wob; // mirror of the darker water below
          vec3 uc = mix(tir, skyc, win);
          uc += vec3(0.9, 1.0, 1.0) * pow(max(0.0, 1.0 - abs(wob)), 10.0) * 0.18 * win;
          uc = mix(uc, uRqFog, 1.0 - exp(-vDist / (uRqVis * 1.7)));
          gl_FragColor = vec4(uc, 1.0);
          return;
        }
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 r = reflect(-v, n);
        float spec = pow(max(dot(r, uSun), 0.0), 180.0) * 2.5;
        vec3 col = mix(vec3(0.05, 0.45, 0.55), uSky, 0.55 + 0.45 * fres);
        float a = mix(0.18, 0.92, fres);
        float depth = 40.0;
        if (uHasDepth > 0.5) {
          vec2 uv = p / uSize + 0.5;
          if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) depth = texture2D(uDepth, uv).r * 255.0 / 8.0;
        }
        // Foam in very shallow water (breaking on reef crests and beaches): broken streaks, not sheets.
        float f = (1.0 - smoothstep(0.15, 0.7, depth)) * step(0.02, depth);
        if (f > 0.0) { // the foam noise is only needed along the shallow fringe
          float streak = fbm(vec2(p.x * 0.9 + t * 0.5, p.y * 0.35 - t * 0.3)) * 0.6 + fbm(p * 1.7 - t * 0.2) * 0.4;
          f *= smoothstep(0.52, 0.72, streak);
        }
        col = mix(col, vec3(0.93, 0.97, 0.98), f * 0.7);
        a = max(a, f * 0.65);
        col += vec3(1.0, 0.95, 0.85) * spec;
        a = min(1.0, a + spec);
        col = mix(col, vec3(1.0), grid * 0.22);
        a = max(a, grid * 0.16);
        // Open ocean beyond the shallows: less see-through.
        a = mix(a, max(a, 0.55), smoothstep(15.0, 40.0, depth));
        gl_FragColor = vec4(haze(col, vDist), a);
      }
    `,
  });
}

/** Sky dome gradient. */
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTop: { value: SKY_TOP }, uHorizon: { value: SKY_HORIZON }, uSun: { value: SUN }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uSun;
      uniform float uTime;
      varying vec3 vDir;
      ${NOISE}
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 c = mix(uHorizon, uTop, pow(h, 0.55));
        // Soft trade-wind cumulus, flattened toward the horizon.
        vec2 cp = vDir.xz / max(vDir.y, 0.06) * 1.4 + vec2(uTime * 0.004, 0.0);
        float cl = smoothstep(0.52, 0.78, fbm(cp * 0.9)) * smoothstep(0.02, 0.22, vDir.y);
        c = mix(c, vec3(0.98, 0.99, 1.0), cl * 0.75);
        c += vec3(1.0, 0.92, 0.75) * pow(max(dot(normalize(vDir), uSun), 0.0), 220.0) * 1.5;
        c += vec3(1.0, 0.9, 0.7) * pow(max(dot(normalize(vDir), uSun), 0.0), 8.0) * 0.15;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
}

/** Deep-water floor under the whole sea: hides the tile edge and gives the open ocean its color. */
export function abyssMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uHorizon: { value: SKY_HORIZON }, uFog: { value: FOG_DENSITY } },
    vertexShader: /* glsl */ `
      varying float vDist;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vDist;
      ${FOG}
      void main() { gl_FragColor = vec4(haze(vec3(0.02, 0.27, 0.44), vDist), 1.0); }
    `,
  });
}
