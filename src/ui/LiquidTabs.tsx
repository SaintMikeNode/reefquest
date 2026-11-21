import { AnimatePresence, motion, type Transition, type Variants } from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

// Liquid tabs (after pinui's "Liquid Tabs", Tulio's pick; rebuilt in our dark HUD style): the panel
// body and the active tab are two shapes merged by a goo filter (blur, then a hard alpha edge), so the
// tab reads as part of the panel, like a folder tab, and flows under the next label when you switch.
// The content leaves toward the side you came from and arrives from the side you went to, through a
// light blur, and the panel's height eases to the new content. Arrow keys move between tabs. Motion
// springs (no wobble); reduced motion is honored by Motion itself.

export interface LiquidTab {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
}

const TAB_H = 46;
const blobSpring: Transition = { type: "spring", visualDuration: 0.5, bounce: 0.12 };
const smooth: Transition = { type: "spring", visualDuration: 0.4, bounce: 0 };
const panelVariants: Variants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 22, filter: "blur(4px)" }),
  animate: { opacity: 1, x: 0, filter: "blur(0px)", transition: { type: "spring", visualDuration: 0.42, bounce: 0 } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -22, filter: "blur(4px)", transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } }),
};

export function LiquidTabs({ tabs, active, onSelect, label, children }: { tabs: LiquidTab[]; active: string; onSelect: (id: string) => void; label: string; children: ReactNode }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gooId = `ltabs-goo-${uid}`;
  const root = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [blob, setBlob] = useState<{ x: number; w: number } | null>(null);
  const [dir, setDir] = useState(1);

  const measure = useCallback(() => {
    const r = root.current?.getBoundingClientRect(), t = tabRefs.current[active]?.getBoundingClientRect();
    if (r && t) setBlob({ x: t.left - r.left, w: t.width });
  }, [active]);
  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (root.current) ro.observe(root.current);
    Object.values(tabRefs.current).forEach((el) => el && ro.observe(el));
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [measure, tabs.length]);

  // The content's natural height, so the panel can ease to it (CSS max-height still caps it).
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const select = (id: string) => {
    if (id === active) return;
    setDir(tabs.findIndex((t) => t.id === id) > tabs.findIndex((t) => t.id === active) ? 1 : -1);
    onSelect(id);
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    select(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return (
    <div ref={root} className="ltabs">
      <svg aria-hidden="true" className="ltabs-defs">
        <defs>
          <filter id={gooId} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" />
          </filter>
        </defs>
      </svg>
      {/* the strip behind the inactive tabs, then the panel body and the liquid tab, merged */}
      <div aria-hidden="true" className="ltabs-strip" style={{ height: TAB_H + 20 }} />
      <div aria-hidden="true" className="ltabs-surface">
        <div className="ltabs-goo" style={{ filter: `url(#${gooId})` }}>
          <div className="ltabs-body" style={{ top: TAB_H }} />
          {blob && <motion.div className="ltabs-blob" style={{ height: TAB_H + 18 }} initial={false} animate={{ x: blob.x, width: blob.w }} transition={blobSpring} />}
        </div>
      </div>

      <div role="tablist" aria-label={label} className="ltabs-bar" style={{ height: TAB_H }}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => void (tabRefs.current[tab.id] = el)}
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            tabIndex={tab.id === active ? 0 : -1}
            className="ltabs-tab"
            onClick={() => select(tab.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <motion.div className="ltabs-content" role="tabpanel" initial={false} animate={{ height }} transition={smooth}>
        <div ref={inner} className="ltabs-inner">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div key={active} custom={dir} variants={panelVariants} initial="initial" animate="animate" exit="exit">
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
