// Thin-stroke icons (1.6 px, 24 grid), drawn for ReefQuest. Decorative: callers label the buttons.
import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "icon",
  "aria-hidden": true,
  ...p,
});

export const IconBack = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconArrow = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" /></svg>
);
export const IconPause = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 5v14M16 5v14" strokeWidth={2.4} /></svg>
);
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconLayers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 4l9 5-9 5-9-5 9-5z" /><path d="M3 14l9 5 9-5" /></svg>
);
export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="7.5" /><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" /></svg>
);
export const IconShip = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 15h18l-2.5 4.5h-13z" /><path d="M7 15v-4h8l2 4" /><path d="M10 11V7h3v4M11.5 7V4" /></svg>
);
export const IconSonar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 4v4" /><path d="M5 20l7-12 7 12" /><path d="M8.2 14.5a7 7 0 0 0 7.6 0M6.6 17.6a11 11 0 0 0 10.8 0" /></svg>
);
export const IconCast = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3v11" /><rect x="8.5" y="14" width="7" height="6" rx="1" /><path d="M5 6h14" /></svg>
);
export const IconBook = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z" /><path d="M5 16.5a3 3 0 0 1 3-3h10" /></svg>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={2.4}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const IconHelp = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4" /><path d="M12 16.6v.4" /></svg>
);
export const IconDive = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 7c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" /><path d="M12 11v9M8.5 16.5L12 20l3.5-3.5" /></svg>
);
export const IconSurface = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 7c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" /><path d="M12 20v-9M8.5 14.5L12 11l3.5 3.5" /></svg>
);
