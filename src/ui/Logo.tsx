// ReefQuest mark: a branching coral rising from a wave line, in one ink color.
export function Logo({ color = "currentColor", accent = "#00707b" }: { color?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 24.5c3.2-1.7 6.3-1.7 9.5 0s6.3 1.7 9.5 0 6.3-1.7 7 0" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
      <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 22V9.5" />
        <path d="M16 17l-5.2-4.4V7.5" />
        <path d="M16 13.5l4.6-3.9V5" />
        <path d="M10.8 12.6l-3.1-1.6" />
        <path d="M20.6 9.6l2.6-1.2" />
      </g>
    </svg>
  );
}
