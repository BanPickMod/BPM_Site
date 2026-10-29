import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MapGrid } from "@/lib/replay/mapAsset";
import { themeFor, type Theme } from "./terrain";

/**
 * What the map maker placed, drawn with our own simple shapes so the layout is recognisable: tall grass and bushes (vision blockers),
 * trees, rocks, columns, ruins, buildings, walls, crystals, destructible rocks, Xel'Naga towers and geysers. Only names and positions come
 * from the map file; no game model or texture is used.
 */
type G = THREE.BufferGeometry;
const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

function paint(g: G, c: [number, number, number]): G {
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}
const place = (g: G, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0): G => {
  const c = (g.index ? g.toNonIndexed() : g.clone()) as G;
  c.deleteAttribute("uv");
  if (c.attributes.normal === undefined) c.computeVertexNormals();
  c.scale(sx, sy, sz); c.rotateX(rx); c.rotateY(ry); c.rotateZ(rz); c.translate(x, y, z);
  return c;
};
const box = (c: [number, number, number], ...a: number[]) => paint(place(new THREE.BoxGeometry(1, 1, 1), ...(a as [number, number, number])), c);
const cone = (c: [number, number, number], seg: number, ...a: number[]) => paint(place(new THREE.ConeGeometry(0.5, 1, seg), ...(a as [number, number, number])), c);
const cyl = (c: [number, number, number], seg: number, ...a: number[]) => paint(place(new THREE.CylinderGeometry(0.5, 0.5, 1, seg), ...(a as [number, number, number])), c);
const ico = (c: [number, number, number], ...a: number[]) => paint(place(new THREE.IcosahedronGeometry(0.5, 0), ...(a as [number, number, number])), c);
const oct = (c: [number, number, number], ...a: number[]) => paint(place(new THREE.OctahedronGeometry(0.5), ...(a as [number, number, number])), c);
const merge = (parts: G[]): G => mergeGeometries(parts.map((p) => { if (p.index) p = p.toNonIndexed(); return p; }))!;
const shade = (c: [number, number, number], k: number): [number, number, number] => [c[0] * k, c[1] * k, c[2] * k];

type C3 = [number, number, number];
const h3 = (x: number, y: number, z: number) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

/**
 * Makes a clean primitive look worn. Corners wander a little (identically for every vertex that shares a corner, so nothing splits),
 * each face gets its own shade, the foot is darker than the top, and faces that look up pick up moss (`mossAmt`, 0 for a dry map).
 * The foot stays flat so a piece sits on the ground.
 */
