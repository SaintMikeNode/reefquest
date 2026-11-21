import { useState } from "react";
import { useT } from "../i18n";
import { href, type Route } from "../lib/router";
import { LangToggle } from "./LangToggle";
import { HAS_WEBGL } from "../webgl";
import { Credit } from "./Credit";
import { Logo } from "./Logo";
import { SpecularButton } from "./SpecularButton";

export function TopBar({ route }: { route: Route }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const links: [string, string, boolean][] = [
    [href.home, t("nav.home"), route.page === "home" || route.page === "island" || route.page === "islands"],
    [href.heat, t("nav.heat"), route.page === "heat"],
    [href.learn, t("nav.learn"), route.page === "learn"],
    [href.about, t("nav.about"), route.page === "about"],
  ];
  // On the home page the bar sits inside the illustrated hero frame.
  return (
    <header className={route.page === "home" ? "site-header on-hero" : "site-header"}>
      <div className="inner">
        <a className="wordmark" href={href.home}>
          <Logo color="#ffffff" accent="#bfe0ff" />
          <b>ReefQuest</b>
        </a>
        <nav className={open ? "site-nav open" : "site-nav"} onClick={() => setOpen(false)}>
          {links.map(([h, label, on]) => (
            <a key={h} href={h} aria-current={on ? "page" : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-end">
          <LangToggle />
          {HAS_WEBGL && (
            <SpecularButton href={href.islands} className="btn light cta" lineColor="#2f86ff" baseColor="#9cc6ff">
              {t("nav.cta")}
            </SpecularButton>
          )}
          <button className="menu-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            {t("nav.menu")}
          </button>
        </div>
      </div>
    </header>
  );
}

/** Footer: who it is for (left), every page (middle), the project (right), then the sources. */
export function Footer() {
  const t = useT();
  const pages: [string, string][] = [
    [href.home, t("nav.home")],
    [href.islands, t("nav.islands")],
    [href.heat, t("nav.heat")],
    [href.learn, t("nav.learn")],
    [href.about, t("nav.about")],
  ];
  return (
    <footer className="site-footer">
      <div className="footer-glow" aria-hidden="true" />
      <div className="inner footer-grid">
        <div className="footer-brand">
          <a className="wordmark" href={href.home}>
            <Logo color="#ffffff" accent="#bfe0ff" />
            <b>ReefQuest</b>
          </a>
          <p>{t("footer.made")}</p>
          <p className="footer-free">{t("footer.free")}</p>
        </div>
        <nav className="footer-col" aria-label={t("footer.explore")}>
          <h3>{t("footer.explore")}</h3>
          {pages.map(([h, label]) => (
            <a key={h} href={h}>
              {label}
            </a>
          ))}
        </nav>
        <div className="footer-col">
          <h3>{t("footer.project")}</h3>
          <Credit className="footer-credit" />
          <a href="https://github.com/saintmikenode/reefquest" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="https://nerdypunk.dev" target="_blank" rel="noreferrer">
            NerdyPunkDev
          </a>
        </div>
      </div>
      <div className="inner footer-bottom">
        <span>{t("footer.data")}</span>
        <span>{t("footer.license")}</span>
      </div>
    </footer>
  );
}
