import type { MapGrid } from "@/lib/replay/mapAsset";

/**
 * Terrain for the 3D viewer: a smooth height field (3 vertices per cell, so cliffs are real slopes instead of stair-stepped
 * blocks) plus one baked colour texture for the whole map (ambient shadow beside cliffs, rock strata on steep faces, worn ramps,
 * mottled ground) and a tiling normal map for fine grain. Everything is derived from the engine's pathing/height grid; no Blizzard art.
 */
export const SUBDIV = 3;

type RGB = [number, number, number];
export interface Theme { lo: RGB; mid: RGB; hi: RGB; rockTop: RGB; cliff: RGB; grass: RGB; tree: RGB; stone: RGB; building: RGB; glow: RGB }
/** Ground and prop colours by the map's own tile set, so a jungle map looks green and a desert map sandy. Our palettes, not game art. */
const THEMES: Record<string, Theme> = {
  dust: { lo: [0.17, 0.135, 0.11], mid: [0.34, 0.275, 0.21], hi: [0.62, 0.53, 0.42], rockTop: [0.085, 0.078, 0.095], cliff: [0.30, 0.25, 0.235], grass: [0.26, 0.42, 0.18], tree: [0.14, 0.32, 0.16], stone: [0.62, 0.55, 0.45], building: [0.42, 0.40, 0.44], glow: [0.35, 0.8, 0.9] },
  green: { lo: [0.09, 0.13, 0.07], mid: [0.2, 0.28, 0.12], hi: [0.4, 0.46, 0.24], rockTop: [0.07, 0.09, 0.07], cliff: [0.28, 0.27, 0.22], grass: [0.22, 0.5, 0.16], tree: [0.1, 0.34, 0.13], stone: [0.55, 0.53, 0.46], building: [0.4, 0.4, 0.38], glow: [0.4, 0.9, 0.6] },
  sand: { lo: [0.27, 0.2, 0.12], mid: [0.52, 0.41, 0.25], hi: [0.78, 0.68, 0.48], rockTop: [0.16, 0.12, 0.1], cliff: [0.42, 0.32, 0.24], grass: [0.45, 0.5, 0.2], tree: [0.3, 0.42, 0.16], stone: [0.7, 0.62, 0.5], building: [0.62, 0.55, 0.45], glow: [0.9, 0.7, 0.4] },
  // the protoss homeland: sun-warmed gold stone under a pale blue energy glow
  aiur: { lo: [0.16, 0.13, 0.1], mid: [0.4, 0.34, 0.24], hi: [0.72, 0.62, 0.42], rockTop: [0.1, 0.09, 0.11], cliff: [0.36, 0.3, 0.26], grass: [0.34, 0.44, 0.2], tree: [0.2, 0.36, 0.18], stone: [0.74, 0.66, 0.5], building: [0.5, 0.46, 0.5], glow: [0.4, 0.72, 1.0] },
  city: { lo: [0.1, 0.11, 0.14], mid: [0.21, 0.22, 0.26], hi: [0.38, 0.39, 0.45], rockTop: [0.06, 0.06, 0.08], cliff: [0.26, 0.27, 0.31], grass: [0.2, 0.42, 0.2], tree: [0.14, 0.34, 0.18], stone: [0.55, 0.56, 0.6], building: [0.36, 0.4, 0.5], glow: [0.5, 0.75, 1.0] },
};
/**
 * The map's colours: its own palette when the asset has one (read from the minimap in the map file), otherwise a guess from the name of
 * the tile set. The name says little (an Aiur4City map can be dark teal, a desert-sounding one green), so the palette wins. Grass, trees
 * and glows are not in the minimap; they lean toward the ground so a green tuft does not sit on blue-grey stone.
 */
export function themeOf(M: { tileSet: string; palette?: Record<string, RGB> | null }): Theme {
  const base = themeFor(M.tileSet), p = M.palette;
  if (!p) return base;
  const toward = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const greener = (c: RGB): RGB => [c[0] * 0.8, Math.min(1, c[1] * 1.15), c[2] * 0.7];
  return {
    ...base, lo: p.lo, mid: p.mid, hi: p.hi, cliff: p.cliff, stone: p.stone, building: p.building, rockTop: p.rockTop,
    grass: toward(base.grass, greener(p.mid), 0.55), tree: toward(base.tree, greener(p.lo), 0.35),
  };
}

