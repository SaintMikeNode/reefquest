import type { Species } from "./corals";
import { create } from "zustand";

export interface Telemetry {
  x: number;
  z: number;
  heading: number; // radians, 0 = north (−z), clockwise
  speed: number; // m/s
  depth: number; // m below the boat (positive), 0 on land
  benthic: number;
  geomorphic: number;
  lat: number;
  lon: number;
  aground: boolean;
}

export interface Sample {
  t: number;
  lat: number;
  lon: number;
  depth: number;
  benthic: number;
  geomorphic: number;
  dhw: number | null;
}

interface BoatState {
  keys: { up: boolean; down: boolean; left: boolean; right: boolean };
  target: { x: number; z: number } | null;
  tele: Telemetry | null;
  near: string | null; // site id within reach
  samples: Sample[];
  mapColors: boolean;
  /** Camera below the surface, close to the reef. */
  under: boolean;
  /** Species of the illustrative reef within ~40 m of the boat, most common first. */
  nearby: Species[];
  present: number[]; // benthic classes found in this zone
  estimated: boolean; // shallow depths estimated from reef zones (no Atlas bathymetry)
  loading: boolean;
  sonar: boolean;
  grid: boolean;
  surveyPct: number; // % of the zone's 0.5–40 m shelf mapped by the multibeam
  surveyHa: number; // area mapped, hectares
  cast: { phase: "idle" | "down" | "hold" | "up"; depth: number; target: number };
  castReq: number; // timestamp of the last "take sample" request
  resetSurveyReq: number;
  buoys: string[]; // site ids with a floating label in this zone (a mooring buoy, or the whale shark waters)
  /** Wildlife places in this zone (site ids with a `scene`), and the ones already seen (saved). */
  wild: string[];
  /** Where every named place of the zone is, and how far short of it "sail there" stops (the
   *  whale sharks' contact zone). */
  placePos: Record<string, { x: number; z: number; standoff: number }>;
  sightings: string[];
  /** The thing to find the boat is within range of, and how it is going (the HUD's mission tag,
   *  the water's mood and the animals' behavior follow it). Whale shark: "near" coming up to the
   *  contact zone; inside it "far" until the boat holds off slowly ("watch"), "logged" once seen,
   *  "dived" when rushed. The others: "above" at the surface over it, "below" looking from under. */
  mission: { id: string; type: MissionType; state: "near" | "far" | "watch" | "logged" | "dived" | "above" | "below" } | null;
  /** A message for the HUD to flash (an i18n key); `n` makes repeats distinct. */
  notice: { key: string; n: number } | null;
  /** When the boat last ran into the shallows or the zone's edge (ms), for the HUD's warning. */
  groundedAt: number;
  /** Whether that was the edge of the zone rather than shallow water. */
  groundEdge: boolean;
  notify: (key: string) => void;
  logSighting: (id: string) => void;
  setPresent: (p: number[]) => void;
  clearSamples: () => void;
  setKey: (k: keyof BoatState["keys"], v: boolean) => void;
  setTarget: (t: { x: number; z: number } | null) => void;
  setTele: (t: Telemetry) => void;
  setNear: (id: string | null) => void;
  addSample: (s: Sample) => void;
  loadSamples: (zone: string) => void;
  toggleMapColors: () => void;
  zoneKey: string;
}

/** The kinds of thing to find in a zone (content/sites.ts `scene`, or a `wreck`). */
export type MissionType = "whale-shark" | "turtles" | "reef-sharks" | "stingrays" | "wreck" | "divers";

const KEY = (z: string) => `rq-log-${z}`;
const SEEN = (z: string) => `rq-seen-${z}`;

export const useBoat = create<BoatState>((set, get) => ({
  keys: { up: false, down: false, left: false, right: false },
  target: null,
  tele: null,
  near: null,
  samples: [],
  mapColors: false,
  under: false,
  nearby: [],
  present: [],
  estimated: false,
  loading: false,
  sonar: true,
  grid: true,
  surveyPct: 0,
  surveyHa: 0,
  cast: { phase: "idle", depth: 0, target: 0 },
  castReq: 0,
  resetSurveyReq: 0,
  buoys: [],
  wild: [],
  placePos: {},
  sightings: [],
  mission: null,
  notice: null,
  groundedAt: 0,
  groundEdge: false,
  notify: (key) => set((s) => ({ notice: { key, n: (s.notice?.n ?? 0) + 1 } })),
  logSighting: (id) => {
    if (get().sightings.includes(id)) return;
    const sightings = [...get().sightings, id];
    set((s) => ({ sightings, notice: { key: "boat.sight.saved", n: (s.notice?.n ?? 0) + 1 } }));
    try {
      localStorage.setItem(SEEN(get().zoneKey), JSON.stringify(sightings));
    } catch {
      /* storage blocked */
    }
  },
  setPresent: (present) => set({ present }),
  clearSamples: () => {
    set({ samples: [] });
    try {
      localStorage.removeItem(KEY(get().zoneKey));
    } catch {
      /* storage blocked */
    }
  },
  zoneKey: "",
  setKey: (k, v) => set((s) => ({ keys: { ...s.keys, [k]: v }, target: v ? null : s.target })),
  setTarget: (target) => set({ target }),
  setTele: (tele) => set({ tele }),
  setNear: (near) => set({ near }),
  addSample: (smp) => {
    const samples = [smp, ...get().samples].slice(0, 60);
    set({ samples });
    try {
      localStorage.setItem(KEY(get().zoneKey), JSON.stringify(samples));
    } catch {
      /* storage blocked */
    }
  },
  loadSamples: (zone) => {
    let samples: Sample[] = [];
    try {
      samples = JSON.parse(localStorage.getItem(KEY(zone)) || "[]");
    } catch {
      /* ignore */
    }
    let sightings: string[] = [];
    try {
      sightings = JSON.parse(localStorage.getItem(SEEN(zone)) || "[]");
    } catch {
      /* ignore */
    }
    set({ samples, sightings, mission: null, notice: null, zoneKey: zone, target: null, near: null, tele: null });
  },
  toggleMapColors: () => set((s) => ({ mapColors: !s.mapColors })),
}));

// Dev-only handle for debugging in the browser console.
if (import.meta.env.DEV) (window as unknown as { __boat: typeof useBoat }).__boat = useBoat;
