import { useEffect, useState } from "react";
import { useL, useT } from "../i18n";
import { loadPhotos, type Photo, type PhotoIndex } from "../lib/data";
import { CurveCarousel } from "./CurveCarousel";
import { Lightbox } from "./Lightbox";

/** The photo index (loaded once, on the first card that needs it). */
export function usePhotos(): PhotoIndex | null {
  const [index, setIndex] = useState<PhotoIndex | null>(null);
  useEffect(() => {
    let live = true;
    loadPhotos()
      .then((p) => live && setIndex(p))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return index;
}

/** The credit line a photo's license asks for: author, license (linked) and source (linked). */
export function PhotoCredit({ p }: { p: Photo }) {
  return (
    <span className="photo-credit">
      {p.credit} ·{" "}
      <a href={p.licenseUrl || p.source} target="_blank" rel="noreferrer">
        {p.license}
      </a>{" "}
      ·{" "}
      <a href={p.source} target="_blank" rel="noreferrer">
        {p.via}
      </a>
    </span>
  );
}

/**
 * Photos of a place: a curved carousel (drag, swipe or arrow keys; the middle photo opens full
 * screen), and a caption with the species, whether it was taken here, and the credit.
 */
export function PhotoStrip({ photos }: { photos: Photo[] }) {
  const t = useT();
  const L = useL();
  const [i, setI] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => setI(0), [photos]);
  const p = photos[Math.min(i, photos.length - 1)];
  if (!p) return null;
  const where = p.here ? t("photos.here") : t("photos.from").replace("{where}", p.where ? L(p.where) : "Roatán");
  return (
    <figure className="photo-strip">
      {photos.length > 1 ? (
        <CurveCarousel photos={photos} index={i} onIndex={setI} onOpen={setOpen} label={t("photos.title")} prevLabel={t("photos.prev")} nextLabel={t("photos.next")} />
      ) : (
        <button className="ps-single" onClick={() => setOpen(0)}>
          <img src={p.src.m} alt={L(p.name)} loading="lazy" decoding="async" />
        </button>
      )}
      <figcaption key={p.id} className="ps-caption">
        <span className="ps-name">
          <b>{L(p.name)}</b>
          {p.sci && p.sci !== L(p.name) && <i> {p.sci}</i>}
        </span>
        <span className="ps-where">
          {where}
          {photos.length > 1 && <span className="ps-count num"> · {i + 1}/{photos.length}</span>}
        </span>
        <PhotoCredit p={p} />
      </figcaption>
      {open !== null && <Lightbox photos={photos} start={open} onClose={() => setOpen(null)} />}
    </figure>
  );
}
