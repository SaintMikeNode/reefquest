import { useState } from "react";
import { useT } from "../i18n";
import { href, type Route } from "../lib/router";
import { LangToggle } from "./LangToggle";
import { HAS_WEBGL } from "../webgl";
import { Logo } from "./Logo";

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
            <a className="btn light cta" href={href.islands}>
              {t("nav.cta")}
            </a>
          )}
          <button className="menu-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            {t("nav.menu")}
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const t = useT();
  return (
    <footer className="site-footer">
      <div className="inner">
        <span>{t("footer.made")}</span>
        <span>{t("footer.free")}</span>
      </div>
    </footer>
  );
}
