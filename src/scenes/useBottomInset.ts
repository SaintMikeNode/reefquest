import { useEffect, useLayoutEffect, type RefObject } from "react";

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
    const update = () => root.style.setProperty(name, `${Math.ceil(root.getBoundingClientRect().bottom - el.getBoundingClientRect().top)}px`);
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
