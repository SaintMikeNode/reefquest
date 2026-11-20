// ReefQuest mark: a branching coral inside an instrument ring.
export function Logo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="#5ff2ff" strokeOpacity=".45" />
      <path d="M2 16h3M27 16h3M16 2v3" stroke="#5ff2ff" strokeOpacity=".7" />
      <g fill="none" stroke="#ff6f5e" strokeWidth="2" strokeLinecap="round">
        <path d="M16 25V13" />
        <path d="M16 19l-5-4.5V10" />
        <path d="M16 16.5l4.5-4V8.5" />
        <path d="M11 14.5l-3-1.5" />
      </g>
      <path d="M7 25.5c3-1.6 6-1.6 9 0s6 1.6 9 0" fill="none" stroke="#5ff2ff" strokeWidth="1.2" />
    </svg>
  );
}