function weather(src: G, o: { seed: number; amp: number; tone: C3; moss?: C3; mossAmt?: number }): G {
  const g = (src.index ? src.toNonIndexed() : src.clone()) as G;
  g.deleteAttribute("uv"); g.deleteAttribute("color");
  const p = g.attributes.position as THREE.BufferAttribute;
  g.computeBoundingBox();
  const minY = g.boundingBox!.min.y, spanY = Math.max(1e-3, g.boundingBox!.max.y - minY);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), kx = Math.round(x * 50), ky = Math.round(y * 50), kz = Math.round(z * 50);
    const foot = y - minY < 1e-4;
    p.setXYZ(i, x + (h3(kx, ky + o.seed, kz) - 0.5) * 2 * o.amp, foot ? y : y + (h3(kx + 7.1, ky, kz + o.seed) - 0.5) * 2 * o.amp, z + (h3(kx, ky + 3.3, kz + o.seed * 1.7) - 0.5) * 2 * o.amp);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal as THREE.BufferAttribute, col = new Float32Array(p.count * 3), moss = o.moss ?? o.tone;
  for (let f = 0; f + 2 < p.count; f += 3) {
    const jitter = 0.88 + h3(f, o.seed, 1.3) * 0.24, mossy = (o.mossAmt ?? 0) * Math.max(0, n.getY(f) - 0.55) / 0.45;
    for (let k = 0; k < 3; k++) {
      const grade = 0.72 + 0.4 * Math.min(1, (p.getY(f + k) - minY) / spanY);
      for (let c = 0; c < 3; c++) col[(f + k) * 3 + c] = (o.tone[c] * grade * (1 - mossy) + moss[c] * mossy) * jitter;
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

const ico1 = () => new THREE.IcosahedronGeometry(0.5, 1);
const sbox = () => new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
const scyl = (top = 0.5, bottom = 0.5, seg = 8) => new THREE.CylinderGeometry(top, bottom, 1, seg, 2);

/** Several shapes per kind of thing, so a field of them does not repeat. The viewer picks one for each placed item. */
function shapes(th: Theme): Record<string, G[]> {
  const dark = shade(th.tree, 0.7), trunk: C3 = [0.22, 0.14, 0.09];
  const lush = th.grass[1] - th.grass[0] > 0.2, mossAmt = lush ? 0.55 : 0.12;
  // a weathered part: k darkens or lightens the kind's own tone
  const W = (g: G, tone: C3, amp: number, seed: number, moss = true) => weather(g, { seed, amp, tone, moss: th.grass, mossAmt: moss ? mossAmt : 0 });
  const st = (k: number) => shade(th.stone, k), bd = (k: number) => shade(th.building, k);
  const grass = (n: number, h: number) => merge(Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, r = i === n - 1 ? 0 : 0.55; return cone(i % 2 ? shade(th.grass, 0.8) : th.grass, 5, Math.cos(a) * r, 0.7, Math.sin(a) * r, 0.34, h + (i % 3) * 0.3, 0.34, Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); }));
  // dark floor bands with a few lit windows: a facade instead of a bare block
  const floors = (x: number, z: number, w: number, d: number, ys: number[]) => ys.flatMap((y, i) => [
    box(bd(0.38), x, y, z, w, 0.16, d),
    ...(i % 2 === 0 ? [box(th.glow, x + w / 2 - 0.02, y + 0.28, z + (h3(i, w, 9) - 0.5) * d * 0.5, 0.06, 0.2, 0.34)] : []),
  ]);
  const small = (seed: number) => Array.from({ length: 5 }, (_, i) => W(place(ico1(), (h3(i, seed, 1) - 0.5) * 2.2, 0.18, (h3(i, seed, 2) - 0.5) * 2.2, 0.5 + h3(i, seed, 3) * 0.5, 0.35 + h3(i, seed, 4) * 0.3, 0.5 + h3(i, seed, 5) * 0.5), st(0.55 + h3(i, seed, 6) * 0.3), 0.05, seed + i));
  return {
    grass: [grass(7, 1.5), grass(5, 2.3)],
    tree: [
      // a pine: trunk and three stacked cones
      merge([cyl(trunk, 6, 0, 0.8, 0, 0.36, 1.6, 0.36), W(place(new THREE.ConeGeometry(0.5, 1, 7, 2), 0, 2.2, 0, 2.6, 2.0, 2.6), th.tree, 0.12, 21, false), W(place(new THREE.ConeGeometry(0.5, 1, 7, 2), 0, 3.4, 0, 2.0, 1.8, 2.0), shade(th.tree, 1.15), 0.1, 22, false), W(place(new THREE.ConeGeometry(0.5, 1, 7, 2), 0, 4.4, 0, 1.3, 1.5, 1.3), dark, 0.08, 23, false)]),
      // a broadleaf: a short trunk and a rounded crown
      merge([cyl(trunk, 6, 0, 0.9, 0, 0.5, 1.8, 0.5), W(place(ico1(), 0, 3.0, 0, 3.0, 2.3, 3.0), th.tree, 0.2, 24, false), W(place(ico1(), 0.7, 3.9, -0.3, 1.9, 1.5, 1.9), shade(th.tree, 1.2), 0.15, 25, false)]),
      // a tall jungle tree: a long bare trunk under a flat crown
      merge([cyl(trunk, 6, 0, 2.2, 0, 0.42, 4.4, 0.42), W(place(ico1(), 0, 5.0, 0, 4.0, 1.1, 4.0), shade(th.tree, 0.95), 0.2, 26, false), W(place(ico1(), -1.2, 4.3, 0.6, 2.0, 0.8, 2.0), dark, 0.15, 27, false)]),
    ],
    rock: [
      merge([W(place(ico1(), 0, 0.5, 0, 1.7, 1.2, 1.5), st(0.62), 0.07, 1)]),                                                       // round boulder
      merge([W(place(ico1(), 0, 0.28, 0, 2.5, 0.62, 1.8, 0, 0.5, 0.06), st(0.7), 0.05, 2)]),                                          // flat slab
      merge([W(place(ico1(), 0, 1.25, 0, 0.95, 2.5, 0.9, 0.08, 0, -0.1), st(0.58), 0.09, 3)]),                                        // standing stone
      merge([W(place(ico1(), 0, 0.45, 0, 1.4, 0.95, 1.2), st(0.6), 0.07, 4), W(place(ico1(), 0.95, 0.3, 0.35, 0.9, 0.6, 0.8), st(0.72), 0.07, 5), W(place(ico1(), -0.6, 0.25, 0.7, 0.7, 0.5, 0.65), st(0.82), 0.07, 6)]),   // pile of three
      merge([W(place(new THREE.OctahedronGeometry(0.5, 1), 0, 0.9, 0, 1.0, 1.9, 0.85, 0.12, 0.4, 0.2), st(0.55), 0.11, 7)]),          // jagged shard
      merge(small(40)),                                                                                                                  // scatter of small stones
    ],
    column: [
      merge([W(place(sbox(), 0, 0.25, 0, 1.4, 0.5, 1.4), st(0.8), 0.04, 31), W(place(scyl(0.5, 0.5, 8), 0, 2.0, 0, 0.9, 3.2, 0.9), st(1), 0.03, 32), W(place(sbox(), 0, 3.75, 0, 1.3, 0.35, 1.3), st(0.9), 0.04, 33)]),
      merge([W(place(sbox(), 0, 0.25, 0, 1.4, 0.5, 1.4), st(0.8), 0.04, 34), W(place(scyl(0.46, 0.5, 8), 0, 1.0, 0, 0.9, 1.6, 0.9, 0.04, 0, 0.05), st(0.95), 0.05, 35), W(place(scyl(0.5, 0.5, 8), 1.2, 0.45, 0.7, 0.8, 1.5, 0.8, 0, 0, Math.PI / 2), st(0.85), 0.05, 36)]),   // snapped, a piece fallen
      merge([W(place(sbox(), -0.9, 0.2, 0, 1.0, 0.4, 1.0), st(0.8), 0.04, 37), W(place(sbox(), 0.9, 0.2, 0, 1.0, 0.4, 1.0), st(0.8), 0.04, 38), W(place(scyl(0.5, 0.5, 8), -0.9, 1.7, 0, 0.7, 2.6, 0.7), st(1), 0.03, 39), W(place(scyl(0.5, 0.5, 8), 0.9, 1.7, 0, 0.7, 2.6, 0.7), st(1), 0.03, 40), W(place(sbox(), 0, 3.15, 0, 3.0, 0.45, 0.9), st(0.9), 0.04, 41)]),   // a pair with a lintel
    ],
    ruin: [
      merge([W(place(sbox(), 0, 0.5, 0, 3.0, 1.0, 0.7), st(0.75), 0.06, 11), W(place(sbox(), -1.0, 1.3, 0, 0.9, 1.6, 0.7), st(0.9), 0.07, 12), W(place(sbox(), 1.3, 0.25, 0.7, 0.7, 0.5, 0.6, 0, 0.4, 0), st(0.7), 0.06, 13)]),     // a broken wall
      merge([W(place(sbox(), 0, 0.2, 0, 3.0, 0.4, 2.4), st(0.7), 0.05, 14), W(place(scyl(0.5, 0.5, 8), -0.2, 0.75, 0.2, 0.8, 2.8, 0.8, 0, 0.3, Math.PI / 2), st(0.95), 0.05, 15), W(place(scyl(0.5, 0.5, 8), 0.6, 0.75, -0.6, 0.8, 1.6, 0.8, 0, 1.0, Math.PI / 2), st(0.85), 0.05, 16)]),   // fallen columns on a slab
      merge([W(place(sbox(), 0, 0.25, 0, 3.4, 0.5, 3.4), st(0.7), 0.05, 17), W(place(sbox(), 0, 0.75, 0, 2.5, 0.5, 2.5), st(0.8), 0.05, 18), W(place(sbox(), 0, 1.25, 0, 1.6, 0.5, 1.6), st(0.9), 0.05, 19), box(th.glow, 0, 1.55, 0, 0.5, 0.1, 0.5)]),   // steps with a lit stone
      merge([W(place(sbox(), -1.2, 1.3, 0, 0.7, 2.6, 0.7), st(0.85), 0.05, 20), W(place(sbox(), 1.2, 0.9, 0, 0.7, 1.8, 0.7), st(0.8), 0.06, 28), W(place(sbox(), -0.55, 2.75, 0, 1.9, 0.55, 0.7, 0, 0, 0.06), st(0.95), 0.05, 29), W(place(sbox(), 0.3, 0.2, 0.8, 0.9, 0.4, 0.8), st(0.7), 0.05, 30)]),   // an arch that did not survive
      merge([W(place(sbox(), 0, 0.2, 0, 2.4, 0.4, 2.4), st(0.7), 0.05, 42), W(place(scyl(0.34, 0.55, 7), 0, 1.3, 0, 1.6, 1.8, 1.6), st(0.88), 0.06, 43), W(place(ico1(), 0.9, 0.3, 0.8, 0.8, 0.5, 0.7), st(0.7), 0.05, 44)]),   // a worn shrine stump
    ],
    building: [
      merge([box(th.building, 0, 1.0, 0, 2.6, 2.0, 2.6), box(shade(th.building, 0.7), 0, 2.1, 0, 2.85, 0.22, 2.85), box(shade(th.building, 1.2), 0.7, 2.5, 0.5, 0.8, 0.55, 0.8), ...floors(0, 0, 2.66, 2.66, [0.55, 1.1, 1.65])]),
      merge([box(bd(0.95), 0, 1.7, 0, 1.9, 3.4, 1.9), box(bd(0.7), 0, 3.5, 0, 2.1, 0.2, 2.1), cyl(bd(1.3), 6, 0.4, 4.2, 0.3, 0.12, 1.4, 0.12), ...floors(0, 0, 1.96, 1.96, [0.5, 1.0, 1.5, 2.0, 2.5, 3.0])]),     // a tall block with an antenna
      merge([box(bd(1), -0.7, 0.9, 0, 1.8, 1.8, 2.8), box(bd(0.85), 0.9, 0.6, 0.5, 1.8, 1.2, 1.8), box(bd(0.7), -0.7, 1.9, 0, 2.0, 0.2, 3.0), ...floors(-0.7, 0, 1.86, 2.86, [0.5, 1.0, 1.5])]),        // two joined low blocks
    ],
    wall: [
      merge([box(bd(0.85), 0, 0.65, 0, 3.4, 1.3, 0.55), box(bd(0.6), 0, 1.35, 0, 3.6, 0.15, 0.75)]),
      merge([box(bd(0.85), -1.1, 0.65, 0, 1.2, 1.3, 0.55), box(bd(0.85), 1.1, 0.5, 0, 1.2, 1.0, 0.55), box(bd(0.6), -1.1, 1.35, 0, 1.4, 0.15, 0.75)]),   // a gap in it
    ],
    pebble: [merge([W(place(ico1(), 0, 0.15, 0, 0.5, 0.32, 0.45), st(0.65), 0.04, 50), W(place(ico1(), 0.45, 0.1, 0.2, 0.3, 0.2, 0.28), st(0.8), 0.04, 51)])],
    tuft: [grass(5, 0.8)],
    crystal: [merge([oct(th.glow, 0, 1.0, 0, 0.8, 2.4, 0.8), oct(shade(th.glow, 0.8), 0.6, 0.6, 0.2, 0.5, 1.5, 0.5), oct(shade(th.glow, 0.9), -0.5, 0.5, -0.3, 0.45, 1.2, 0.45)])],
    prop: [merge([box([0.45, 0.3, 0.2], 0, 0.35, 0, 0.9, 0.7, 0.9), box([0.55, 0.4, 0.25], 0.5, 0.2, 0.4, 0.5, 0.4, 0.5)])],
  };
}

