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

const FOG = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  vec3 applyFog(vec3 c, float dist) {
    float f = 1.0 - exp(-pow(dist * uFogDensity, 1.6));
    return mix(c, uFogColor, clamp(f, 0.0, 1.0));
  }
`;

export function terrainMaterial(habitatTex: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uHabitat: { value: habitatTex },
      uBenthic: { value: benthicLUT },
      uShowHabitat: { value: 1 },
      uShowContours: { value: 1 },
      uTime: { value: 0 },
      uFogColor: { value: new THREE.Color("#020d16") },
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
          if (uShowHabitat > 0.5 && benthic > 0.5) {
            vec3 hc = texture2D(uBenthic, vec2((benthic + 0.5) / 32.0, 0.5)).rgb;
            // Habitat seen through water: dimmer with depth.
            base = mix(base, hc * 0.95, 0.78 * (1.0 - smoothstep(4.0, 22.0, d) * 0.45));
          }
          col = base * (0.45 + 0.75 * lambert);
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
export function waterMaterial(heatTex: THREE.Texture, geo: number[][], grid: { lat0: number; lon0: number; cell: number; cols: number; rows: number }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uHeat: { value: heatTex },
      uShowHeat: { value: 1 },
      uLon: { value: new THREE.Vector3(...geo[0]) },
      uLat: { value: new THREE.Vector3(...geo[1]) },
      uGrid: { value: new THREE.Vector4(grid.lat0, grid.lon0, grid.cell, 0) },
      uGridSize: { value: new THREE.Vector2(grid.cols, grid.rows) },
      uTime: { value: 0 },
      uFogColor: { value: new THREE.Color("#020d16") },
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
      uniform sampler2D uHeat;
      uniform float uShowHeat;
      uniform vec3 uLon;
      uniform vec3 uLat;
      uniform vec4 uGrid;
      uniform vec2 uGridSize;
      uniform float uTime;
      varying vec2 vUv;
      varying float vDist;
      varying vec3 vWorld;
      ${FOG}
      void main() {
        // uv (v = 0 north) → lon/lat via the pipeline's affine fit → NOAA grid cell.
        vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
        float lon = dot(uLon, vec3(uv, 1.0));
        float lat = dot(uLat, vec3(uv, 1.0));
        float col = (lon - uGrid.y) / uGrid.z + 0.5;
        float row = (uGrid.x - lat) / uGrid.z + 0.5;
        vec4 cell = texture2D(uHeat, vec2(col / uGridSize.x, row / uGridSize.y));
        vec3 c = vec3(0.04, 0.24, 0.36);
        float a = 0.10;
        if (uShowHeat > 0.5 && cell.a > 0.0) {
          // cell.a = heat intensity (0 at 0 DHW → 1 at 12+ DHW).
          vec2 f = fract(vec2(col, row));
          vec2 edge = min(f, 1.0 - f);
          float border = 1.0 - smoothstep(0.0, 0.018, min(edge.x, edge.y));
          float k = cell.a;
          c = mix(c, cell.rgb, 0.30 + 0.45 * k);
          a = 0.06 + 0.26 * k;
          c = mix(c, cell.rgb * 1.3 + 0.1, border * 0.8);
          a = max(a, border * (0.18 + 0.5 * k));
        }
        // Faint moving sheen.
        a += 0.03 * sin(vWorld.x * 0.08 + vWorld.z * 0.05 + uTime * 0.6);
        c = applyFog(c, vDist);
        float fade = 1.0 - smoothstep(600.0, 1100.0, vDist);
        gl_FragColor = vec4(c, a * fade);
      }
    `,
  });
}
