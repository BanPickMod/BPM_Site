/*
 * 3D map for the replay viewer (three.js, loaded lazily by Map3D.tsx). Ported from design-lab/viewer/viewer-3d.js.
 * Heightfield from the engine's real terrain grid: smooth pathable ground, dark rock blocks with cliff walls, lighter ramps,
 * base glows in the owner's colour, minerals, shadows. Units and buildings are our own stylised silhouettes (no Blizzard assets).
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MapGrid } from "@/lib/replay/mapAsset";
import { bakeTexture, buildField, makeNormalMap, SUBDIV } from "./terrain";
import { buildFeatures, type Features } from "./features3d";
import { posAt, type Model, type Unit } from "@/lib/replay/timeline";
import { squadsAt, type CostOf, type Squad } from "@/lib/replay/squads";
import { drawBadge, imageCache } from "./squadBadge";
import type { Clock } from "@/lib/replay/clock";

const OWNER: Record<number, number> = { 1: 0x38bdf8, 2: 0xf59e0b };
const RELIEF = 6.0;
const AIR = /medivac|overlord|overseer|liberator|viking|wraith|banshee|muta|corruptor|broodlord|phoenix|voidray|carrier|battlecruiser|raven|sciencevessel|observer|warpprism|tempest|oracle|interceptor/i;
const BIGU = /thor|ultralisk|colossus|carrier|battlecruiser|broodlord|archon|immortal|defiler|ravasaur|tyrannozor|mothership/i;
const SMALLU = /marine|scv|zergling|drone|probe|broodling|reaper|larva|baneling|mule/i;
const BIGB = /commandcenter|orbitalcommand|planetaryfortress|hatchery|lair|hive|nexus/i;

export interface HoverInfo { unit: Unit; x: number; y: number }
export interface SceneOptions {
  model: Model;
  map: MapGrid;
  clock: Clock;
  races: Record<number, string>;
  iconOf: (u: Unit) => string | null;
  /** Icon of a unit type, for the squad badges. */
  iconOfType: (type: string) => string | null;
  costOf: CostOf;
  onHover: (h: HoverInfo | null) => void;
  onSelect: (u: Unit | null) => void;
}
export interface SceneHandle {
  resetView(): void; topView(): void; setFollow(v: boolean): void; dispose(): void;
  /** Slide the camera to a map position (full-map cells), keeping the zoom. */
  focus(x: number, y: number): void;
  /** Show or hide the squad badges (what each army group is made of). */
  setSquads(v: boolean): void;
  /** Show or hide the map's placed features (grass, trees, rocks...) to see the bare ground. */
  setFeatures(v: boolean): void;
  /** Ring around a unit. */
  select(u: Unit | null): void;
  /** Keep the camera on a moving unit until cleared. */
  followUnit(u: Unit | null): void;
}

