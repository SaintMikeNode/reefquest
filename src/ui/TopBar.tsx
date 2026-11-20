import { useState } from "react";
import { useT } from "../i18n";
import { href, type Route } from "../lib/router";
import { LangToggle } from "./LangToggle";
import { Logo } from "./Logo";

export function TopBar({ route }: { route: Route }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const links: [string, string, boolean][] = [
    [href.home, t("nav.home"), route.page === "home" || route.page === "island"],
    [href.heat, t("nav.heat"), route.page === "heat"],
    [href.learn, t("nav.learn"), route.page === "learn"],
    [href.about, t("nav.about"), route.page === "about"],
  ];
  return (
    <header className="site-header">
      <div className="inner">
        <a className="wordmark" href={href.home}>
          <Logo color="#ffffff" accent="#5fd0d6" />
          <b>ReefQuest</b>
          <span>{t("app.tagline")}</span>
        </a>
        <button className="menu-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          {t("nav.menu")}
        </button>
        <nav className={open ? "site-nav open" : "site-nav"} onClick={() => setOpen(false)}>
          {links.map(([h, label, on]) => (
            <a key={h} href={h} aria-current={on ? "page" : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <LangToggle />
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
