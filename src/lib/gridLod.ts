// Level-of-detail triangle indices for a regular w × h vertex grid (heightfields).
// The grid is cut into blocks of B × B cells; each block is drawn with cells of 1, 2 or 4 grid steps
// (or skipped), so flat or far-away areas cost a fraction of the triangles. Neighboring blocks at
// different levels meet with T-junctions: hairline cracks are possible, so use coarse levels where
// they can't be seen (deep water, far from the camera).

export const B = 4;

export const blocksOf = (n: number) => Math.ceil((n - 1) / B);

/**
 * @param level cell stride for block (bi, bj): 1, 2 or 4; 0 skips the block.
 * @param out   reused when large enough.
 */
export function lodIndices(w: number, h: number, level: (bi: number, bj: number) => number, out?: Uint32Array): { index: Uint32Array; count: number } {
  const bw = blocksOf(w), bh = blocksOf(h);
  // Count first so the buffer is allocated once.
  let need = 0;
  for (let bj = 0; bj < bh; bj++)
    for (let bi = 0; bi < bw; bi++) {
      const s = level(bi, bj);
      if (!s) continue;
      const cx = Math.min(B, w - 1 - bi * B), cy = Math.min(B, h - 1 - bj * B);
      const st = cx === B && cy === B ? s : 1; // partial edge blocks: full detail
      need += Math.ceil(cx / st) * Math.ceil(cy / st) * 6;
    }
  const index = out && out.length >= need ? out : new Uint32Array(need);
  let p = 0;
  for (let bj = 0; bj < bh; bj++)
    for (let bi = 0; bi < bw; bi++) {
      const s = level(bi, bj);
      if (!s) continue;
      const x0 = bi * B, y0 = bj * B;
      const x1 = Math.min(x0 + B, w - 1), y1 = Math.min(y0 + B, h - 1);
      const st = x1 - x0 === B && y1 - y0 === B ? s : 1;
      for (let y = y0; y < y1; y += st)
        for (let x = x0; x < x1; x += st) {
          const a = y * w + x, b = a + st, c = a + st * w, d = c + st;
          index[p++] = a; index[p++] = c; index[p++] = b;
          index[p++] = b; index[p++] = c; index[p++] = d;
        }
    }
  return { index, count: p };
}

/** Per-vertex normals of a heightfield by central differences over ±step grid cells. */
export function gridNormals(w: number, h: number, y: (k: number) => number, cellX: number, cellZ: number, step = 1): Float32Array {
  const n = new Float32Array(w * h * 3);
  for (let j = 0; j < h; j++) {
    const j0 = Math.max(0, j - step), j1 = Math.min(h - 1, j + step);
    for (let i = 0; i < w; i++) {
      const i0 = Math.max(0, i - step), i1 = Math.min(w - 1, i + step);
      const dx = (y(j * w + i1) - y(j * w + i0)) / ((i1 - i0) * cellX);
      const dz = (y(j1 * w + i) - y(j0 * w + i)) / ((j1 - j0) * cellZ);
      const l = 1 / Math.hypot(dx, 1, dz);
      const k = (j * w + i) * 3;
      n[k] = -dx * l;
      n[k + 1] = l;
      n[k + 2] = -dz * l;
    }
  }
  return n;
}
