import { useEffect, useState } from "react";
import { accent, useT } from "../i18n";
import { href, parse, type LearnTab } from "../lib/router";
import { IconBook, IconHeat } from "../ui/Icons";
import { LiquidTabs } from "../ui/LiquidTabs";
import { HeatPage } from "./HeatPage";
import { LearnPage } from "./LearnPage";

// "Aprende": the heat data and the lessons on one page, as two liquid tabs (Tulio: one entry in the
// menu, the same tab system as the layers box in the 3D view). The heat data is the main tab, the
// lessons the second. Each tab has its own address (#/learn/heat, #/learn/lessons) so links and the
// footer can open either; choosing a tab rewrites the address without adding a history step, and
// App plays no page transition between the two (they are one route).
export function LearnHub({ tab: initial }: { tab: LearnTab }) {
  const t = useT();
  const [tab, setTab] = useState<LearnTab>(initial);
  useEffect(() => setTab(initial), [initial]);
  // A link to the other tab while this page is open (the footer, a lesson): follow it.
  useEffect(() => {
    const on = () => {
      const r = parse(location.hash);
      if (r.page === "learn") setTab(r.tab);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const select = (id: string) => {
    const next = id as LearnTab;
    setTab(next);
    history.replaceState(null, "", next === "heat" ? href.heat : href.lessons);
  };
  return (
    <main className="page hub">
      <header className="page-head page-band-head">
        <p className="eyebrow">{t("hub.kicker")}</p>
        <h1>{accent(t("learn.title"))}</h1>
        <p className="standfirst">{t("hub.lead")}</p>
      </header>
      <LiquidTabs
        page
        label={t("nav.learn")}
        active={tab}
        onSelect={select}
        tabs={[
          { id: "heat", icon: <IconHeat />, label: t("nav.heat") },
          { id: "lessons", icon: <IconBook />, label: t("hub.lessons") },
        ]}
      >
        {tab === "heat" ? <HeatPage /> : <LearnPage />}
      </LiquidTabs>
    </main>
  );
}