type Race = "terran" | "zerg" | "protoss";
const raceKey = (r: string | undefined): Race => (r === "protoss" || r === "zerg" ? r : "terran");
const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------- procedural skins ----------
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, n: number) => void, repeat = 1) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const SKIN: Record<Race, { tex: () => THREE.CanvasTexture; metal: number; rough: number; emis: number }> = {
  terran: { tex: () => canvasTex(128, (g, n) => { g.fillStyle = "#9aa4b8"; g.fillRect(0, 0, n, n); g.strokeStyle = "#566072"; g.lineWidth = 2;
      for (let i = 0; i <= n; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, n); g.moveTo(0, i); g.lineTo(n, i); g.stroke(); }
      g.fillStyle = "#e9c24a"; for (let i = 0; i < 6; i++) g.fillRect(i * 24, 118, 12, 10); }), metal: 0.55, rough: 0.5, emis: 0.12 },
  zerg: { tex: () => canvasTex(128, (g, n) => { g.fillStyle = "#4a2a3c"; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${90 + rnd() * 70 | 0},${40 + rnd() * 30 | 0},${70 + rnd() * 50 | 0},0.35)`; g.beginPath(); g.arc(rnd() * n, rnd() * n, 3 + rnd() * 9, 0, 6.283); g.fill(); }
      g.strokeStyle = "rgba(200,60,110,0.55)"; g.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) { g.beginPath(); let x = rnd() * n, y = rnd() * n; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); } }), metal: 0.05, rough: 0.75, emis: 0.2 },
  protoss: { tex: () => canvasTex(128, (g, n) => { const gr = g.createLinearGradient(0, 0, n, n); gr.addColorStop(0, "#e8cf86"); gr.addColorStop(1, "#b88a2f"); g.fillStyle = gr; g.fillRect(0, 0, n, n);
      g.strokeStyle = "rgba(60,40,10,0.55)"; g.lineWidth = 2; for (let i = -n; i < n * 2; i += 40) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + n, n); g.stroke(); }
      g.fillStyle = "rgba(120,220,255,0.7)"; for (let i = 0; i < 8; i++) g.fillRect(8 + i * 15, 60, 5, 8); }), metal: 0.6, rough: 0.35, emis: 0.3 },
};

type G3 = THREE.BufferGeometry;
const T = (g: G3, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0): G3 => {
  const c = g.index ? g.toNonIndexed() : g.clone(); c.scale(sx, sy, sz); c.rotateX(rx); c.rotateY(ry); c.rotateZ(rz); c.translate(x, y, z); return c;
};
type P = [number, number, number, number?, number?, number?, number?, number?, number?];
const box = (...a: P) => T(new THREE.BoxGeometry(1, 1, 1), ...a), cyl = (...a: P) => T(new THREE.CylinderGeometry(0.5, 0.5, 1, 10), ...a),
  cone = (...a: P) => T(new THREE.ConeGeometry(0.5, 1, 7), ...a), sph = (...a: P) => T(new THREE.SphereGeometry(0.5, 12, 8), ...a), oct = (...a: P) => T(new THREE.OctahedronGeometry(0.5), ...a);

// One silhouette per kind of unit/building so things can be told apart at map scale (shape + size + hover name + legend).
const GEO_SRC: Record<"building" | "unit", Record<Race, Record<string, G3[]>>> = {
  building: {
    terran: {
      hall: [box(0, 0.7, 0, 4.6, 1.4, 4.6), box(0, 1.9, 0, 3, 1, 3), cyl(0, 2.9, 0, 1.4, 1.4, 1.4), box(2.6, 0.5, 0, 0.9, 1, 3)],
      rax: [box(0, 0.8, 0, 3, 1.6, 3), box(1.9, 0.5, 0.6, 0.9, 1, 1.4), box(0, 1.8, 0, 1.6, 0.4, 1.6)],
      factory: [box(0, 0.8, 0, 3, 1.6, 3), cyl(-0.8, 2.3, -0.8, 0.6, 1.6, 0.6), box(1.9, 0.5, 0.6, 0.9, 1, 1.4)],
      starport: [box(0, 0.7, 0, 3, 1.4, 3), cyl(0, 1.5, 0, 2.4, 0.15, 2.4), box(0, 2.0, 0, 0.5, 0.9, 0.5)],
      depot: [box(0, 0.35, 0, 1.8, 0.7, 1.8), box(0, 0.8, 0, 1.2, 0.2, 1.2)],
      refinery: [cyl(0, 0.5, 0, 2, 1, 2), cyl(0, 1.2, 0, 0.9, 1.2, 0.9), sph(0.9, 0.8, 0.9, 0.7, 0.7, 0.7)],
      tech: [box(0, 0.7, 0, 2.4, 1.4, 2.4), cyl(0, 2, 0, 1.8, 0.12, 1.8), cyl(0, 1.5, 0, 0.15, 1.2, 0.15)],
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
const BARCH: Record<Race, [RegExp, string][]> = {
  terran: [[/techlab|reactor/i, "small"], [/commandcenter|orbital|planetary/i, "hall"], [/barracks/i, "rax"], [/factory/i, "factory"], [/starport/i, "starport"], [/depot/i, "depot"], [/refinery/i, "refinery"], [/engineering|armory|fusion|ghostacademy|sensor/i, "tech"]],
  zerg: [[/hatchery|^lair|^hive/i, "hatch"], [/spawningpool|roachwarren|hydraliskden|spire|evolution|infestation|banelingnest|ultralisk|nydus/i, "pool"], [/spore|spine/i, "tower"], [/extractor/i, "extractor"]],
  protoss: [[/nexus/i, "nexus"], [/gateway|warpgate|stargate|robotics/i, "gate"], [/pylon/i, "pylon"], [/cyber|twilight|templar|dark|fleet|forge/i, "tech"]],
};
const UARCH: Record<Race, [RegExp, string][]> = {
  terran: [[/tank/i, "tank"], [/goliath|warhound|thor/i, "walker"], [/marauder|firebat/i, "heavy"], [/hellion|hellbat|widowmine|cyclone/i, "vehicle"], [/medivac|liberator/i, "dropship"], [/viking|wraith|banshee/i, "fighter"], [/battlecruiser|raven|sciencevessel/i, "capital"]],
  zerg: [[/roach|ravager|aberration/i, "roach"], [/hydralisk|lurker|queen/i, "hydra"], [/ultralisk|ravasaur|tyrannozor/i, "brute"], [/mutalisk|corruptor|overlord|overseer|broodlord|guardian|viper/i, "flyer"], [/infestor|defiler/i, "caster"]],
  protoss: [[/stalker|dragoon|sentry|energizer/i, "walker"], [/immortal|disruptor|reaver/i, "mech"], [/colossus/i, "tall"], [/phoenix|voidray|oracle|carrier|tempest|scout|corsair|arbiter|mothership|observer|warpprism/i, "air"], [/templar|archon/i, "caster"]],
};
const DEFAULT_U: Record<Race, string> = { terran: "inf", zerg: "ling", protoss: "zeal" };
const pick1 = (table: [RegExp, string][], type: string, dflt: string) => (table.find(([re]) => re.test(type)) ?? [null, dflt])[1] as string;

function glowTexture(inner = "rgba(255,255,255,0.95)", outer = "rgba(255,255,255,0)") {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!, r = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  r.addColorStop(0, inner); r.addColorStop(0.45, "rgba(255,255,255,0.25)"); r.addColorStop(1, outer);
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const usize = (t: string) => 1.9 * (BIGU.test(t) ? 1.9 : SMALLU.test(t) ? 0.75 : 1.2);   // exaggerated so units read at map scale

export function mountScene(container: HTMLElement, o: SceneOptions): SceneHandle {
  const { model, map: M, clock } = o;
  const BW = M.w, BH = M.h, k = Math.max(BW, BH) / 140;       // camera and shadow sizes were tuned on a 140-cell map
  const span = Math.max(1, M.hMax - M.hMin);
  const relief = RELIEF * Math.min(1.5, Math.max(0.35, span / 32));   // flat maps are not stretched into mountains

  // ---------- terrain: smooth height field, baked colour texture, skirt ----------
  const field = buildField(M, relief);
  const gAt = (x: number, y: number) => field.heightAt(x, y);                                // crop cells
  const wx = (x: number) => x - M.x0 - BW / 2, wz = (y: number) => -(y - M.y0 - BH / 2);   // timeline cells -> world
  const gAtFull = (x: number, y: number) => gAt(x - M.x0, y - M.y0);
  const lx = (x: number) => x - BW / 2, lz = (y: number) => -(y - BH / 2);                  // crop cells -> world

  function buildTerrain(): G3 {
    const { fw, fh, H } = field, R = SUBDIV, n = fw * fh;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
      const v = j * fw + i;
      pos[v * 3] = lx(i / R); pos[v * 3 + 1] = H[v]; pos[v * 3 + 2] = lz(j / R);
      const dhx = (H[j * fw + Math.min(fw - 1, i + 1)] - H[j * fw + Math.max(0, i - 1)]) / (2 / R);
      const dhy = (H[Math.min(fh - 1, j + 1) * fw + i] - H[Math.max(0, j - 1) * fw + i]) / (2 / R);
      const l = Math.hypot(dhx, 1, dhy);
      nor[v * 3] = -dhx / l; nor[v * 3 + 1] = 1 / l; nor[v * 3 + 2] = dhy / l;
      uv[v * 2] = i / (fw - 1); uv[v * 2 + 1] = j / (fh - 1);
    }
    const idx = new Uint32Array((fw - 1) * (fh - 1) * 6);
    let o = 0;
    for (let j = 0; j < fh - 1; j++) for (let i = 0; i < fw - 1; i++) {
      const a = j * fw + i, b = a + 1, c = a + fw, d = c + 1;
      idx[o++] = a; idx[o++] = b; idx[o++] = c; idx[o++] = b; idx[o++] = d; idx[o++] = c;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }
  /** A wall down from the terrain's outer edge to the slab, so the map reads as a solid board from any angle. */
  function buildSkirt(): G3 {
    const { fw, fh, H } = field, R = SUBDIV, floor = -0.15, pos: number[] = [];
    const edge = (pts: [number, number, number][]) => { for (let k = 0; k < pts.length - 1; k++) { const [x0, h0, z0] = pts[k], [x1, h1, z1] = pts[k + 1]; pos.push(x0, h0, z0, x1, h1, z1, x1, floor, z1, x0, h0, z0, x1, floor, z1, x0, floor, z0); } };
    edge(Array.from({ length: fw }, (_, i) => [lx(i / R), H[i], lz(0)] as [number, number, number]));
    edge(Array.from({ length: fw }, (_, i) => [lx(i / R), H[(fh - 1) * fw + i], lz(fh / R - 1 / R)] as [number, number, number]));
    edge(Array.from({ length: fh }, (_, j) => [lx(0), H[j * fw], lz(j / R)] as [number, number, number]));
    edge(Array.from({ length: fh }, (_, j) => [lx(fw / R - 1 / R), H[j * fw + fw - 1], lz(j / R)] as [number, number, number]));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  // ---------- renderer, camera, light ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x07080f); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement); renderer.domElement.style.cssText = "display:block;width:100%;height:100%";

  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x07080f, 230 * k, 520 * k);
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 1500 * k);
  const HOME = { pos: new THREE.Vector3(0, 150 * k, 172 * k), target: new THREE.Vector3(0, -2, 6 * k) };
  camera.position.copy(HOME.pos);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME.target); controls.minDistance = 55 * k; controls.maxDistance = 330 * k; controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.38;
  controls.minAzimuthAngle = -0.9; controls.maxAzimuthAngle = 0.9; controls.enablePan = true; controls.screenSpacePanning = false; controls.update();

  scene.add(new THREE.HemisphereLight(0x9db4ff, 0x1c1526, 0.85));
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.9); sun.position.set(-70 * k, 110 * k, 80 * k); sun.castShadow = true;
  const shadowSize = Math.min(4096, renderer.capabilities.maxTextureSize); sun.shadow.mapSize.set(shadowSize, shadowSize);
  const sc = sun.shadow.camera; sc.left = -140 * k; sc.right = 140 * k; sc.top = 140 * k; sc.bottom = -140 * k; sc.near = 20 * k; sc.far = 340 * k;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.4;
  scene.add(sun);

  const aniso = renderer.capabilities.getMaxAnisotropy();
  const bakedTex = new THREE.CanvasTexture(bakeTexture(M, field));
  bakedTex.colorSpace = THREE.SRGBColorSpace; bakedTex.anisotropy = aniso; bakedTex.wrapS = bakedTex.wrapT = THREE.ClampToEdgeWrapping;
  const grain = new THREE.CanvasTexture(makeNormalMap());
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(BW / 5, BH / 5); grain.anisotropy = aniso;
  const terr = new THREE.Mesh(buildTerrain(), new THREE.MeshStandardMaterial({ map: bakedTex, normalMap: grain, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.94, metalness: 0 }));
  terr.receiveShadow = true; terr.castShadow = true; scene.add(terr);
  const skirt = new THREE.Mesh(buildSkirt(), new THREE.MeshLambertMaterial({ color: 0x24201f, side: THREE.DoubleSide })); scene.add(skirt);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.2, 9, BH + 0.2), new THREE.MeshLambertMaterial({ color: 0x0d0f1a })); slab.position.set(0, -4.6, 0); scene.add(slab);
  const grid = new THREE.GridHelper(Math.max(BW, BH) * 2.6, 52, 0x232a50, 0x151934); grid.position.y = -9.2; scene.add(grid);

  // minerals and gas
  const dummy = new THREE.Object3D();
  const crystal = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.62), new THREE.MeshStandardMaterial({ color: 0x4aa8ff, emissive: 0x1760d0, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.1 }), Math.max(1, M.res.length));
  crystal.count = M.res.length;
  M.res.forEach(([x, y], i) => { dummy.position.set(lx(x), gAt(x, y) + 0.9, lz(y)); dummy.scale.set(0.9, 1.8, 0.9); dummy.rotation.y = hash(x, y) * 6; dummy.updateMatrix(); crystal.setMatrixAt(i, dummy.matrix); });
  crystal.castShadow = true; scene.add(crystal);

  // what the map maker placed: grass, trees, rocks, ruins, buildings, destructibles, towers, geysers
  const features: Features = buildFeatures(M, gAt, lx, lz);
  scene.add(features.group);

  // base glows follow the owner of a living town hall
  const glowTex = glowTexture();
  const bases = [...M.starts, ...M.exps].map(([x, y]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x444444, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(lx(x), gAt(x, y) + 0.25, lz(y)); scene.add(m);
    return { x: x + M.x0, y: y + M.y0, m };
  });
  const townhalls = model.units.filter((u) => u.kind === "structure" && BIGB.test(u.type));

  // ---------- units ----------
  const GEO: Record<"building" | "unit", Record<Race, Record<string, G3>>> = { building: { terran: {}, zerg: {}, protoss: {} }, unit: { terran: {}, zerg: {}, protoss: {} } };
  for (const kind of ["building", "unit"] as const) for (const race of ["terran", "zerg", "protoss"] as const)
    for (const [key, parts] of Object.entries(GEO_SRC[kind][race])) GEO[kind][race][key] = mergeGeometries(parts)!;
  const skins = [1, 2].map((owner) => {
    const race = raceKey(o.races[owner]), S = SKIN[race], tint = new THREE.Color(OWNER[owner]).lerp(new THREE.Color(0xffffff), 0.55);
    return { owner, race, mat: new THREE.MeshStandardMaterial({ map: S.tex(), color: tint, emissive: OWNER[owner], emissiveIntensity: S.emis, roughness: S.rough, metalness: S.metal }) };
  });
  interface Group { list: Unit[]; mesh: THREE.InstancedMesh; kind: string }
  const groupsOf = (building: boolean): Group[] => skins.flatMap((s) => {
    const table = building ? BARCH[s.race] : UARCH[s.race], dflt = building ? "small" : DEFAULT_U[s.race], geos = building ? GEO.building[s.race] : GEO.unit[s.race];
    return Object.keys(geos).flatMap((kind) => {
      const list = model.units.filter((u) => u.owner === s.owner && (building ? u.kind === "structure" : u.kind === "army") && pick1(table, u.type, dflt) === kind);
      if (!list.length) return [];
      const mesh = new THREE.InstancedMesh(geos[kind], s.mat, list.length);
      mesh.castShadow = true; mesh.receiveShadow = building; mesh.frustumCulled = false; mesh.userData.list = list; scene.add(mesh);
      return [{ list, mesh, kind }];
    });
  });
  const buildings = groupsOf(true), movers = groupsOf(false);

  // picked units: lime ring on the ground, a beam, and the pick's portrait above
  const pickList = model.units.filter((u) => u.pick);
  const ring = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.12, 6, 24), new THREE.MeshBasicMaterial({ color: 0xd6f542, transparent: true, opacity: 0.95 }), Math.max(1, pickList.length));
  const beam = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xd6f542, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), Math.max(1, pickList.length));
  ring.frustumCulled = beam.frustumCulled = false; scene.add(ring, beam);
  let needs = true;
  const loader = new THREE.TextureLoader(), iconTex = new Map<string, THREE.Texture>();
  const pickIcons = pickList.map((u) => {
    const url = o.iconOf(u); if (!url) return null;
    let tex = iconTex.get(url);
    if (!tex) { tex = loader.load(url, () => (needs = true)); tex.colorSpace = THREE.SRGBColorSpace; iconTex.set(url, tex); }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(5.2, 5.2, 1); sp.visible = false; scene.add(sp);
    return sp;
  });

  // squad badges: for each army group that was seen recently, the two unit types that make up most of its value, with their counts
  const BADGE_W = 256, BADGE_H = 88, BADGES_PER_SIDE = 8;
  const badgeCache = new Map<string, THREE.CanvasTexture>();
  const iconImage = imageCache(() => { badgeCache.forEach((t) => t.dispose()); badgeCache.clear(); squadT = -1; update(); });   // an icon that arrives late replaces its letter even while paused
  const badgeKey = (q: Squad) => `${q.owner}|${q.comp.slice(0, 2).map((c) => `${c.type}:${c.count}:${c.pick ? 1 : 0}`).join(",")}`;
  function badgeTexture(q: Squad): THREE.CanvasTexture {
    const key = badgeKey(q);
    let tex = badgeCache.get(key);
    if (!tex) {
      const cv = document.createElement("canvas"); cv.width = BADGE_W; cv.height = BADGE_H;
      drawBadge(cv.getContext("2d")!, BADGE_W, BADGE_H, q, (type) => iconImage(o.iconOfType(type)));
      tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      if (badgeCache.size >= 160) { const first = badgeCache.keys().next().value!; badgeCache.get(first)!.dispose(); badgeCache.delete(first); }
      badgeCache.set(key, tex);
    }
    return tex;
  }
  const badgeSprites = Array.from({ length: BADGES_PER_SIDE * 2 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); sp.scale.set(19, 19 * BADGE_H / BADGE_W, 1); sp.visible = false; sp.renderOrder = 6; scene.add(sp); return sp;
  });
  let squadsOn = true, squadT = -1, squadList: Squad[] = [];
  function updateSquads(t: number) {
    if (!squadsOn) { badgeSprites.forEach((sp) => (sp.visible = false)); return; }
    if (squadT < 0 || Math.abs(t - squadT) >= 0.4) {                 // grouping a few dozen units is cheap, but not worth doing sixty times a second
      squadT = t;
      squadList = [...squadsAt(model, 1, t, o.costOf).slice(0, BADGES_PER_SIDE), ...squadsAt(model, 2, t, o.costOf).slice(0, BADGES_PER_SIDE)];
      badgeSprites.forEach((sp, i) => {
        const q = squadList[i];
        if (!q) { sp.visible = false; return; }
        sp.material.map = badgeTexture(q); sp.material.needsUpdate = true;
      });
    }
    badgeSprites.forEach((sp, i) => {
      const q = squadList[i];
      if (!q) { sp.visible = false; return; }
      sp.visible = true; sp.position.set(wx(q.x), gAtFull(q.x, q.y) + 9.5, wz(q.y));
    });
  }

  // deaths and battle zones
  const sparkTex = glowTexture("rgba(255,244,214,1)", "rgba(255,120,60,0)");
  const sparks = Array.from({ length: 110 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: 0xffb070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); return s;
  });
  const deaths = model.units.filter((u) => u.died < Infinity && u.death && u.kind === "army").sort((a, b) => a.died - b.died);
  const zones = model.battles.map((b) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(13, 40), new THREE.MeshBasicMaterial({ color: 0xff4458, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(wx(b.cx), gAtFull(b.cx, b.cy) + 0.3, wz(b.cy)); m.visible = false; scene.add(m);
    return { b, m };
  });

  // selection ring
  const selRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.09, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }));
  selRing.rotation.x = -Math.PI / 2; selRing.visible = false; selRing.renderOrder = 10; scene.add(selRing);
  let selected: Unit | null = null, followTarget: Unit | null = null, focusGoal: THREE.Vector3 | null = null;
  const unitPos = (u: Unit, t: number): { x: number; y: number } | null => {
    const p = posAt(u, t, model.windowSec);
    return p ? { x: p.x, y: p.y } : null;
  };

  // ---------- per-frame update ----------
  let follow = false;
  const tmp = new THREE.Object3D(), follow3 = new THREE.Vector3(), heading = new Map<Unit, number>();
  const W = model.windowSec;
  function update() {
    const t = clock.t;
    for (const b of bases) {
      const th = townhalls.find((u) => { const p = posAt(u, t, W); return !!p && (p.air ?? 0) < 0.5 && Math.abs(p.x - b.x) < 7 && Math.abs(p.y - b.y) < 7; });
      if (th) { b.m.material.color.setHex(OWNER[th.owner]); b.m.material.opacity = 0.85; } else b.m.material.opacity = 0;
    }
    for (const B of buildings) {
      B.list.forEach((u, i) => {
        const p = posAt(u, t, W), live = !!p, px = p ? p.x : u.x0, py = p ? p.y : u.y0;
        tmp.position.set(wx(px), gAtFull(px, py) + (p?.air ?? 0) * 3.2, wz(py)); tmp.scale.setScalar(live ? 1 : 0);   // a lifted building rises off the ground
        tmp.rotation.set(0, ["hall", "hatch", "nexus"].includes(B.kind) ? 0 : hash(u.x0, u.y0) * 1.2, 0); tmp.updateMatrix(); B.mesh.setMatrixAt(i, tmp.matrix);
      });
      B.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const Mv of movers) {
      Mv.list.forEach((u, i) => {
        const p = posAt(u, t, W);
        if (!p) { tmp.scale.setScalar(0); tmp.position.set(0, -50, 0); tmp.updateMatrix(); Mv.mesh.setMatrixAt(i, tmp.matrix); return; }
        const p2 = posAt(u, t + 1.5, W) ?? p, air = AIR.test(u.type) ? 3.4 : 0;
        if (Math.hypot(p2.x - p.x, p2.y - p.y) > 0.05) heading.set(u, Math.atan2(p2.x - p.x, -(p2.y - p.y)));   // face the way it moves (world z is -y)
        tmp.position.set(wx(p.x), gAtFull(p.x, p.y) + air, wz(p.y)); tmp.scale.setScalar(usize(u.type) * 0.55 * (0.3 + 0.7 * p.a));
        tmp.rotation.set(0, heading.get(u) ?? 0, 0); tmp.updateMatrix(); Mv.mesh.setMatrixAt(i, tmp.matrix);
      });
      Mv.mesh.instanceMatrix.needsUpdate = true;
    }
    pickList.forEach((u, i) => {
      const p = posAt(u, t, W), s = usize(u.type), air = AIR.test(u.type) ? 3.2 : 0;
      if (!p) {
        tmp.scale.setScalar(0); tmp.updateMatrix(); ring.setMatrixAt(i, tmp.matrix); beam.setMatrixAt(i, tmp.matrix);
        const sp0 = pickIcons[i]; if (sp0) sp0.visible = false;
        return;
      }
      const gy = gAtFull(p.x, p.y);
      tmp.position.set(wx(p.x), gy + 0.15, wz(p.y)); tmp.rotation.set(-Math.PI / 2, 0, 0); tmp.scale.setScalar(0.9 + s * 0.55); tmp.updateMatrix(); ring.setMatrixAt(i, tmp.matrix);
      tmp.position.set(wx(p.x), gy + 3.2 + air, wz(p.y)); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(1); tmp.updateMatrix(); beam.setMatrixAt(i, tmp.matrix);
      const sp = pickIcons[i]; if (sp) { sp.visible = !squadsOn; sp.position.set(wx(p.x), gy + air + 7.4, wz(p.y)); sp.material.opacity = 0.4 + 0.6 * p.a; }
    });
    updateSquads(t);
    ring.instanceMatrix.needsUpdate = beam.instanceMatrix.needsUpdate = true;
    // death sparks: a short flash for deaths in the last 2.2 s
    let n = 0;
    for (let i = deaths.length - 1; i >= 0 && n < sparks.length; i--) {
      const d = deaths[i]; if (d.died > t) continue; if (t - d.died > 2.2) break;
      const a = (t - d.died) / 2.2, s = sparks[n++]; s.visible = true;
      s.position.set(wx(d.death![0]), gAtFull(d.death![0], d.death![1]) + 1.2, wz(d.death![1])); s.scale.setScalar(2 + a * 7); s.material.opacity = (1 - a) * 0.9; s.material.color.setHex(d.owner === 1 ? 0x9fe0ff : 0xffc27a);
    }
    for (; n < sparks.length; n++) sparks[n].visible = false;
    for (const { b, m } of zones) { const act = t >= b.t0 - 3 && t <= b.t1 + 6; m.visible = act; m.material.opacity = act ? 0.14 + 0.1 * Math.sin(t * 5) : 0; }
    if (follow) {                                                   // slide the camera target toward the active battle
      const act = model.battles.find((b) => t >= b.t0 - 3 && t <= b.t1 + 4);
      const goal = act ? new THREE.Vector3(wx(act.cx), gAtFull(act.cx, act.cy), wz(act.cy)) : HOME.target;
      follow3.copy(goal).sub(controls.target).multiplyScalar(0.06); controls.target.add(follow3); camera.position.add(follow3); controls.update();
    }
    if (selected) {
      const p = unitPos(selected, t);
      selRing.visible = !!p;
      if (p) { selRing.position.set(wx(p.x), gAtFull(p.x, p.y) + 0.3 + (AIR.test(selected.type) ? 3.2 : 0), wz(p.y)); selRing.scale.setScalar(selected.kind === "structure" ? (BIGB.test(selected.type) ? 4.6 : 2.6) : 1.2 + usize(selected.type) * 0.55); }
    } else selRing.visible = false;
    needs = true;
  }

  // The home view is sized to the window: as close as lets the whole map fit, whether the stage is wide (limited by height) or narrow (by width).
  const HOME_DIR = new THREE.Vector3(0, 150, 172).normalize();
  let moved = false;                                              // once the viewer has moved the camera, a resize keeps their view
  function fitHome() {
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), sinTilt = HOME_DIR.y;   // a flat map seen from above is this much shallower
    const halfDepth = (BH / 2) * sinTilt + 8 * k, halfWidth = (BW / 2) * 1.04;
    const dist = Math.max(halfDepth / tanHalf, halfWidth / (tanHalf * camera.aspect)) * 1.04;
    HOME.pos.copy(HOME.target).addScaledVector(HOME_DIR, THREE.MathUtils.clamp(dist, 60 * k, 320 * k));
  }
  function resize() {
    const r = container.getBoundingClientRect(); if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
    fitHome();
    if (!moved) { camera.position.copy(HOME.pos); controls.update(); }
    needs = true;
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  controls.addEventListener("start", () => (moved = true));
  controls.addEventListener("change", () => (needs = true));

  // hover: name what is under the cursor (instanced meshes carry their unit list)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hoverMeshes = [...buildings, ...movers].map((x) => x.mesh); let lastMove = 0;
  const pickAt = (e: PointerEvent): Unit | null => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); hoverMeshes.forEach((m) => m.computeBoundingSphere());
    const hit = ray.intersectObjects(hoverMeshes, false)[0];
    return hit && hit.instanceId !== undefined ? (hit.object.userData.list as Unit[])[hit.instanceId] : null;
  };
  const onMove = (e: PointerEvent) => {
    const now = performance.now(); if (now - lastMove < 60) return; lastMove = now;
    const r = renderer.domElement.getBoundingClientRect(), unit = pickAt(e);
    o.onHover(unit ? { unit, x: e.clientX - r.left, y: e.clientY - r.top } : null);
  };
  const onLeave = () => o.onHover(null);
  let down: { x: number; y: number; t: number } | null = null;           // a click is a press and release that did not drag the camera
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onUp = (e: PointerEvent) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 500) o.onSelect(pickAt(e));
    down = null;
  };
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("pointerleave", onLeave);
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  const unsub = clock.subscribe(update);
  update();
  let raf = 0, dead = false;
  function stepCamera() {
    let goal: THREE.Vector3 | null = focusGoal;
    if (followTarget) { const p = unitPos(followTarget, clock.t); if (p) goal = new THREE.Vector3(wx(p.x), gAtFull(p.x, p.y), wz(p.y)); }
    if (!goal) return;
    follow3.copy(goal).sub(controls.target);
    if (!followTarget && follow3.length() < 0.2) { focusGoal = null; return; }
    follow3.multiplyScalar(0.18); controls.target.add(follow3); camera.position.add(follow3); controls.update(); needs = true;
  }
  (function loop() { if (dead) return; stepCamera(); if (needs) { needs = false; renderer.render(scene, camera); } raf = requestAnimationFrame(loop); })();

  return {
    resetView() { moved = false; camera.position.copy(HOME.pos); controls.target.copy(HOME.target); controls.update(); needs = true; },
    topView() { camera.position.set(0, 260 * k, 0.1); controls.target.set(0, 0, 0); controls.update(); needs = true; },
    setFollow(v: boolean) { follow = v; needs = true; },
    focus(x: number, y: number) { moved = true; followTarget = null; focusGoal = new THREE.Vector3(wx(x), gAtFull(x, y), wz(y)); },
    setFeatures(v: boolean) { features.setVisible(v); needs = true; },
    setSquads(v: boolean) { squadsOn = v; squadT = -1; update(); },
    select(u: Unit | null) { selected = u; update(); },
    followUnit(u: Unit | null) { followTarget = u; if (u) { moved = true; focusGoal = null; } },
    dispose() {
      dead = true; cancelAnimationFrame(raf); unsub(); ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove); renderer.domElement.removeEventListener("pointerleave", onLeave);
      renderer.domElement.removeEventListener("pointerdown", onDown); renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => { (x as THREE.MeshBasicMaterial).map?.dispose(); x.dispose(); });
      });
      iconTex.forEach((t) => t.dispose());
      badgeCache.forEach((t) => t.dispose()); badgeCache.clear();
      features.dispose();
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
