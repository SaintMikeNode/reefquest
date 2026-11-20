import * as THREE from "three";

// Water seen from above or from inside it. Shared by the seafloor, reef life, fish and the sea surface
// so every object fades into the same water.

/** Shared uniforms: 1 when the camera is underwater, the water color there, and the visibility (m). */
export const WATER = {
  uRqUnder: { value: 0 },
  uRqFog: { value: new THREE.Color("#0a4d5c") },
  uRqVis: { value: 24 },
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
  uniform float uRqVis;
  vec3 rqWaterTint(vec3 c, vec3 w) {
    float depth = max(-w.y, 0.0);
    if (uRqUnder > 0.5) {
      // Red light is absorbed first with depth, then everything fades into the water with distance.
      c *= mix(vec3(1.0), vec3(0.62, 0.88, 0.97), 1.0 - exp(-depth / 14.0));
      float dist = length(cameraPosition - w);
      // Visibility falls off gently near the camera (colors stay true), then quickly into the blue.
      return mix(c, uRqFog, 1.0 - exp(-pow(dist / uRqVis, 1.6)));
    }
    // From above: light travels through the water along the line of sight (longer at low angles).
    float path = depth / max(normalize(cameraPosition - w).y, 0.08) * (11.0 / 12.0);
    vec3 water = mix(vec3(0.10, 0.72, 0.74), vec3(0.02, 0.30, 0.48), smoothstep(2.0, 30.0, path));
    return mix(c, water, 1.0 - exp(-path / 11.0));
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
