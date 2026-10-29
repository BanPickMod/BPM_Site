/**
 * Replay viewer data model: the worker's timeline.json.gz (schema 1, worker/bpm_replay/timeline.py) decoded into
 * plain typed arrays, plus the pure queries the viewer needs (where is a unit at time t, how is a pick being used,
 * who won a battle). No DOM, no React: everything here is unit-tested (timeline.test.ts).
 */

export type Owner = 1 | 2;
export type PositionMode = "tracked" | "static" | "event-endpoints" | "birth-only";

/** A lift and landing of a building (the worker's `moves`): where it left from, where it landed, and what it was seen passing. */
export interface RawMove {
  t0: number;
  t1: number;
  x: number;
  y: number;
  fromX?: number;
  fromY?: number;
  /** "command" = the landing command's point, "track" = the last place it was seen in the air, "unknown" = it left and we do not know where it landed. */
  src: "command" | "track" | "unknown";
  path?: [number, number, number][];
}

export interface RawUnit {
  tag: number;
  type: string;
  owner: Owner;
  kind: "structure" | "worker" | "army" | "other";
  bornT: number | null;
  doneT: number | null;
  diedT: number | null;
  killerOwner: number | null;
  killerType: string | null;
  x0: number;
  y0: number;
  deathPos: [number, number] | null;
  /** First point absolute [t, x, y], then [dt, dx, dy]; all times and coordinates multiplied by meta.timeScale. */
  track: number[][];
  positionMode: PositionMode;
  moves?: RawMove[];
}

export interface RawSeriesPoint {
  t: number;
  owner: Owner;
  minerals: number;
  gas: number;
  workers: number;
  supply: [number, number];
  armyValue: number;
  incomeMin: number;
  incomeGas: number;
  spent: number;
  lost: number;
  killed: number;
}

export interface RawBattle {
  id: number;
  t0: number;
  t1: number;
  cx: number;
  cy: number;
  lostA: number;
  lostB: number;
  units: Record<string, number>;
  importance: number;
}

export interface RawTimeline {
  schema: 1;
  meta: {
    map: string | null;
    mapTransform: { asset: string; x0: number; y0: number; w: number; h: number } | null;
    build: number | null;
    durationSec: number;
    analyzerVersion: string;
    timeScale: number;
    coordinateScale: number;
    positionPolicy: { endpointWindowSec: number } & Record<string, string | number>;
    positionModes: Record<string, number>;
  };
  players: { owner: Owner; race: string | null; result: "win" | "loss" | null; isAi: boolean; handleKey: string | null }[];
  draft: { players: { owner: Owner; picks: { unit: string; replaces: string | null; group: string | null }[]; bans: string[]; displaced: string[] }[] };
  series: RawSeriesPoint[];
  units: RawUnit[];
  buildOrder: { t: number; owner: Owner; supply: number | null; kind: string; id: string }[];
  battles: RawBattle[];
  tech: { t: number; owner: Owner; id: string }[];
}

export interface Unit {
  row: number;
  type: string;
  owner: Owner;
  kind: "structure" | "worker" | "army";
  born: number;
  /** Infinity while alive at the end of the replay. */
  died: number;
  x0: number;
  y0: number;
  death: [number, number] | null;
  killer: { owner: number; type: string } | null;
  mode: PositionMode;
  moves: RawMove[];
  ts: Float32Array;
  xs: Float32Array;
  ys: Float32Array;
  pick: boolean;
}

export interface Battle {
  id: number;
  label: string;
  t0: number;
  t1: number;
  cx: number;
  cy: number;
  lost: [number, number];
  /** 1 or 2 = the side that lost fewer units, 0 = even. */
  winner: 0 | 1 | 2;
  picksLost: number;
  units: Record<string, number>;
}

export interface Model {
  raw: RawTimeline;
  duration: number;
  units: Unit[];
  series: Record<Owner, RawSeriesPoint[]>;
  battles: Battle[];
  windowSec: number;
}

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Decode one track: first point absolute, then deltas, then undo the integer scaling. */
export function decodeTrack(track: number[][], timeScale: number, coordScale: number): { ts: Float32Array; xs: Float32Array; ys: Float32Array } {
  const n = track.length;
  const ts = new Float32Array(n), xs = new Float32Array(n), ys = new Float32Array(n);
  let t = 0, x = 0, y = 0;
  for (let i = 0; i < n; i++) {
    const [a, b, c] = track[i];
    if (i === 0) { t = a; x = b; y = c; } else { t += a; x += b; y += c; }
    ts[i] = t / timeScale; xs[i] = x / coordScale; ys[i] = y / coordScale;
  }
  return { ts, xs, ys };
}

const letter = (id: number) => (id >= 1 && id <= 26 ? String.fromCharCode(64 + id) : String(id));

