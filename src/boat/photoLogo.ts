import { brandMark } from "./brandMarkPaths";

// The ReefQuest logo stamped in the bottom-right corner of every underwater photo, so a saved
// photo carries where it came from. Drawn with canvas paths (no image to load, so it is there on
// the very first shot and in every browser). The paths are the brand kit's horizontal
// "color on dark" logo (brand/logo/svg/reefquest-horizontal-color-on-dark.svg): the mark from
// src/ui/Logo.tsx and the outlined Inter wordmark. Regenerate brandMarkPaths.ts if the logo changes.

/** Draws the logo into the bottom-right corner of a W × H photo canvas. */
export function stampLogo(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const { viewBox: [vx, vy, vw, vh], wave, coral, word } = brandMark;
  const width = Math.round(w * 0.2), height = (width * vh) / vw, pad = Math.round(w * 0.025);
  const k = width / vw;
  ctx.save();
  ctx.translate(w - pad - width, h - pad - height);
  ctx.scale(k, k);
  ctx.translate(-vx, -vy);
  // A soft dark halo keeps the white legible over bright shallows and sand.
  ctx.shadowColor = "rgba(2, 10, 24, 0.55)";
  ctx.shadowBlur = 5 / k;
  ctx.globalAlpha = 0.92;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.save();
  ctx.scale(8.75, 8.75);
  ctx.strokeStyle = "#bfe0ff";
  ctx.lineWidth = 1.8;
  ctx.stroke(new Path2D(wave));
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  for (const d of coral) ctx.stroke(new Path2D(d));
  ctx.restore();
  ctx.fillStyle = "#ffffff";
  ctx.translate(370, 205.75);
  ctx.fill(new Path2D(word));
  ctx.restore();
}
