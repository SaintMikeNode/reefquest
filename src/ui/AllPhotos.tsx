import { lazy, Suspense, useState } from "react";
import { useT } from "../i18n";
import type { Photo, PhotoIndex } from "../lib/data";
import { IconCamera } from "./Icons";
import { usePhotos } from "./PhotoStrip";

const DomeGallery = lazy(() => import("./DomeGallery"));

/** Every photo once (places first, then the field guide). */
export function allPhotos(index: PhotoIndex): Photo[] {
  const seen = new Map<string, Photo>();
  for (const p of [...Object.values(index.places).flat(), ...Object.values(index.species)]) if (!seen.has(p.id)) seen.set(p.id, p);
  return [...seen.values()];
}

/** "See all the photos": opens the dome of every photo (loaded only when pressed). */
export function AllPhotosButton({ className = "btn light" }: { className?: string }) {
  const t = useT();
  const index = usePhotos();
  const [open, setOpen] = useState(false);
  if (!index) return null;
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        <IconCamera /> {t("photos.all")}
      </button>
      {open && (
        <Suspense fallback={null}>
          <DomeGallery photos={allPhotos(index)} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
