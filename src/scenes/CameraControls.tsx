import { useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo } from "react";
import { MapControls as MapImpl } from "three/examples/jsm/controls/MapControls.js";
import { OrbitControls as OrbitImpl } from "three/examples/jsm/controls/OrbitControls.js";

// Camera controls for the island and boat views: three.js's own OrbitControls / MapControls,
// mounted like drei's (default controls, eased with damping, a redraw on every change).
//
// Not drei's: those come from three-stdlib, whose touch handling froze the camera on phones
// (Tulio: "pinching to zoom and rotate, the camera got stuck"). There, lifting one finger after a
// pinch switches the controls off while the other finger is still down, so it moves nothing until
// every finger is up; it also doesn't capture fingers and can count one twice. three.js's version
// picks up the remaining finger, captures, and tracks each finger once.
// On top: two fingers twisting turn the view (`twist`), as in map apps; the controls themselves
// turn it only when both fingers slide together.

export type Controls = OrbitImpl;

interface Props {
  map?: boolean;
  /** Two-finger twist turns the view around its target. */
  twist?: boolean;
  makeDefault?: boolean;
  enableDamping?: boolean;
  dampingFactor?: number;
  enablePan?: boolean;
  enableRotate?: boolean;
  enableZoom?: boolean;
  screenSpacePanning?: boolean;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  mouseButtons?: OrbitImpl["mouseButtons"];
  onChange?: () => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export const CameraControls = forwardRef<OrbitImpl, Props>(function CameraControls(
  { map = false, twist = true, makeDefault, onChange, onStart, onEnd, ...settings },
  ref,
) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const connected = useThree((s) => s.events.connected) as HTMLElement | undefined;
  const invalidate = useThree((s) => s.invalidate);
  const set = useThree((s) => s.set);
  const get = useThree((s) => s.get);
  const el = connected ?? gl.domElement;

  const controls = useMemo(() => (map ? new MapImpl(camera) : new OrbitImpl(camera)), [map, camera]);
  useImperativeHandle(ref, () => controls, [controls]);
  useEffect(() => {
    controls.connect(el);
    return () => controls.disconnect();
  }, [controls, el]);
  useEffect(() => () => controls.dispose(), [controls]);

  // Settings follow the props on every render (minDistance changes when diving, ...).
  useEffect(() => {
    Object.assign(controls, settings);
  });

  useFrame(() => {
    if (controls.enabled) controls.update();
  }, -1);

  useEffect(() => {
    const change = () => {
      invalidate();
      onChange?.();
    };
    const start = () => onStart?.();
    const end = () => onEnd?.();
    controls.addEventListener("change", change);
    controls.addEventListener("start", start);
    controls.addEventListener("end", end);
    return () => {
      controls.removeEventListener("change", change);
      controls.removeEventListener("start", start);
      controls.removeEventListener("end", end);
    };
  }, [controls, invalidate, onChange, onStart, onEnd]);

  useEffect(() => {
    if (!makeDefault) return;
    const before = get().controls;
    set({ controls });
    return () => set({ controls: before });
  }, [makeDefault, controls, get, set]);

  // Two-finger twist: the change of the angle between the fingers turns the view.
  useEffect(() => {
    if (!twist) return;
    const fingers = new Map<number, { x: number; y: number }>();
    let angle: number | null = null;
    const between = () => {
      const [a, b] = [...fingers.values()];
      return Math.atan2(b.y - a.y, b.x - a.x);
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      angle = fingers.size === 2 ? between() : null;
    };
    const move = (e: PointerEvent) => {
      const f = fingers.get(e.pointerId);
      if (!f) return;
      f.x = e.clientX;
      f.y = e.clientY;
      if (fingers.size !== 2 || angle === null || !controls.enabled || !controls.enableRotate) return;
      const now = between();
      const d = Math.atan2(Math.sin(now - angle), Math.cos(now - angle));
      angle = now;
      if (Math.abs(d) < 0.6) {
        controls.rotateLeft(-d);
        invalidate();
      }
    };
    const up = (e: PointerEvent) => {
      if (!fingers.delete(e.pointerId)) return;
      angle = fingers.size === 2 ? between() : null;
    };
    el.addEventListener("pointerdown", down);
    // Moves and lifts are heard on the window: a finger can end anywhere.
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, [twist, controls, el, invalidate]);

  return null;
});
