// Checked once at startup: without WebGL the app falls back to the 2D map (and, later, charts).
export const HAS_WEBGL = (() => {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
})();
