import * as THREE from "three";

// Allen Coral Atlas palettes (their published colors, slightly brightened for the dark scene).
export const BENTHIC: Record<number, { color: string; es: string; en: string }> = {
  11: { color: "#ffffbe", es: "Arena", en: "Sand" },
  12: { color: "#e0d05e", es: "Escombros", en: "Rubble" },
  13: { color: "#b19c3a", es: "Roca", en: "Rock" },
  14: { color: "#78a63e", es: "Pastos marinos", en: "Seagrass" },
  15: { color: "#ff6161", es: "Coral / algas", en: "Coral / algae" },
  18: { color: "#9bcc4f", es: "Tapete de microalgas", en: "Microalgal mats" },
};
export const GEOMORPHIC: Record<number, { es: string; en: string }> = {
  11: { es: "Laguna somera", en: "Shallow lagoon" },
  12: { es: "Laguna profunda", en: "Deep lagoon" },
  13: { es: "Planicie arrecifal interior", en: "Inner reef flat" },
  14: { es: "Planicie arrecifal exterior", en: "Outer reef flat" },
  15: { es: "Cresta del arrecife", en: "Reef crest" },
  16: { es: "Planicie arrecifal terrestre", en: "Terrestrial reef flat" },
  21: { es: "Talud protegido", en: "Sheltered reef slope" },
  22: { es: "Talud arrecifal", en: "Reef slope" },
  23: { es: "Meseta", en: "Plateau" },
  24: { es: "Talud trasero", en: "Back reef slope" },
  25: { es: "Arrecife de parche", en: "Patch reef" },
};