export function themeFor(tileSet: string): Theme {
  if (/aiur|protoss|shakuras|talDarim|ulnar/i.test(tileSet)) return THEMES.aiur;
  if (/grass|braxis|jungle|agria|belshir|haven/i.test(tileSet)) return THEMES.green;
  if (/desert|purification|elsecaro|marsara|sand/i.test(tileSet)) return THEMES.sand;
  if (/tarsonis|korhal|portcity|dominion/i.test(tileSet)) return THEMES.city;
  return THEMES.dust;
}
/**
 * Unpathable ground is drawn at the height the map records for it. Most of it is not rock but lower land: in the five maps
 * 51-78% of the cells deep inside unpathable areas lie 80-240 recorded units below every walkable cell around them, and the border of the
 * map is at the bottom. So the open ground between plateaus is a drop, not a wall. The drop is cut off at CHASM world units below
 * the lowest walkable ground (the true depth would push the plateaus into a sliver) and a little rock may stand above the highest ground.
 */
export const CHASM = 6.5;
const BLUFF = 3.0;
const CLIFF_STEP = 0.12;    // a height difference between neighbouring cells, as a share of the relief, that counts as a cliff
const CLIFF_FACE = 0.2;     // half the width of the cliff face, in cells (the drop spans 0.4 of a cell instead of one)

const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const vnoise = (x: number, y: number) => {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};

export interface TerrainField {
  fw: number;
  fh: number;
  /** Heights on the fine grid, row 0 = lowest y. Vertex (i, j) sits at crop cell (i / SUBDIV, j / SUBDIV). */
  H: Float32Array;
  /** Steepness (height change per cell) on the same grid. */
  slope: Float32Array;
  /** Ground height at a crop-cell position (bilinear). */
  heightAt(x: number, y: number): number;
  relief: number;
}

function box(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++; } } tmp[y * w + x] = s / n; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; } } out[y * w + x] = s / n; }
  return out;
}

const RAMP_EASE = 5;       // cells beyond a ramp that are eased into it

/**
 * The game's ramps are straight slopes that begin and end at a crease, and from the usual camera that reads as a steep wall. This
 * evens out the ground on and just around every ramp (pathable but not buildable) a few times, so the climb starts and ends gently.
 * The effect fades out with the distance from the ramp, so the plateaus and everything else keep their exact height.
 */
function easeRamps(M: MapGrid, ground: Float32Array): void {
  const { w, h } = M, weight = new Float32Array(w * h), dist = new Int16Array(w * h).fill(-1), queue: number[] = [];
  for (let i = 0; i < w * h; i++) if (M.pathable[i] && !M.buildable[i]) { dist[i] = 0; queue.push(i); }
  for (let head = 0; head < queue.length; head++) {                      // distance from the nearest ramp cell, over ground only
    const i = queue[head], x = i % w, y = (i - x) / w, d = dist[i];
    if (d >= RAMP_EASE) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx;
      if (dist[j] === -1 && M.pathable[j]) { dist[j] = d + 1; queue.push(j); }
    }
  }
  for (let i = 0; i < w * h; i++) if (dist[i] >= 0) weight[i] = 1 - dist[i] / (RAMP_EASE + 1);
  for (let pass = 0; pass < 6; pass++) {
    const next = ground.slice();
    for (const i of queue) {
      const x = i % w, y = (i - x) / w;
      let s = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && M.pathable[yy * w + xx]) { s += ground[yy * w + xx]; n++; }
      }
      if (n) next[i] = ground[i] + (s / n - ground[i]) * weight[i];
    }
    ground.set(next);
  }
}

