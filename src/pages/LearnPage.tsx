import type { ReactElement } from "react";
import { LESSONS } from "../content/learn";
import { accent, useL, useT } from "../i18n";
import { BleachingFigure, DhwFigure } from "../ui/LessonFigures";

const FIGURES: Record<string, () => ReactElement> = { bleaching: BleachingFigure, dhw: DhwFigure };

export function LearnPage() {
  const t = useT();
  const L = useL();
  return (
    <main className="page">
      <header className="page-head page-band-head">
        <p className="eyebrow">{t("learn.kicker")}</p>
        <h1>{accent(t("learn.title"))}</h1>
        <p className="standfirst">{t("learn.lead")}</p>
      </header>
      <div className="article">
        {LESSONS.map((l, i) => (
          <article className="lesson" key={l.id} id={l.id}>
            <div className="meta">
              <span className="n">{i + 1}</span>
              {L(l.kicker)}
            </div>
            <div>
              <h2>{L(l.title)}</h2>
              {L(l.body).map((p, k) => (
                <p key={k}>{p}</p>
              ))}
              {FIGURES[l.id] && FIGURES[l.id]()}
              <p className="sources">
                {t("scene.sources")}:{" "}
                {l.sources.map((s, k) => (
                  <span key={s.url}>
                    {k > 0 && "; "}
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.label}
                    </a>
                  </span>
                ))}
              </p>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
