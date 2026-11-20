import { useEffect, useState } from "react";
import { accent, fmtDate, useL, useLang, useT } from "../i18n";
import { loadLatest } from "../lib/data";

type T2 = { es: string; en: string };

const CAVEATS: T2[] = [
  {
    es: "El estrés térmico es una señal regional: temperatura de la superficie del océano en celdas satelitales de 5 km, no una medición sobre un arrecife. El valor de cada isla es el promedio de las celdas dentro de un recuadro alrededor de ella.",
    en: "Heat stress is a regional signal: ocean surface temperature in 5 km satellite cells, not a measurement on a reef. Each island's value is the average of the cells inside a box around it.",
  },
  {
    es: "Calculamos el nivel de alerta solo con las semanas-grado de calentamiento (DHW). NOAA además exige que el agua esté al menos 1 °C sobre su límite ese día, así que nuestros niveles son una aproximación de los oficiales.",
    en: "We compute the alert level from degree heating weeks (DHW) alone. NOAA also requires the water to be at least 1 °C above its limit that day, so our levels approximate the official ones.",
  },
  {
    es: "Los hábitats del arrecife vienen de imágenes satelitales de 2018–2020 clasificadas por computadora. Su exactitud varía, “coral / algas” es una sola clase y solo cubren agua clara de hasta ~10–15 m.",
    en: "Reef habitats come from 2018–2020 satellite images classified by computer. Accuracy varies, “coral / algae” is a single class, and they only cover clear water down to ~10–15 m.",
  },
  {
    es: "La profundidad sobre el arrecife es batimetría estimada por satélite (hasta ~20 m), suavizada. Más afuera usamos GEBCO, con celdas de ~450 m, solo para unir el arrecife con el agua profunda. El relieve está exagerado. No es una carta de navegación.",
    en: "Depth over the reef is satellite-estimated bathymetry (down to ~20 m), smoothed. Farther out we use GEBCO, with ~450 m cells, only to join the reef to deep water. Relief is exaggerated. This is not a navigation chart.",
  },
  {
    es: "Los sitios de buceo están en la posición de sus boyas de amarre (precisión de 50–100 m).",
    en: "Dive sites are placed at their mooring buoys (accurate to 50–100 m).",
  },
];

const DATA: { name: string; what: T2; cite: string; license: string; url: string }[] = [
  {
    name: "NOAA Coral Reef Watch v3.1 (5 km)",
    what: { es: "Temperatura del mar y semanas-grado de calentamiento diarias desde 1985, vía ERDDAP (PacIOOS).", en: "Daily sea temperature and degree heating weeks since 1985, via ERDDAP (PacIOOS)." },
    cite: "NOAA Coral Reef Watch (2018, updated daily). Version 3.1 Daily Global 5 km Satellite Coral Bleaching Heat Stress Products. doi:10.25921/6jgr-pt28",
    license: "Public domain (US Government)",
    url: "https://coralreefwatch.noaa.gov/product/5km/index.php",
  },
  {
    name: "Allen Coral Atlas",
    what: { es: "Mapas de hábitats (bentónico y geomorfológico, v2.0, vía Google Earth Engine) y batimetría satelital de Roatán.", en: "Habitat maps (benthic and geomorphic, v2.0, via Google Earth Engine) and satellite bathymetry for Roatán." },
    cite: "Allen Coral Atlas (2020). Imagery, maps and monitoring of the world's tropical coral reefs. Zenodo. doi:10.5281/zenodo.3833242. Maps and bathymetry © 2020 Allen Coral Atlas Partnership and Vulcan, Inc. Bathymetry: Li et al. (2021), Remote Sensing 13(8):1469.",
    license: "CC BY 4.0",
    url: "https://allencoralatlas.org/",
  },
  {
    name: "Copernicus DEM GLO-30 (2024)",
    what: { es: "Relieve de la isla, 30 m, vía Google Earth Engine.", en: "Island relief, 30 m, via Google Earth Engine." },
    cite: "Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.",
    license: "Copernicus DEM license (free use with attribution)",
    url: "https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM",
  },
  {
    name: "GEBCO 2023 Grid",
    what: { es: "Profundidad del océano abierto (~450 m), vía el catálogo comunitario de Earth Engine.", en: "Open-ocean depth (~450 m), via the Earth Engine community catalog." },
    cite: "GEBCO Compilation Group (2023). GEBCO 2023 Grid. doi:10.5285/f98b053b-0cbc-6c23-e053-6c86abc0af7b",
    license: "Public domain with attribution",
    url: "https://www.gebco.net/",
  },
  {
    name: "OpenStreetMap",
    what: { es: "Contornos de las islas.", en: "Island outlines." },
    cite: "© OpenStreetMap contributors",
    license: "ODbL 1.0",
    url: "https://www.openstreetmap.org/copyright",
  },
  {
    name: "Healthy Reefs for Healthy People · Roatán Marine Park · IUCN · Truc et al. (2023)",
    what: { es: "Datos de campo y hechos citados en las historias y explicaciones (cada uno con su enlace).", en: "Field data and facts cited in the stories and explainers (each with its link)." },
    cite: "See the sources listed under each story and lesson.",
    license: "—",
    url: "https://www.healthyreefs.org/",
  },
];

export function AboutPage() {
  const t = useT();
  const L = useL();
  const lang = useLang((s) => s.lang);
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => {
    loadLatest().then((l) => setDate(l.date)).catch(() => {});
  }, []);
  return (
    <main className="page">
      <header className="page-head page-band-head">
        <p className="eyebrow">{t("about.kicker")}</p>
        <h1>{accent(t("about.title"))}</h1>
        <p className="standfirst">{t("about.lead")}</p>
      </header>

      <section className="section">
        <div className="section-head">
          <h2>{accent(t("about.caveatsTitle"))}</h2>
        </div>
        <ol className="caveats">
          {CAVEATS.map((c, i) => (
            <li key={i}>{L(c)}</li>
          ))}
        </ol>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{accent(t("about.dataTitle"))}</h2>
          {date && <p>{t("home.dataThrough")} {fmtDate(date, lang)}.</p>}
        </div>
        <div className="def-list">
          {DATA.map((d) => (
            <div className="def" key={d.name}>
              <h3>
                <a href={d.url} target="_blank" rel="noreferrer">
                  {d.name}
                </a>
              </h3>
              <div>
                <p>{L(d.what)}</p>
                <p className="cite">{d.cite}</p>
                <p className="lic">{t("about.license")}: {d.license}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{accent(t("about.softwareTitle"))}</h2>
        </div>
        <p className="measure muted">
          three.js, React, React Three Fiber, drei, zustand, drawille-canvas, Vite (MIT). Inter, Instrument Serif, IBM Plex Mono (SIL Open Font License). Google Earth Engine (noncommercial use). Python: xarray, rasterio, NumPy, SciPy. ReefQuest © 2026, MIT License.
        </p>
      </section>
    </main>
  );
}
