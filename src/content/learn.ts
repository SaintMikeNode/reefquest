// Plain-language explainers for teenagers and classrooms (Spanish first). Every fact has a source.
import type { Source } from "./sites";

export interface Lesson {
  id: string;
  kicker: { es: string; en: string };
  title: { es: string; en: string };
  body: { es: string[]; en: string[] };
  sources: Source[];
}

const CRW_METHODS: Source = { label: "NOAA Coral Reef Watch, 5 km methodology", url: "https://coralreefwatch.noaa.gov/product/5km/methodology.php" };
const NOAA_GLOBAL: Source = { label: "NOAA, 4th global coral bleaching event (15 Apr 2024)", url: "https://www.noaa.gov/news-release/noaa-confirms-4th-global-coral-bleaching-event" };
const HRHP_2024: Source = {
  label: "Healthy Reefs for Healthy People, 2024 Mesoamerican Reef Report Card",
  url: "https://cdn.prod.website-files.com/66b16833c7877e9078babf9d/67361e479ff8ca23dc49ebf7_2024%20Report%20Card%20-website%20version.pdf",
};
const TRUC_2023: Source = { label: "Truc et al. (2023), Frontiers in Marine Science 10", url: "https://www.frontiersin.org/articles/10.3389/fmars.2023.1197318/full" };
const MARFUND_2024: Source = { label: "MAR Fund policy brief (2024), citing IDB (2021)", url: "https://marfund.org/en/wp-content/uploads/2024/02/Policy-Brief-Regional-english-v1.1.pdf" };
const SECORE_2023: Source = { label: "SECORE International, CoralSeeding Honduras (2023)", url: "https://www.secore.org/en/news/3/coralseeding-honduras" };
const RMP: Source = { label: "Roatán Marine Park", url: "https://www.roatanmarinepark.org/" };

