import type * as THREE from "three";
import { create } from "zustand";

// The underwater camera (after CopánQuest's): a viewfinder, the thing in frame worked out a few
// times a second, and one small JPEG grabbed right after a frame is drawn. A photo of a place's
// subject (the whale shark, a wreck, ...) completes that place's mission. Photos are small on
// purpose (480 × 270, ~25 KB), kept in localStorage, and saved from the logbook with one press.

export interface Shot {
  url: string; // JPEG data URL
  at: number;
}
const KEY = "rq-photos-v1";
const W = 480, H = 270;

function load(): Record<string, Shot> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

interface RollState {
  /** One photo per subject (a mission's site id); a new one replaces the old. */
  photos: Record<string, Shot>;
  /** The viewfinder is up. */
  camera: boolean;
  /** The subject in the viewfinder (a site id), if any. */
  aim: string | null;
  /** Bumped on every press of the shutter (the white flash). */
  flash: number;
  /** The photo just taken, for a moment (the little print that pops up). */
  last: string | null;
  setCamera: (on: boolean) => void;
  setAim: (id: string | null) => void;
  add: (id: string, url: string) => void;
}

export const useRoll = create<RollState>((set, get) => ({
  photos: load(),
  camera: false,
  aim: null,
  flash: 0,
  last: null,
  setCamera: (camera) => set({ camera, aim: null }),
  setAim: (aim) => {
    if (get().aim !== aim) set({ aim });
  },
  add: (id, url) => {
    const photos = { ...get().photos, [id]: { url, at: Date.now() } };
    set({ photos, last: id });
    try {
      localStorage.setItem(KEY, JSON.stringify(photos));
    } catch {
      /* storage full or blocked: the photo stays for this visit */
    }
  },
}));

/** What can be photographed right now: a key per animal or point → its subject (a site id), its
 *  position, and from how far (m) it makes a photo. The scenes in wildlife.tsx keep this current. */
export const photoSubjects = new Map<string, { id: string; x: number; y: number; z: number; r: number }>();
export function trackSubject(key: string, id: string, x: number, y: number, z: number, r: number) {
  const e = photoSubjects.get(key);
  if (e) Object.assign(e, { id, x, y, z, r });
  else photoSubjects.set(key, { id, x, y, z, r });
}
export function untrack(prefix: string) {
  for (const k of photoSubjects.keys()) if (k.startsWith(prefix)) photoSubjects.delete(k);
}

/** The part of the screen a photo keeps, as shares of the width and height: the viewfinder's frame,
 *  a centered 16:9 box 78% of the width or 74% of the height, whichever is smaller (the same
 *  numbers as `.vf-frame` in styles.css). */
export function cropShare(w: number, h: number) {
  const fw = Math.min(0.78 * w, ((0.74 * h) * 16) / 9);
  return { fx: fw / w, fy: (fw * 9) / 16 / h };
}

let pending: ((url: string) => void) | null = null;
/** Ask for a photo of the next frame. */
export function requestShot(cb: (url: string) => void) {
  pending = cb;
}
/** Inside the render loop: if a photo was asked for, draw the frame now and keep its 16:9 crop as
 *  a small JPEG (the drawing buffer is only readable right after drawing). */
export function fulfilShot(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  if (!pending) return;
  const cb = pending;
  pending = null;
  gl.render(scene, camera);
  const src = gl.domElement;
  const { fx, fy } = cropShare(src.width, src.height);
  const cw = src.width * fx, ch = src.height * fy;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  out.getContext("2d")!.drawImage(src, (src.width - cw) / 2, (src.height - ch) / 2, cw, ch, 0, 0, W, H);
  cb(out.toDataURL("image/jpeg", 0.78));
}
