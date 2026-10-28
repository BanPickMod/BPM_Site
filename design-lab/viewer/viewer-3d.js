/*
 * 3D "game-like" map for the replay-viewer mockups (three.js). Real height grid from the engine, real unit positions.
 * Terrain is a blocky heightfield: pathable ground at its real level, unpathable cells as dark rock with cliff faces,
 * ramps (pathable but not buildable) lighter, base glows in the owner's colour, minerals, shadows.
 * Mockup quality: it shows what the product could look like; it is not tuned for weak GPUs (a 2D fallback exists in viewer-core.js).
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const V = window.Viewer, D = V.D, G = V.grid, M = G.M, bb = G.bb, BW = G.BW, BH = G.BH;
const OWNER = { 1: 0x38bdf8, 2: 0xf59e0b };
const LV0 = 207, LV1 = 239, RELIEF = 6.0;           // height range of this map and the vertical exaggeration (cells)
const AIR = /medivac|overlord|overseer|liberator|viking|wraith|banshee|muta|corruptor|broodlord|phoenix|voidray|carrier|battlecruiser|raven|sciencevessel|observer|warpprism|tempest|oracle|interceptor/i;
const BIGU = /thor|ultralisk|colossus|carrier|battlecruiser|broodlord|archon|immortal|defiler|ravasaur|tyrannozor|mothership/i;
const SMALLU = /marine|scv|zergling|drone|probe|broodling|reaper|larva|baneling|mule/i;
const BIGB = /commandcenter|orbitalcommand|planetaryfortress|hatchery|lair|hive|nexus/i;
const MEDB = /barracks|factory|starport|gateway|stargate|robotics|spawningpool|roachwarren|hydraliskden|spire|infestation|engineering|armory|fusion|nydus|cyberneticscore|twilight|forge|templar|fleetbeacon/i;

// ---------- height model ----------
const idx = (x, y) => y * M.w + x;
const ground = new Float32Array(M.w * M.h), top = new Float32Array(M.w * M.h);
(() => {
  for (let y = bb.y0; y < bb.y1; y++) for (let x = bb.x0; x < bb.x1; x++) { const i = idx(x, y); if (G.pa[i]) ground[i] = ((G.ht[i] - LV0) / (LV1 - LV0)) * RELIEF; }
  for (let y = bb.y0; y < bb.y1; y++) for (let x = bb.x0; x < bb.x1; x++) {
    const i = idx(x, y); if (G.pa[i]) { top[i] = ground[i]; continue; }
    let s = 0, n = 0;                                                  // rock sits above the average of the nearby ground
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= M.w || yy >= M.h) continue; const j = idx(xx, yy); if (G.pa[j]) { s += ground[j]; n++; } }
    ground[i] = n ? s / n : 0; top[i] = ground[i] + 1.7;
  }
})();
const gAt = (x, y) => { const xx = Math.max(0, Math.min(M.w - 1, Math.floor(x))), yy = Math.max(0, Math.min(M.h - 1, Math.floor(y))); return ground[idx(xx, yy)]; };
const wx = (x) => x - bb.x0 - BW / 2, wz = (y) => -(y - bb.y0 - BH / 2);

// ---------- terrain mesh ----------
// Pathable ground is one smooth surface (heights averaged at the grid corners, so ramps are real slopes);
// unpathable cells are flat rock blocks with cliff walls down to the ground next to them.
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; };
const inb = (x, y) => x >= 0 && y >= 0 && x < M.w && y < M.h;
const path = (x, y) => inb(x, y) && G.pa[idx(x, y)] === 1;
function cellColor(x, y) {
  const i = idx(x, y), f = (G.ht[i] - LV0) / (LV1 - LV0);
  const lo = [0.17, 0.135, 0.11], mid = [0.34, 0.275, 0.21], hi = [0.6, 0.51, 0.4];     // dark loam -> dust -> pale sand
  const a = f < 0.5 ? lo : mid, b = f < 0.5 ? mid : hi, k = f < 0.5 ? f * 2 : (f - 0.5) * 2;
  let c = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  if (!G.pl[i]) c = [c[0] * 1.18 + 0.02, c[1] * 1.16 + 0.02, c[2] * 1.12 + 0.02];       // ramps and paths: worn, lighter
  const n = 0.86 + vnoise(x / 7, y / 7) * 0.2 + (hash(x, y) - 0.5) * 0.1;               // broad mottling + fine grain
  return [c[0] * n, c[1] * n, c[2] * n * 0.96];
}
function buildTerrain() {
  const pos = [], nor = [], col = [];
  // grid-corner heights and colours: average of the pathable cells that touch the corner
  const cornerH = (vx, vy) => { let s = 0, n = 0; for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (path(vx + dx, vy + dy)) { s += ground[idx(vx + dx, vy + dy)]; n++; } return n ? s / n : -9; };
  const cache = new Map(), CH = (vx, vy) => { const k = vy * 4096 + vx; let v = cache.get(k); if (v === undefined) { v = cornerH(vx, vy); cache.set(k, v); } return v; };
  const CHs = (vx, vy) => { const v = CH(vx, vy); return v === -9 ? ground[idx(Math.min(M.w - 1, Math.max(0, vx)), Math.min(M.h - 1, Math.max(0, vy)))] : v; };
  const cornerC = (vx, vy) => { let r = 0, g = 0, b = 0, n = 0; for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (path(vx + dx, vy + dy)) { const c = cellColor(vx + dx, vy + dy); r += c[0]; g += c[1]; b += c[2]; n++; } return n ? [r / n, g / n, b / n] : [0.1, 0.1, 0.12]; };
  const normalAt = (vx, vy) => { const dx = (CHs(vx + 1, vy) - CHs(vx - 1, vy)) / 2, dy = (CHs(vx, vy + 1) - CHs(vx, vy - 1)) / 2; const l = Math.hypot(dx, 1, dy); return [-dx / l, 1 / l, dy / l]; };
  const uv = [];
  const vert = (vx, vy, h, n, c) => { pos.push(wx(vx), h, wz(vy)); nor.push(...n); col.push(...c); uv.push(wx(vx) / 14, wz(vy) / 14); };
  const wall = (a, b, ha0, hb0, ha1, hb1, n, ct, cb) => {   // a,b = [vx,vy] edge ends; *0 = top heights, *1 = bottom heights
    const P = (v, h) => [wx(v[0]), h, wz(v[1])];
    const A0 = P(a, ha0), B0 = P(b, hb0), B1 = P(b, hb1), A1 = P(a, ha1);
    pos.push(...A0, ...B0, ...B1, ...A0, ...B1, ...A1); for (let k = 0; k < 6; k++) nor.push(...n);
    for (const v of [A0, B0, B1, A0, B1, A1]) uv.push((v[0] + v[2]) / 14, v[1] / 7);   // walls: strata along height
    col.push(...ct, ...ct, ...cb, ...ct, ...cb, ...cb);
  };
  const rockTop = [0.075, 0.07, 0.085], wallTop = [0.27, 0.23, 0.22], wallBot = [0.05, 0.048, 0.06];
  for (let y = bb.y0; y < bb.y1; y++) for (let x = bb.x0; x < bb.x1; x++) {
    const i = idx(x, y);
    if (G.pa[i]) {                                           // smooth ground
      const V = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
      const vs = V.map(([vx, vy]) => ({ vx, vy, h: CHs(vx, vy), n: normalAt(vx, vy), c: cornerC(vx, vy) }));
      for (const k of [0, 1, 2, 0, 2, 3]) vert(vs[k].vx, vs[k].vy, vs[k].h, vs[k].n, vs[k].c);
    } else {                                                 // rock block
      const h = top[i], c = rockTop.map((v) => v * (0.8 + hash(x, y) * 0.5));
      for (const [vx, vy] of [[x, y], [x + 1, y], [x + 1, y + 1], [x, y], [x + 1, y + 1], [x, y + 1]]) vert(vx, vy, h, [0, 1, 0], c);
      const side = (nx, ny, a, b) => {
        const xx = x + nx, yy = y + ny, out = !inb(xx, yy), nh = out ? -2 : top[idx(xx, yy)];
        if (!out && G.pa[idx(xx, yy)]) wall(a, b, h, h, CHs(a[0], a[1]), CHs(b[0], b[1]), [nx, 0, -ny], wallTop, wallBot);
        else if (nh < h - 0.02) wall(a, b, h, h, nh, nh, [nx, 0, -ny], wallTop, wallBot);
      };
      side(1, 0, [x + 1, y + 1], [x + 1, y]); side(-1, 0, [x, y], [x, y + 1]); side(0, 1, [x, y + 1], [x + 1, y + 1]); side(0, -1, [x + 1, y], [x, y]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// ---------- procedural skins (our own art: race-themed materials and silhouettes) ----------
function canvasTex(size, draw, repeat = 1) { const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d"); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const groundDetail = () => canvasTex(256, (g, n) => {       // dusty rock grain with fine cracks; multiplies the height/ramp colours
  g.fillStyle = "#cfcfcf"; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 2600; i++) { const v = 150 + rnd() * 105 | 0; g.fillStyle = `rgba(${v},${v - 6},${v - 14},${0.18 + rnd() * 0.25})`; const r = 1 + rnd() * 5; g.beginPath(); g.arc(rnd() * n, rnd() * n, r, 0, 6.283); g.fill(); }
  g.strokeStyle = "rgba(40,30,25,0.35)"; g.lineWidth = 1; for (let i = 0; i < 38; i++) { g.beginPath(); let x = rnd() * n, y = rnd() * n; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 34; y += (rnd() - 0.5) * 34; g.lineTo(x, y); } g.stroke(); } });
const SKIN = {
  terran: { tex: () => canvasTex(128, (g, n) => { g.fillStyle = "#9aa4b8"; g.fillRect(0, 0, n, n); g.strokeStyle = "#566072"; g.lineWidth = 2; for (let i = 0; i <= n; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, n); g.moveTo(0, i); g.lineTo(n, i); g.stroke(); }
      g.fillStyle = "#e9c24a"; for (let i = 0; i < 6; i++) g.fillRect(i * 24, 118, 12, 10); g.fillStyle = "#3a4152"; for (let x = 8; x < n; x += 32) for (let y = 8; y < n; y += 32) g.fillRect(x, y, 3, 3); }),
            metal: 0.55, rough: 0.5, emis: 0.12 },
  zerg:   { tex: () => canvasTex(128, (g, n) => { g.fillStyle = "#4a2a3c"; g.fillRect(0, 0, n, n); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${90 + rnd() * 70 | 0},${40 + rnd() * 30 | 0},${70 + rnd() * 50 | 0},0.35)`; g.beginPath(); g.arc(rnd() * n, rnd() * n, 3 + rnd() * 9, 0, 6.283); g.fill(); }
      g.strokeStyle = "rgba(200,60,110,0.55)"; g.lineWidth = 1.5; for (let i = 0; i < 14; i++) { g.beginPath(); let x = rnd() * n, y = rnd() * n; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); } }),
            metal: 0.05, rough: 0.75, emis: 0.2 },
  protoss:{ tex: () => canvasTex(128, (g, n) => { const gr = g.createLinearGradient(0, 0, n, n); gr.addColorStop(0, "#e8cf86"); gr.addColorStop(1, "#b88a2f"); g.fillStyle = gr; g.fillRect(0, 0, n, n);
      g.strokeStyle = "rgba(60,40,10,0.55)"; g.lineWidth = 2; for (let i = -n; i < n * 2; i += 40) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + n, n); g.stroke(); } g.fillStyle = "rgba(120,220,255,0.7)"; for (let i = 0; i < 8; i++) g.fillRect(8 + i * 15, 60, 5, 8); }),
            metal: 0.6, rough: 0.35, emis: 0.3 },
};
const raceKey = (r) => (r === "protoss" || r === "zerg" ? r : "terran");
const T = (g, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { const c = g.index ? g.toNonIndexed() : g.clone(); c.scale(sx, sy, sz); c.rotateX(rx); c.rotateY(ry); c.rotateZ(rz); c.translate(x, y, z); return c; };
const box = (...a) => T(new THREE.BoxGeometry(1, 1, 1), ...a), cyl = (...a) => T(new THREE.CylinderGeometry(0.5, 0.5, 1, 10), ...a), cone = (...a) => T(new THREE.ConeGeometry(0.5, 1, 7), ...a),
  sph = (...a) => T(new THREE.SphereGeometry(0.5, 12, 8), ...a), oct = (...a) => T(new THREE.OctahedronGeometry(0.5), ...a);
// One silhouette per kind of unit/building, so things can be told apart at map scale (shape + size + hover name + legend).
const GEO = {
  building: {
    terran: {
      hall: [box(0, 0.7, 0, 4.6, 1.4, 4.6), box(0, 1.9, 0, 3, 1, 3), cyl(0, 2.9, 0, 1.4, 1.4, 1.4), box(2.6, 0.5, 0, 0.9, 1, 3)],
      rax: [box(0, 0.8, 0, 3, 1.6, 3), box(1.9, 0.5, 0.6, 0.9, 1, 1.4), box(0, 1.8, 0, 1.6, 0.4, 1.6)],
      factory: [box(0, 0.8, 0, 3, 1.6, 3), cyl(-0.8, 2.3, -0.8, 0.6, 1.6, 0.6), box(1.9, 0.5, 0.6, 0.9, 1, 1.4)],
      starport: [box(0, 0.7, 0, 3, 1.4, 3), cyl(0, 1.5, 0, 2.4, 0.15, 2.4), box(0, 2.0, 0, 0.5, 0.9, 0.5)],
      depot: [box(0, 0.35, 0, 1.8, 0.7, 1.8), box(0, 0.8, 0, 1.2, 0.2, 1.2)],
      refinery: [cyl(0, 0.5, 0, 2, 1, 2), cyl(0, 1.2, 0, 0.9, 1.2, 0.9), sph(0.9, 0.8, 0.9, 0.7, 0.7, 0.7)],
      tech: [box(0, 0.7, 0, 2.4, 1.4, 2.4), cyl(0, 2, 0, 1.8, 0.12, 1.8, 0.5, 0, 0), cyl(0, 1.5, 0, 0.15, 1.2, 0.15)],
      small: [box(0, 0.5, 0, 1.8, 1, 1.8), box(0, 1.15, 0, 1, 0.3, 1)],
    },
    zerg: {
      hatch: [sph(0, 0.4, 0, 6, 3.6, 6), cone(-2.2, 2.2, 1, 0.8, 2.6, 0.8), cone(2, 2.4, -1.2, 0.9, 3, 0.9), cone(0.4, 2.8, 2.2, 0.7, 2.2, 0.7), cone(-0.5, 2.6, -2.4, 0.8, 2.6, 0.8)],
      pool: [sph(0, 0.3, 0, 3.4, 2.2, 3.4), cone(1.2, 1.6, 0.4, 0.6, 1.6, 0.6), cone(-1, 1.5, -0.6, 0.6, 1.4, 0.6), box(0, 0.2, 1.6, 1, 0.4, 1)],
      tower: [sph(0, 0.3, 0, 1.8, 1, 1.8), cone(0, 1.8, 0, 1.1, 3, 1.1)],
      extractor: [sph(0, 0.3, 0, 2.2, 1.2, 2.2), cyl(0, 1.2, 0, 0.8, 1.2, 0.8), sph(0, 1.9, 0, 1, 0.7, 1)],
      small: [sph(0, 0.2, 0, 2, 1.2, 2), cone(0, 1.1, 0, 0.5, 1, 0.5)],
    },
    protoss: {
      nexus: [cyl(0, 0.5, 0, 5, 1, 5), cyl(0, 1.3, 0, 3.4, 0.7, 3.4), oct(0, 3, 0, 2.2, 4, 2.2)],
      gate: [box(1.2, 0.9, 0, 0.8, 1.8, 2.4), box(-1.2, 0.9, 0, 0.8, 1.8, 2.4), box(0, 1.9, 0, 3.2, 0.5, 2.6), oct(0, 1, 0, 0.6, 1, 0.6)],
      pylon: [cyl(0, 0.3, 0, 1.8, 0.6, 1.8), oct(0, 1.9, 0, 1.3, 2.8, 1.3)],
      tech: [cyl(0, 0.5, 0, 3, 1, 3), cyl(0, 1.4, 0, 2.4, 0.2, 2.4), oct(0, 2.3, 0, 1, 1.4, 1)],
      small: [cyl(0, 0.35, 0, 1.8, 0.7, 1.8), oct(0, 1.3, 0, 1, 1.6, 1)],
    },
  },
  unit: {
    terran: {
      inf: [cyl(0, 0.55, 0, 0.5, 1, 0.5), sph(0, 1.2, 0, 0.5, 0.5, 0.5), box(0.35, 0.8, 0.3, 0.15, 0.15, 0.8)],
      heavy: [cyl(0, 0.6, 0, 0.8, 1.2, 0.7), sph(0, 1.35, 0, 0.5, 0.5, 0.5), box(0.55, 1.1, 0, 0.45, 0.35, 0.5), box(-0.55, 1.1, 0, 0.45, 0.35, 0.5), box(0, 0.9, -0.55, 0.5, 0.9, 0.3)],
      walker: [box(0, 1.5, 0, 1.1, 0.8, 1.4), box(0.45, 0.6, 0, 0.25, 1.2, 0.35), box(-0.45, 0.6, 0, 0.25, 1.2, 0.35), box(0.8, 1.5, 0.5, 0.25, 0.25, 1.2), box(-0.8, 1.5, 0.5, 0.25, 0.25, 1.2)],
      tank: [box(0, 0.35, 0, 1.5, 0.5, 2.2), cyl(0, 0.9, -0.1, 1, 0.5, 1), box(0, 1, 0.9, 0.18, 0.18, 1.6)],
      vehicle: [box(0, 0.3, 0, 1.1, 0.4, 1.8), box(0, 0.65, -0.3, 0.8, 0.35, 0.8), cyl(0.6, 0.2, 0.6, 0.5, 0.4, 0.5, 0, 0, 1.57), cyl(-0.6, 0.2, 0.6, 0.5, 0.4, 0.5, 0, 0, 1.57)],
      dropship: [sph(0, 0, 0, 1, 0.8, 2), cyl(0.9, 0.5, 0, 1.2, 0.06, 1.2), cyl(-0.9, 0.5, 0, 1.2, 0.06, 1.2), box(0, -0.4, 0, 0.5, 0.3, 1)],
      fighter: [cone(0, 0, 0.6, 0.7, 2.4, 0.7, 1.5708, 0, 0), box(0, 0, -0.3, 2.2, 0.06, 0.8), box(0, 0.25, -0.8, 0.08, 0.5, 0.5)],
      capital: [box(0, 0, 0, 1, 0.8, 3.6), box(0, 0.6, -0.6, 0.6, 0.5, 1.2), box(0, -0.2, 1.5, 1.4, 0.5, 0.8), cyl(0, 0, -1.8, 0.6, 0.6, 0.6)],
    },
    zerg: {
      ling: [sph(0, 0.4, 0, 0.7, 0.55, 1.2), cone(0.2, 0.9, 0.2, 0.2, 0.6, 0.2), cone(-0.2, 0.9, 0.2, 0.2, 0.6, 0.2), cone(0, 0.45, 0.9, 0.3, 0.6, 0.3, 1.5708, 0, 0)],
      roach: [sph(0, 0.55, 0, 1.3, 0.8, 1.8), cone(0, 1.1, 0, 0.5, 0.9, 0.5), cone(0, 0.95, -0.6, 0.4, 0.7, 0.4), cone(0.6, 0.2, 0.5, 0.3, 0.7, 0.3, 0, 0, 0.4), cone(-0.6, 0.2, 0.5, 0.3, 0.7, 0.3, 0, 0, -0.4)],
      hydra: [sph(0, 0.8, 0, 0.7, 1.4, 0.9), cone(0.55, 1.3, 0.3, 0.25, 1.1, 0.25, 0, 0, -0.5), cone(-0.55, 1.3, 0.3, 0.25, 1.1, 0.25, 0, 0, 0.5), cone(0, 0.3, 0.8, 0.5, 1, 0.5, 1.2, 0, 0)],
      brute: [sph(0, 0.9, 0, 1.6, 1.4, 2.2), cone(0.8, 1.5, 0.9, 0.4, 1.4, 0.4, 0, 0, -0.4), cone(-0.8, 1.5, 0.9, 0.4, 1.4, 0.4, 0, 0, 0.4), cone(0, 0.6, 1.1, 0.9, 0.8, 0.9, 1.5, 0, 0)],
      flyer: [sph(0, 0, 0, 0.8, 0.6, 1.8), box(1, 0.1, -0.1, 1.6, 0.05, 0.7, 0, 0, 0.5), box(-1, 0.1, -0.1, 1.6, 0.05, 0.7, 0, 0, -0.5), cone(0, 0, -1.2, 0.3, 1.4, 0.3, -1.5708, 0, 0)],
      caster: [sph(0, 0.7, 0, 0.9, 1.1, 0.9), sph(0, 1.5, 0, 0.55, 0.55, 0.55), cone(0, 1.9, 0, 0.3, 0.7, 0.3), sph(0.7, 0.7, 0.2, 0.4, 0.4, 0.4)],
    },
    protoss: {
      zeal: [oct(0, 0.8, 0, 0.8, 1.5, 0.8), box(0.45, 0.9, 0.3, 0.12, 0.12, 0.9), box(-0.45, 0.9, 0.3, 0.12, 0.12, 0.9)],
      walker: [oct(0, 1.1, 0, 1, 1.4, 1.3), cyl(0.4, 0.4, 0, 0.2, 0.8, 0.2), cyl(-0.4, 0.4, 0, 0.2, 0.8, 0.2)],
      mech: [oct(0, 0.8, 0, 1.3, 1.6, 1.8), cyl(0, 0.25, 0, 1.5, 0.15, 1.9)],
      tall: [oct(0, 1.6, 0, 1.2, 3, 1.2), cyl(0, 0.3, 0, 1.6, 0.2, 1.6)],
      air: [oct(0, 0, 0, 1.1, 0.7, 2), box(0, 0, 0, 2.2, 0.06, 0.8, 0, 0.7, 0)],
      caster: [oct(0, 0.8, 0, 0.8, 1.2, 0.8), cyl(0, 0.2, 0, 1.2, 0.08, 1.2), sph(0, 1.7, 0, 0.4, 0.4, 0.4)],
    },
  },
};
for (const k of ["building", "unit"]) for (const r of Object.values(GEO[k])) for (const key of Object.keys(r)) r[key] = mergeGeometries(r[key]);
const BARCH = {
  terran: [[/techlab|reactor/i, "small"], [/commandcenter|orbital|planetary/i, "hall"], [/barracks/i, "rax"], [/factory/i, "factory"], [/starport/i, "starport"], [/depot/i, "depot"], [/refinery/i, "refinery"], [/engineering|armory|fusion|ghostacademy|sensor/i, "tech"]],
  zerg: [[/hatchery|^lair|^hive/i, "hatch"], [/spawningpool|roachwarren|hydraliskden|spire|evolution|infestation|banelingnest|ultralisk|nydus/i, "pool"], [/spore|spine/i, "tower"], [/extractor/i, "extractor"]],
  protoss: [[/nexus/i, "nexus"], [/gateway|warpgate|stargate|robotics/i, "gate"], [/pylon/i, "pylon"], [/cyber|twilight|templar|dark|fleet|forge/i, "tech"]],
};
const UARCH = {
  terran: [[/tank/i, "tank"], [/goliath|warhound|thor/i, "walker"], [/marauder|firebat/i, "heavy"], [/hellion|hellbat|widowmine|cyclone/i, "vehicle"], [/medivac|liberator/i, "dropship"], [/viking|wraith|banshee/i, "fighter"], [/battlecruiser|raven|sciencevessel/i, "capital"]],
  zerg: [[/roach|ravager|aberration/i, "roach"], [/hydralisk|lurker|queen/i, "hydra"], [/ultralisk|ravasaur|tyrannozor/i, "brute"], [/mutalisk|corruptor|overlord|overseer|broodlord|guardian|viper/i, "flyer"], [/infestor|defiler/i, "caster"]],
  protoss: [[/stalker|dragoon|sentry|energizer/i, "walker"], [/immortal|disruptor|reaver/i, "mech"], [/colossus/i, "tall"], [/phoenix|voidray|oracle|carrier|tempest|scout|corsair|arbiter|mothership|observer|warpprism/i, "air"], [/templar|archon/i, "caster"]],
};
const DEFAULT_U = { terran: "inf", zerg: "ling", protoss: "zeal" }, DEFAULT_B = "small";
const pick1 = (table, type, dflt) => (table.find(([re]) => re.test(type)) || [0, dflt])[1];
const bKind = (type, race) => pick1(BARCH[race], type, DEFAULT_B);
const uKind = (type, race) => pick1(UARCH[race], type, DEFAULT_U[race]);

// ---------- helpers ----------
function glowTexture(inner = "rgba(255,255,255,0.95)", outer = "rgba(255,255,255,0)") {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 2, 64, 64, 62); r.addColorStop(0, inner); r.addColorStop(0.45, "rgba(255,255,255,0.25)"); r.addColorStop(1, outer);
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
const bsize = (t) => (BIGB.test(t) ? [5, 2.6, 5] : MEDB.test(t) ? [3, 1.9, 3] : /supply|pylon|depot/i.test(t) ? [1.6, 1.0, 1.6] : [2.1, 1.4, 2.1]);
const usize = (t) => 1.9 * (BIGU.test(t) ? 1.9 : SMALLU.test(t) ? 0.75 : 1.2);   // exaggerated so units read at map scale

export function mount(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x07080f); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement); renderer.domElement.style.cssText = "display:block;width:100%;height:100%";

  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x07080f, 230, 520);
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 1500);
  const HOME = { pos: new THREE.Vector3(0, 150, 172), target: new THREE.Vector3(0, -2, 6) };
  camera.position.copy(HOME.pos);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME.target); controls.minDistance = 55; controls.maxDistance = 330; controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.38;
  controls.minAzimuthAngle = -0.9; controls.maxAzimuthAngle = 0.9; controls.enablePan = true; controls.screenSpacePanning = false; controls.update();

  // light
  scene.add(new THREE.HemisphereLight(0x9db4ff, 0x1c1526, 0.85));
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.9); sun.position.set(-70, 110, 80); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -140; sc.right = 140; sc.top = 140; sc.bottom = -140; sc.near = 20; sc.far = 340; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.4;
  scene.add(sun);

  // terrain + slab + floor grid
  const terr = new THREE.Mesh(buildTerrain(), new THREE.MeshLambertMaterial({ vertexColors: true, map: groundDetail() })); terr.receiveShadow = true; terr.castShadow = true; scene.add(terr);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.2, 9, BH + 0.2), new THREE.MeshLambertMaterial({ color: 0x0d0f1a })); slab.position.set(0, -4.6, 0); scene.add(slab);
  const grid = new THREE.GridHelper(Math.max(BW, BH) * 2.6, 52, 0x232a50, 0x151934); grid.position.y = -9.2; scene.add(grid);

  // resources (blue crystals)
  const crystal = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.62), new THREE.MeshStandardMaterial({ color: 0x4aa8ff, emissive: 0x1760d0, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.1 }), M.res.length);
  const dummy = new THREE.Object3D();
  M.res.forEach(([x, y], i) => { dummy.position.set(wx(x), gAt(x, y) + 0.9, wz(y)); dummy.scale.set(0.9, 1.8, 0.9); dummy.rotation.y = hash(x, y) * 6; dummy.updateMatrix(); crystal.setMatrixAt(i, dummy.matrix); });
  crystal.castShadow = true; scene.add(crystal);

  // base glows on the ground
  const glowTex = glowTexture();
  const bases = [...M.starts, ...M.exps].map(([x, y]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x444444, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(wx(x), gAt(x, y) + 0.25, wz(y)); scene.add(m); return { x, y, m };
  });
  const townhalls = V.units.filter((u) => u.building && BIGB.test(u.type));

  // buildings and units (one instanced mesh per owner so each can glow in its own colour)
  const skin = (o) => { const race = raceKey(D.draft[o - 1].race), S = SKIN[race], tint = new THREE.Color(OWNER[o]).lerp(new THREE.Color(0xffffff), 0.55);
    return { race, mat: new THREE.MeshStandardMaterial({ map: S.tex(), color: tint, emissive: OWNER[o], emissiveIntensity: S.emis, roughness: S.rough, metalness: S.metal }) }; };
  const skins = { 1: skin(1), 2: skin(2) };
  const buildings = [1, 2].flatMap((o) => Object.keys(GEO.building[skins[o].race]).map((kind) => { const list = V.units.filter((u) => u.building && u.owner === o && bKind(u.type, skins[o].race) === kind);
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(GEO.building[skins[o].race][kind], skins[o].mat, list.length); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.userData.list = list; scene.add(mesh); return { list, mesh, kind }; })).filter(Boolean);
  const movers = [1, 2].flatMap((o) => Object.keys(GEO.unit[skins[o].race]).map((kind) => { const list = V.units.filter((u) => !u.building && u.owner === o && u.track.length && !u.worker && uKind(u.type, skins[o].race) === kind);
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(GEO.unit[skins[o].race][kind], skins[o].mat, list.length); mesh.castShadow = true; mesh.frustumCulled = false; mesh.userData.list = list; scene.add(mesh); return { list, mesh, kind }; })).filter(Boolean);
  const pickList = V.units.filter((u) => !u.building && u.pick && u.track.length);
  const ring = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.12, 6, 24), new THREE.MeshBasicMaterial({ color: 0xd6f542, transparent: true, opacity: 0.95 }), Math.max(1, pickList.length));
  const beam = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xd6f542, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), Math.max(1, pickList.length));
  ring.frustumCulled = beam.frustumCulled = false; scene.add(ring, beam);
  const loader = new THREE.TextureLoader(), iconTex = {};
  const iconOf = (u) => { const pk = D.draft[u.owner - 1].picks.find((p) => V.norm(u.type).includes(V.norm(p.unit))); return pk && D.meta[pk.unit] && D.meta[pk.unit].icon ? `../../public${D.meta[pk.unit].icon}` : null; };
  const pickIcons = pickList.map((u) => { const url = iconOf(u); if (!url) return null;
    const tex = iconTex[url] || (iconTex[url] = loader.load(url, () => (needs = true))); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(5.2, 5.2, 1); scene.add(sp); return sp; });

  // deaths and battle zones
  const sparkTex = glowTexture("rgba(255,244,214,1)", "rgba(255,120,60,0)");
  const sparks = Array.from({ length: 110 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: 0xffb070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); return s; });
  const deaths = V.units.filter((u) => u.t1 < Infinity && u.dx != null && !u.worker).sort((a, b) => a.t1 - b.t1);
  const zones = V.battles.map((b) => { const m = new THREE.Mesh(new THREE.CircleGeometry(13, 40), new THREE.MeshBasicMaterial({ color: 0xff4458, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(wx(b.cx), gAt(b.cx, b.cy) + 0.3, wz(b.cy)); scene.add(m); return { b, m }; });

  // ---------- per-frame update ----------
  let needs = true, follow = !!opts.follow;
  const col = new THREE.Color(), tmp = new THREE.Object3D(), follow3 = new THREE.Vector3();
  function update(t) {
    // base glows follow the owner of a living town hall
    for (const b of bases) {
      const th = townhalls.find((u) => u.t0 <= t && t < u.t1 && Math.abs(u.x - b.x) < 7 && Math.abs(u.y - b.y) < 7);
      if (th) { b.m.material.color.setHex(OWNER[th.owner]); b.m.material.opacity = 0.85; } else b.m.material.opacity = 0;
    }
    for (const B of buildings) {
      B.list.forEach((u, i) => { const live = t >= u.t0 && t < u.t1;
        tmp.position.set(wx(u.x), gAt(u.x, u.y), wz(u.y)); tmp.scale.setScalar(live ? 1 : 0); tmp.rotation.set(0, ["hall", "hatch", "nexus"].includes(B.kind) ? 0 : hash(u.x, u.y) * 1.2, 0); tmp.updateMatrix(); B.mesh.setMatrixAt(i, tmp.matrix); });
      B.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const Mv of movers) {
      Mv.list.forEach((u, i) => { const live = t >= u.t0 && t < u.t1; const [x, y] = V.posAt(u, t), [x2, y2] = V.posAt(u, t + 1.5), s = usize(u.type) * 0.55, air = AIR.test(u.type) ? 3.4 : 0;
        if (Math.hypot(x2 - x, y2 - y) > 0.05) u._h = Math.atan2(x2 - x, -(y2 - y));       // face the direction of travel (world z is -y)
        tmp.position.set(wx(x), gAt(x, y) + air, wz(y)); tmp.scale.setScalar(live ? s : 0); tmp.rotation.set(0, u._h || 0, 0); tmp.updateMatrix(); Mv.mesh.setMatrixAt(i, tmp.matrix); });
      Mv.mesh.instanceMatrix.needsUpdate = true;
    }
    pickList.forEach((u, i) => { const live = t >= u.t0 && t < u.t1; const [x, y] = V.posAt(u, t), s = usize(u.type), air = AIR.test(u.type) ? 3.2 : 0, gy = gAt(x, y);
      tmp.position.set(wx(x), gy + 0.15 + air * 0.0, wz(y)); tmp.rotation.set(-Math.PI / 2, 0, 0); tmp.scale.setScalar(live ? 0.9 + s * 0.55 : 0); tmp.updateMatrix(); ring.setMatrixAt(i, tmp.matrix);
      tmp.position.set(wx(x), gy + 3.2 + air, wz(y)); tmp.rotation.set(0, 0, 0); tmp.scale.set(live ? 1 : 0, live ? 1 : 0, live ? 1 : 0); tmp.updateMatrix(); beam.setMatrixAt(i, tmp.matrix); });
    ring.instanceMatrix.needsUpdate = beam.instanceMatrix.needsUpdate = true;
    pickList.forEach((u, i) => { const sp = pickIcons[i]; if (!sp) return; const live = t >= u.t0 && t < u.t1; sp.visible = live; if (live) { const [x, y] = V.posAt(u, t); sp.position.set(wx(x), gAt(x, y) + (AIR.test(u.type) ? 3.2 : 0) + 7.4, wz(y)); } });
    // death sparks: a short flash for deaths in the last 2.2 s
    let k = 0;
    for (let i = deaths.length - 1; i >= 0 && k < sparks.length; i--) { const d = deaths[i]; if (d.t1 > t) continue; if (t - d.t1 > 2.2) break;
      const a = (t - d.t1) / 2.2, s = sparks[k++]; s.visible = true; s.position.set(wx(d.dx), gAt(d.dx, d.dy) + 1.2, wz(d.dy)); s.scale.setScalar(2 + a * 7); s.material.opacity = (1 - a) * 0.9; s.material.color.setHex(d.owner === 1 ? 0x9fe0ff : 0xffc27a); }
    for (; k < sparks.length; k++) sparks[k].visible = false;
    // battle zones pulse while active
    for (const { b, m } of zones) { const act = t >= b.t0 - 3 && t <= b.t1 + 6; m.material.opacity = act ? 0.14 + 0.1 * Math.sin(t * 5) : 0; m.visible = act; }
    // optional cinematic follow: slide the camera target toward the active battle
    if (follow) { const act = V.battles.find((b) => t >= b.t0 - 3 && t <= b.t1 + 4); const goal = act ? new THREE.Vector3(wx(act.cx), gAt(act.cx, act.cy), wz(act.cy)) : HOME.target;
      follow3.copy(goal).sub(controls.target).multiplyScalar(0.06); controls.target.add(follow3); camera.position.add(follow3); controls.update(); }
    needs = true;
  }
  function resize() { const r = container.getBoundingClientRect(); if (!r.width || !r.height) return; renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); needs = true; }
  new ResizeObserver(resize).observe(container); resize();
  controls.addEventListener("change", () => (needs = true));
  // hover: name what is under the cursor (instanced meshes carry their unit list)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hoverMeshes = [...buildings, ...movers].map((x) => x.mesh); let lastMove = 0;
  renderer.domElement.addEventListener("pointermove", (e) => {
    const now = performance.now(); if (now - lastMove < 60) return; lastMove = now;
    const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); hoverMeshes.forEach((m) => m.computeBoundingSphere());
    const hit = ray.intersectObjects(hoverMeshes, false)[0];
    opts.onHover && opts.onHover(hit ? { unit: hit.object.userData.list[hit.instanceId], x: e.clientX - r.left, y: e.clientY - r.top } : null);
  });
  renderer.domElement.addEventListener("pointerleave", () => opts.onHover && opts.onHover(null));
  V.Clock.on(update);
  (function loop() { if (needs) { needs = false; renderer.render(scene, camera); } requestAnimationFrame(loop); })();

  return {
    resetView() { camera.position.copy(HOME.pos); controls.target.copy(HOME.target); controls.update(); needs = true; },
    topView() { camera.position.set(0, 260, 0.1); controls.target.set(0, 0, 0); controls.update(); needs = true; },
    setFollow(v) { follow = v; if (!v) needs = true; },
    renderer, camera, scene,
  };
}
window.Viewer3D = { mount };