const CAST = new Set(["tree", "rock", "column", "ruin", "building", "wall"]);
const SIZE: Record<string, [number, number]> = { grass: [0.8, 2.0], tree: [0.8, 1.8], rock: [0.7, 2.2], column: [0.8, 1.6], ruin: [0.8, 1.8], building: [0.7, 1.3], wall: [0.8, 1.8], crystal: [0.8, 1.8], prop: [0.8, 1.5] };
/** How often each shape is chosen: the plain ones are common, the striking ones rare. */
const WEIGHTS: Record<string, number[]> = { rock: [3, 3, 1.4, 2, 1, 2], ruin: [3, 2, 2, 1.6, 1.4], tree: [3, 2, 1.4], column: [3, 1.6, 1], building: [3, 1.5, 2], wall: [3, 1.4], grass: [3, 2] };
const SINK: Record<string, number> = { rock: 0.1, ruin: 0.06, column: 0.04, wall: 0.04 };

/** Items nearer than this (cells) to a bigger one of the same kind are dropped: piles that read as clutter, most of all in the city maps. */
const THIN: Record<string, number> = { building: 2.4, wall: 1.5, ruin: 1.6, column: 1.3, rock: 0.9, tree: 1.0 };

function thin<T extends { x: number; y: number; scale: number }>(items: T[], minDist: number): T[] {
  const kept: T[] = [], grid = new Map<string, T[]>(), cell = (v: number) => Math.floor(v / minDist);
  for (const d of [...items].sort((a, b) => b.scale - a.scale || a.x - b.x || a.y - b.y)) {
    const cx = cell(d.x), cy = cell(d.y);
    let free = true;
    for (let gx = cx - 1; gx <= cx + 1 && free; gx++) for (let gy = cy - 1; gy <= cy + 1 && free; gy++) {
      for (const k of grid.get(`${gx},${gy}`) ?? []) if (Math.hypot(d.x - k.x, d.y - k.y) < minDist) { free = false; break; }
    }
    if (!free) continue;
    kept.push(d);
    const key = `${cx},${cy}`;
    (grid.get(key) ?? grid.set(key, []).get(key)!).push(d);
  }
  return kept;
}

