// Dive sites shown as pins in the island scenes. Every story fact carries a source.
// Coordinates: Roatán Marine Park mooring inventory ("RMP dive sites", republished on
// roatan.day, stated accuracy 50–100 m) unless noted. Moorings are buoys, not exact reef features.

export interface Source {
  label: string;
  url: string;
}
export interface Site {
  id: string;
  island: string;
  name: string;
  lat: number;
  lon: number;
  approx?: boolean; // location only roughly known
  kind: "story" | "dive";
  depth_m?: number;
  title?: { es: string; en: string };
  body?: { es: string[]; en: string[] };
  /** Optional DHW date to jump the timeline to when the site is opened. */
  date?: string;
  sources: Source[];
}

const RMP_MOORINGS: Source = { label: "Roatán Marine Park, dive-site moorings (via roatan.day)", url: "https://roatan.day/en/interactive-dive-sites-map/" };
const TRUC_2023: Source = {
  label: "Truc et al. (2023), Frontiers in Marine Science 10",
  url: "https://www.frontiersin.org/articles/10.3389/fmars.2023.1197318/full",
};
const HRHP_PRESS_2024: Source = {
  label: "Healthy Reefs for Healthy People, 2024 Report Card press release",
  url: "https://cdn.prod.website-files.com/66b16833c7877e9078babf9d/6720d8ca79940fb3a840e0d7_Final%202024%20RC%20Press%20Release.pdf",
};
const MCFIELD_2025: Source = { label: "McField & Muñiz (2025), One Ocean Science Congress abstract", url: "https://meetingorganizer.copernicus.org/OOS2025/OOS2025-1536.html" };
const HRHP_CARD_2024: Source = {
  label: "Healthy Reefs for Healthy People, 2024 Report Card",
  url: "https://cdn.prod.website-files.com/66b16833c7877e9078babf9d/67361e479ff8ca23dc49ebf7_2024%20Report%20Card%20-website%20version.pdf",
};
const SKETCHFAB_PILLAR: Source = { label: "Pillar coral with SCTLD, West End (3D model, Sketchfab)", url: "https://sketchfab.com/3d-models/pillar-coral-sctld-dendrogyra-cylindricus-9bffdf5527ef44efbc388aff747de9b2" };
const CANTY_2021: Source = { label: "Canty et al. (2021), Scientific Reports 11:3523", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7876111/" };
const IUCN_2022: Source = { label: "IUCN Red List update, 9 Dec 2022", url: "https://iucn.org/press-release/202212/human-activity-devastating-marine-species-mammals-corals-iucn-red-list" };
const REEFSMART_AGUILA: Source = { label: "Reef Smart Guides: El Aguila", url: "https://reefsmartguides.com/el-aguila/" };

export const SITES: Site[] = [
  {
    id: "flowers-bay",
    island: "roatan",
    name: "Flowers Bay",
    lat: 16.28725,
    lon: -86.575223,
    kind: "story",
    title: { es: "Aquí llegó una enfermedad nueva", en: "Where a new disease arrived" },
    body: {
      es: [
        "El 24 de septiembre de 2020, buzos registraron aquí el primer caso en Honduras de la enfermedad de pérdida de tejido de corales duros (SCTLD, por sus siglas en inglés). La enfermedad mata el tejido vivo del coral y deja el esqueleto blanco.",
        "Se extendió rápido: en promedio unos 155 metros por día alrededor de Roatán y Utila. En la costa norte de Roatán avanzó unos 229 m al día y en la costa sur unos 90 m al día.",
        "Para noviembre de 2021 ya había afectado al menos 28 especies de coral en más de 40 sitios de arrecife.",
      ],
      en: [
        "On September 24, 2020, divers recorded here Honduras's first case of stony coral tissue loss disease (SCTLD). The disease kills the coral's living tissue and leaves the white skeleton behind.",
        "It spread fast: about 155 meters per day on average around Roatán and Utila. On Roatán's north coast it moved about 229 m a day, and about 90 m a day on the south coast.",
        "By November 2021 it had affected at least 28 coral species at more than 40 reef sites.",
      ],
    },
    sources: [TRUC_2023],
  },
  {
    id: "cordelia-banks",
    island: "roatan",
    name: "Cordelia Banks",
    lat: 16.3,
    lon: -86.52,
    approx: true,
    kind: "story",
    date: "2023-10-31",
    title: { es: "El verano que se perdió un arrecife", en: "The summer a reef was lost" },
    body: {
      es: [
        "Cordelia Banks, frente a la costa sur de Roatán, tenía muchísimo coral vivo: un 46 % del fondo en septiembre de 2023, cuando el promedio del Arrecife Mesoamericano rondaba el 17–19 %. En 2012 fue declarado Sitio de Importancia Especial para la Vida Silvestre.",
        "En 2023 el océano se calentó como nunca antes en el Arrecife Mesoamericano. Entre septiembre de 2023 y febrero de 2024, la cobertura de coral vivo en Cordelia Banks cayó del 46 % a solo el 5 %.",
        "La línea de tiempo saltó al 31 de octubre de 2023, cerca del pico de calor alrededor de Roatán: los cuadros muestran el calor acumulado sobre esta zona.",
      ],
      en: [
        "Cordelia Banks, off Roatán's south coast, had a lot of living coral: 46% of the bottom in September 2023, when the Mesoamerican Reef average was around 17–19%. In 2012 it was declared a Site of Special Importance for Wildlife.",
        "In 2023 the ocean around the Mesoamerican Reef heated up like never before. Between September 2023 and February 2024, live coral cover at Cordelia Banks fell from 46% to just 5%.",
        "The timeline jumped to October 31, 2023, near the heat peak around Roatán: the squares show the heat that had built up over this area.",
      ],
    },
    sources: [HRHP_PRESS_2024, MCFIELD_2025, CANTY_2021, HRHP_CARD_2024],
  },
  {
    id: "pillar-coral",
    island: "roatan",
    name: "West End",
    lat: 16.3047352,
    lon: -86.5976975,
    approx: true,
    kind: "story",
    title: { es: "El coral pilar, en peligro crítico", en: "Pillar coral, critically endangered" },
    body: {
      es: [
        "El coral pilar crece en columnas verticales, como dedos que salen del fondo. Hay colonias en los arrecifes de West End, algunas ya afectadas por la enfermedad SCTLD.",
        "En 2022, la UICN lo pasó de Vulnerable a En Peligro Crítico: su población cayó más de un 80 % en la mayor parte de su área desde 1990. La amenaza más urgente es la enfermedad SCTLD.",
      ],
      en: [
        "Pillar coral grows in upright columns, like fingers rising from the seafloor. There are colonies on West End's reefs, some already hit by SCTLD.",
        "In 2022, the IUCN moved it from Vulnerable to Critically Endangered: its population fell by more than 80% across most of its range since 1990. The most urgent threat is SCTLD.",
      ],
    },
    sources: [IUCN_2022, SKETCHFAB_PILLAR],
  },
  {
    id: "el-aguila",
    island: "roatan",
    name: "El Aguila",
    lat: 16.3275054,
    lon: -86.5790357,
    kind: "story",
    depth_m: 33,
    title: { es: "Un barco que se volvió arrecife", en: "A ship that became a reef" },
    body: {
      es: [
        "El Aguila es un barco de carga hundido frente a Sandy Bay, a unos 33 metros (110 pies) de profundidad.",
        "Los naufragios dan a corales, esponjas y peces una superficie dura donde vivir. Por eso muchos buzos lo visitan.",
      ],
      en: [
        "El Aguila is a cargo ship sunk off Sandy Bay, at about 33 meters (110 feet) deep.",
        "Wrecks give corals, sponges and fish a hard surface to live on. That's why many divers visit it.",
      ],
    },
    sources: [REEFSMART_AGUILA, RMP_MOORINGS],
  },
  { id: "deep-seaquest", island: "roatan", name: "Deep Seaquest", lat: 16.28713, lon: -86.60368, kind: "dive", depth_m: 12, sources: [RMP_MOORINGS] },
  { id: "chiefs-quarters", island: "roatan", name: "Chief's Quarters", lat: 16.2943301, lon: -86.6021079, kind: "dive", sources: [RMP_MOORINGS] },
  { id: "hole-in-the-wall", island: "roatan", name: "Hole in the Wall", lat: 16.3138371, lon: -86.5917933, kind: "dive", sources: [RMP_MOORINGS] },
  { id: "spooky-channel", island: "roatan", name: "Spooky Channel", lat: 16.3393987, lon: -86.5644513, kind: "dive", sources: [RMP_MOORINGS] },
  { id: "marys-place", island: "roatan", name: "Mary's Place", lat: 16.3376598, lon: -86.4685934, kind: "dive", depth_m: 9, sources: [RMP_MOORINGS] },
];