/**
 * Units that a Protoss warps in start with the same event as a building, so analyses made before the worker told them apart list them
 * as buildings. They are units: read them as army, placed from their recorded positions or the places they were seen.
 */
const WARPED_IN = /^(Zealot|Stalker|Sentry|Adept|HighTemplar|DarkTemplar|Archon|Dragoon|Energizer)$/;

export function buildModel(raw: RawTimeline): Model {
  const { timeScale, coordinateScale } = raw.meta;
  const pickSets: Record<number, string[]> = {};
  for (const p of raw.draft.players) pickSets[p.owner] = p.picks.map((x) => norm(x.unit));
  const units: Unit[] = [];
  raw.units.forEach((u, row) => {
    if (u.kind === "other" || (u.owner !== 1 && u.owner !== 2)) return;
    const tr = decodeTrack(u.track, timeScale, coordinateScale);
    const warped = u.kind === "structure" && WARPED_IN.test(u.type);
    const kind = warped ? "army" : u.kind;
    const mode: PositionMode = warped ? (tr.ts.length ? "tracked" : u.deathPos ? "event-endpoints" : "birth-only") : u.positionMode;
    units.push({
      row, type: u.type, owner: u.owner, kind, born: u.bornT ?? 0, died: u.diedT ?? Infinity, x0: u.x0, y0: u.y0, death: u.deathPos,
      killer: u.killerType ? { owner: u.killerOwner ?? 0, type: u.killerType } : null, mode, moves: u.moves ?? [], ...tr, pick: kind === "army" && (pickSets[u.owner] ?? []).some((n) => norm(u.type).includes(n)),
    });
  });

  const series: Record<Owner, RawSeriesPoint[]> = { 1: [], 2: [] };
  for (const s of raw.series) series[s.owner]?.push(s);
  series[1].sort((a, b) => a.t - b.t); series[2].sort((a, b) => a.t - b.t);

  const battles: Battle[] = raw.battles.map((b) => {
    const picksLost = units.filter((u) => u.pick && u.died >= b.t0 - 0.1 && u.died <= b.t1 + 0.1).length;
    return { id: b.id, label: letter(b.id), t0: b.t0, t1: b.t1, cx: b.cx, cy: b.cy, lost: [b.lostA, b.lostB], winner: b.lostA === b.lostB ? 0 : b.lostA < b.lostB ? 1 : 2, picksLost, units: b.units };
  });
  return { raw, duration: raw.meta.durationSec, units, series, battles, windowSec: raw.meta.positionPolicy.endpointWindowSec ?? 3 };
}

const LIFT_SEC = 1.6;   // how long the rise and the descent take on screen
const ease = (v: number) => { const c = Math.min(1, Math.max(0, v)); return c * c * (3 - 2 * c); };

/**
 * A building that lifted off: it stands where it was first placed, flies from there to where it landed (through the places it was
 * seen on the way), then stands at the landing. `air` is 0 on the ground and 1 at full height; the 3D view lifts the model by it.
 */
function movedPos(u: Unit, t: number): { x: number; y: number; a: number; air: number } {
  let x = u.x0, y = u.y0;
  for (const m of u.moves) {
    if (t < m.t0) break;
    const from = { x: m.fromX ?? x, y: m.fromY ?? y };
    if (t >= m.t1) { x = m.x; y = m.y; continue; }
    const pts: [number, number, number][] = [[m.t0, from.x, from.y], ...(m.path ?? []).filter((p) => p[0] > m.t0 && p[0] < m.t1), [m.t1, m.x, m.y]];
    let k = 1;
    while (k < pts.length - 1 && pts[k][0] <= t) k++;
    const [ta, xa, ya] = pts[k - 1], [tb, xb, yb] = pts[k], f = Math.min(1, Math.max(0, (t - ta) / Math.max(0.01, tb - ta)));
    return { x: xa + (xb - xa) * f, y: ya + (yb - ya) * f, a: 1, air: Math.min(ease((t - m.t0) / LIFT_SEC), ease((m.t1 - t) / LIFT_SEC)) };
  }
  return { x, y, a: 1, air: 0 };
}

