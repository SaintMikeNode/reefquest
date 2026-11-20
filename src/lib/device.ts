// "Lite" mode for low-end phones and old PCs: smaller terrain mesh, no animated caustics, DPR 1.
const nav = navigator as Navigator & { deviceMemory?: number };
const touch = matchMedia("(pointer: coarse)").matches;
const cores = nav.hardwareConcurrency ?? 4;
const mem = nav.deviceMemory ?? 4;

export const LITE = (touch && (cores <= 6 || mem <= 4)) || cores <= 2 || mem <= 2 || /[?&]lite\b/.test(location.search);
export const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Frosted-glass HUD surfaces (backdrop blur) cost a full-screen blur per frame on weak GPUs: use solid ones.
if (LITE && typeof document !== "undefined") document.documentElement.classList.add("lite");
