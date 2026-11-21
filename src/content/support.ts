// Organizations that work for the reefs of the Bay Islands, for the "Cómo ayudar" page (Spanish
// first). Every statement comes from the organization's own website (or, where noted, a partner's),
// read on the date below; the page links out and ReefQuest never handles donations.
// Only organizations with a working website are listed (Tulio). Checked and left out: Roatán
// Institute for Marine Sciences (part of a resort, no nonprofit statement), Kanahau (its projects
// are on land), ProTECTOR (site under construction), Utila Coral Foundation (no reachable site),
// Centro de Estudios Marinos (its site describes mainland work only).
import type { Source } from "./sites";

/** When the organizations' websites were read. Update it when the entries are re-checked. */
export const SUPPORT_CHECKED = "2026-11-20";

export type Place = "roatan" | "utila" | "guanaja" | "cayos-cochinos" | "all";

export interface OrgLink {
  kind: "site" | "donate" | "volunteer" | "support";
  url: string;
}

export interface Org {
  id: string;
  name: string;
  place: Place;
  kind: { es: string; en: string };
  about: { es: string; en: string };
  does: { es: string[]; en: string[] };
  support: { es: string; en: string };
  links: OrgLink[];
  sources: Source[];
}

const BICA_DONATE = "https://www.bicainc.org/donate";
const BICA_ABOUT: Source = { label: "BICA, About us", url: "https://www.bicainc.org/about-us" };
const CORAL_ROATAN: Source = { label: "Coral Reef Alliance, Roatán", url: "https://coral.org/where-we-work/western-caribbean/honduras/roatan/" };

