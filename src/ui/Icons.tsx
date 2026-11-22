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
export const IconIslands = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3.5 12.5c1.4-2.4 4-3.3 6.4-2.7s2.8 2.2 1.2 3.4-6.4 1.6-7.6-.7z" /><path d="M14.2 7.6c1-1.5 3-2 4.6-1.2s1.2 2.3-.4 2.9-4.8.3-4.2-1.7z" /><path d="M3 18.5c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0" /></svg>
);
export const IconGlobe = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5c-2.3 2.5-3.3 5.3-3.3 8.5s1 6 3.3 8.5M12 3.5c2.3 2.5 3.3 5.3 3.3 8.5s-1 6-3.3 8.5M4 9.2h16M4 14.8h16" /></svg>
);
export const IconTools = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
);
export const IconPhotos = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4" /></svg>
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
export const IconCamera = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 8h3l1.6-2.2h6.8L17 8h3v11H4z" /><circle cx="12" cy="13.2" r="3.4" /></svg>
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
export const IconHeat = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M10 13.6V5.5a2 2 0 0 1 4 0v8.1a4 4 0 1 1-4 0z" /><path d="M12 9.5v6.5" /><circle cx="12" cy="17" r="1.2" /></svg>
);
export const IconHeart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 19.5s-7-4.2-7-9.4A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.5c0 5.2-7 9.4-7 9.4z" /></svg>
);
export const IconExternal = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 6H6.5A1.5 1.5 0 0 0 5 7.5v10A1.5 1.5 0 0 0 6.5 19h10a1.5 1.5 0 0 0 1.5-1.5V15" /><path d="M13 5h6v6M19 5l-8 8" /></svg>
);
// Things to find in the boat mode (mission tags and place tags).
export const IconWhaleShark = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M2.5 12c2.6-3 7.6-4.2 12.3-2.4L19.5 6l-1 4.4 3 1.6-3 1.6 1 4.4-4.7-3.6C10.1 16.2 5.1 15 2.5 12z" /><path d="M9 8.9l2-2.6 1.6 2.5" /><path d="M6.6 11.6h.01M9.6 12.7h.01M12.4 11.3h.01" /></svg>
);
export const IconTurtle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><ellipse cx="12" cy="12.8" rx="4.8" ry="5.8" /><circle cx="12" cy="4.9" r="1.6" /><path d="M7.9 9.6L4.2 7.4M16.1 9.6l3.7-2.2M8.6 17.2l-2.2 2.4M15.4 17.2l2.2 2.4" /><path d="M12 9.5v6.6M9.2 11.4l2.8 1.6 2.8-1.6" /></svg>
);
export const IconShark = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 18c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" /><path d="M7.8 14.6C9.4 10 12.2 6.4 16 4.8c-.7 3.7-.3 6.8 1.3 9.8" /></svg>
);
export const IconWreck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 6c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" /><path d="M4.4 15.2l14.4-2.9-1.8 6H7.3z" /><path d="M10.8 13.9l-1-4.6M12.6 13.5l-.5-2.5 2.9-.6.5 2.5" /></svg>
);
export const IconStingray = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 4.5c2.6 1.6 6.4 3.8 8.6 6.6-2.4 1.6-5.6 3.3-8.6 4.4-3-1.1-6.2-2.8-8.6-4.4C5.6 8.3 9.4 6.1 12 4.5z" /><path d="M12 15.5c0 2 .4 3.4 1.6 4.8" /><path d="M10.4 8.6h.01M13.6 8.6h.01" /></svg>
);
export const IconDiver = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="18.6" cy="10.2" r="1.9" /><path d="M16.5 11.4l-8 1.2-3.3-.6" /><path d="M9.6 8.9h5.2" /><path d="M8.5 12.6l-1.7 3.6L3 17.6M11.4 12.2l-.6 4L7.6 19" /><path d="M20.2 6.6v-.01M21.3 4.3v-.01" /></svg>
);
export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19.5h14" /></svg>
);
