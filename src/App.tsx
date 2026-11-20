import { lazy, Suspense } from "react";
import { useT } from "./i18n";
import { SCENE_ISLANDS } from "./lib/islands";
import { useRoute } from "./lib/router";
import { Home } from "./pages/Home";
import { Footer, TopBar } from "./ui/TopBar";
import { HAS_WEBGL } from "./webgl";

// The first screen (map + island status) needs no 3D engine. three.js / R3F and each page load
// only when visited.
const IslandScene = lazy(() => import("./scenes/IslandScene"));
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

export function App() {
  const route = useRoute();
  const t = useT();

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
        {route.page === "heat" ? <HeatPage /> : route.page === "learn" ? <LearnPage /> : route.page === "about" ? <AboutPage /> : <Home />}
      </Suspense>
      <Footer />
    </>
  );
}