export function buildField(M: MapGrid, relief: number): TerrainField {
  const { w, h } = M, span = Math.max(1, M.hMax - M.hMin);
  const ground = new Float32Array(w * h), target = new Float32Array(w * h);
  for (let i = 0; i < ground.length; i++) if (M.pathable[i]) ground[i] = ((M.height[i] - M.hMin) / span) * relief;
  easeRamps(M, ground);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (M.pathable[i]) { target[i] = ground[i]; continue; }
    const own = ((M.height[i] - M.hMin) / span) * relief;         // its own recorded height, on the same scale as the ground
    target[i] = Math.max(-CHASM, Math.min(relief + BLUFF, own));
  }
  const R = SUBDIV, fw = w * R + 1, fh = h * R + 1;
  let H: Float32Array = new Float32Array(fw * fh);
  const at = (x: number, y: number) => target[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
    const cx = i / R - 0.5, cy = j / R - 0.5, x0 = Math.floor(cx), y0 = Math.floor(cy);
    let fx = cx - x0, fy = cy - y0;
    const c00 = at(x0, y0), c10 = at(x0 + 1, y0), c01 = at(x0, y0 + 1), c11 = at(x0 + 1, y0 + 1);
    // Where neighbouring cells differ by a cliff's worth the blend between them is pulled towards the middle of the cell, so the drop
    // is a short steep face with a flat top and foot instead of a bowl; gentle ground keeps its plain blend.
    const drop = Math.max(c00, c10, c01, c11) - Math.min(c00, c10, c01, c11), sharp = smooth(relief * CLIFF_STEP, relief * CLIFF_STEP * 2, drop);
    if (sharp > 0) {
      const pull = (f: number) => f + (smooth(0.5 - CLIFF_FACE, 0.5 + CLIFF_FACE, f) - f) * sharp;
      fx = pull(fx); fy = pull(fy);
    }
    H[j * fw + i] = c00 * (1 - fx) * (1 - fy) + c10 * fx * (1 - fy) + c01 * (1 - fx) * fy + c11 * fx * fy;
  }
  H = box(H, fw, fh, 1);                                          // one light pass rounds off the corners of the grid

  const slope = new Float32Array(fw * fh);
  for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
    const dx = (H[j * fw + Math.min(fw - 1, i + 1)] - H[j * fw + Math.max(0, i - 1)]) / (2 / R), dy = (H[Math.min(fh - 1, j + 1) * fw + i] - H[Math.max(0, j - 1) * fw + i]) / (2 / R);
    slope[j * fw + i] = Math.hypot(dx, dy);
  }
  const heightAt = (x: number, y: number) => {
    const gx = Math.max(0, Math.min(fw - 1.001, x * R)), gy = Math.max(0, Math.min(fh - 1.001, y * R)), i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
    return H[j * fw + i] * (1 - fx) * (1 - fy) + H[j * fw + i + 1] * fx * (1 - fy) + H[(j + 1) * fw + i] * (1 - fx) * fy + H[(j + 1) * fw + i + 1] * fx * fy;
  };
  return { fw, fh, H, slope, heightAt, relief };
}

