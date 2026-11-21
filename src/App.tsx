import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useT } from "./i18n";
import { SCENE_ISLANDS } from "./lib/islands";
import { useRoute, type Route } from "./lib/router";
import { Home } from "./pages/Home";
import { Footer, TopBar } from "./ui/TopBar";
import { HAS_WEBGL } from "./webgl";
import { transition } from "./ui/SceneTransition";

// Island names on the transition curtain (proper nouns, the same in both languages).
const ISLAND_NAMES: Record<string, string> = { roatan: "Roatán", utila: "Utila", guanaja: "Guanaja", "cayos-cochinos": "Cayos Cochinos" };

// The first screen (map + island status) needs no 3D engine. three.js / R3F and each page load
// only when visited.
const IslandScene = lazy(() => import("./scenes/IslandScene"));
const IslandsPage = lazy(() => import("./pages/IslandsPage").then((m) => ({ default: m.IslandsPage })));
const HeatPage = lazy(() => import("./pages/HeatPage").then((m) => ({ default: m.HeatPage })));
const LearnPage = lazy(() => import("./pages/LearnPage").then((m) => ({ default: m.LearnPage })));
const AboutPage = lazy(() => import("./pages/AboutPage").then((m) => ({ default: m.AboutPage })));


function Loading() {
  const t = useT();
  return (
    <div className="loading-screen">
      <div className="box">
        <div>{t("scene.loading")}</div>
        <div className="bar">
          <i />
        </div>
      </div>
    </div>
  );
}

const routeKey = (r: Route) => (r.page === "island" ? `island:${r.id}` : r.page);

export function App() {
  const target = useRoute();
  const t = useT();

  // Every change of scene is animated (not the first load): the curtain closes over the current
  // scene, the route switches behind it, and it opens on the new one. An iris into an island,
  // a circle swoop between pages.
  const [route, setRoute] = useState(target);
  const key = routeKey(target);
  // The last route asked for: a change made while the curtain is still closing is compared with
  // where we are going, not with what is on screen (otherwise it was dropped and the earlier change
  // landed, leaving the page and the address out of step, so a click seemed lost).
  const wanted = useRef(key);
  useEffect(() => {
    if (key === wanted.current) return;
    wanted.current = key;
    const next = target;
    if (next.page === "island")
      transition({ kind: "island", label: ISLAND_NAMES[next.id] ?? next.id, sub: t("home.kicker"), apply: () => setRoute(next) });
    else
      transition({ kind: "page", label: t(next.page === "home" ? "nav.home" : `nav.${next.page}`), sub: "ReefQuest", apply: () => setRoute(next) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (route.page === "island" && SCENE_ISLANDS.has(route.id)) {
    if (!HAS_WEBGL)
      return (
        <>
          <TopBar route={route} />
          <main className="page">
            <div className="page-head">
              <p>{t("scene.noWebgl")}</p>
            </div>
          </main>
        </>
      );
    return (
      <Suspense fallback={<Loading />}>
        <IslandScene island={route.id} />
      </Suspense>
    );
  }

  return (
    <>
      <TopBar route={route} />
      <Suspense fallback={<Loading />}>
        {route.page === "islands" ? (
          <IslandsPage />
        ) : route.page === "home" ? (
          <Home />
        ) : (
          // Inner pages sit on the same dotted navy sea as the landing page.
          <div className="sea-bg">{route.page === "heat" ? <HeatPage /> : route.page === "learn" ? <LearnPage /> : <AboutPage />}</div>
        )}
      </Suspense>
      <Footer />
    </>
  );
}
