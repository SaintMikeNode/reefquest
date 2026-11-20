import type { Species } from "../boat/corals";

type T2 = { es: string; en: string };

// Field guide for the underwater view. Names and growth forms follow Coralpedia (University of
// Warwick), a field guide to Caribbean corals and sponges. Shapes in the scene are stylized.
export const REEF_LIFE: Record<Species, { name: T2; sci: string; look: T2; color: string }> = {
  brain: {
    name: { es: "Coral cerebro", en: "Brain coral" },
    sci: "Pseudodiploria strigosa",
    look: { es: "Domos con valles que serpentean como un cerebro.", en: "Domes with valleys that wind like a brain." },
    color: "#e2b45e",
  },
  star: {
    name: { es: "Coral estrella", en: "Star coral" },
    sci: "Orbicella spp.",
    look: { es: "Montículos y lóbulos cubiertos de copas de pólipos.", en: "Mounds and lobes covered in polyp cups." },
    color: "#c4a752",
  },
  elkhorn: {
    name: { es: "Coral cuerno de alce", en: "Elkhorn coral" },
    sci: "Acropora palmata",
    look: { es: "Ramas anchas y planas, en aguas someras donde rompen las olas.", en: "Broad, flat branches in shallow water where waves break." },
    color: "#eeb062",
  },
  staghorn: {
    name: { es: "Coral cuerno de ciervo", en: "Staghorn coral" },
    sci: "Acropora cervicornis",
    look: { es: "Ramas cilíndricas como astas de venado, con puntas claras.", en: "Cylindrical branches like deer antlers, with pale tips." },
    color: "#f0c58c",
  },
  pillar: {
    name: { es: "Coral pilar", en: "Pillar coral" },
    sci: "Dendrogyra cylindrus",
    look: { es: "Columnas verticales; sus pólipos abiertos parecen pelusa.", en: "Upright columns; its open polyps look fuzzy." },
    color: "#ead8a8",
  },
  fan: {
    name: { es: "Abanico de mar", en: "Sea fan" },
    sci: "Gorgonia ventalina",
    look: { es: "Coral blando en forma de red plana que se mece con la corriente.", en: "A soft coral shaped like a flat net that sways in the current." },
    color: "#b56be6",
  },
  rod: {
    name: { es: "Varas de mar", en: "Sea rods" },
    sci: "Plexaura, Eunicea",
    look: { es: "Corales blandos ramificados, como candelabros.", en: "Branching soft corals, like candelabras." },
    color: "#9a62b4",
  },
  barrel: {
    name: { es: "Esponja de barril", en: "Giant barrel sponge" },
    sci: "Xestospongia muta",
    look: { es: "Un barril enorme, abierto arriba, que filtra el agua.", en: "A huge barrel, open at the top, that filters the water." },
    color: "#c85a3e",
  },
  tube: {
    name: { es: "Esponjas de tubo", en: "Tube sponges" },
    sci: "Aplysina, Callyspongia",
    look: { es: "Racimos de tubos de colores.", en: "Clusters of colorful tubes." },
    color: "#a066ec",
  },
  vase: {
    name: { es: "Esponja florero azul", en: "Azure vase sponge" },
    sci: "Callyspongia plicifera",
    look: { es: "Un florero lila o azul con pliegues.", en: "A lilac or blue vase with ridges." },
    color: "#a9b6ff",
  },
  grass: {
    name: { es: "Pasto de tortuga", en: "Turtle grass" },
    sci: "Thalassia testudinum",
    look: { es: "Una planta con flores que forma praderas sobre la arena.", en: "A flowering plant that forms meadows on the sand." },
    color: "#6fa844",
  },
};

export const REEF_LIFE_NOTE: T2 = {
  es: "Ilustración: las especies se colocan según el hábitat del mapa y la profundidad; no es un censo. El calor marino de 2023 golpeó con fuerza al cuerno de alce y al cuerno de ciervo.",
  en: "Illustration: species are placed by the mapped habitat and depth; this is not a survey. The 2023 marine heatwave hit elkhorn and staghorn corals hard.",
};

export const REEF_LIFE_SOURCES = [
  { label: "Coralpedia (University of Warwick)", url: "https://coralpedia.bio.warwick.ac.uk/" },
  { label: "IUCN Red List coral update, Nov 2024", url: "https://iucn.org/press-release/202411/over-40-coral-species-face-extinction-iucn-red-list" },
];