/** Where a unit is drawn at time t and how opaque (0..1), or null when it should not be drawn. Follows meta.positionPolicy. */
export function posAt(u: Unit, t: number, windowSec: number): { x: number; y: number; a: number; air?: number } | null {
  if (t < u.born || t >= u.died) return null;
  switch (u.mode) {
    case "static":
      return u.moves.length ? movedPos(u, t) : { x: u.x0, y: u.y0, a: 1 };
    case "tracked": {
      const { ts, xs, ys } = u, n = ts.length;
      if (n === 0 || t <= ts[0]) return { x: n ? u.x0 : u.x0, y: u.y0, a: 1 };
      if (t >= ts[n - 1]) return { x: xs[n - 1], y: ys[n - 1], a: 1 };
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; }
      const k = (t - ts[lo]) / Math.max(0.01, ts[hi] - ts[lo]);
      return { x: xs[lo] + (xs[hi] - xs[lo]) * k, y: ys[lo] + (ys[hi] - ys[lo]) * k, a: 1 };
    }
    case "event-endpoints":
      // No samples between birth and death: show it only where we actually know it was, fading in and out.
      if (t - u.born <= windowSec) return { x: u.x0, y: u.y0, a: 1 - (t - u.born) / windowSec };
      if (u.death && u.died - t <= windowSec) return { x: u.death[0], y: u.death[1], a: 1 - (u.died - t) / windowSec };
      return null;
    case "birth-only":
      return t - u.born <= windowSec ? { x: u.x0, y: u.y0, a: 1 - (t - u.born) / windowSec } : null;
  }
}

export function statAt(m: Model, owner: Owner, t: number): RawSeriesPoint | null {
  const s = m.series[owner];
  if (!s.length) return null;
  let lo = 0, hi = s.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (s[mid].t <= t) lo = mid; else hi = mid - 1; }
  return s[lo];
}

export interface PickUsage {
  unit: string;
  replaces: string | null;
  made: number;
  alive: number;
  lost: number;
  total: number;
  first: number | null;
  unused: boolean;
}

/** How each picked unit is being used up to time t (units are matched by type name, which already has the BPM_ prefix removed). */
export function pickUsage(m: Model, owner: Owner, t: number): PickUsage[] {
  const draft = m.raw.draft.players.find((p) => p.owner === owner);
  if (!draft) return [];
  return draft.picks.map((pk) => {
    const n = norm(pk.unit);
    const mine = m.units.filter((u) => u.owner === owner && u.kind === "army" && norm(u.type).includes(n));
    const made = mine.filter((u) => u.born <= t), lost = made.filter((u) => u.died <= t);
    return { unit: pk.unit, replaces: pk.replaces, made: made.length, alive: made.length - lost.length, lost: lost.length, total: mine.length,
      first: mine.length ? Math.min(...mine.map((u) => u.born)) : null, unused: mine.length === 0 };
  });
}

export function aliveCounts(m: Model, owner: Owner, t: number): { units: number; buildings: number } {
  let units = 0, buildings = 0;
  for (const u of m.units) if (u.owner === owner && u.born <= t && t < u.died) { if (u.kind === "structure") buildings++; else if (u.kind === "army") units++; }
  return { units, buildings };
}

const NOT_ARMY = /Overlord|Overseer|Larva|Egg|Medivac|MULE/;

/** Army size over time split into picked units and the rest (stacked area chart), one point per 5 seconds. */
export function compSeries(m: Model, owner: Owner): { t: number; pick: number; other: number }[] {
  const us = m.units.filter((u) => u.owner === owner && u.kind === "army" && !NOT_ARMY.test(u.type));
  const out: { t: number; pick: number; other: number }[] = [];
  for (let t = 0; t <= m.duration; t += 5) {
    let pick = 0, other = 0;
    for (const u of us) if (u.born <= t && t < u.died) { if (u.pick) pick++; else other++; }
    out.push({ t, pick, other });
  }
  return out;
}

/** First appearance of each unit/building type, in time order (the build tab). */
export function buildLog(m: Model, owner: Owner, limit = 40): { t: number; type: string; building: boolean; pick: boolean }[] {
  const seen = new Set<string>(), out: { t: number; type: string; building: boolean; pick: boolean }[] = [];
  for (const u of m.units.filter((x) => x.owner === owner && x.kind !== "worker").sort((a, b) => a.born - b.born)) {
    if (seen.has(u.type) || /^(SupplyDepot|Pylon|Overlord|Extractor|Refinery|Assimilator|Creep)/.test(u.type)) continue;
    seen.add(u.type);
    out.push({ t: u.born, type: u.type, building: u.kind === "structure", pick: u.pick });
  }
  return out.slice(0, limit);
}

/** What is alive at time t, grouped by type: the roster panel. Picked units first, then by count. */
export function aliveByType(m: Model, owner: Owner, t: number): { type: string; count: number; pick: boolean; building: boolean }[] {
  const by = new Map<string, { type: string; count: number; pick: boolean; building: boolean }>();
  for (const u of m.units) {
    if (u.owner !== owner || u.kind === "worker" || !(u.born <= t && t < u.died)) continue;
    const e = by.get(u.type) ?? { type: u.type, count: 0, pick: u.pick, building: u.kind === "structure" };
    e.count++;
    by.set(u.type, e);
  }
  return [...by.values()].sort((a, b) => Number(a.building) - Number(b.building) || Number(b.pick) - Number(a.pick) || b.count - a.count);
}

export const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
