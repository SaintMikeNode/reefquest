import { SITES, type Site } from "../content/sites";
import { heightAtXZ, lonLatToXZ, type Zone } from "./zone";

// Where each place of content/sites.ts sits inside a boat zone. Worked out once per zone and shared
// by the mooring buoys, the arrival check, the wildlife and the wrecks.

export interface ZonePlace {
  site: Site;
  x: number;
  z: number;
  /** Wrecks: the heading of the hull (radians, 0 = bow toward +z) and the seafloor height there (m). */
  yaw?: number;
  floor?: number;
}

/** What the mission in range is about, in zone coordinates: the whale shark as it swims, a wreck,
 *  the middle of a turtle or shark place. The underwater camera starts out facing it. Plain
 *  mutable state written by wildlife.tsx (every frame for the shark): not worth a store update. */
export const subject = {
  on: false,
  x: 0,
  z: 0,
  /** Wrecks: how the underwater view frames them (the height it looks at, how far it stands off
   *  the hull's side, the hull's heading). A diver doesn't put their mask inside the ship. */
  look: null as null | { y: number; dist: number; yaw: number },
};

/** How far (m) from its pin a wreck may be laid to reach its documented depth. */
const WRECK_SEARCH = 520;

/**
 * A wreck's place on the seafloor. The zone's bathymetry is much smoother than the real reef: a
 * wreck on sand at 30 m at the foot of a wall can read 8 m at its pin, and a 30 m ship laid there
 * would stand out of the water. So the hull goes down the model's slope to the nearest spot at
 * about its documented depth (up to WRECK_SEARCH from the pin), lying along the depth contour so
 * it sits level. Its buoy and its arrival point move with it. A model, like the rest of the view.
 */
function wreckSpot(zone: Zone, site: Site, x0: number, z0: number) {
  const want = -(site.depth_m ?? 25);
  const limX = zone.sizeX / 2 - 60, limZ = zone.sizeZ / 2 - 60;
  let best = { x: x0, z: z0, h: heightAtXZ(zone, x0, z0), score: Infinity };
  for (let dz = -WRECK_SEARCH; dz <= WRECK_SEARCH; dz += 10)
    for (let dx = -WRECK_SEARCH; dx <= WRECK_SEARCH; dx += 10) {
      const d = Math.hypot(dx, dz), x = x0 + dx, z = z0 + dz;
      if (d > WRECK_SEARCH || Math.abs(x) > limX || Math.abs(z) > limZ) continue;
      const h = heightAtXZ(zone, x, z);
      // Depth first (within 2 m is as good as exact), then the nearest such spot.
      const score = Math.max(0, Math.abs(h - want) - 2) * 100 + d;
      if (score < best.score) best = { x, z, h, score };
    }
  const gx = heightAtXZ(zone, best.x + 15, best.z) - heightAtXZ(zone, best.x - 15, best.z);
  const gz = heightAtXZ(zone, best.x, best.z + 15) - heightAtXZ(zone, best.x, best.z - 15);
  // Along the contour: perpendicular to the slope (any heading on flat sand).
  const yaw = Math.hypot(gx, gz) > 0.05 ? Math.atan2(-gz, gx) : 0.6;
  return { x: best.x, z: best.z, floor: best.h, yaw };
}

const cache = new WeakMap<Zone, ZonePlace[]>();
/** The places of this island that fall inside the zone (50 m in from its edge). */
export function zonePlaces(zone: Zone): ZonePlace[] {
  let list = cache.get(zone);
  if (!list) {
    list = [];
    for (const site of SITES) {
      if (site.island !== zone.meta.island) continue;
      const p = lonLatToXZ(zone, site.lon, site.lat);
      if (Math.abs(p.x) > zone.sizeX / 2 - 50 || Math.abs(p.z) > zone.sizeZ / 2 - 50) continue;
      list.push(site.wreck ? { site, ...wreckSpot(zone, site, p.x, p.z) } : { site, x: p.x, z: p.z });
    }
    cache.set(zone, list);
  }
  return list;
}
