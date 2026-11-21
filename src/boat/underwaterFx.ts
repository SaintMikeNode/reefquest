import * as THREE from "three";
import { WATER, WATER_GLSL } from "./props";

// Cheap effects for the underwater camera: the water itself as a backdrop (a dome whose color
// follows the direction, with rays of sunlight fanning down through it), shafts of sunlight near
// the camera (a few additive quads that turn to face it) and marine snow (one point cloud that
// wraps around the camera).

/** The water all around: one inside-out sphere centered on the camera, drawn first. Without it the
 *  view below the horizon was one flat color (Tulio: "boring and lame"). */
export class WaterDome {
  mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  constructor(rays: boolean) {
    this.mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(-0.32, 0.9, -0.28).normalize() }, uRays: { value: rays ? 1 : 0 }, ...WATER },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * viewMatrix * vec4(position * 500.0 + cameraPosition, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSun;
        uniform float uRays;
        varying vec3 vDir;
        ${WATER_GLSL}
        void main() {
          vec3 d = normalize(vDir);
          vec3 c = rqWaterDir(d);
          if (uRays > 0.5) {
            // Rays fan out from the sun's direction: bands around that axis, drifting and
            // breathing, strongest toward the sun and gone well below the horizon.
            vec3 u = normalize(cross(uSun, vec3(0.0, 0.0, 1.0))), w = cross(uSun, u);
            float ang = atan(dot(d, w), dot(d, u));
            float toSun = dot(d, uSun) * 0.5 + 0.5;
            float bands = sin(ang * 13.0 + uTime * 0.11) * 0.5 + sin(ang * 31.0 - uTime * 0.17 + 1.3) * 0.3 + sin(ang * 57.0 + uTime * 0.23) * 0.2;
            float rays = pow(max(0.0, bands * 0.5 + 0.5), 3.0) * pow(toSun, 2.2) * smoothstep(-0.75, 0.15, d.y);
            c += (uRqFog * 1.5 + vec3(0.05, 0.14, 0.16)) * rays * 0.42;
            // A soft glow where the sun stands above the water.
            c += vec3(0.5, 0.75, 0.8) * pow(toSun, 14.0) * 0.28;
          }
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -2;
    this.mesh.visible = false;
  }
  update(t: number, visible: boolean) {
    this.mesh.visible = visible;
    if (visible) this.mat.uniforms.uTime.value = t;
  }
}

export class LightShafts {
  group = new THREE.Group();
  private quads: THREE.Mesh[] = [];
  private mat: THREE.ShaderMaterial;
  constructor(count = 7) {
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, ...WATER },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vDist;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uRqVis;
        varying vec2 vUv;
        varying float vDist;
        void main() {
          float edge = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
          float fall = pow(vUv.y, 1.6);                       // bright at the surface, fading down
          float flicker = 0.75 + 0.25 * sin(uTime * 0.8 + vUv.x * 6.0 + vUv.y * 3.0);
          float a = edge * fall * flicker * 0.15 * exp(-vDist / (uRqVis * 1.8));
          gl_FragColor = vec4(vec3(0.75, 0.95, 1.0) * a, a);
        }`,
    });
    for (let i = 0; i < count; i++) {
      const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
      q.frustumCulled = false;
      q.renderOrder = 4;
      this.quads.push(q);
      this.group.add(q);
    }
    this.group.visible = false;
  }
  update(cam: THREE.Camera, cx: number, cz: number, floor: number, t: number, visible: boolean) {
    this.group.visible = visible;
    if (!visible) return;
    this.mat.uniforms.uTime.value = t;
    const h = Math.max(4, -floor);
    this.quads.forEach((q, i) => {
      // Shafts drift slowly around the focus point and lean with the sun.
      const a = i * 2.39 + t * 0.03;
      const r = 4 + ((i * 7) % 5) * 3.2;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const w = 1.6 + (i % 3) * 1.1;
      q.scale.set(w, h, 1);
      q.position.set(x - h * 0.18, -h / 2, z - h * 0.12);
      q.rotation.set(0, Math.atan2(cam.position.x - x, cam.position.z - z), -0.18);
    });
  }
}

export class MarineSnow {
  points: THREE.Points;
  private mat: THREE.ShaderMaterial;
  constructor(count = 900, box = 26) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = Math.random() * box;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uTime: { value: 0 }, uPx: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform vec3 uCam;
        uniform float uBox;
        uniform float uTime;
        uniform float uPx;
        varying float vA;
        void main() {
          vec3 p = position + vec3(uTime * 0.12, -uTime * 0.05, uTime * 0.07);
          p = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;   // wrap around the camera
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vA = smoothstep(uBox * 0.5, uBox * 0.2, d) * smoothstep(0.3, 1.2, d);
          gl_PointSize = clamp(uPx * 2.2 * 12.0 / d, 1.0, 4.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.1, length(c)) * vA * 0.55;
          gl_FragColor = vec4(vec3(0.85, 0.95, 0.95), a);
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 5;
  }
  update(cam: THREE.Camera, t: number, dpr: number, visible: boolean) {
    this.points.visible = visible;
    if (!visible) return;
    this.mat.uniforms.uCam.value.copy(cam.position);
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uPx.value = dpr;
  }
}
