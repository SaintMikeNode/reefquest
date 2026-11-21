import { AnimatePresence, motion, type Transition, type Variants } from "motion/react";
import { MOBILE } from "../lib/device";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

// Liquid tabs (after pinui's "Liquid Tabs", Tulio's pick; rebuilt in our dark HUD style): the panel
// body and the active tab are two shapes merged by a goo filter (blur, then a hard alpha edge), so the
// tab reads as part of the panel, like a folder tab, and flows under the next label when you switch.
// The content leaves toward the side you came from and arrives from the side you went to, through a
// light blur, and the panel's height eases to the new content. Arrow keys move between tabs. Motion
// springs (no wobble); reduced motion is honored by Motion itself.
//
// `page`: the same system at page size (the Learn hub: heat data | lessons). The panel is as long as
// the page, so three things change: only the top of the panel goes through the goo filter (a plain
// sheet carries the rest; filtering thousands of pixels on every frame of a tab change would
// stutter), the panel's height is not animated (animating layout on a long page janks on phones),
// and the content slides and fades with no blur on any device. The page scrolls, not the panel.

export interface LiquidTab {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
}

const TAB_H = 46;
const PAGE_TAB_H = 54;
// How far below the tabs the filtered part of a page-size panel reaches, and where the plain sheet
// takes over (it overlaps the filtered part, so the seam can't show).
const PAGE_GOO = 96, PAGE_SHEET = 44;
const blobSpring: Transition = { type: "spring", visualDuration: 0.5, bounce: 0.12 };
const smooth: Transition = { type: "spring", visualDuration: 0.4, bounce: 0 };
// Phones and tablets slide and fade only: an animated blur repaints the panel every frame.
const soft = (px: number) => (MOBILE ? {} : { filter: `blur(${px}px)` });
const panelVariants: Variants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 22, ...soft(4) }),
  animate: { opacity: 1, x: 0, ...soft(0), transition: { type: "spring", visualDuration: 0.42, bounce: 0 } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -22, ...soft(4), transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } }),
};

const pageVariants: Variants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 18 }),
  animate: { opacity: 1, x: 0, transition: { type: "spring", visualDuration: 0.4, bounce: 0 } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -18, transition: { duration: 0.16, ease: [0.4, 0, 0.2, 1] } }),
};

export function LiquidTabs({ tabs, active, onSelect, label, page = false, children }: { tabs: LiquidTab[]; active: string; onSelect: (id: string) => void; label: string; page?: boolean; children: ReactNode }) {
  const tabH = page ? PAGE_TAB_H : TAB_H;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gooId = `ltabs-goo-${uid}`;
  const root = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [blob, setBlob] = useState<{ x: number; w: number } | null>(null);
  const [dir, setDir] = useState(1);

  // The open tab's place in the row (numbers, not the tabs array: a new array each parent render
  // would re-measure and re-observe every time).
  const activeIndex = tabs.findIndex((tab) => tab.id === active), count = tabs.length;
  const measure = useCallback(() => {
    const r = root.current?.getBoundingClientRect(), t = tabRefs.current[active]?.getBoundingClientRect();
    if (!r || !t) return;
    // The first and last tabs reach the panel's edges (1 px past, over the strip's hairline), so
    // no sliver of the lighter strip shows around the open tab's outer corner.
    const left = activeIndex === 0 ? -1 : t.left - r.left;
    // (At page size the tab row can be narrower than the panel: only a tab that really ends at the
    // panel's edge reaches past it.)
    const atEdge = activeIndex === count - 1 && (!page || Math.abs(t.right - r.right) < 2);
    const right = atEdge ? r.width + 1 : t.right - r.left;
    setBlob((b) => (b && b.x === left && b.w === right - left ? b : { x: left, w: right - left }));
  }, [active, activeIndex, count, page]);
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
    if (!el || page) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [page]);

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
    <div ref={root} className={page ? "ltabs full" : "ltabs"}>
      <svg aria-hidden="true" className="ltabs-defs">
        <defs>
          <filter id={gooId} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" />
          </filter>
        </defs>
      </svg>
      {/* the strip behind the inactive tabs, then the panel body and the liquid tab, merged */}
      <div aria-hidden="true" className="ltabs-strip" style={{ height: tabH + (page ? 10 : 20) }} />
      <div aria-hidden="true" className="ltabs-surface" style={page ? { height: tabH + PAGE_GOO } : undefined}>
        <div className="ltabs-goo" style={{ filter: `url(#${gooId})` }}>
          <div className="ltabs-body" style={{ top: tabH }} />
          {blob && <motion.div className="ltabs-blob" style={{ height: tabH + 18 }} initial={false} animate={{ x: blob.x, width: blob.w }} transition={blobSpring} />}
        </div>
      </div>
      {page && <div aria-hidden="true" className="ltabs-sheet" style={{ top: tabH + PAGE_SHEET }} />}

      <div role="tablist" aria-label={label} className="ltabs-bar" style={{ height: tabH }}>
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

      <motion.div className="ltabs-content" role="tabpanel" initial={false} animate={page ? undefined : { height }} transition={smooth}>
        <div ref={inner} className="ltabs-inner">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div key={active} custom={dir} variants={page ? pageVariants : panelVariants} initial="initial" animate="animate" exit="exit">
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
