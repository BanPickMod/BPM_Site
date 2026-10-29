import { posAt, type Model, type Owner, type Unit } from "./timeline.ts";

/** What one unit type cost. Injected, so this file stays free of the wiki data and can be tested alone. */
export interface Cost { minerals: number; gas: number; supply: number }
export type CostOf = (type: string) => Cost | null;

/** The mod's armoured variants (MarauderHeavyArmor, FirebatHeavyArmor) are the same unit to a reader: counted and shown as the base unit. */
export const canonType = (type: string) => type.replace(/^BPM_/, "").replace(/HeavyArmor$/, "");

/** Resource value of a unit: minerals plus gas, the same measure the game's own army value uses. */
export const worth = (c: Cost | null) => (c ? c.minerals + c.gas : 0);

export interface CompEntry {
  type: string;
  count: number;
  /** Minerals + gas of all of them. */
  value: number;
  /** One of the player's drafted picks. */
  pick: boolean;
}

export interface Squad {
  owner: Owner;
  x: number;
  y: number;
  units: number;
  value: number;
  /** Largest value first. The badge shows the first two. */
  comp: CompEntry[];
}

/** Support and scouting units that would otherwise name every squad "Overlord". */
const NOT_A_SQUAD_MEMBER = /^(Overlord|Overseer|Observer|Changeling.*)$/;
const GROUP_RADIUS = 9;       // cells: units closer than this chain into one squad
const MAX_SAMPLE_GAP = 20;    // seconds: a position older than this is a guess, and a squad is never drawn from guesses
const MIN_VALUE = 100;        // a lone marine is not a squad; a lone liberator (a harass) is

/** Seconds between `t` and the nearest recorded position of the unit (Infinity when it has none). */
export function sampleGap(u: Unit, t: number): number {
  const { ts } = u, n = ts.length;
  if (!n) return Infinity;
  if (t <= ts[0]) return ts[0] - t;
  if (t >= ts[n - 1]) return t - ts[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; }
  return Math.min(t - ts[lo], ts[hi] - t);
}

export function composition(types: { type: string; pick: boolean }[], costOf: CostOf): CompEntry[] {
  const by = new Map<string, CompEntry>();
  for (const raw of types) {
    const type = canonType(raw.type), u = { type, pick: raw.pick };
    const e = by.get(type) ?? { type, count: 0, value: 0, pick: u.pick };
    e.count++; e.value += worth(costOf(type)); e.pick ||= u.pick;
    by.set(type, e);
  }
  return [...by.values()].sort((a, b) => b.value - a.value || b.count - a.count || a.type.localeCompare(b.type));
}

/**
 * The army groups of one player at time `t`: units with a recent recorded position, chained together when closer than a few cells.
 * Only units we actually saw recently take part, so a squad is never a guess. Positions exist for only part of the army (the
 * viewer states the share), so a squad's size is what was observed, not necessarily everything that was there.
 */
export function squadsAt(model: Model, owner: Owner, t: number, costOf: CostOf): Squad[] {
  const pts: { u: Unit; x: number; y: number }[] = [];
  for (const u of model.units) {
    if (u.owner !== owner || u.kind !== "army" || u.mode !== "tracked" || NOT_A_SQUAD_MEMBER.test(u.type)) continue;
    const p = posAt(u, t, model.windowSec);
    if (p && sampleGap(u, t) <= MAX_SAMPLE_GAP) pts.push({ u, x: p.x, y: p.y });
  }
  const parent = pts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) <= GROUP_RADIUS) parent[find(i)] = find(j);
  }
  const groups = new Map<number, typeof pts>();
  pts.forEach((p, i) => { const r = find(i); (groups.get(r) ?? groups.set(r, []).get(r)!).push(p); });
  const out: Squad[] = [];
  for (const g of groups.values()) {
    const comp = composition(g.map((m) => ({ type: m.u.type, pick: m.u.pick })), costOf);
    const value = comp.reduce((s, c) => s + c.value, 0);
    if (value < MIN_VALUE && g.length < 3) continue;
    out.push({
      owner, units: g.length, value, comp,
      x: g.reduce((s, m) => s + m.x, 0) / g.length, y: g.reduce((s, m) => s + m.y, 0) / g.length,
    });
  }
  return out.sort((a, b) => b.value - a.value);
}