export const ORGS: Org[] = [
  {
    id: "rmp",
    name: "Roatán Marine Park",
    place: "roatan",
    kind: { es: "Organización comunitaria sin fines de lucro", en: "Community-based nonprofit" },
    about: {
      es: "Cuida el área marina y costera de Roatán, dentro del Parque Nacional Marino Islas de la Bahía.",
      en: "Looks after Roatán's marine and coastal area, inside the Bay Islands National Marine Park.",
    },
    does: {
      es: [
        "Patrullajes de guardaparques junto a la Fuerza Naval para hacer cumplir las leyes ambientales.",
        "Boyas de amarre, marcadores de canal y zonas de nado: dice tener a su cargo más del 90 % de la infraestructura marina de Roatán.",
        "Restauración de coral con SECORE International.",
        "Educación, investigación y talleres de caza de pez león.",
      ],
      en: [
        "Ranger patrols with the Honduran Navy to enforce environmental laws.",
        "Mooring buoys, channel markers and swim zones: it says it is responsible for over 90% of Roatán's marine infrastructure.",
        "Coral restoration with SECORE International.",
        "Education, research and lionfish-hunting workshops.",
      ],
    },
    support: {
      es: "Donación en línea. Pasa por Roatan Marine Park International (EE. UU.) y solo es deducible de impuestos en EE. UU.; para donar desde Honduras, la organización pide escribirle.",
      en: "Online donation. It goes through Roatan Marine Park International (USA) and is tax-deductible only in the USA; to give from Honduras, the organization asks you to write to it.",
    },
    links: [
      { kind: "donate", url: "https://www.roatanmarinepark.org/donate" },
      { kind: "site", url: "https://www.roatanmarinepark.org/" },
    ],
    sources: [
      { label: "Roatán Marine Park, About us", url: "https://www.roatanmarinepark.org/about-us" },
      { label: "Roatán Marine Park, Donate", url: "https://www.roatanmarinepark.org/donate" },
    ],
  },
  {
    id: "bica-roatan",
    name: "BICA Roatán",
    place: "roatan",
    kind: { es: "Organización hondureña sin fines de lucro, fundada en 1990", en: "Honduran nonprofit, founded in 1990" },
    about: {
      es: "Bay Islands Conservation Association (BICA) tiene capítulos en Roatán, Utila y Guanaja.",
      en: "The Bay Islands Conservation Association (BICA) has chapters on Roatán, Utila and Guanaja.",
    },
    does: {
      es: [
        "Vivero de coral desde 2018 en la zona protegida Sandy Bay–West End, con monitoreo mensual.",
        "Laboratorio de calidad de agua; según Coral Reef Alliance, el primero y único de las Islas de la Bahía.",
        "Monitoreo de arrecifes, tortugas marinas, manglares y pastos marinos.",
        "Educación ambiental.",
      ],
      en: [
        "Coral nursery since 2018 in the Sandy Bay–West End protected zone, monitored every month.",
        "Water quality laboratory; according to the Coral Reef Alliance, the first and only one in the Bay Islands.",
        "Monitoring of reefs, sea turtles, mangroves and seagrass.",
        "Environmental education.",
      ],
    },
    support: {
      es: "Donación en línea, única o mensual. Para ser voluntario en monitoreo y restauración de arrecifes, la organización pide escribirle.",
      en: "Online donation, one-time or monthly. To volunteer in reef monitoring and restoration, the organization asks you to write to it.",
    },
    links: [
      { kind: "donate", url: BICA_DONATE },
      { kind: "site", url: "https://www.bicainc.org/" },
    ],
    sources: [BICA_ABOUT, { label: "BICA Roatán, coral restoration", url: "https://www.bicainc.org/bica-roatan-coral-restoration" }, CORAL_ROATAN],
  },
  {
    id: "bica-utila",
    name: "BICA Utila",
    place: "utila",
    kind: { es: "Capítulo de BICA en Utila", en: "BICA's Utila chapter" },
    about: {
      es: "Comaneja con el ICF las áreas protegidas marinas y terrestres de las Islas de la Bahía (convenio desde 1994, según su sitio).",
      en: "Co-manages the Bay Islands' marine and land protected areas with ICF, Honduras's forest and protected-areas institute (an agreement since 1994, according to its site).",
    },
    does: {
      es: [
        "Monitoreo y tratamiento de la enfermedad de pérdida de tejido de corales duros (SCTLD) en 10 sitios: 412 colonias tratadas y marcadas.",
        "Calidad de agua cada mes desde 2015, en 10 sitios de la costa sur.",
        "Monitoreo del desove de cinco especies de coral.",
        "Educación ambiental para unos 700 niños al año en ocho escuelas.",
      ],
      en: [
        "Monitoring and treatment of stony coral tissue loss disease (SCTLD) at 10 sites: 412 colonies treated and tagged.",
        "Water quality every month since 2015, at 10 sites on the south shore.",
        "Spawning monitoring of five coral species.",
        "Environmental education for about 700 children a year in eight schools.",
      ],
    },
    support: { es: "Donación en línea a BICA, única o mensual.", en: "Online donation to BICA, one-time or monthly." },
    links: [
      { kind: "donate", url: BICA_DONATE },
      { kind: "site", url: "https://www.bicainc.org/about-bica-utila" },
    ],
    sources: [
      { label: "BICA Utila, About", url: "https://www.bicainc.org/about-bica-utila" },
      { label: "BICA Utila, research and monitoring", url: "https://www.bicainc.org/bica-utila-research" },
      { label: "BICA Utila, environmental education", url: "https://www.bicainc.org/bica-utila-education" },
    ],
  },
  {
    id: "wsorc",
    name: "Whale Shark & Oceanic Research Center",
    place: "utila",
    kind: { es: "Organización sin fines de lucro registrada en Honduras, según su sitio", en: "Registered Honduran nonprofit, according to its site" },
    about: {
      es: "Centro de investigación del tiburón ballena en Utila.",
      en: "Whale shark research center on Utila.",
    },
    does: {
      es: [
        "Base de datos de avistamientos de tiburón ballena, con registros desde 1997.",
        "Vivero de coral, con trasplantes a los arrecifes de Utila.",
        "Charlas en escuelas y pasantías de conservación marina.",
      ],
      en: [
        "Whale shark sightings database, with records since 1997.",
        "Coral nursery, with corals planted out on Utila's reefs.",
        "School outreach and marine conservation internships.",
      ],
    },
    support: {
      es: "Donación por PayPal a través de Bay Islands College of Diving, una escuela de buceo que el centro describe como su organización hermana. También ofrece pasantías.",
      en: "PayPal donation through Bay Islands College of Diving, a dive school the center describes as its sister organization. It also offers internships.",
    },
    links: [
      { kind: "support", url: "https://www.wsorc.org/about" },
      { kind: "site", url: "https://www.wsorc.org/" },
    ],
    sources: [{ label: "WSORC, About", url: "https://www.wsorc.org/about" }],
  },
  {
    id: "bica-guanaja",
    name: "BICA Guanaja",
    place: "guanaja",
    kind: { es: "Capítulo de BICA en Guanaja", en: "BICA's Guanaja chapter" },
    about: {
      es: "Trabaja con las comunidades de Guanaja dentro del Parque Nacional Marino Islas de la Bahía.",
      en: "Works with Guanaja's communities inside the Bay Islands National Marine Park.",
    },
    does: {
      es: [
        "Viveros de coral en el mar y trasplante de fragmentos sanos a zonas dañadas.",
        "Reforestación de unas 30 hectáreas de manglar en zonas degradadas por el huracán Mitch.",
        "Protectores del Océano: capacita a pescadores, buzos y líderes comunitarios en turismo sostenible y buceo seguro, como alternativa a la pesca artesanal.",
        "Educación ambiental, investigación y monitoreo.",
      ],
      en: [
        "Coral nurseries in the sea, and healthy fragments transplanted to damaged areas.",
        "Reforestation of about 30 hectares of mangrove in areas degraded by Hurricane Mitch.",
        "Ocean Protectors: trains fishers, divers and community leaders in sustainable tourism and safe diving, as an alternative to artisanal fishing.",
        "Environmental education, research and monitoring.",
      ],
    },
    support: {
      es: "Donación en línea a BICA. Sus páginas invitan a voluntarios para la restauración de coral, los manglares y el monitoreo.",
      en: "Online donation to BICA. Its pages invite volunteers for coral restoration, mangroves and monitoring.",
    },
    links: [
      { kind: "donate", url: BICA_DONATE },
      { kind: "site", url: "https://www.bicainc.org/about-bica-guanaja" },
    ],
    sources: [
      { label: "BICA Guanaja, coral restoration", url: "https://www.bicainc.org/bica-guanaja-coral-restoration" },
      { label: "BICA Guanaja, mangrove reforestation", url: "https://www.bicainc.org/bica-guanaja-mangrove-reforestation" },
      { label: "BICA Guanaja, Ocean Protectors", url: "https://www.bicainc.org/bica-guanaja-ocean-protectors" },
    ],
  },
  {
    id: "fcc",
    name: "Fundación Cayos Cochinos",
    place: "cayos-cochinos",
    kind: { es: "Fundación sin fines de lucro, creada en 1994 (Honduras Coral Reef Fund)", en: "Nonprofit foundation, created in 1994 (Honduras Coral Reef Fund)" },
    about: {
      es: "Se creó para establecer el área protegida de Cayos Cochinos. Trabaja en coordinación con el ICF y la Fuerza Naval.",
      en: "Created to establish the Cayos Cochinos protected area. Works in coordination with ICF and the Honduran Navy.",
    },
    does: {
      es: [
        "Rescate y restauración de coral en el Monumento Natural Marino Archipiélago Cayos Cochinos.",
        "Control del pez león.",
        "Monitoreo de la anidación de la tortuga carey con voluntarios.",
        "Planes de manejo, desarrollo comunitario y cultura garífuna.",
      ],
      en: [
        "Coral rescue and restoration in the Cayos Cochinos Archipelago Natural Marine Monument.",
        "Lionfish control.",
        "Hawksbill turtle nesting monitoring with volunteers.",
        "Management plans, community development and Garífuna culture.",
      ],
    },
    support: {
      es: "Voluntariado, pasantías e investigación científica: la fundación pide escribirle. No encontramos una página de donación en su sitio.",
      en: "Volunteering, internships and scientific research: the foundation asks you to write to it. We found no donation page on its site.",
    },
    links: [
      { kind: "volunteer", url: "https://www.cayoscochinos.org/volunteer" },
      { kind: "site", url: "https://www.cayoscochinos.org/" },
    ],
    sources: [
      { label: "Fundación Cayos Cochinos, About us", url: "https://www.cayoscochinos.org/aboutus" },
      { label: "Fundación Cayos Cochinos", url: "https://www.cayoscochinos.org/" },
    ],
  },
  {
    id: "coral",
    name: "Coral Reef Alliance",
    place: "all",
    kind: { es: "ONG internacional sin fines de lucro, con sede en EE. UU.", en: "International nonprofit, based in the USA" },
    about: {
      es: "Apoya a las organizaciones locales. Trabaja en Roatán desde 2005.",
      en: "Supports the local organizations. Has worked on Roatán since 2005.",
    },
    does: {
      es: [
        "Agua limpia: ayudó a la junta de agua de Polo's, en West End, a conectar más del 99 % de las viviendas viables al tratamiento de aguas residuales.",
        "Ayudó a BICA Roatán a montar su laboratorio de calidad de agua y patrocina el monitoreo de agua de BICA Utila.",
        "Apoya el manejo y el patrullaje de áreas marinas protegidas en Roatán, Utila y Guanaja.",
      ],
      en: [
        "Clean water: helped the Polo's Water Board in West End connect over 99% of viable homes to wastewater treatment.",
        "Helped BICA Roatán set up its water quality laboratory and sponsors BICA Utila's water monitoring.",
        "Supports the management and patrolling of marine protected areas on Roatán, Utila and Guanaja.",
      ],
    },
    support: {
      es: "Donación en línea, deducible de impuestos en EE. UU. según la ley. A quienes viven en las islas les recomienda acercarse a Roatán Marine Park y a BICA.",
      en: "Online donation, tax-deductible in the USA as allowed by law. It points island residents to Roatán Marine Park and BICA.",
    },
    links: [
      { kind: "donate", url: "https://coral.org/donate/" },
      { kind: "site", url: "https://coral.org/where-we-work/western-caribbean/honduras/" },
    ],
    sources: [
      { label: "Coral Reef Alliance, Honduras", url: "https://coral.org/where-we-work/western-caribbean/honduras/" },
      CORAL_ROATAN,
      { label: "Coral Reef Alliance, Utila", url: "https://coral.org/where-we-work/western-caribbean/honduras/utila/" },
    ],
  },
  {
    id: "hrhp",
    name: "Healthy Reefs for Healthy People",
    place: "all",
    kind: { es: "Equipo técnico regional del Arrecife Mesoamericano", en: "Regional technical team for the Mesoamerican Reef" },
    about: {
      es: "Coordina la Healthy Reefs Initiative, con más de 70 organizaciones socias en México, Belice, Guatemala y Honduras.",
      en: "Leads the Healthy Reefs Initiative, with over 70 partner organizations in Mexico, Belize, Guatemala and Honduras.",
    },
    does: {
      es: ["Publica los reportes de salud del Arrecife Mesoamericano.", "Tiene una coordinación en Honduras que articula a socios y proyectos en el país."],
      en: ["Publishes the Mesoamerican Reef health report cards.", "Has a Honduras coordinator who works with partners and projects in the country."],
    },
    support: { es: "Donación por PayPal desde su sitio.", en: "PayPal donation from its site." },
    links: [{ kind: "site", url: "https://www.healthyreefs.org/" }],
    sources: [{ label: "Healthy Reefs for Healthy People, About us", url: "https://www.healthyreefs.org/en/about-us" }],
  },
  {
    id: "maralliance",
    name: "MarAlliance",
    place: "all",
    kind: { es: "ONG internacional sin fines de lucro (EE. UU., Belice y Panamá)", en: "International nonprofit (USA, Belize and Panama)" },
    about: {
      es: "Estudia y protege tiburones, rayas y otra fauna marina grande.",
      en: "Studies and protects sharks, rays and other large marine wildlife.",
    },
    does: {
      es: [
        "Completó en 2017 la línea base de fauna marina grande en todas las Islas de la Bahía.",
        "Cofundó y facilita el comité asesor nacional de tiburones de Honduras.",
        "Educación marina con más de 2,340 estudiantes y 68 docentes.",
      ],
      en: [
        "Completed the baseline of large marine wildlife throughout the Bay Islands in 2017.",
        "Co-founded and facilitates Honduras's National Shark Advisory Committee.",
        "Marine education with over 2,340 students and 68 teachers.",
      ],
    },
    support: { es: "Donación en línea y voluntariado.", en: "Online donation and volunteering." },
    links: [
      { kind: "donate", url: "https://maralliance.org/donate/" },
      { kind: "site", url: "https://maralliance.org/honduras" },
    ],
    sources: [{ label: "MarAlliance, Honduras", url: "https://maralliance.org/honduras" }],
  },
];
