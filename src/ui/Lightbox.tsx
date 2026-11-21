import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useL, useT } from "../i18n";
import type { Photo } from "../lib/data";
import { IconArrow, IconClose } from "./Icons";
import { PhotoCredit } from "./PhotoStrip";

/**
 * A photo opened full screen: dark blurred backdrop, the photo zooming up from the middle, its
 * caption and credit, and the place's other photos a swipe or an arrow key away. Escape, a tap
 * outside or the close button closes it (with a short fade). CSS animations only.
 */
export function Lightbox({ photos, start, onClose }: { photos: Photo[]; start: number; onClose: () => void }) {
  const t = useT();
  const L = useL();
  const [i, setI] = useState(start);
  const [closing, setClosing] = useState(false);
  const swipe = useRef<number | null>(null);
  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 200);
  };
  const step = (d: number) => setI((k) => (k + d + photos.length) % photos.length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const p = photos[i];
  const where = p.here ? t("photos.here") : t("photos.from").replace("{where}", p.where ? L(p.where) : "Roatán");
  return createPortal(
    <div
      className={closing ? "lightbox closing" : "lightbox"}
      role="dialog"
      aria-modal="true"
      aria-label={L(p.name)}
      onClick={(e) => e.target === e.currentTarget && close()}
      onPointerDown={(e) => (swipe.current = e.clientX)}
      onPointerUp={(e) => {
        if (swipe.current === null) return;
        const dx = e.clientX - swipe.current;
        swipe.current = null;
        if (Math.abs(dx) > 50 && photos.length > 1) step(dx < 0 ? 1 : -1);
      }}
    >
      <figure className="lb-figure">
        <img key={p.id} src={p.src.m} alt={L(p.name)} draggable={false} />
        <figcaption>
          <span className="ps-name">
            <b>{L(p.name)}</b>
            {p.sci && p.sci !== L(p.name) && <i> {p.sci}</i>}
          </span>
          <span className="ps-where">{where}</span>
          <PhotoCredit p={p} />
        </figcaption>
      </figure>
      {photos.length > 1 && (
        <>
          <button className="lb-nav prev" onClick={() => step(-1)} aria-label="←">
            <IconArrow />
          </button>
          <button className="lb-nav next" onClick={() => step(1)} aria-label="→">
            <IconArrow />
          </button>
          <span className="lb-count num">
            {i + 1} / {photos.length}
          </span>
        </>
      )}
      <button className="lb-close" onClick={close} aria-label={t("scene.close")}>
        <IconClose />
      </button>
    </div>,
    document.body,
  );
}