const benthicLUT = (() => {
  const data = new Uint8Array(32 * 4);
  for (const [k, v] of Object.entries(BENTHIC)) {
    const c = new THREE.Color(v.color);
    data.set([c.r * 255, c.g * 255, c.b * 255, 255], Number(k) * 4);
  }
  const t = new THREE.DataTexture(data, 32, 1, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

/** Fog / background color shared by the island materials; deepens toward a dark wine in severe heat. */
export const SCENE_FOG = new THREE.Color("#020d16");
export const FOG_CALM = new THREE.Color("#020d16");
export const FOG_SEVERE = new THREE.Color("#1d0718");

export type HeatGrid = { lat0: number; lon0: number; cell: number; cols: number; rows: number };

/** GLSL: heat intensity (0 at 0 DHW → 1 at 12+ DHW) of the NOAA 5 km cell under a uv (v = 0 north). */
const HEAT_GLSL = /* glsl */ `
  uniform sampler2D uHeat;
  uniform float uShowHeat;
  uniform vec3 uLon;
  uniform vec3 uLat;
  uniform vec4 uGrid;
  uniform vec2 uGridSize;
  vec4 heatCell(vec2 uv, out vec2 cr) {
    float lon = dot(uLon, vec3(uv, 1.0));
    float lat = dot(uLat, vec3(uv, 1.0));
    cr = vec2((lon - uGrid.y) / uGrid.z + 0.5, (uGrid.x - lat) / uGrid.z + 0.5);
    return texture2D(uHeat, vec2(cr.x / uGridSize.x, cr.y / uGridSize.y));
  }
`;

const heatUniforms = (heatTex: THREE.Texture, geo: number[][], grid: HeatGrid) => ({
  uHeat: { value: heatTex },
  uShowHeat: { value: 1 },
  uLon: { value: new THREE.Vector3(...geo[0]) },
  uLat: { value: new THREE.Vector3(...geo[1]) },
  uGrid: { value: new THREE.Vector4(grid.lat0, grid.lon0, grid.cell, 0) },
  uGridSize: { value: new THREE.Vector2(grid.cols, grid.rows) },
});

const FOG = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  vec3 applyFog(vec3 c, float dist) {
    float f = 1.0 - exp(-pow(dist * uFogDensity, 1.6));
    return mix(c, uFogColor, clamp(f, 0.0, 1.0));
  }
`;

export function terrainMaterial(habitatTex: THREE.Texture, heatTex: THREE.Texture, geo: number[][], grid: HeatGrid) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...heatUniforms(heatTex, geo, grid),
      uHabitat: { value: habitatTex },
      uHabSize: { value: new THREE.Vector2((habitatTex.image as { width: number }).width, (habitatTex.image as { height: number }).height) },
      uBenthic: { value: benthicLUT },
      uShowHabitat: { value: 1 },
      uShowContours: { value: 1 },
      uTime: { value: 0 },
      uFogColor: { value: SCENE_FOG },
      uFogDensity: { value: 0.0011 },
      uLight: { value: new THREE.Vector3(-0.5, 0.75, -0.45).normalize() },
    },
    vertexShader: /* glsl */ `
      attribute float aH;
      varying float vH;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorld;
      varying float vDist;
      void main() {
        vH = aH;
        vUv = uv;
        vNormal = normalize(normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uHabitat;
      uniform sampler2D uBenthic;
      uniform float uShowHabitat;
      uniform float uShowContours;
      uniform float uTime;
      uniform vec3 uLight;
      ${HEAT_GLSL}
      varying float vH;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorld;
      varying float vDist;
      ${FOG}

      float contour(float value, float interval, float width) {
        float f = abs(fract(value / interval + 0.5) - 0.5) * interval;
        float w = fwidth(value) * width;
        return 1.0 - smoothstep(0.0, w, f);
      }
      // Cheap animated caustics: two warped sine grids.
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
      }
      // Natural seafloor seen from the air (scene units are 100 m): pale sand, dark grass beds,
      // mottled coral heads and spurs, rock, rubble.
      vec3 naturalBottom(float cls, vec2 p) {
        float n1 = vn(p * 4.0), n2 = vn(p * 13.0), n3 = vn(p * 31.0);
        if (cls < 0.5 || cls > 17.5 && cls < 18.5) return mix(vec3(0.80, 0.78, 0.62), vec3(0.62, 0.62, 0.44), n1 * 0.6 + n2 * 0.4);
        if (cls < 11.5) return mix(vec3(0.97, 0.94, 0.82), vec3(0.88, 0.85, 0.72), n2 * 0.7 + n3 * 0.3);
        if (cls < 12.5) return mix(vec3(0.82, 0.79, 0.68), vec3(0.58, 0.56, 0.48), step(0.55, n3));
        if (cls < 13.5) return mix(vec3(0.50, 0.45, 0.36), vec3(0.36, 0.33, 0.27), n2);
        if (cls < 14.5) return mix(vec3(0.10, 0.22, 0.14), vec3(0.20, 0.32, 0.18), vn(vec2(p.x * 22.0, p.y * 5.0)) * 0.5 + n1 * 0.5);
        // Coral / algae: warm browns with purple and gold colonies, dark grooves between spurs.
        vec3 b = mix(vec3(0.42, 0.33, 0.24), vec3(0.30, 0.25, 0.20), n1);
        b = mix(b, vec3(0.62, 0.44, 0.56), smoothstep(0.62, 0.74, n2) * 0.7);
        b = mix(b, vec3(0.74, 0.58, 0.32), smoothstep(0.66, 0.78, n3) * 0.6);
        return b * (0.75 + 0.35 * smoothstep(0.3, 0.7, vn(p * 7.0 + 3.1)));
      }
      // Habitat map as a chart rather than pixels. The Atlas classes (~34 m cells) can't be blended
      // like colors, so the 3 × 3 cells around each point vote with smooth quadratic B-spline
      // weights and the class with the most weight wins: boundaries become rounded curves instead
      // of staircases. A slight noise warp keeps them from following the grid. "margin" is the
      // winner's lead over the runner-up (0 on a boundary), used to antialias and outline edges.
      uniform vec2 uHabSize;
      float habAt(vec2 cell) { return floor(texture2D(uHabitat, (cell + 0.5) / uHabSize).r * 255.0 + 0.5); }
      void habSmooth(vec2 uv, out float best, out float second, out float margin) {
        vec2 t = uv * uHabSize - 0.5;
        t += (vec2(vn(t * 0.45), vn(t * 0.45 + 17.3)) - 0.5) * 0.8;
        vec2 c = floor(t + 0.5), f = t - c;
        vec3 wx = vec3(0.5 * (0.5 - f.x) * (0.5 - f.x), 0.75 - f.x * f.x, 0.5 * (0.5 + f.x) * (0.5 + f.x));
        vec3 wy = vec3(0.5 * (0.5 - f.y) * (0.5 - f.y), 0.75 - f.y * f.y, 0.5 * (0.5 + f.y) * (0.5 + f.y));
        float cls[9];
        float w[9];
        for (int j = 0; j < 3; j++)
          for (int i = 0; i < 3; i++) {
            cls[j * 3 + i] = habAt(c + vec2(float(i - 1), float(j - 1)));
            w[j * 3 + i] = wx[i] * wy[j];
          }
        best = cls[4];
        second = -1.0;
        float bw = -1.0, sw = 0.0;
        for (int k = 0; k < 9; k++) {
          float s = 0.0;
          for (int m = 0; m < 9; m++) s += abs(cls[m] - cls[k]) < 0.5 ? w[m] : 0.0;
          if (s > bw + 1e-5) {
            if (abs(cls[k] - best) > 0.5) { second = best; sw = max(bw, 0.0); }
            best = cls[k];
            bw = s;
          } else if (abs(cls[k] - best) > 0.5 && s > sw) {
            second = cls[k];
            sw = s;
          }
        }
        margin = second < 0.0 ? 1.0 : bw - sw;
      }
      vec3 habColor(float cls, vec3 water) { return cls < 0.5 ? water : texture2D(uBenthic, vec2((cls + 0.5) / 32.0, 0.5)).rgb * 0.95; }
      // Chart patterns per class in world space (scene units are 100 m), antialiased and faded out
      // with distance before they can shimmer: stipple on coral, hatching on seagrass, cross-hatch
      // on rock, scattered dots on rubble, a fine grain on sand, mottling on microalgal mats.
      float habPattern(float cls, vec2 p) {
        vec2 q = p * 7.0;
        float fw = max(fwidth(q.x), 1e-4);
        float fade = 1.0 - smoothstep(0.12, 0.38, fw);
        if (fade <= 0.0) return 0.0;
        float ink = 0.0;
        if (cls > 14.5 && cls < 15.5) {
          vec2 g = q + vec2(0.5 * floor(q.y), 0.0);
          ink = 1.0 - smoothstep(0.17, 0.17 + fw * 1.5, length(fract(g) - 0.5));
        } else if (cls > 13.5 && cls < 14.5) {
          ink = 1.0 - smoothstep(0.08, 0.08 + fw * 1.5, abs(fract((q.x + q.y) * 0.8) - 0.5));
        } else if (cls > 12.5 && cls < 13.5) {
          ink = max(1.0 - smoothstep(0.06, 0.06 + fw * 1.5, abs(fract((q.x + q.y) * 0.6) - 0.5)),
                    1.0 - smoothstep(0.06, 0.06 + fw * 1.5, abs(fract((q.x - q.y) * 0.6) - 0.5)));
        } else if (cls > 11.5 && cls < 12.5) {
          vec2 i = floor(q * 0.8);
          ink = step(0.62, h21(i)) * (1.0 - smoothstep(0.14, 0.14 + fw * 1.5, length(fract(q * 0.8) - 0.5)));
        } else if (cls > 17.5) {
          ink = smoothstep(0.55, 0.75, vn(q * 0.7)) * 0.7;
        } else if (cls > 10.5) {
          ink = step(0.86, h21(floor(q * 2.2))) * 0.5;
        }
        return ink * fade;
      }
      float caustic(vec2 p, float t) {
        vec2 q = p * 0.9;
        float a = sin(q.x * 1.7 + sin(q.y * 1.3 + t * 0.7) * 1.4 + t);
        float b = sin(q.y * 1.9 + sin(q.x * 1.1 - t * 0.6) * 1.6 - t * 0.8);
        return pow(max(0.0, 1.0 - abs(a + b) * 0.55), 4.0);
      }

      void main() {
        vec3 n = normalize(vNormal);
        float lambert = clamp(dot(n, uLight), 0.0, 1.0);
        vec3 col;
        if (vH > 0.0) {
          // Land: dark vegetation tones lifted with elevation, hillshade, 20 m topo lines.
          float e = clamp(vH / 230.0, 0.0, 1.0);
          vec3 low = vec3(0.10, 0.22, 0.17);
          vec3 mid = vec3(0.22, 0.36, 0.22);
          vec3 high = vec3(0.55, 0.56, 0.42);
          col = mix(mix(low, mid, smoothstep(0.0, 0.45, e)), high, smoothstep(0.45, 1.0, e));
          col *= 0.35 + 0.95 * lambert;
          if (uShowContours > 0.5) col += vec3(0.37, 0.95, 1.0) * contour(vH, 20.0, 1.0) * 0.18;
          // Glowing shoreline: land is never below 0.5 m in the heightmap, so heights under 0.5 only
          // occur on triangles that cross the coast (low swamps inland stay dark).
          col += vec3(0.37, 0.95, 1.0) * (1.0 - smoothstep(0.05, 0.5, vH)) * 0.55;
        } else {
          float d = -vH;
          // Water column tint by depth: turquoise shallows → navy → abyss.
          vec3 shallow = vec3(0.30, 0.82, 0.78);
          vec3 midc = vec3(0.07, 0.36, 0.50);
          vec3 deep = vec3(0.02, 0.08, 0.16);
          vec3 base = mix(shallow, midc, smoothstep(0.0, 18.0, d));
          base = mix(base, deep, smoothstep(18.0, 700.0, d));
          vec4 hab = texture2D(uHabitat, vUv);
          float benthic = floor(hab.r * 255.0 + 0.5);
          float geo = floor(hab.g * 255.0 + 0.5);
          if (uShowHabitat > 0.5 && d < 60.0) {
            // Classified map: Allen Coral Atlas legend colors on smooth shapes, dimmer with depth,
            // with a fine darker line where two habitats meet and a light pattern inside each.
            float best, second, margin;
            habSmooth(vUv, best, second, margin);
            if (best > 0.5 || second > 0.5) {
              float aa = max(fwidth(margin), 1e-4);
              vec3 c1 = habColor(best, base), c2 = habColor(second < 0.0 ? best : second, base);
              vec3 hc = mix(mix(c1, c2, 0.5), c1, smoothstep(0.0, aa * 1.5, margin));
              if (best > 0.5) hc *= 1.0 - 0.16 * habPattern(best, vWorld.xz);
              float line = (1.0 - smoothstep(aa * 0.6, aa * 2.2, margin)) * step(-0.5, second);
              hc = mix(hc, hc * 0.55, line * 0.7);
              // (Where the Atlas has no class, habColor is the water itself, so the map's outer edge
              // blends into the sea.)
              base = mix(base, hc, 0.82 * (1.0 - smoothstep(4.0, 22.0, d) * 0.45));
            }
          } else if (benthic > 0.5 && d < 30.0) {
            // Natural view: the bottom through clear water (more water color with depth).
            vec3 nb = naturalBottom(benthic, vWorld.xz);
            // Bleaching: with the heat layer on, coral areas whiten as heat passes NOAA's thresholds
            // (patchy from ~4 °C-weeks, most of the reef by ~10). Illustrative, driven by the 5 km cell.
            if (uShowHeat > 0.5 && benthic > 14.5 && benthic < 15.5) {
              vec2 cr;
              float k = heatCell(vUv, cr).a;
              float patchy = vn(vWorld.xz * 9.0) * 0.6 + vn(vWorld.xz * 27.0) * 0.4;
              float bleach = smoothstep(0.28 + patchy * 0.25, 0.62 + patchy * 0.25, k);
              nb = mix(nb, vec3(0.98, 0.97, 0.93), bleach * 0.92);
            }
            base = mix(nb, base, 1.0 - exp(-d / 7.5));
          }
          col = base * (0.45 + 0.75 * lambert);
          // Surf breaking along the reef crest (and outer reef flat): white streaks that drift.
          if (uShowHabitat < 0.5 && (geo > 14.5 && geo < 15.5 || geo > 13.5 && geo < 14.5 && d < 1.5)) {
            float s = vn(vec2(vWorld.x * 9.0 + uTime * 0.25, vWorld.z * 9.0)) * 0.6 + vn(vWorld.xz * 23.0 - uTime * 0.4) * 0.4;
            col = mix(col, vec3(0.95, 0.98, 1.0), smoothstep(0.5, 0.75, s) * (geo > 14.5 ? 0.75 : 0.35));
          }
          // Light caustics in the shallows.
          col += vec3(0.6, 1.0, 1.0) * caustic(vWorld.xz * 0.9, uTime) * 0.16 * (1.0 - smoothstep(0.0, 14.0, d));
          if (uShowContours > 0.5) {
            float c = d < 30.0 ? contour(d, 5.0, 1.0) * 0.35 : contour(d, 200.0, 1.2) * 0.45;
            col += vec3(0.37, 0.95, 1.0) * c * (d < 30.0 ? 0.5 : 0.35);
          }
        }
        col = applyFog(col, vDist);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    extensions: { derivatives: true } as never,
  });
}

/** Sea surface with the NOAA 5 km heat-stress cells. */
export function waterMaterial(heatTex: THREE.Texture, geo: number[][], grid: HeatGrid) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      ...heatUniforms(heatTex, geo, grid),
      uTime: { value: 0 },
      uFogColor: { value: SCENE_FOG },
      uFogDensity: { value: 0.0011 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vDist;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      ${HEAT_GLSL}
      varying vec2 vUv;
      varying float vDist;
      varying vec3 vWorld;
      ${FOG}
      void main() {
        // uv (v = 0 north) → lon/lat via the pipeline's affine fit → NOAA grid cell.
        vec2 cr;
        vec4 cell = heatCell(vec2(vUv.x, 1.0 - vUv.y), cr);
        vec3 c = vec3(0.04, 0.24, 0.36);
        float a = 0.08;
        if (uShowHeat > 0.5 && cell.a > 0.0) {
          // Severity drives everything: calm years leave the sea almost clear; from Alert 1 (4 °C-weeks)
          // the sea takes the alert color, and from Alert 2 (8) it dominates and pulses slowly.
          float k = cell.a;
          float warn = smoothstep(0.0, 0.33, k);
          float alert = smoothstep(0.3, 1.0, k);
          c = mix(c, cell.rgb, 0.35 + 0.6 * max(warn * 0.5, alert));
          a = 0.02 + 0.1 * warn + 0.52 * alert;
          a *= 1.0 + 0.14 * smoothstep(0.62, 1.0, k) * sin(uTime * 1.4 + (cr.x + cr.y) * 0.8);
          // Cell edges as a hairline (about 1 px at any zoom), stronger as heat rises.
          vec2 f = fract(cr);
          vec2 edge = min(f, 1.0 - f) / max(fwidth(cr), vec2(1e-4));
          float border = 1.0 - smoothstep(0.4, 1.4, min(edge.x, edge.y));
          c = mix(c, cell.rgb * 1.2 + 0.05, border * (0.3 + 0.5 * alert));
          a = max(a, border * (0.08 + 0.5 * alert));
        } else {
          a += 0.03 * sin(vWorld.x * 0.08 + vWorld.z * 0.05 + uTime * 0.6);
        }
        c = applyFog(c, vDist);
        float fade = 1.0 - smoothstep(600.0, 1100.0, vDist);
        gl_FragColor = vec4(c, a * fade);
      }
    `,
  });
}
