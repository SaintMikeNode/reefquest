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
  /** The label in Spanish, when the place has no proper name of its own (a wildlife area, a reserve). */
  nameEs?: string;
  lat: number;
  lon: number;
  approx?: boolean; // location only roughly known
  kind: "story" | "dive";
  depth_m?: number;
  title?: { es: string; en: string };
  body?: { es: string[]; en: string[] };
  /** Optional DHW date to jump the timeline to when the site is opened. */
  date?: string;
  /** Animals documented at this place, shown in the boat mode (boat/wildlife.tsx). A place with a
   *  scene in open water gets no mooring buoy. */
  scene?: "whale-shark" | "turtles" | "reef-sharks";
  /** A shipwreck to find on the seafloor in the boat mode (boat/wreck.ts): its length and how it
   *  lies, as the sources describe it. It is laid at `depth_m`. */
  wreck?: { length_m: number; pose: "upright" | "side" | "pieces" };
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

// Utila. Coordinates: the survey-site tables of two open-access papers (CC BY 4.0; the center of
// the transects at each site), PADI pages contributed by Utila dive centers where an independent
// source agrees within about 60 m, and OpenStreetMap. Sites whose published positions disagree
// (Black Hills, Blackish Point, Silver Gardens, CJ's Drop Off) or that only a personal-use atlas
// locates are left out until a dive center or BICA Utila confirms them (researched 2026-11-20).
const ANDRADI_2016: Source = { label: "Andradi-Brown et al. (2016), PLOS ONE 11(6): survey sites (S1 Table)", url: "https://doi.org/10.1371/journal.pone.0156641" };
const ANDRADI_2017: Source = { label: "Andradi-Brown et al. (2017), Royal Society Open Science 4: survey sites", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5451808" };
const LAVERICK_2017: Source = { label: "Laverick et al. (2017), PLOS ONE 12(8)", url: "https://doi.org/10.1371/journal.pone.0183075" };
const WEDIVE_UTILA: Source = { label: "We-Dive Utila: dive sites", url: "https://www.wediveutila.com/utila-dive-sites" };
const UDC_HALLIBURTON: Source = { label: "Utila Dive Center: the Halliburton wreck", url: "https://utiladivecenter.wordpress.com/2011/07/20/the-halliburton-wreck/" };
const HALLIBURTON_POSITION: Source = { label: "Position: a diver's log of the Halliburton", url: "https://divemasteraustin.com/dive-sites/the-haliburton" };
const DECRETO_75_2010: Source = { label: "Decreto 75-2010, Parque Nacional Marino Islas de la Bahía (La Gaceta, 26 jul 2010)", url: "https://faolex.fao.org/docs/pdf/hon219038.pdf" };
const PADI = (slug: string, name: string): Source => ({ label: `PADI dive site: ${name}`, url: `https://travel.padi.com/dive-site/honduras/${slug}/` });
// Wildlife.
const FOX_2013: Source = { label: "Fox et al. (2013), Journal of Fish Biology 83", url: "https://doi.org/10.1111/jfb.12195" };
const MCKINNEY_2017: Source = { label: "McKinney et al. (2017), PLOS ONE 12(8)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5560665/" };
const MARALLIANCE_SHARKS: Source = { label: "MarAlliance: sharks and rays of Honduras", url: "https://maralliance.org/sharks-and-rays-of-honduras-a-glimpse-into-the-underwater-giants-of-the-caribbean/" };
const MARALLIANCE_2024: Source = { label: "MarAlliance (2024), Honduras shark and ray report", url: "https://maralliance.org/wp-content/uploads/2025/09/2024-024-GSRR_En_Honduras.pdf" };
const WSORC_2025: Source = { label: "Whale Shark & Oceanic Research Center (20 Sep 2025)", url: "https://www.wsorc.org/post/respecting-the-giants-first-whale-shark-signthing-of-the-year" };
const IUCN_2016: Source = { label: "IUCN (July 2016): whale sharks listed as Endangered", url: "https://iucn.org/news/secretariat/201607/whale-sharks-winghead-sharks-and-bornean-orangutans-slide-towards-extinction" };
const XRAY_WHALE_SHARKS: Source = { label: "X-Ray Mag: tagging whale sharks (Utila's encounter guidelines)", url: "https://xray-mag.com/content/tagging-whale-sharks" };
const UTILA_GUIDE_WS: Source = { label: "Utila Guide: whale sharks", url: "https://www.utilaguide.com/activities/whaleshark/" };
const LAPRENSA_2012: Source = { label: "La Prensa (2012): Utila y el tiburón ballena", url: "https://www.laprensa.hn/honduras/utila-en-defensa-de-su-iguana-negra-y-el-tiburon-ballena-ECLP342677" };
const YEATER_2008: Source = { label: "Yeater (2008), dolphins near Utila (dissertation, Univ. of Southern Mississippi)", url: "https://aquila.usm.edu/dissertations/1198" };
const DUNBAR_2025: Source = { label: "Dunbar et al. (2025), PLOS ONE 20", url: "https://doi.org/10.1371/journal.pone.0317778" };
const BICA_UTILA_PATROLS: Source = { label: "BICA Utila: protection", url: "https://www.bicainc.org/bica-utila-protection" };
const PROTECTOR_2019: Source = { label: "ProTECTOR Inc., national report for 2019 (WIDECAST)", url: "https://www.widecast.org/What/Country/Honduras/Docs/Dunbar%20Salinas%202020_ProTECTOR%20Inc%20National%20Report%20for%202019.pdf" };
const PROTECTOR_2022: Source = { label: "ProTECTOR Inc., national report for 2022 (WIDECAST)", url: "https://www.widecast.org/What/Country/Honduras/Docs/ProTECTOR%20Inc%20National%20Report_%20for%202022_Corrected.pdf" };
const BERUBE_2012: Source = { label: "Berube et al. (2012), Chelonian Conservation and Biology 11", url: "https://www.widecast.org/What/Country/Honduras/Docs/BerubeEtAl_2012_CCB.pdf" };
const DAN_ROATAN: Source = { label: "Frink (2015), Alert Diver (Divers Alert Network): Roatán", url: "https://dan.org/alert-diver/article/roatan/" };
const SHARK_DIVE_OPERATOR: Source = { label: "Caribbean Adventures Roatán: shark dive", url: "https://caribbeanadventuresroatan.com/adventures/shark-dive/" };
const MONGABAY_2011: Source = { label: "Mongabay (2011): Honduras protects sharks in all its waters", url: "https://news.mongabay.com/2011/06/honduras-protects-sharks-in-all-its-waters/" };
const RIMS_ABOUT: Source = { label: "Roatán Institute for Marine Sciences: about", url: "https://roatanims.org/about" };
const RIMS_DOLPHINS: Source = { label: "Roatán Institute for Marine Sciences: dolphin research", url: "https://roatanims.org/dolphin-research" };
const AKR_DOLPHINS: Source = { label: "Anthony's Key Resort: dolphin programs", url: "https://anthonyskey.com/?p=280" };
const DCP: Source = { label: "Dolphin Communication Project (researchers at the facility)", url: "https://www.dolphincommunicationproject.org/general-dcp-11/" };
const DAILY_BEAST_2019: Source = { label: "The Daily Beast (2019): opinion piece on the dolphin program", url: "https://www.thedailybeast.com/swimming-with-the-dolphins-is-it-love-or-exploitation" };
// Guanaja. The two dive maps the positions were read from, then the descriptions.
const FRANKO_GUANAJA: Source = { label: "Franko's Maps, Guanaja Dive Guide (2017), shown in Scuba Diving magazine: positions read off its grid", url: "https://www.scubadiving.com/three-things-love-about-guanaja" };
const CLEARWATER_MAP: Source = { label: "Clearwater Paradise Resort: dive-site map", url: "https://www.clearwaterparadise.com/diving/" };
const SCUBADIVING_2002: Source = { label: "Scuba Diving magazine (2002): Guanaja", url: "https://www.scubadiving.com/guanaja-sacred-island" };
const FLYFISH_GUANAJA: Source = { label: "Fly Fish Guanaja: an operator's dive-site descriptions", url: "https://www.flyfishguanaja.com/guanajaactivities" };
const FROMMERS_GUANAJA: Source = { label: "Frommer's: scuba diving in Guanaja", url: "https://www.frommers.com/destinations/guanaja/active-pursuits/scuba-diving/" };
const UNDERCURRENT_1997: Source = { label: "Undercurrent (March 1997): Bayman Bay, Guanaja", url: "https://undercurrent.org/UCnow/dive_magazine/1997/BaymanBayGuanaja199703.html" };
const UNDERCURRENT_2019: Source = { label: "Undercurrent (January 2019): Villa on Dunbar Rock, Guanaja", url: "https://undercurrent.org/UCnow/dive_magazine/2019/VillaDunbarRock201901.html" };
const CORAL_SCTLD: Source = { label: "Coral Reef Alliance: stony coral tissue loss disease in Honduras", url: "https://coral.org/blog/stony-coral-tissue-loss-disease-detected-in-honduras-heres-what-that-means/" };
const NOAA_NASSAU_2013: Source = { label: "NOAA Fisheries (2013), Nassau Grouper Biological Report", url: "https://repository.library.noaa.gov/view/noaa/16285" };
const ACUERDO_022_2019: Source = { label: "Acuerdo 022-2019, vedas de pesca (Honduras, vía FAOLEX)", url: "https://faolex.fao.org/docs/pdf/hon188929.pdf" };
const BRITANNICA_COLUMBUS: Source = { label: "Encyclopaedia Britannica: Columbus, the fourth voyage", url: "https://www.britannica.com/biography/Christopher-Columbus/The-fourth-voyage-and-final-years" };
const AHA_CACAO: Source = { label: "American Historical Association, Perspectives: A Taste of the Past", url: "https://www.historians.org/perspectives-article/a-taste-of-the-past/" };
const OSM_MANGROVE_BIGHT: Source = { label: "OpenStreetMap: Mangrove Bight", url: "https://www.openstreetmap.org/#map=15/16.5027/-85.8779" };
const VANSELOW_2007: Source = { label: "Vanselow, Kolb & Fickert (2007), Erdkunde 61(4)", url: "https://doi.org/10.3112/erdkunde.2007.04.06" };
const CAHOON_2003: Source = { label: "Cahoon et al. (2003): mangrove peat collapse after Hurricane Mitch (USGS)", url: "https://www.usgs.gov/publications/mass-tree-mortality-leads-mangrove-peat-collapse-bay-islands-honduras-after-hurricane" };
const BICA_GUANAJA_MANGROVES: Source = { label: "BICA Guanaja: mangrove reforestation", url: "https://www.bicainc.org/bica-guanaja-mangrove-reforestation" };

/** The place's label in the reader's language. */
export const siteName = (s: Site, lang: "es" | "en") => (lang === "es" && s.nameEs) || s.name;

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
    wreck: { length_m: 70, pose: "pieces" },
    title: { es: "Un barco que se volvió arrecife", en: "A ship that became a reef" },
    body: {
      es: [
        "El Aguila es un barco de carga hundido frente a Sandy Bay, a unos 33 metros (110 pies) de profundidad.",
        "Mide 230 pies (unos 70 metros). Anthony's Key Resort lo hundió en 1997 como arrecife artificial. Un año después, el huracán Mitch dañó buena parte de su estructura: hoy está en varios pedazos.",
        "Los naufragios dan a corales, esponjas y peces una superficie dura donde vivir. Por eso muchos buzos lo visitan.",
      ],
      en: [
        "El Aguila is a cargo ship sunk off Sandy Bay, at about 33 meters (110 feet) deep.",
        "It is 230 feet long (about 70 meters). Anthony's Key Resort sank it in 1997 as an artificial reef. A year later, Hurricane Mitch damaged much of its structure: today it lies in several pieces.",
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

  // ---- Roatán: wildlife places (positions approximate: none of the sources publishes coordinates).
  {
    id: "cara-a-cara",
    island: "roatan",
    name: "Cara a Cara",
    lat: 16.30536,
    lon: -86.53428,
    approx: true,
    kind: "story",
    depth_m: 20,
    scene: "reef-sharks",
    title: { es: "Cara a cara con tiburones de arrecife", en: "Face to face with reef sharks" },
    body: {
      es: [
        "Frente a Coxen Hole, a unos 18–21 metros, un centro de buceo lleva buzos a ver tiburones de arrecife del Caribe. Suelen llegar entre 10 y 20, de 1.8 a 2.7 metros de largo.",
        "Es un buceo con carnada: se suelta un balde pequeño con restos de pescado para atraerlos. No se permite tocarlos.",
        "Honduras declaró todas sus aguas santuario de tiburones en 2011. MarAlliance señala que desde 2016 se permite desembarcar la captura incidental, que eso se usa como vacío legal y que no hay monitoreo de capturas.",
        "El tiburón de arrecife del Caribe está En Peligro (UICN) y es el tiburón más común en las Islas de la Bahía.",
      ],
      en: [
        "Off Coxen Hole, at about 18–21 meters, a dive center takes divers to see Caribbean reef sharks. Usually 10 to 20 turn up, 1.8 to 2.7 meters long.",
        "It is a baited dive: a small bucket of fish scraps is released to draw them in. Touching them is not allowed.",
        "Honduras declared all its waters a shark sanctuary in 2011. MarAlliance notes that since 2016 incidental catch may be landed, that this is used as a loophole, and that catches are not monitored.",
        "The Caribbean reef shark is Endangered (IUCN) and is the most common shark in the Bay Islands.",
      ],
    },
    sources: [DAN_ROATAN, SHARK_DIVE_OPERATOR, MONGABAY_2011, MARALLIANCE_2024, MARALLIANCE_SHARKS],
  },
  {
    id: "reserve-turtles",
    island: "roatan",
    name: "Reserve turtles",
    nameEs: "Tortugas de la reserva",
    lat: 16.33081,
    lon: -86.57341,
    approx: true,
    kind: "story",
    scene: "turtles",
    title: { es: "Tortugas jóvenes en la reserva", en: "Young turtles in the reserve" },
    body: {
      es: [
        "En la Reserva Marina Sandy Bay–West End viven y se alimentan tortugas carey y verdes jóvenes.",
        "En Port Royal, al este de la isla, los científicos siguieron a careys jóvenes: cada una se movía en un área pequeña, de 0.15 a 0.55 km², y comía sobre todo esponjas.",
        "La carey está En Peligro Crítico. El punto en el mapa es solo una referencia: las tortugas se mueven por toda la reserva.",
      ],
      en: [
        "Young hawksbill and green turtles live and feed in the Sandy Bay–West End Marine Reserve.",
        "At Port Royal, on the east of the island, scientists followed young hawksbills: each kept to a small area, 0.15 to 0.55 km², and ate mostly sponges.",
        "The hawksbill is Critically Endangered. The point on the map is only a reference: the turtles move all over the reserve.",
      ],
    },
    sources: [PROTECTOR_2019, PROTECTOR_2022, BERUBE_2012, DUNBAR_2025],
  },
  {
    id: "dolphin-lagoon",
    island: "roatan",
    name: "Dolphin lagoon",
    nameEs: "Laguna de los delfines",
    lat: 16.32702,
    lon: -86.57503,
    approx: true,
    kind: "story",
    title: { es: "Los delfines de la laguna viven en cautiverio", en: "The lagoon's dolphins are captive" },
    body: {
      es: [
        "El Instituto de Ciencias Marinas de Roatán (RIMS), fundado en 1989 por los dueños de Anthony's Key Resort, mantiene delfines nariz de botella en encierros dentro de la laguna de Sandy Bay.",
        "Los visitantes pagan por encuentros en el agua, nado con esnórquel y buceos en los que los delfines nadan con su entrenador hasta un arenal a unos 18 metros.",
        "Son animales en cautiverio: así los describen los propios investigadores que trabajan ahí.",
        "Hay debate. Una crónica de opinión de 2019 califica el programa de explotación y cita a la científica Naomi Rose; el entrenador principal responde que la laguna es lo más natural que puede ser el cautiverio.",
        "En mar abierto las islas también tienen delfines libres: frente a Utila se ven delfines de dientes rugosos, tornillo y nariz de botella.",
      ],
      en: [
        "The Roatán Institute for Marine Sciences (RIMS), founded in 1989 by the owners of Anthony's Key Resort, keeps bottlenose dolphins in enclosures inside the Sandy Bay lagoon.",
        "Visitors pay for encounters in the water, snorkel swims, and dives in which the dolphins swim with their trainer to a sand patch about 18 meters down.",
        "They are captive animals: the researchers who work there describe them that way.",
        "There is a debate. A 2019 opinion piece calls the program exploitative and cites the scientist Naomi Rose; the head trainer answers that the lagoon is as natural as captivity gets.",
        "In open water the islands also have wild dolphins: off Utila, rough-toothed, spinner and bottlenose dolphins are the ones seen.",
      ],
    },
    sources: [RIMS_ABOUT, RIMS_DOLPHINS, AKR_DOLPHINS, DAN_ROATAN, DCP, DAILY_BEAST_2019, YEATER_2008],
  },

  // ---- Utila.
  {
    id: "utila-whale-sharks",
    island: "utila",
    name: "Whale shark waters",
    nameEs: "Aguas del tiburón ballena",
    lat: 16.14,
    lon: -86.872,
    approx: true,
    kind: "story",
    scene: "whale-shark",
    title: { es: "Tiburones ballena en la esquina noreste", en: "Whale sharks off the north-east corner" },
    body: {
      es: [
        "Entre 1999 y 2011 se reportaron 479 encuentros con tiburones ballena en Utila. La mayoría fue en el lado norte, cerca del borde de la plataforma, y más de la mitad en esta esquina noreste.",
        "Se les ha visto en todos los meses. Marzo y abril son los mejores, pero cambia mucho de un año a otro, y MarAlliance advierte que los avistamientos en las Islas de la Bahía han bajado. En 2025, el centro de investigación de la isla reportó su primer encuentro del año en septiembre.",
        "Vienen a comer. El atún aleta negra persigue peces pequeños hasta la superficie y el agua parece hervir; el tiburón ballena come en medio de ese «hervidero». Los capitanes lo encuentran buscando atunes que saltan y aves que vuelan en círculo.",
        "Los 95 tiburones identificados aquí medían entre 2 y 11 metros, y la mayoría eran machos jóvenes de paso. La especie está En Peligro (UICN) desde 2016.",
        "Las reglas de la isla: solo con esnórquel, sin tocarlos, máximo ocho nadadores por bote, y el bote no debe meterse en el hervidero. A veces también llegan delfines de dientes rugosos, tornillo o nariz de botella.",
        "En el bote de ReefQuest puedes practicarlo: entra despacio a la zona de contacto y quédate fuera del hervidero (el límite de 3 nudos es una regla del juego). El punto en el mapa es una referencia: los encuentros ocurren en toda esta zona.",
      ],
      en: [
        "Between 1999 and 2011, 479 whale shark encounters were reported at Utila. Most were on the north side, near the edge of the shelf, and more than half at this north-east corner.",
        "They have been seen in every month. March and April are the best, but it changes a lot from year to year, and MarAlliance warns that sightings in the Bay Islands have declined. In 2025, the island's research center reported its first encounter of the year in September.",
        "They come to eat. Blackfin tuna chase small fish to the surface and the water seems to boil; the whale shark feeds in the middle of that “boil”. Captains find it by looking for jumping tuna and circling birds.",
        "The 95 sharks identified here were 2 to 11 meters long, and most were young males passing through. The species has been Endangered (IUCN) since 2016.",
        "The island's rules: snorkel only, no touching, at most eight swimmers per boat, and the boat must not drive into the boil. Sometimes rough-toothed, spinner or bottlenose dolphins turn up too.",
        "On the ReefQuest boat you can practice it: enter the contact zone slowly and stay out of the boil (the 3-knot limit is a rule of the game). The point on the map is a reference: encounters happen all over this area.",
      ],
    },
    sources: [FOX_2013, MCKINNEY_2017, MARALLIANCE_SHARKS, WSORC_2025, IUCN_2016, XRAY_WHALE_SHARKS, UTILA_GUIDE_WS, LAPRENSA_2012, YEATER_2008],
  },
  {
    id: "pumpkin-hill-beach",
    island: "utila",
    name: "Pumpkin Hill Beach",
    lat: 16.1222,
    lon: -86.8802,
    approx: true,
    kind: "story",
    scene: "turtles",
    title: { es: "La playa donde anida la carey", en: "The beach where hawksbills nest" },
    body: {
      es: [
        "En Pumpkin Hill, una playa de un kilómetro, anidan tortugas carey. De 14 playas evaluadas en Utila, solo dos tienen anidación regular documentada.",
        "De junio a octubre, BICA Utila y ProTECTOR patrullan la playa de noche, de 9 de la noche a 4 de la mañana.",
        "Hembras marcadas aquí viajaron después hasta Belice, México y la plataforma entre Honduras y Nicaragua: la playa de una isla pequeña conecta a toda la región.",
        "La carey está En Peligro Crítico. A esta playa la amenazan las casas, el corte de vegetación y la erosión.",
      ],
      en: [
        "Hawksbill turtles nest at Pumpkin Hill, a beach one kilometer long. Of 14 beaches assessed on Utila, only two have documented regular nesting.",
        "From June to October, BICA Utila and ProTECTOR patrol the beach at night, from 9 pm to 4 am.",
        "Females tagged here later traveled to Belize, Mexico and the shelf between Honduras and Nicaragua: the beach of a small island connects the whole region.",
        "The hawksbill is Critically Endangered. Housing, vegetation clearing and erosion threaten this beach.",
      ],
    },
    sources: [DUNBAR_2025, BICA_UTILA_PATROLS, PROTECTOR_2019],
  },
  {
    id: "halliburton",
    island: "utila",
    name: "Halliburton",
    lat: 16.084067,
    lon: -86.897045,
    approx: true,
    kind: "story",
    depth_m: 30,
    wreck: { length_m: 30, pose: "upright" },
    title: { es: "El naufragio más grande de Utila", en: "Utila's largest wreck" },
    body: {
      es: [
        "El Halliburton es un carguero de 30 metros hundido a propósito en mayo de 1998. Su casco descansa sobre la arena a 30 metros, cerca del faro, en la entrada del puerto de Utila.",
        "La cubierta está a unos 26 metros y el techo del puente a unos 20. Es el naufragio más grande de la isla.",
      ],
      en: [
        "The Halliburton is a 30-meter cargo ship sunk on purpose in May 1998. Its hull rests on sand at 30 meters, near the lighthouse, at the entrance to Utila's harbor.",
        "The deck is at about 26 meters and the top of the bridge at about 20. It is the largest wreck on the island.",
      ],
    },
    sources: [UDC_HALLIBURTON, WEDIVE_UTILA, HALLIBURTON_POSITION],
  },
  {
    id: "the-maze",
    island: "utila",
    name: "The Maze",
    lat: 16.11266,
    lon: -86.94912,
    kind: "story",
    title: { es: "La pared del norte", en: "The north wall" },
    body: {
      es: [
        "En la costa norte de Utila, la más expuesta al oleaje, el arrecife cae en una pared con escalones que pasa de los 100 metros de profundidad. Aquí la estudiaron hasta los 85 metros.",
        "Arriba, entre 5 y 12 metros, el arrecife forma canales como un laberinto, con una cueva a unos 21 metros.",
        "La costa sur es distinta: espolones y canales de coral que bajan suavemente hasta la arena, a 30–45 metros.",
        "The Maze queda en Turtle Harbour, donde el decreto del Parque Nacional Marino Islas de la Bahía (2010) crea una zona de protección especial marina.",
      ],
      en: [
        "On Utila's north coast, the one most exposed to the swell, the reef drops as a stepped wall to more than 100 meters deep. Here it was studied down to 85 meters.",
        "Above, between 5 and 12 meters, the reef forms channels like a maze, with a cave at about 21 meters.",
        "The south coast is different: coral spurs and grooves sloping gently down to sand at 30–45 meters.",
        "The Maze lies in Turtle Harbour, where the decree of the Bay Islands National Marine Park (2010) sets up a special marine protection zone.",
      ],
    },
    sources: [LAVERICK_2017, ANDRADI_2016, WEDIVE_UTILA, DECRETO_75_2010],
  },
  { id: "raggedy-cay", island: "utila", name: "Raggedy Cay", lat: 16.09066, lon: -86.9941, kind: "dive", sources: [ANDRADI_2017, LAVERICK_2017] },
  { id: "spotted-bay", island: "utila", name: "Spotted Bay", lat: 16.09713, lon: -86.98717, kind: "dive", sources: [ANDRADI_2016] },
  { id: "black-coral-wall", island: "utila", name: "Black Coral Wall", lat: 16.08306, lon: -86.917, kind: "dive", sources: [ANDRADI_2016, PADI("black-coral-wall", "Black Coral Wall")] },
  { id: "coral-view", island: "utila", name: "Coral View", lat: 16.08823, lon: -86.91095, kind: "dive", sources: [ANDRADI_2016] },
  { id: "little-bight", island: "utila", name: "Little Bight", lat: 16.07926, lon: -86.92942, kind: "dive", sources: [ANDRADI_2016] },
  { id: "stingray-point", island: "utila", name: "Stingray Point", lat: 16.06891, lon: -86.95478, kind: "dive", sources: [ANDRADI_2016, PADI("sting-ray-point", "Sting Ray Point")] },
  { id: "rocky-point", island: "utila", name: "Rocky Point", lat: 16.08784, lon: -86.88423, kind: "dive", sources: [ANDRADI_2017] },
  { id: "teds-point", island: "utila", name: "Ted's Point", lat: 16.08594, lon: -86.88851, kind: "dive", sources: [PADI("teds-point", "Ted's Point")] },
  { id: "moon-hole", island: "utila", name: "Moon Hole", lat: 16.08499, lon: -86.89334, kind: "dive", depth_m: 11, sources: [PADI("moon-hole", "Moon Hole")] },
  { id: "jack-neil-beach", island: "utila", name: "Jack Neil Beach", lat: 16.07633, lon: -86.93844, kind: "dive", sources: [PADI("jack-neil-beach", "Jack Neil Beach")] },

  // ---- Guanaja. No GPS list of Guanaja's dive sites is published anywhere (checked 2026-11-20:
  // PADI, SSI, OpenStreetMap, the operators' sites). Every position here was read off two dive maps:
  // Franko's Maps "Guanaja Dive Guide" (2017), which has a latitude/longitude grid, and Clearwater
  // Paradise Resort's own map. Only sites where the two agree within about 300 m are pinned (the
  // story sites within about 700 m), all marked approximate. The artwork of the maps is not used.
  {
    id: "jado-trader",
    island: "guanaja",
    name: "Jado Trader",
    lat: 16.4098,
    lon: -85.868,
    approx: true,
    kind: "story",
    depth_m: 33,
    wreck: { length_m: 73, pose: "side" },
    title: { es: "Un carguero convertido en arrecife", en: "A freighter turned into a reef" },
    body: {
      es: [
        "El Jado Trader es un carguero de unos 73 metros (240 pies) hundido en 1987 como arrecife artificial, al este de Southwest Cay.",
        "Descansa de costado sobre una plataforma de arena junto a la pared del arrecife, a unos 33 metros, con dos pináculos de coral cerca.",
        "Las fuentes no coinciden en todos los datos: algunas dan otra eslora, y el año aparece también como «finales de los ochenta».",
      ],
      en: [
        "The Jado Trader is a freighter of about 73 meters (240 feet) sunk in 1987 as an artificial reef, east of Southwest Cay.",
        "It lies on its side on a sandy shelf beside the reef wall, at about 33 meters, with two coral pinnacles close by.",
        "Sources don't agree on every detail: some give a different length, and the year also appears as “the late eighties”.",
      ],
    },
    sources: [SCUBADIVING_2002, FLYFISH_GUANAJA, FROMMERS_GUANAJA, UNDERCURRENT_2019, FRANKO_GUANAJA, CLEARWATER_MAP],
  },
  {
    id: "black-rock-canyon",
    island: "guanaja",
    name: "Black Rock Canyon",
    lat: 16.5163,
    lon: -85.8715,
    approx: true,
    kind: "story",
    depth_m: 18,
    title: { es: "Cañones, cuevas y túneles", en: "Canyons, caves and tunnels" },
    body: {
      es: [
        "Frente a Mangrove Bight, en el norte de Guanaja, el arrecife es una red de cuevas, túneles y grietas profundas.",
        "Las paredes suben desde un fondo de arena, a unos 18 metros, hasta casi la superficie.",
        "Los operadores de buceo lo atribuyen a actividad volcánica. No encontramos una fuente geológica que lo confirme.",
      ],
      en: [
        "Off Mangrove Bight, in the north of Guanaja, the reef is a network of caves, tunnels and deep cracks.",
        "The walls rise from a sandy bottom, about 18 meters down, to near the surface.",
        "Dive operators put it down to volcanic action. We found no geological source that confirms it.",
      ],
    },
    sources: [FLYFISH_GUANAJA, UNDERCURRENT_1997, CLEARWATER_MAP, FRANKO_GUANAJA],
  },
  {
    id: "jims-silverlode",
    island: "guanaja",
    name: "Jim's Silverlode",
    lat: 16.4049,
    lon: -85.8825,
    approx: true,
    kind: "story",
    title: { es: "Un túnel lleno de peces plateados", en: "A tunnel full of silver fish" },
    body: {
      es: [
        "Junto a Southwest Cay, una pared profunda tiene un túnel cuya entrada está a unos 21 metros.",
        "El túnel suele estar lleno de sardinas plateadas y se abre a un anfiteatro en el arrecife.",
      ],
      en: [
        "Beside Southwest Cay, a deep wall has a tunnel whose entrance is about 21 meters down.",
        "The tunnel is usually full of silversides and opens into an amphitheater in the reef.",
      ],
    },
    sources: [SCUBADIVING_2002, UNDERCURRENT_1997, FRANKO_GUANAJA, CLEARWATER_MAP],
  },
  {
    id: "michaels-rock",
    island: "guanaja",
    name: "Michael's Rock Canyon",
    lat: 16.4905,
    lon: -85.9138,
    approx: true,
    kind: "story",
    depth_m: 21,
    title: { es: "Grietas frente a Michael's Rock", en: "Cracks off Michael's Rock" },
    body: {
      es: [
        "En el lado de sotavento, frente a Michael's Rock, el arrecife está lleno de grietas y pasadizos, hasta unos 21 metros de profundidad.",
        "El canal de Michael's Rock, al lado, tiene una caída de unos 55 metros.",
      ],
      en: [
        "On the leeward side, off Michael's Rock, the reef is full of cracks and swim-throughs, down to about 21 meters.",
        "The Michael's Rock channel, next to it, has a drop-off of about 55 meters.",
      ],
    },
    sources: [FLYFISH_GUANAJA, UNDERCURRENT_2019, SCUBADIVING_2002, FRANKO_GUANAJA, CLEARWATER_MAP],
  },
  {
    id: "eels-garden",
    island: "guanaja",
    name: "Eel's Garden",
    lat: 16.4717,
    lon: -85.9198,
    approx: true,
    kind: "story",
    date: "2021-06-13",
    title: { es: "La enfermedad llegó a Guanaja en 2021", en: "The disease reached Guanaja in 2021" },
    body: {
      es: [
        "El 13 de junio de 2021 se reportó aquí el primer caso en Guanaja de la enfermedad de pérdida de tejido de corales duros (SCTLD).",
        "Había llegado a Honduras nueve meses antes, por Flowers Bay, en Roatán.",
      ],
      en: [
        "On June 13, 2021, Guanaja's first case of stony coral tissue loss disease (SCTLD) was reported here.",
        "It had reached Honduras nine months earlier, at Flowers Bay on Roatán.",
      ],
    },
    sources: [TRUC_2023, CORAL_SCTLD, FRANKO_GUANAJA, CLEARWATER_MAP],
  },
  {
    id: "caldera-del-diablo",
    island: "guanaja",
    name: "Caldera del Diablo",
    lat: 16.4868,
    lon: -85.8161,
    approx: true,
    kind: "story",
    title: { es: "Los meros que ya no se reúnen", en: "The groupers that no longer gather" },
    body: {
      es: [
        "Frente a Guanaja estaba la única agregación de desove del mero de Nassau documentada en Honduras: cada invierno, miles de meros se juntaban en el mismo lugar para reproducirse.",
        "Los pescadores la encontraron. Según un informe de NOAA, en un sitio cercano a Guanaja los barcos redujeron la agregación de unos 10,000 peces a menos de 500 en dos años, y parece haber desaparecido a principios de los años noventa.",
        "Desde 2019, Honduras prohíbe pescar el mero de Nassau en todo el país, sin fecha de fin.",
        "El punto en el mapa es una referencia: el lugar queda mar afuera, al este, y su posición exacta no es pública.",
      ],
      en: [
        "Off Guanaja was the only Nassau grouper spawning aggregation documented in Honduras: every winter, thousands of groupers gathered at the same spot to reproduce.",
        "Fishers found it. According to a NOAA report, at a site close to Guanaja vessels cut the aggregation from about 10,000 fish to fewer than 500 in two years, and it seems to have disappeared in the early 1990s.",
        "Since 2019, Honduras has banned fishing Nassau grouper nationwide, with no end date.",
        "The point on the map is a reference: the place lies offshore to the east, and its exact position is not public.",
      ],
    },
    sources: [NOAA_NASSAU_2013, ACUERDO_022_2019, FRANKO_GUANAJA, CLEARWATER_MAP],
  },
  {
    id: "soldado-beach",
    island: "guanaja",
    name: "Soldado Beach",
    nameEs: "Playa El Soldado",
    lat: 16.4572,
    lon: -85.916,
    approx: true,
    kind: "story",
    title: { es: "Colón, 1502 y el primer cacao", en: "Columbus, 1502 and the first cacao" },
    body: {
      es: [
        "El 30 de julio de 1502, en su cuarto viaje, Cristóbal Colón llegó a Guanaja, que los libros en inglés también llaman Bonacca. La llamó Isla de Pinos.",
        "Cerca de Guanaja, sus hombres encontraron una gran canoa de comerciantes mayas. El relato de su hijo sobre las «almendras» que llevaban es la primera mención europea registrada del cacao.",
        "La tradición ubica el desembarco en esta playa, y los dos mapas de buceo de la isla lo marcan aquí (uno, con un monumento a Colón). No encontramos una fuente de la época que lo confirme.",
      ],
      en: [
        "On July 30, 1502, on his fourth voyage, Christopher Columbus reached Guanaja, which books in English also call Bonacca. He named it Isla de Pinos, the island of pines.",
        "Near Guanaja, his men met a large canoe of Maya traders. His son's account of the “almonds” it carried is the first recorded European mention of cacao.",
        "Tradition places the landing at this beach, and both dive maps of the island mark it here (one, with a monument to Columbus). We found no source from the time that confirms it.",
      ],
    },
    sources: [BRITANNICA_COLUMBUS, AHA_CACAO, FRANKO_GUANAJA, CLEARWATER_MAP],
  },
  {
    id: "mangrove-bight",
    island: "guanaja",
    name: "Mangrove Bight",
    lat: 16.5045,
    lon: -85.8777,
    kind: "story",
    date: "1998-10-27",
    title: { es: "El huracán que se quedó tres días", en: "The hurricane that stayed three days" },
    body: {
      es: [
        "El huracán Mitch pasó junto a Guanaja como categoría 4 el 27 de octubre de 1998 y se quedó frente a la costa hasta el 29: la isla tuvo vientos extremos durante más de 70 horas.",
        "Guanaja tenía 243 hectáreas de manglar. El 97 % se destruyó. Siete años después, cerca de dos tercios de los tramos estudiados seguían siendo madera muerta.",
        "Sin árboles vivos, el suelo de los manglares muertos se hundió unos 11 milímetros por año.",
        "Los arrecifes ya venían golpeados por el blanqueamiento de 1998. El lado sureste fue el más dañado; del extremo suroeste hasta Michael's Rock, el menos. El oleaje también enfrió el agua y terminó con el blanqueamiento.",
        "BICA Guanaja ha reforestado unas 30 hectáreas de manglar en las zonas degradadas por el huracán.",
        "El punto marca Mangrove Bight, un pueblo de la costa norte. Los datos son de toda la isla.",
      ],
      en: [
        "Hurricane Mitch passed Guanaja as a category 4 storm on October 27, 1998 and stayed off the coast until the 29th: the island had extreme winds for more than 70 hours.",
        "Guanaja had 243 hectares of mangrove. 97% was destroyed. Seven years later, about two thirds of the stretches surveyed were still dead wood.",
        "With no living trees, the ground of the dead mangroves sank by about 11 millimeters a year.",
        "The reefs were already battered by the 1998 bleaching. The south-east side was hit hardest; from the south-west tip up to Michael's Rock, the least. The storm's waves also cooled the water and ended the bleaching.",
        "BICA Guanaja has reforested about 30 hectares of mangrove in the areas the hurricane degraded.",
        "The point marks Mangrove Bight, a village on the north coast. The figures are for the whole island.",
      ],
    },
    sources: [VANSELOW_2007, CAHOON_2003, BICA_GUANAJA_MANGROVES, OSM_MANGROVE_BIGHT],
  },
  { id: "vertigo", island: "guanaja", name: "Vertigo", lat: 16.3969, lon: -85.8906, approx: true, kind: "dive", sources: [FLYFISH_GUANAJA, FRANKO_GUANAJA, CLEARWATER_MAP] },
  { id: "lees-pleasure", island: "guanaja", name: "Lee's Pleasure", lat: 16.4091, lon: -85.8883, approx: true, kind: "dive", depth_m: 15, sources: [FRANKO_GUANAJA, CLEARWATER_MAP] },
  { id: "lisas-reef", island: "guanaja", name: "Lisa's Reef", lat: 16.4421, lon: -85.8648, approx: true, kind: "dive", sources: [FRANKO_GUANAJA, CLEARWATER_MAP] },
  { id: "kiatrons-cay-reef", island: "guanaja", name: "Kiatron's Cay Reef", lat: 16.4441, lon: -85.8609, approx: true, kind: "dive", sources: [FRANKO_GUANAJA, CLEARWATER_MAP] },
  { id: "short-stop", island: "guanaja", name: "Short Stop", lat: 16.4452, lon: -85.8581, approx: true, kind: "dive", sources: [FRANKO_GUANAJA, CLEARWATER_MAP] },
  { id: "half-moon-cay-reef", island: "guanaja", name: "Half Moon Cay Reef", lat: 16.4469, lon: -85.8477, approx: true, kind: "dive", sources: [FRANKO_GUANAJA, CLEARWATER_MAP] },
  { id: "stephans-reef", island: "guanaja", name: "Stephan's Reef", lat: 16.447, lon: -85.8399, approx: true, kind: "dive", sources: [FRANKO_GUANAJA, CLEARWATER_MAP] },
  { id: "georges-reef", island: "guanaja", name: "George's Reef", lat: 16.4699, lon: -85.8237, approx: true, kind: "dive", sources: [FRANKO_GUANAJA, CLEARWATER_MAP] },
  { id: "tortuga-reef", island: "guanaja", name: "Tortuga Reef", lat: 16.4613, lon: -85.9289, approx: true, kind: "dive", sources: [FRANKO_GUANAJA, CLEARWATER_MAP] },
  { id: "bayman-bay-drop", island: "guanaja", name: "Bayman Bay Drop", lat: 16.4753, lon: -85.9228, approx: true, kind: "dive", sources: [FRANKO_GUANAJA, CLEARWATER_MAP] },
  { id: "dianes-wall", island: "guanaja", name: "Diane's Wall", lat: 16.476, lon: -85.9208, approx: true, kind: "dive", sources: [FRANKO_GUANAJA, CLEARWATER_MAP] },
  { id: "aldersons-wall", island: "guanaja", name: "Alderson's Wall", lat: 16.4977, lon: -85.903, approx: true, kind: "dive", sources: [FRANKO_GUANAJA, CLEARWATER_MAP] },
];
