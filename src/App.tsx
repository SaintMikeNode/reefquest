import { lazy, Suspense, useState } from "react";
import { ArchipelagoMenu } from "./ui/ArchipelagoMenu";
import { LangToggle } from "./ui/LangToggle";
import { useT } from "./i18n";
import type { IslandId } from "./data/islands";
import { HAS_WEBGL } from "./webgl";

// The 3D engine (three + R3F) and each island scene load only when an island is opened, so the
// first view stays small on phones.
const IslandScene = lazy(() => import("./scenes/IslandScene"));

export function App() {
  const t = useT();
  const [island, setIsland] = useState<IslandId | null>(null);

  if (island && HAS_WEBGL) {
    return (
      <Suspense fallback={<div className="loading">{t("scene.loading")}</div>}>
        <IslandScene island={island} onBack={() => setIsland(null)} />
      </Suspense>
    );
  }

  return (
    <div className="page">
      <header className="top">
        <div>
          <h1>ReefQuest</h1>
          <p className="tagline">{t("app.tagline")}</p>
        </div>
        <LangToggle />
      </header>
      <main>
        {!HAS_WEBGL && (
          <div className="notice">
            <strong>{t("nowebgl.title")}</strong>
            <p>{t("nowebgl.body")}</p>
          </div>
        )}
        <p className="prompt">{t("menu.prompt")}</p>
        <ArchipelagoMenu onOpen={setIsland} />
      </main>
      <footer className="foot">{t("footer.credits")}</footer>
    </div>
  );
}
