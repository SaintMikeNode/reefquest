import * as THREE from "three";

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
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
`;

const FOG = /* glsl */ `
  uniform vec3 uHorizon;
  uniform float uFog;
  vec3 haze(vec3 c, float dist) { return mix(c, uHorizon, 1.0 - exp(-dist * uFog)); }
`;

/** Seafloor and land, natural colors from the Allen Coral Atlas classes, seen through clear water. */
export function seafloorMaterial(habitat: THREE.DataTexture, lite: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uHabitat: { value: habitat },
      uTexSize: { value: new THREE.Vector2(habitat.image.width, habitat.image.height) },
      uTime: { value: 0 },
      uSun: { value: SUN },
      uHorizon: { value: SKY_HORIZON },
      uFog: { value: FOG_DENSITY },
      uMapColors: { value: 0 },
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
      varying float vH;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vW;
      varying float vDist;
      ${NOISE}
      ${FOG}
      float caustic(vec2 p, float t) {
        float a = sin(p.x * 0.55 + sin(p.y * 0.42 + t * 0.9) * 1.6 + t * 1.1);
        float b = sin(p.y * 0.61 + sin(p.x * 0.37 - t * 0.7) * 1.8 - t * 0.9);
        return pow(max(0.0, 1.0 - abs(a + b) * 0.5), 5.0);
      }
      void main() {
        vec2 p = vW.xz;
        // Domain-warp the 5 m class lookup so habitat edges look organic instead of square.
        vec2 warp = (vec2(fbm(p * 0.08), fbm(p * 0.08 + 17.3)) - 0.5) * 9.0;
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
          ${lite ? "" : "c += vec3(0.7, 1.0, 0.95) * caustic(p, uTime) * 0.35 * exp(-d / 9.0) * (1.0 - smoothstep(80.0, 320.0, vDist));"}
          // Light lost through the water column: shallow sand goes turquoise, depth goes blue.
          vec3 water = mix(vec3(0.10, 0.72, 0.74), vec3(0.02, 0.30, 0.48), smoothstep(2.0, 30.0, d));
          // Light travels through the water along the line of sight: at low viewing angles the path
          // is much longer than the depth, so distant seafloor fades into the sea color (as in reality).
          float vy = max(normalize(cameraPosition - vW).y, 0.08);
          float path = d / vy;
          c = mix(c, water, 1.0 - exp(-path / 12.0));
        }
        gl_FragColor = vec4(haze(c, vDist), 1.0);
      }
    `,
  });
}

/** Sea surface: ripples, fresnel transparency, sun glint, foam on shallow reef crests and shores. */
export function seaMaterial(depthTex: THREE.Texture | null, size: [number, number]) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uDepth: { value: depthTex },
      uHasDepth: { value: depthTex ? 1 : 0 },
      uSize: { value: new THREE.Vector2(...size) },
      uTime: { value: 0 },
      uSun: { value: SUN },
      uHorizon: { value: SKY_HORIZON },
      uFog: { value: FOG_DENSITY },
      uSky: { value: SKY_TOP },
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
      varying vec3 vW;
      varying float vDist;
      ${NOISE}
      ${FOG}
      void main() {
        vec2 p = vW.xz;
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
        float streak = fbm(vec2(p.x * 0.9 + t * 0.5, p.y * 0.35 - t * 0.3)) * 0.6 + fbm(p * 1.7 - t * 0.2) * 0.4;
        f *= smoothstep(0.52, 0.72, streak);
        col = mix(col, vec3(0.93, 0.97, 0.98), f * 0.7);
        a = max(a, f * 0.65);
        col += vec3(1.0, 0.95, 0.85) * spec;
        a = min(1.0, a + spec);
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
    uniforms: { uTop: { value: SKY_TOP }, uHorizon: { value: SKY_HORIZON }, uSun: { value: SUN } },
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
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 c = mix(uHorizon, uTop, pow(h, 0.55));
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
