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
    <header className="topbar">
      <a className="brand" href={href.home} aria-label="ReefQuest">
        <Logo />
        <span className="brand-name">
          Reef<b>Quest</b>
        </span>
      </a>
      <button className="btn ghost menu-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t("nav.menu")}
      </button>
      <nav className={open ? "nav open" : "nav"} onClick={() => setOpen(false)}>
        {links.map(([h, label, on]) => (
          <a key={h} href={h} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
            {label}
          </a>
        ))}
      </nav>
      <LangToggle />
    </header>
  );
}

export function Footer() {
  const t = useT();
  return (
    <footer className="footer">
      <span>{t("footer.made")}</span>
      <span className="mono">{t("footer.free")}</span>
    </footer>
  );
}
