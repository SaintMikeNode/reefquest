import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLang, useT } from "../i18n";
import { lockScroll } from "../lib/scrollLock";
import { IconClose } from "./Icons";

/**
 * The one-minute demo of ReefQuest, in a floating window over the landing page (Tulio's call).
 * Nothing of it loads until someone presses "Watch the demo": this component is its own lazy
 * chunk, and the video and its poster are only requested once the window opens. The video is in
 * the site's language (Spanish or English), made for the web from Tulio's 1080p recordings, every
 * file with fast start so it plays while it downloads: phones and slow connections get 720p
 * H.264 (~6 MB; many phones can't decode AV1 smoothly); computers get 1080p AV1 (much smaller at
 * the same quality) or, where the browser can't play AV1, 1080p H.264. The browser takes the
 * first <source> it can play. It starts playing at once (the press allows sound; if a browser
 * still blocks it, the controls are there). Escape, the close button or a click outside closes it,
 * which stops the download. CSS animations only (the landing page carries no Motion).
 */
export default function DemoVideo({ onClose }: { onClose: () => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [closing, setClosing] = useState(false);
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // The tail of the press that opened the window (a touch tap's click arrives after the window
  // is on screen) must not close it.
  const born = useRef(performance.now());

  const small = (() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    return window.matchMedia("(max-width: 900px)").matches || !!conn?.saveData || /2g|3g/.test(conn?.effectiveType ?? "");
  })();
  const base = `/video/demo-${lang}`;
  const sources = small
    ? [{ src: `${base}-720.mp4`, type: "video/mp4" }]
    : [
        { src: `${base}-1080-av1.mp4`, type: 'video/mp4; codecs="av01.0.08M.08, mp4a.40.2"' },
        { src: `${base}-1080.mp4`, type: "video/mp4" },
      ];

  const close = () => {
    if (closing) return;
    video.current?.pause();
    setClosing(true);
    setTimeout(onClose, 200);
  };
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    addEventListener("keydown", onKey);
    const release = lockScroll();
    closeRef.current?.focus({ preventScroll: true });
    video.current?.play().catch(() => {
      /* blocked: the controls are on screen */
    });
    return () => {
      removeEventListener("keydown", onKey);
      release();
      before?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      className={closing ? "demo-modal closing" : "demo-modal"}
      role="dialog"
      aria-modal="true"
      aria-label={t("demo.title")}
      onClick={(e) => {
        if (e.target === e.currentTarget && performance.now() - born.current > 400) close();
      }}
    >
      <div className="demo-window">
        <div className="demo-head">
          <span className="demo-title">{t("demo.title")}</span>
          <button ref={closeRef} type="button" className="demo-close" onClick={close} aria-label={t("demo.close")} title={t("demo.close")}>
            <IconClose />
          </button>
        </div>
        <div className="demo-frame">
          {failed ? (
            <p className="demo-error">{t("demo.error")}</p>
          ) : (
            <video ref={video} key={lang} poster={`/video/poster-${lang}.jpg`} controls playsInline preload="auto">
              {sources.map((v, i) => (
                // The last source failing means none could play.
                <source key={v.src} src={v.src} type={v.type} onError={i === sources.length - 1 ? () => setFailed(true) : undefined} />
              ))}
            </video>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