export const LESSONS: Lesson[] = [
  {
    id: "bleaching",
    kicker: { es: "Lo básico", en: "The basics" },
    title: { es: "¿Qué es el blanqueamiento?", en: "What is coral bleaching?" },
    body: {
      es: [
        "Un coral es un animal pequeño que vive en colonias. Dentro de su tejido viven unas algas microscópicas que le dan comida y color.",
        "Cuando el agua se calienta demasiado por muchas semanas, el coral se estresa y expulsa esas algas. Se queda transparente y vemos su esqueleto blanco: eso es el blanqueamiento.",
        "Un coral blanqueado no está muerto todavía. Si el agua se enfría pronto, las algas pueden volver. Si el calor dura demasiado, el coral se muere de hambre o se enferma.",
      ],
      en: [
        "A coral is a small animal that lives in colonies. Inside its tissue live microscopic algae that give it food and color.",
        "When the water stays too warm for many weeks, the coral gets stressed and pushes those algae out. It turns see-through and we see its white skeleton: that's bleaching.",
        "A bleached coral isn't dead yet. If the water cools down soon, the algae can come back. If the heat lasts too long, the coral starves or gets sick.",
      ],
    },
    sources: [CRW_METHODS],
  },
  {
    id: "dhw",
    kicker: { es: "Cómo se mide", en: "How it's measured" },
    title: { es: "¿Qué es una semana-grado de calentamiento?", en: "What is a degree heating week?" },
    body: {
      es: [
        "Satélites de NOAA miden cada día la temperatura de la superficie del mar en todo el planeta, en cuadros de 5 km.",
        "Cada lugar tiene un límite: la temperatura del mes más caliente normal, más 1 °C. Cuando el agua pasa ese límite, el calor extra se va sumando.",
        "Las semanas-grado de calentamiento (DHW) suman ese calor extra de las últimas 12 semanas. 1 DHW es una semana a 1 °C por encima del límite, o media semana a 2 °C.",
        "Con 4 DHW se espera blanqueamiento en todo el arrecife. Con 8, blanqueamiento con muerte de corales sensibles. Desde 2023, NOAA tiene niveles hasta 20 DHW o más, cuando puede morir más del 80 % de los corales.",
      ],
      en: [
        "NOAA satellites measure sea surface temperature every day across the whole planet, in 5 km squares.",
        "Each place has a limit: its normal warmest-month temperature plus 1 °C. When the water goes above that limit, the extra heat starts adding up.",
        "Degree heating weeks (DHW) add up that extra heat over the last 12 weeks. 1 DHW is one week at 1 °C above the limit, or half a week at 2 °C.",
        "At 4 DHW, reef-wide bleaching is expected. At 8, bleaching with death of heat-sensitive corals. Since 2023, NOAA has levels up to 20 DHW or more, when over 80% of corals may die.",
      ],
    },
    sources: [CRW_METHODS],
  },
  {
    id: "2023",
    kicker: { es: "Historia reciente", en: "Recent history" },
    title: { es: "2023 y 2024: dos años seguidos de calor extremo", en: "2023 and 2024: two extreme years in a row" },
    body: {
      es: [
        "En el registro satelital de NOAA para las Islas de la Bahía, 2023 y 2024 son los dos años de más calor desde 1985. Alrededor de Roatán, el calor acumulado llegó a 13,3 °C-semana en 2023 y a 14,3 en 2024; antes de 2023, ningún año había pasado de 6,5. (Cálculo de ReefQuest con los datos de 5 km de NOAA.)",
        "Según el informe de Healthy Reefs de 2024, en 2023 todos los arrecifes del Arrecife Mesoamericano acumularon entre 16 y casi 24 semanas-grado de calentamiento, y fue el peor evento de blanqueamiento registrado: cerca del 40 % de los corales se vieron afectados. El coral lechuga fue de los más golpeados: 43 % de sus colonias se blanquearon por completo.",
        "En abril de 2024, NOAA confirmó el cuarto evento global de blanqueamiento de corales.",
      ],
      en: [
        "In NOAA's satellite record for the Bay Islands, 2023 and 2024 are the two hottest years since 1985. Around Roatán, heat built up to 13.3 °C-weeks in 2023 and 14.3 in 2024; before 2023, no year had gone above 6.5. (ReefQuest's calculation from NOAA's 5 km data.)",
        "According to Healthy Reefs' 2024 report card, in 2023 every reef in the Mesoamerican Reef built up between 16 and nearly 24 degree heating weeks, and it was the worst bleaching event on record: about 40% of corals were affected. Lettuce coral was among the hardest hit: 43% of its colonies bleached completely.",
        "In April 2024, NOAA confirmed the fourth global coral bleaching event.",
      ],
    },
    sources: [CRW_METHODS, HRHP_2024, NOAA_GLOBAL],
  },
  {
    id: "sctld",
    kicker: { es: "Otra amenaza", en: "Another threat" },
    title: { es: "Una enfermedad que viaja rápido", en: "A disease that travels fast" },
    body: {
      es: [
        "La enfermedad de pérdida de tejido de corales duros (SCTLD) llegó a Honduras en 2020: se registró por primera vez en Flowers Bay, Roatán, el 24 de septiembre.",
        "Se extendió a unos 155 metros por día alrededor de Roatán y Utila, un poco más rápido que en Florida. En un año ya afectaba al menos 28 especies de coral.",
      ],
      en: [
        "Stony coral tissue loss disease (SCTLD) reached Honduras in 2020: it was first recorded at Flowers Bay, Roatán, on September 24.",
        "It spread about 155 meters per day around Roatán and Utila, slightly faster than in Florida. Within a year it had affected at least 28 coral species.",
      ],
    },
    sources: [TRUC_2023],
  },
  {
    id: "health",
    kicker: { es: "Chequeo de salud", en: "Health check" },
    title: { es: "¿Cómo están los arrecifes de las islas?", en: "How are the islands' reefs doing?" },
    body: {
      es: [
        "Cada dos o tres años, la iniciativa Healthy Reefs for Healthy People revisa cientos de sitios del Arrecife Mesoamericano. En 2024 calificó al arrecife completo como “pobre” (2,5 de 5), aunque mejoró por primera vez en cinco años gracias a más peces herbívoros.",
        "Roatán obtuvo 2,8, “regular”: 22 % de coral vivo y 19 % de macroalgas. Utila también 2,8, Guanaja 3,0 y Cayos Cochinos 3,3.",
      ],
      en: [
        "Every two to three years, the Healthy Reefs for Healthy People initiative checks hundreds of sites across the Mesoamerican Reef. In 2024 it rated the whole reef “poor” (2.5 out of 5), though it improved for the first time in five years thanks to more herbivorous fish.",
        "Roatán scored 2.8, “fair”: 22% live coral and 19% fleshy macroalgae. Utila also scored 2.8, Guanaja 3.0 and Cayos Cochinos 3.3.",
      ],
    },
    sources: [HRHP_2024],
  },
  {
    id: "matter",
    kicker: { es: "Por qué importan", en: "Why they matter" },
    title: { es: "Los arrecifes sostienen a las islas", en: "Reefs hold up the islands" },
    body: {
      es: [
        "El Arrecife Mesoamericano vale unos 3.900 millones de dólares al año en turismo, 183 millones en pesca y entre 320 y 438 millones en protección de la costa contra olas y tormentas.",
        "En la parte hondureña del arrecife trabajan unos 4.300 pescadores. Desde 2022, los arrecifes de Roatán, Utila y Guanaja forman parte de un seguro de arrecifes: se cuidan como una defensa contra huracanes.",
      ],
      en: [
        "The Mesoamerican Reef is worth about USD 3.9 billion a year in tourism, USD 183 million in fishing and USD 320–438 million in protecting the coast from waves and storms.",
        "About 4,300 fishers work in Honduras's part of the reef. Since 2022, the reefs of Roatán, Utila and Guanaja have been part of a reef insurance program: they're protected as a defense against hurricanes.",
      ],
    },
    sources: [MARFUND_2024, HRHP_2024],
  },
  {
    id: "restoration",
    kicker: { es: "Esperanza", en: "Hope" },
    title: { es: "Sembrar corales", en: "Planting corals" },
    body: {
      es: [
        "Desde 2018, el Roatán Marine Park cultiva fragmentos de coral en viveros submarinos y los trasplanta al arrecife. Trabaja con corales cuerno de ciervo y cuerno de alce, que crecen rápido y forman refugio para los peces.",
        "Desde 2022 también ayuda a los corales a reproducirse, y en 2023 publicó el primer calendario de desove de corales de Honduras.",
      ],
      en: [
        "Since 2018, Roatán Marine Park has grown coral fragments in underwater nurseries and planted them back on the reef. It works with staghorn and elkhorn corals, which grow fast and give fish shelter.",
        "Since 2022 it has also helped corals reproduce, and in 2023 it published Honduras's first coral spawning calendar.",
      ],
    },
    sources: [SECORE_2023, HRHP_2024, RMP],
  },
];