function pickVariant(cls: string, n: number, r: number): number {
  const w = WEIGHTS[cls] ?? Array.from({ length: n }, () => 1), total = w.slice(0, n).reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < n; i++) { acc += w[i] ?? 1; if (r * total < acc) return i; }
  return n - 1;
}

export interface Features { group: THREE.Group; setVisible(v: boolean): void; counts: Record<string, number>; dispose(): void }

export function buildFeatures(M: MapGrid, heightAt: (x: number, y: number) => number, lx: (x: number) => number, lz: (y: number) => number): Features {
  const th = themeFor(M.tileSet), group = new THREE.Group(), geos = shapes(th), counts: Record<string, number> = {};
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.02 });
  const glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: new THREE.Color(th.glow[0], th.glow[1], th.glow[2]), emissiveIntensity: 0.55 });
  const dummy = new THREE.Object3D(), tint = new THREE.Color();

  for (const cls of Object.keys(geos)) {
    const placed = M.doodads.filter((d) => d.cls === cls && d.x >= 0 && d.y >= 0 && d.x < M.w && d.y < M.h);
    const list = THIN[cls] ? thin(placed, THIN[cls]) : placed;
    if (!list.length) continue;
    counts[cls] = list.length;
    const variants = geos[cls], byVariant: (typeof list)[] = variants.map(() => []);
    list.forEach((d) => byVariant[pickVariant(cls, variants.length, hash(d.x * 9.1 + 3.7, d.y * 4.7 + 1.3))].push(d));
    const [lo, hi] = SIZE[cls];
    variants.forEach((geo, vi) => {
      const items = byVariant[vi];
      if (!items.length) return;
      const mesh = new THREE.InstancedMesh(geo, cls === "crystal" ? glowMat : mat, items.length);
      items.forEach((d, i) => {
        const j = hash(d.x * 3.1, d.y * 1.7), s = Math.min(hi, Math.max(lo, d.scale * (0.8 + j * 0.4))), stretch = 0.9 + hash(d.y * 2.9, d.x * 1.1) * 0.25;
        // stand on the lowest ground under the piece, a little sunk in, so nothing hovers on a slope
        const r = 0.5 * s, ground = Math.min(heightAt(d.x, d.y), heightAt(d.x + r, d.y), heightAt(d.x - r, d.y), heightAt(d.x, d.y + r), heightAt(d.x, d.y - r));
        dummy.position.set(lx(d.x), ground - (SINK[cls] ?? 0) * s * 2, lz(d.y));
        const tilt = cls === "rock" ? (hash(d.x, d.y * 5.1) - 0.5) * 0.35 : 0;
        dummy.rotation.set(tilt, (d.rot * Math.PI) / 180, cls === "rock" ? (hash(d.y, d.x * 2.3) - 0.5) * 0.35 : 0);
        dummy.scale.set(s * (cls === "rock" || cls === "ruin" ? stretch : 1), s * (cls === "building" ? 0.8 + j * 0.6 : cls === "rock" ? 0.85 + j * 0.4 : 1), s * (cls === "rock" || cls === "ruin" ? 2 - stretch : 1));
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        const v = 0.84 + hash(d.x, d.y * 2.3) * 0.3; tint.setRGB(v * (0.95 + hash(d.x * 1.3, d.y) * 0.1), v * (0.97 + hash(d.y * 1.9, d.x) * 0.06), v * (0.93 + hash(d.x, d.y * 3.3) * 0.12)); mesh.setColorAt(i, tint);
      });
      mesh.castShadow = CAST.has(cls); mesh.receiveShadow = cls !== "grass"; mesh.frustumCulled = false;
      group.add(mesh);
    });
  }

  // broken stone along the foot of every cliff: the plateaus end in jagged rock instead of a smooth slope
  const DIR4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  {
    const chunks: { x: number; y: number; s: number; rot: number; v: number }[] = [];
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
      if (M.pathable[y * M.w + x] || hash(x * 1.7, y * 2.9) > 0.5) continue;
      let nx = 0, ny = 0, n = 0;
      for (const [dx, dy] of DIR4) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < M.w && yy < M.h && M.pathable[yy * M.w + xx]) { nx += dx; ny += dy; n++; } }
      if (!n) continue;
      const j = hash(x * 3.3 + 1, y * 5.1);
      chunks.push({ x: x + 0.5 + (nx / n) * 0.4 + (j - 0.5) * 0.5, y: y + 0.5 + (ny / n) * 0.4 + (hash(y, x * 1.9) - 0.5) * 0.5, s: 0.65 + j * 0.95, rot: hash(x, y) * 360, v: Math.floor(hash(y * 2.1, x * 0.7) * 3) });
    }
    const stride = Math.max(1, Math.ceil(chunks.length / 3200)), picked = chunks.filter((_, i) => i % stride === 0);
    const kinds = [0, 3, 4];                                  // round, a small pile and jagged: a slab or a tall standing stone looks wrong set into a cliff
    kinds.forEach((rockIndex, k) => {
      const items = picked.filter((c) => c.v === k);
      if (!items.length || !geos.rock[rockIndex]) return;
      const mesh = new THREE.InstancedMesh(geos.rock[rockIndex], mat, items.length);
      items.forEach((c, i) => {
        dummy.position.set(lx(c.x), heightAt(c.x, c.y) - 0.15 * c.s, lz(c.y));
        dummy.rotation.set((hash(c.x, c.y) - 0.5) * 0.5, (c.rot * Math.PI) / 180, (hash(c.y, c.x) - 0.5) * 0.5);
        dummy.scale.set(c.s * 1.1, c.s * (0.8 + hash(c.x * 2, c.y) * 0.45), c.s * 1.1); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        const v = 0.62 + hash(c.x * 1.9, c.y * 1.3) * 0.3; tint.setRGB(v, v * 0.98, v * 0.95); mesh.setColorAt(i, tint);
      });
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh);
    });
    counts.cliff = picked.length;
  }

  // pebbles and small tufts on the open ground, left out around bases and resources so nothing hides where a building goes
  {
    const anchors: [number, number, number][] = [...M.starts.map(([x, y]) => [x, y, 8.5] as [number, number, number]), ...M.exps.map(([x, y]) => [x, y, 7.5] as [number, number, number]), ...M.res.map(([x, y]) => [x, y, 3.5] as [number, number, number]), ...M.gas.map(([x, y]) => [x, y, 3.5] as [number, number, number])];
    const open = (x: number, y: number) => !anchors.some(([ax, ay, r]) => Math.hypot(x - ax, y - ay) < r);
    const urban = /city|tarsonis|korhal|dominion/i.test(M.tileSet);      // no grass growing between the streets: rubble only
    const spots: { x: number; y: number; kind: "pebble" | "tuft"; s: number; rot: number }[] = [];
    for (let y = 1; y < M.h - 1; y++) for (let x = 1; x < M.w - 1; x++) {
      if (!M.pathable[y * M.w + x]) continue;
      const r = hash(x * 4.1, y * 2.3);
      if (r > 0.17) continue;
      const px = x + hash(y, x * 3.7), py = y + hash(x, y * 1.9);
      if (!open(px, py)) continue;
      const stone = urban || r < 0.07;
      spots.push({ x: px, y: py, kind: stone ? "pebble" : "tuft", s: stone ? 0.7 + hash(px, py) * 0.9 : 0.35 + hash(py, px) * 0.35, rot: hash(px * 2, py) * 360 });
    }
    for (const kind of ["pebble", "tuft"] as const) {
      const items = spots.filter((p) => p.kind === kind), geo = geos[kind]?.[0];
      if (!items.length || !geo) continue;
      const mesh = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach((p, i) => {
        dummy.position.set(lx(p.x), heightAt(p.x, p.y) - 0.04, lz(p.y)); dummy.rotation.set(0, (p.rot * Math.PI) / 180, 0); dummy.scale.setScalar(p.s); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        const v = 0.8 + hash(p.x * 1.3, p.y * 2.1) * 0.35; tint.setRGB(v, v * (0.96 + hash(p.y, p.x) * 0.08), v * 0.95); mesh.setColorAt(i, tint);
      });
      mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh);
    }
    counts.ground = spots.length;
  }

  // destructible rocks: a rust-coloured pile on a translucent footprint, so they read as "can be broken"
  const dest = M.special.filter((u) => u.kind === "dest");
  if (dest.length) {
    const rockGeo = ico([0.62, 0.34, 0.2], 0, 0.5, 0, 1.6, 1.3, 1.5);
    const pieces = dest.flatMap((u) => { const n = Math.max(3, Math.round((u.w * u.h) / 5)); return Array.from({ length: n }, (_, k) => ({ u, k, n })); });
    const mesh = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), pieces.length);
    pieces.forEach(({ u, k }, i) => {
      const a = hash(u.x + k, u.y * 1.3 + k * 7), b = hash(u.y + k * 3, u.x * 0.7), cos = u.diagonal ? Math.SQRT1_2 : 1, sin = u.diagonal ? Math.SQRT1_2 : 0;
      const ox = (a - 0.5) * (u.w - 1.4), oy = (b - 0.5) * (u.h - 1.4), rx = ox * cos - oy * sin, ry = ox * sin + oy * cos;
      dummy.position.set(lx(u.x + rx), heightAt(u.x + rx, u.y + ry), lz(u.y + ry));
      dummy.rotation.set(0, a * 6.28, 0); const s = 0.9 + b * 0.9; dummy.scale.set(s, s * (0.9 + a * 0.6), s); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh);
    for (const u of dest) {
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(u.w, u.h), new THREE.MeshBasicMaterial({ color: 0xff8c3c, transparent: true, opacity: 0.22, depthWrite: false }));
      pad.rotation.x = -Math.PI / 2; pad.rotation.z = u.diagonal ? Math.PI / 4 : 0; pad.position.set(lx(u.x), heightAt(u.x, u.y) + 0.2, lz(u.y)); group.add(pad);
    }
    counts.destructible = dest.length;
  }
  for (const u of M.special.filter((q) => q.kind === "plate")) {
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(u.w, u.h), new THREE.MeshBasicMaterial({ color: 0xaab4d0, transparent: true, opacity: 0.28, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2; pad.rotation.z = u.diagonal ? Math.PI / 4 : 0; pad.position.set(lx(u.x), heightAt(u.x, u.y) + 0.18, lz(u.y)); group.add(pad);
  }

  // Xel'Naga towers: a lit pillar and a ring that shows how far it sees
  for (const u of M.special.filter((q) => q.kind === "tower")) {
    const y = heightAt(u.x, u.y);
    const tower = new THREE.Mesh(merge([cyl([0.3, 0.36, 0.4], 10, 0, 0.35, 0, 3.0, 0.7, 3.0), cyl([0.5, 0.58, 0.62], 8, 0, 3.0, 0, 1.0, 5.2, 1.0), cyl(th.glow, 12, 0, 5.7, 0, 2.0, 0.25, 2.0), cone(th.glow, 6, 0, 6.6, 0, 0.9, 1.4, 0.9)]), glowMat);
    tower.position.set(lx(u.x), y, lz(u.y)); tower.castShadow = true; group.add(tower);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(22, 0.12, 6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(th.glow[0], th.glow[1], th.glow[2]), transparent: true, opacity: 0.35, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(lx(u.x), y + 0.4, lz(u.y)); group.add(ring);
    counts.tower = (counts.tower ?? 0) + 1;
  }

  // geysers: a dark vent with a green glow
  if (M.gas.length) {
    const geo = merge([cyl([0.16, 0.17, 0.2], 10, 0, 0.35, 0, 3.4, 0.7, 3.4), cyl([0.1, 0.1, 0.12], 10, 0, 0.74, 0, 2.2, 0.12, 2.2)]);
    const base = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), M.gas.length);
    const glow = new THREE.InstancedMesh(new THREE.CircleGeometry(1.0, 20), new THREE.MeshBasicMaterial({ color: 0x5ee08a, transparent: true, opacity: 0.9 }), M.gas.length);
    M.gas.forEach(([x, y], i) => {
      const h = heightAt(x, y);
      dummy.position.set(lx(x), h, lz(y)); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); base.setMatrixAt(i, dummy.matrix);
      dummy.position.set(lx(x), h + 0.82, lz(y)); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.updateMatrix(); glow.setMatrixAt(i, dummy.matrix);
    });
    base.castShadow = true; base.frustumCulled = glow.frustumCulled = false; group.add(base, glow);
    counts.gas = M.gas.length;
  }

  return {
    group, counts,
    setVisible(v: boolean) { group.visible = v; },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mt = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose());
      });
    },
  };
}
