import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { REDUCED_MOTION, TOUCH } from "../lib/device";
import { IconClose } from "../ui/Icons";

// Bottom-right card on computers with a mouse: three small mice, each with the button that does
// the job lit (drag, right-drag, wheel). Hidden on touch screens; closing it is remembered.
// On entering a 3D view it is pointed out once (Tulio): as soon as the transition curtain has
// cleared, a soft aqua ring pulses twice around the card and the three controls lift one after
// another (`.spot`, transform and opacity only). Not with reduced motion.

// -2: the controls changed (no right-drag), so the card shows again once for everyone.
const KEY = "rq-mouse-guide-2";
type Part = "left" | "right" | "wheel";

function Mouse({ lit }: { lit: Part }) {
  const on = "var(--aqua)", off = "rgba(255, 255, 255, 0.12)";
  return (
    <svg viewBox="0 0 24 34" width="22" height="31" aria-hidden="true">
      <path d="M12 1.5C6.2 1.5 2.5 5.4 2.5 11v1.5H12z" fill={lit === "left" ? on : off} />
      <path d="M12 1.5c5.8 0 9.5 3.9 9.5 9.5v1.5H12z" fill={lit === "right" ? on : off} />
      <rect x="2.5" y="1.5" width="19" height="31" rx="9.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 12.5h19M12 1.5v11" stroke="currentColor" strokeWidth="1.2" />
      <rect x="10.2" y="4.5" width="3.6" height="6" rx="1.8" fill={lit === "wheel" ? on : "#04101d"} stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** `inline`: sits in the flow of another bar (the boat's) instead of the bottom-right corner. */
export function MouseGuide({ items, inline }: { items: { part: Part; key?: string; label: string; how: string }[]; inline?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "closed";
    } catch {
      return true;
    }
  });
  // The highlight waits for the curtain and any loading screen, so it is actually seen.
  const [spot, setSpot] = useState(false);
  useEffect(() => {
    if (TOUCH || !open || REDUCED_MOTION) return;
    let raf = 0, timer = 0;
    const wait = () => {
      if (document.querySelector(".curtain, .loading-screen")) raf = requestAnimationFrame(wait);
      else {
        setSpot(true);
        timer = window.setTimeout(() => setSpot(false), 3200);
      }
    };
    raf = requestAnimationFrame(wait);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [open]);
  if (TOUCH || !open) return null;
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "closed");
    } catch {
      /* private mode: it just comes back next time */
    }
  };
  return (
    <aside className={`${inline ? "mouse-guide inline panel" : "hud mouse-guide panel"}${spot ? " spot" : ""}`} aria-label={t("scene.mouse.title")}>
      <ul>
        {items.map((it) => (
          <li key={it.label}>
            {it.key && <kbd className="mg-key">{it.key}</kbd>}
            <Mouse lit={it.part} />
            <span>
              <b>{it.label}</b>
              {it.how}
            </span>
          </li>
        ))}
      </ul>
      <button className="mg-close" onClick={close} aria-label={t("scene.mouse.close")} title={t("scene.mouse.close")}>
        <IconClose />
      </button>
    </aside>
  );
}
