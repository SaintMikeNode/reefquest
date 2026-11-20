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
  buoys: string[]; // site ids with a buoy in this zone
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

const KEY = (z: string) => `rq-log-${z}`;

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
    set({ samples, zoneKey: zone, target: null, near: null, tele: null });
  },
  toggleMapColors: () => set((s) => ({ mapColors: !s.mapColors })),
}));

// Dev-only handle for debugging in the browser console.
if (import.meta.env.DEV) (window as unknown as { __boat: typeof useBoat }).__boat = useBoat;
