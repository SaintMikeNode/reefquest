// Stops the page behind a full-screen overlay (photo viewer, photo dome) from scrolling.
//
// Overlays nest (a photo opened inside the dome), so the lock is counted: the page scrolls again
// only when the last overlay lets go, and it gets back exactly the style it had before the first
// one. Each overlay used to save and restore `body.style.overflow` by itself; with two open, each
// saved the other's "hidden" as "what it was before", so closing both left the page locked, and
// since this is a single-page site the lock followed the visitor to every page until a reload
// (Tulio: "pages get stuck and scrolling is frozen").
let locks = 0;
let before = "";

/** Locks page scrolling; call the returned function to release (safe to call more than once). */
export function lockScroll(): () => void {
  if (locks++ === 0) {
    before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) document.body.style.overflow = before;
  };
}
