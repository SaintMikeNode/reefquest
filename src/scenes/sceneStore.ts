import { create } from "zustand";

export interface Readout {
  lat: number;
  lon: number;
  h: number; // meters, + above sea level
  benthic: number;
  geomorphic: number;
  dhw: number | null;
}

interface SceneState {
  layers: { habitat: boolean; heat: boolean; contours: boolean; sites: boolean };
  year: number;
  day: number; // index within the year file
  playing: boolean;
  site: string | null;
  readout: Readout | null;
  flyTo: { x: number; z: number; dist: number; key: number; home?: boolean } | null;
  boat: { zone: string; lon: number; lat: number } | null;
  setBoat: (b: SceneState["boat"]) => void;
  toggle: (k: keyof SceneState["layers"]) => void;
  setYear: (y: number, day?: number) => void;
  setDay: (d: number) => void;
  setPlaying: (p: boolean) => void;
  setSite: (id: string | null) => void;
  setReadout: (r: Readout | null) => void;
  fly: (x: number, z: number, dist: number, home?: boolean) => void;
}

export const useScene = create<SceneState>((set) => ({
  layers: { habitat: true, heat: true, contours: true, sites: true },
  year: 0,
  day: 0,
  playing: false,
  site: null,
  readout: null,
  flyTo: null,
  boat: null,
  setBoat: (boat) => set({ boat, site: null, readout: null, playing: false }),
  toggle: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setYear: (year, day = 0) => set({ year, day }),
  setDay: (day) => set({ day }),
  setPlaying: (playing) => set({ playing }),
  setSite: (site) => set({ site }),
  setReadout: (readout) => set({ readout }),
  fly: (x, z, dist, home) => set((s) => ({ flyTo: { x, z, dist, home, key: (s.flyTo?.key ?? 0) + 1 } })),
}));

/** Current year's heat grid (not reactive; read together with the reactive `day`). */
export const heatRef: { grid: Uint8Array | null; year: number } = { grid: null, year: 0 };