/** One colour texture for the whole map. Canvas row 0 is the highest y, which is how three.js maps v = 1. */
export function bakeTexture(M: MapGrid, f: TerrainField): HTMLCanvasElement {
  const { w, h } = M, span = Math.max(1, M.hMax - M.hMin);
  const px = Math.max(4, Math.min(8, Math.floor(1536 / Math.max(w, h))));          // pixels per cell
  const TW = w * px, TH = h * px;
  const rock = new Float32Array(w * h), ramp = new Float32Array(w * h), level = new Float32Array(w * h);
  for (let i = 0; i < rock.length; i++) { rock[i] = M.pathable[i] ? 0 : 1; ramp[i] = M.pathable[i] && !M.buildable[i] ? 1 : 0; level[i] = (M.height[i] - M.hMin) / span; }
  // the level inside rock is the level of the ground around it, so colours do not jump at the foot of a cliff
  for (let pass = 0; pass < 4; pass++) {
    const next = level.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (M.pathable[i]) continue;
      let s = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && (M.pathable[yy * w + xx] || pass > 0)) { s += level[yy * w + xx]; n++; } }
      if (n) next[i] = s / n;
    }
    level.set(next);
  }
  const rockBlur = box(box(rock, w, h, 2), w, h, 1), rampBlur = box(ramp, w, h, 1);

  const bil = (a: Float32Array, x: number, y: number) => {
    const cx = Math.max(0, Math.min(w - 1.001, x - 0.5)), cy = Math.max(0, Math.min(h - 1.001, y - 0.5)), x0 = Math.floor(cx), y0 = Math.floor(cy), fx = cx - x0, fy = cy - y0;
    return a[y0 * w + x0] * (1 - fx) * (1 - fy) + a[y0 * w + x0 + 1] * fx * (1 - fy) + a[(y0 + 1) * w + x0] * (1 - fx) * fy + a[(y0 + 1) * w + x0 + 1] * fx * fy;
  };
  const slopeAt = (x: number, y: number) => {
    const gx = Math.max(0, Math.min(f.fw - 1.001, x * SUBDIV)), gy = Math.max(0, Math.min(f.fh - 1.001, y * SUBDIV)), i = Math.floor(gx), j = Math.floor(gy);
    return f.slope[j * f.fw + i];
  };

  const cv = document.createElement("canvas"); cv.width = TW; cv.height = TH;
  const g = cv.getContext("2d")!, img = g.createImageData(TW, TH), d = img.data;
  const theme = themeOf(M), { lo, mid, hi, rockTop, cliff } = theme;
  const toSrgb = (v: number) => Math.round(255 * Math.pow(Math.min(1, Math.max(0, v)), 1 / 2.2));
  for (let py = 0; py < TH; py++) {
    const y = h - (py + 0.5) / px;
    for (let pxl = 0; pxl < TW; pxl++) {
      const x = (pxl + 0.5) / px;
      const lv = bil(level, x, y), rk = smooth(0.25, 0.75, bil(rock, x, y)), rb = bil(rockBlur, x, y), rp = bil(rampBlur, x, y), sl = slopeAt(x, y);
      // broad mottling, medium patches and fine grain
      const big = vnoise(x * 0.11, y * 0.11), med = vnoise(x * 0.55, y * 0.55), fine = vnoise(x * 2.4, y * 2.4), grain = hash(pxl, py) - 0.5;
      const n = 0.80 + big * 0.26 + med * 0.14 + fine * 0.08 + grain * 0.05;
      const a = lv < 0.5 ? lo : mid, b = lv < 0.5 ? mid : hi, k = lv < 0.5 ? lv * 2 : (lv - 0.5) * 2;
      let r = a[0] + (b[0] - a[0]) * k, gg = a[1] + (b[1] - a[1]) * k, bb = a[2] + (b[2] - a[2]) * k;
      const warm = (med - 0.5) * 0.05;
      r += warm; bb -= warm;
      const wear = smooth(0.15, 0.7, rp);                                                    // ramps and paths: worn and lighter
      r = r * (1 + 0.2 * wear) + 0.02 * wear; gg = gg * (1 + 0.18 * wear) + 0.02 * wear; bb = bb * (1 + 0.12 * wear);
      const ao = 1 - 0.55 * smooth(0.02, 0.85, rb) * (1 - rk);                              // ground darkens beside cliffs
      r *= ao; gg *= ao; bb *= ao;
      // rock: dark flat tops, lighter strata on steep faces
      const face = smooth(0.7, 2.0, sl);
      const strata = 0.82 + 0.18 * Math.sin(lv * 40 + big * 9 + (x + y) * 0.35) + (fine - 0.5) * 0.25;
      const topR = rockTop[0] * (0.8 + med * 0.5), topG = rockTop[1] * (0.8 + med * 0.5), topB = rockTop[2] * (0.8 + med * 0.5);
      const faceR = cliff[0] * strata * (1 - 0.45 * smooth(0.6, 1, rb)), faceG = cliff[1] * strata * (1 - 0.45 * smooth(0.6, 1, rb)), faceB = cliff[2] * strata * (1 - 0.45 * smooth(0.6, 1, rb));
      const cm = Math.max(rk, face * 0.9);
      r = r * (1 - cm) + (topR * (1 - face) + faceR * face) * cm; gg = gg * (1 - cm) + (topG * (1 - face) + faceG * face) * cm; bb = bb * (1 - cm) + (topB * (1 - face) + faceB * face) * cm;
      r *= n; gg *= n; bb *= n * 0.97;
      const o = (py * TW + pxl) * 4;
      d[o] = toSrgb(r); d[o + 1] = toSrgb(gg); d[o + 2] = toSrgb(bb); d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

/** Tiling normal map from layered noise: gives the ground and rock a gritty surface under the sun without a bigger mesh. */
export function makeNormalMap(size = 256, strength = 2.2): HTMLCanvasElement {
  const period = 8, hgt = new Float32Array(size * size);
  const wrapNoise = (x: number, y: number, per: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const H = (a: number, b: number) => hash(((a % per) + per) % per, ((b % per) + per) % per);
    return H(x0, y0) * (1 - sx) * (1 - sy) + H(x0 + 1, y0) * sx * (1 - sy) + H(x0, y0 + 1) * (1 - sx) * sy + H(x0 + 1, y0 + 1) * sx * sy;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    hgt[y * size + x] = wrapNoise(u * period, v * period, period) * 0.5 + wrapNoise(u * period * 2, v * period * 2, period * 2) * 0.3 + wrapNoise(u * period * 4, v * period * 4, period * 4) * 0.2;
  }
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const g = cv.getContext("2d")!, img = g.createImageData(size, size);
  const at = (x: number, y: number) => hgt[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength * 6, dy = (at(x, y + 1) - at(x, y - 1)) * strength * 6, l = Math.hypot(dx, dy, 1), o = (y * size + x) * 4;
    img.data[o] = Math.round((-dx / l * 0.5 + 0.5) * 255); img.data[o + 1] = Math.round((dy / l * 0.5 + 0.5) * 255); img.data[o + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

/**
 * The flat map used by the 2D view and the minimap: terrain at one pixel per cell, scaled up by `px`, with the map's features marked
 * (grass, trees, rocks, buildings, destructible rocks, towers, geysers) so the layout can be read without the 3D view.
 */
export function flatMapCanvas(M: MapGrid, px = 1): HTMLCanvasElement {
  const base = document.createElement("canvas"); base.width = M.w; base.height = M.h;
  const bg = base.getContext("2d")!, img = bg.createImageData(M.w, M.h), span = Math.max(1, M.hMax - M.hMin), th = themeFor(M.tileSet);
  const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
    const i = y * M.w + x, o = ((M.h - 1 - y) * M.w + x) * 4;
    let c: RGB = [0.05, 0.055, 0.1];
    if (M.pathable[i]) {
      const f = (M.height[i] - M.hMin) / span;
      c = f < 0.5 ? mix(th.lo, th.mid, f * 2) : mix(th.mid, th.hi, (f - 0.5) * 2);
      c = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
      if (!M.buildable[i]) c = [c[0] * 1.25 + 0.03, c[1] * 1.22 + 0.03, c[2] * 1.15 + 0.03];
    } else c = [th.cliff[0] * 0.5, th.cliff[1] * 0.5, th.cliff[2] * 0.5];
    img.data[o] = Math.min(255, c[0] * 255 * 1.1); img.data[o + 1] = Math.min(255, c[1] * 255 * 1.1); img.data[o + 2] = Math.min(255, c[2] * 255 * 1.1); img.data[o + 3] = 255;
  }
  bg.putImageData(img, 0, 0);
  if (px === 1) return base;
  const cv = document.createElement("canvas"); cv.width = M.w * px; cv.height = M.h * px;
  const g = cv.getContext("2d")!;
  g.imageSmoothingEnabled = false; g.drawImage(base, 0, 0, cv.width, cv.height);
  const X = (x: number) => x * px, Y = (y: number) => (M.h - y) * px, css = (c: RGB, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
  for (const d of M.doodads) {
    const r = Math.max(0.35, Math.min(1.6, d.scale * 0.55)) * px;
    if (d.cls === "grass") { g.fillStyle = css(th.grass, 0.75); g.fillRect(X(d.x) - r, Y(d.y) - r, r * 2, r * 2); }
    else if (d.cls === "tree") { g.fillStyle = css(th.tree, 0.9); g.beginPath(); g.arc(X(d.x), Y(d.y), r * 1.1, 0, 6.283); g.fill(); }
    else if (d.cls === "rock" || d.cls === "column") { g.fillStyle = css(th.stone, 0.55); g.beginPath(); g.arc(X(d.x), Y(d.y), r * 0.8, 0, 6.283); g.fill(); }
    else if (d.cls === "building" || d.cls === "ruin" || d.cls === "wall") { g.fillStyle = css(th.building, 0.8); g.fillRect(X(d.x) - r, Y(d.y) - r, r * 2, r * 2); }
    else if (d.cls === "crystal") { g.fillStyle = css(th.glow, 0.9); g.fillRect(X(d.x) - r * 0.6, Y(d.y) - r * 0.6, r * 1.2, r * 1.2); }
  }
  for (const u of M.special) {
    if (u.kind === "dest") { g.fillStyle = "rgba(255,140,60,.75)"; g.fillRect(X(u.x - u.w / 2), Y(u.y + u.h / 2), u.w * px, u.h * px); }
    else if (u.kind === "plate") { g.strokeStyle = "rgba(220,230,255,.6)"; g.strokeRect(X(u.x - u.w / 2), Y(u.y + u.h / 2), u.w * px, u.h * px); }
    else { g.strokeStyle = "rgba(90,240,230,.9)"; g.lineWidth = Math.max(1, px * 0.4); g.beginPath(); g.arc(X(u.x), Y(u.y), px * 2.2, 0, 6.283); g.stroke(); g.fillStyle = "rgba(90,240,230,.9)"; g.fillRect(X(u.x) - px * 0.8, Y(u.y) - px * 0.8, px * 1.6, px * 1.6); }
  }
  g.fillStyle = "rgba(94,224,138,.95)";
  for (const [x, y] of M.gas) g.fillRect(X(x) - px * 1.5, Y(y) - px * 1.5, px * 3, px * 3);
  return cv;
}
