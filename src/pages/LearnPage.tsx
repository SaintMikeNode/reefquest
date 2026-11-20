import { LESSONS } from "../content/learn";
import { useL, useT } from "../i18n";

export function LearnPage() {
  const t = useT();
  const L = useL();
  return (
    <main className="page">
      <header className="page-head">
        <div className="label">{t("learn.kicker")}</div>
        <h1>{t("learn.title")}</h1>
        <p>{t("learn.lead")}</p>
      </header>
      <div className="learn-grid">
        {LESSONS.map((l, i) => (
          <article className="panel learn-card" key={l.id} id={l.id}>
            <div className="label">
              {String(i + 1).padStart(2, "0")} · {L(l.kicker)}
            </div>
            <h3>{L(l.title)}</h3>
            {L(l.body).map((p, k) => (
              <p key={k}>{p}</p>
            ))}
            <div className="src">
              {l.sources.map((s, k) => (
                <span key={s.url}>
                  {k > 0 && " · "}
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
