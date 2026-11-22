import * as THREE from "three";
import { LITE } from "../lib/device";
import type { MissionType } from "./boatStore";

// A ring on the water around every mission of the zone, so it is clear where to stop and go under
// (Tulio: "something cool and subtle"). In the mission's own color (the same as its tag): a dashed
// edge turning slowly, a soft glow just inside it, a faint ripple running out from the middle now
// and then. Brighter and solid while the boat is inside, dimmer once the mission's photo is taken.
// All the rings of a zone are one instanced draw call over the sea; hidden under the water.

/** The tag colors of styles.css (`.tag.k-*`). */
const COLORS: Record<MissionType, string> = {
  "whale-shark": "#8fc1ff",
  turtles: "#79e2b8",
  "reef-sharks": "#ffa78f",
  stingrays: "#ff9ec4",
  wreck: "#f2c078",
  divers: "#c3b4ff",
};

export interface Ring {
  id: string;
  type: MissionType;
  x: number;
  z: number;
  r: number;
}

/** States, as the shader reads them. */
export const RING_IDLE = 0, RING_INSIDE = 1, RING_DONE = 2;

export function missionRings(rings: Ring[], time: { value: number }) {
  const disc = new THREE.CircleGeometry(1, 96);
  disc.rotateX(-Math.PI / 2);
  const g = new THREE.InstancedBufferGeometry();
  g.index = disc.index;
  g.setAttribute("position", disc.attributes.position);
  const at = new Float32Array(rings.length * 3), col = new Float32Array(rings.length * 3), state = new Float32Array(rings.length);
  const c = new THREE.Color();
  rings.forEach((r, i) => {
    at.set([r.x, r.z, r.r], i * 3);
    c.set(COLORS[r.type]);
    col.set([c.r, c.g, c.b], i * 3);
  });
  g.setAttribute("aRing", new THREE.InstancedBufferAttribute(at, 3));
  g.setAttribute("aColor", new THREE.InstancedBufferAttribute(col, 3));
  g.setAttribute("aState", new THREE.InstancedBufferAttribute(state, 1));
  g.instanceCount = rings.length;
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: time, uWave: { value: LITE ? 0 : 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aRing, aColor;
      attribute float aState;
      varying vec2 vP;
      varying vec3 vColor;
      varying float vState, vR, vDist;
      void main() {
        vP = position.xz;
        vColor = aColor;
        vState = aState;
        vR = aRing.z;
        vec3 w = vec3(aRing.x + position.x * aRing.z, 0.06, aRing.y + position.z * aRing.z);
        vDist = distance(w, cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uWave;
      varying vec2 vP;
      varying vec3 vColor;
      varying float vState, vR, vDist;
      void main() {
        float d = length(vP);
        if (d > 1.0) discard;
        float m = (1.0 - d) * vR; // meters in from the edge
        float px = fwidth(m);
        float inside = step(0.5, vState) * step(vState, 1.5);
        float done = step(1.5, vState);
        // The edge: a line about a meter wide, dashed and turning slowly (solid while inside).
        float line = 1.0 - smoothstep(0.55, 0.55 + max(px, 0.05) * 1.5, abs(m - 0.7));
        float n = max(12.0, floor(vR * 0.9));
        float a = atan(vP.y, vP.x) / 6.2832 + 0.5;
        float f = fract(a * n + uTime * 0.012 * (1.0 + inside * 2.0));
        float dash = smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.55, 0.6, f));
        line *= mix(dash, 1.0, inside);
        // A soft glow just inside the edge, and a very faint wash over the whole area.
        float glow = exp(-m / 7.0) * 0.32 + 0.035;
        // A ripple running out from the middle every few seconds, fading as it grows.
        float k = fract(uTime / 6.0 + vR * 0.013);
        float wave = (1.0 - smoothstep(0.0, 1.6 + px, abs(m - (1.0 - k) * vR))) * (1.0 - k) * 0.35 * uWave * (1.0 - done);
        float alpha = max(line * 0.75, glow + wave);
        alpha *= mix(1.0, 1.55, inside) * mix(1.0, 0.45, done);
        // Fades with distance so far rings don't clutter the horizon.
        alpha *= 1.0 - smoothstep(700.0, 1700.0, vDist);
        gl_FragColor = vec4(mix(vColor, vec3(1.0), line * 0.35 * (1.0 - done)) * alpha, alpha);
      }`,
  });
  // Premultiplied: the color is already scaled by alpha.
  mat.blending = THREE.CustomBlending;
  mat.blendSrc = THREE.OneFactor;
  mat.blendDst = THREE.OneMinusSrcAlphaFactor;
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5; // after the sea surface (4)
  return mesh;
}
