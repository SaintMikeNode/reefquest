import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Distance from an element's top to the bottom of `root`, ignoring its own translate: a sheet sliding
 *  in or out (transform) would otherwise be measured part-way and things stacked on it end up touching. */
function insetOf(el: HTMLElement, root: HTMLElement) {
  const ty = new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform).m42;
  return Math.ceil(root.getBoundingClientRect().bottom - (el.getBoundingClientRect().top - ty));
}

/**
 * Publishes how much of the scene a bottom-anchored panel takes (from its top edge to the bottom of
 * the scene, safe-area spacing included) as a CSS variable on the scene root, so other panels can
 * stack above it instead of overlapping. Updates when the panel or the window changes size.
 * Used for the timeline (--tb) and the boat's bottom bar (--bb).
 */
export function useBottomInset(ref: RefObject<HTMLElement | null>, name: string) {
  useEffect(() => {
    const el = ref.current, root = el?.parentElement;
    if (!el || !root) return;
    const update = () => root.style.setProperty(name, `${insetOf(el, root)}px`);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(root);
    update();
    return () => {
      ro.disconnect();
      root.style.removeProperty(name);
    };
  }, [ref, name]);
}

/**
 * Publishes an element's width as a CSS variable on the scene root (before paint, and whenever it
 * changes). Used for the tools at the top right (--tools-w): on phones the way back sits on the
 * same row, and may take only the room the tools leave (styles.css), so the two can never overlap
 * whatever the language or the screen width.
 */
export function useWidthVar(ref: RefObject<HTMLElement | null>, name: string) {
  useLayoutEffect(() => {
    const el = ref.current, root = el?.parentElement;
    if (!el || !root) return;
    const update = () => root.style.setProperty(name, `${Math.ceil(el.getBoundingClientRect().width)}px`);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => {
      ro.disconnect();
      root.style.removeProperty(name);
    };
  }, [ref, name]);
}

/** Whether a media query matches, kept current (e.g. the phone layout, "(max-width: 760px)"). */
export function useMedia(query: string) {
  const [on, setOn] = useState(() => typeof matchMedia !== "undefined" && matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const update = () => setOn(m.matches);
    m.addEventListener("change", update);
    update();
    return () => m.removeEventListener("change", update);
  }, [query]);
  return on;
}

/** useBottomInset for an element that comes and goes (a callback ref): while it is on screen, its
 *  distance from the bottom of the scene is published as `name` on its parent. */
export function useInsetRef(name: string) {
  const stop = useRef<(() => void) | null>(null);
  return useCallback(
    (el: HTMLElement | null) => {
      stop.current?.();
      stop.current = null;
      const root = el?.parentElement;
      if (!el || !root) return;
      const update = () => root.style.setProperty(name, `${insetOf(el, root)}px`);
      const ro = new ResizeObserver(update);
      ro.observe(el);
      ro.observe(root);
      update();
      stop.current = () => {
        ro.disconnect();
        root.style.removeProperty(name);
      };
    },
    [name],
  );
}
