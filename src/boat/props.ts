import * as THREE from "three";

// Water seen from above or from inside it. Shared by the seafloor, reef life, fish and the sea surface
// so every object fades into the same water.

/** Shared uniforms: 1 when the camera is underwater, the water color at eye level and straight
 *  down, and the visibility (m). */
export const WATER = {
  uRqUnder: { value: 0 },
  uRqFog: { value: new THREE.Color("#0a4d5c") },
  uRqDeep: { value: new THREE.Color("#02142c") },
  uRqVis: { value: 24 },
};

/** A look for the water around something to find, so each place has its own (colors at eye level
 *  and straight down, and how far one sees compared with reef water). `null` is plain reef water. */
export type WaterMood = "whale-shark" | "turtles" | "reef-sharks" | "stingrays" | "wreck";
export const MOODS: Record<WaterMood, { fog: THREE.Color; deep: THREE.Color; vis: number }> = {
  // Open blue water off the shelf: cobalt, very clear, falling away to near black.
  "whale-shark": { fog: new THREE.Color(0.02, 0.27, 0.62), deep: new THREE.Color(0.0, 0.02, 0.14), vis: 2.0 },
  // Sunlit shallows over sand and seagrass: bright turquoise.
  turtles: { fog: new THREE.Color(0.05, 0.5, 0.56), deep: new THREE.Color(0.01, 0.2, 0.32), vis: 1.3 },
  // Twenty meters down on the sand: steel blue, dimmer.
  "reef-sharks": { fog: new THREE.Color(0.03, 0.2, 0.4), deep: new THREE.Color(0.0, 0.035, 0.12), vis: 1.25 },
  // A sand channel through the reef, a few meters down: pale aqua over white sand, clear.
  stingrays: { fog: new THREE.Color(0.07, 0.44, 0.52), deep: new THREE.Color(0.02, 0.18, 0.28), vis: 1.45 },
  // Thirty meters down beside a hull: deep blue-green, clear enough to take the ship in.
  wreck: { fog: new THREE.Color(0.02, 0.2, 0.34), deep: new THREE.Color(0.0, 0.03, 0.1), vis: 2.0 },
};

/** The color of open water at a camera depth (deeper = darker, bluer). */
export function waterColorAt(depth: number, out: THREE.Color) {
  const t = Math.min(1, Math.max(0, depth / 30));
  return out.setRGB(0.04 + (0.015 - 0.04) * t, 0.36 + (0.2 - 0.36) * t, 0.44 + (0.36 - 0.44) * t);
}

/** GLSL: tint a lit color by the water between it and the camera. Needs vRqW (world position). */
export const WATER_GLSL = /* glsl */ `
  uniform float uRqUnder;
  uniform vec3 uRqFog;
  uniform vec3 uRqDeep;
  uniform float uRqVis;
  // Open water seen from under the surface, by direction: lit haze at eye level, falling into
  // the dark below and brightening toward the surface above. Everything fades into this, and the
  // backdrop (underwaterFx WaterDome) is this, so distant things melt into the water around them.
  vec3 rqWaterDir(vec3 d) {
    float down = clamp(-d.y, 0.0, 1.0), up = clamp(d.y, 0.0, 1.0);
    vec3 c = mix(uRqFog, uRqDeep, 1.0 - pow(1.0 - down, 2.6));
    return mix(c, uRqFog * 1.25 + vec3(0.015, 0.06, 0.07), up * 0.75);
  }
  vec3 rqWaterTint(vec3 c, vec3 w) {
    float depth = max(-w.y, 0.0);
    if (uRqUnder > 0.5) {
      // Red light is absorbed first with depth, then everything fades into the water with distance.
      c *= mix(vec3(1.0), vec3(0.62, 0.88, 0.97), 1.0 - exp(-depth / 14.0));
      vec3 to = w - cameraPosition;
      float dist = length(to);
      // Visibility falls off gently near the camera (colors stay true), then quickly into the blue.
      return mix(c, rqWaterDir(to / max(dist, 0.001)), 1.0 - exp(-pow(dist / uRqVis, 1.6)));
    }
    // From above: light travels through the water along the line of sight (longer at low angles).
    // Caribbean water is very clear: ~16 m e-folding along the path.
    float path = depth / max(normalize(cameraPosition - w).y, 0.08);
    vec3 water = mix(vec3(0.10, 0.72, 0.74), vec3(0.02, 0.30, 0.48), smoothstep(3.0, 36.0, path));
    return mix(c, water, 1.0 - exp(-path / 16.0));
  }`;

/** Tint a standard material by the water column (same light loss as the seafloor shader). */
export function underwater<T extends THREE.Material>(m: T): T {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    Object.assign(sh.uniforms, WATER);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRqW;")
      .replace("#include <project_vertex>", "#include <project_vertex>\n  vRqW = (inverse(viewMatrix) * mvPosition).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vRqW;\n${WATER_GLSL}`)
      .replace("#include <dithering_fragment>", "#include <dithering_fragment>\n  gl_FragColor.rgb = rqWaterTint(gl_FragColor.rgb, vRqW);");
  };
  return m;
}
