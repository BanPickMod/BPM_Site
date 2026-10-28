import type { Analysis, RaceId } from "./analysis";
import { GameClusters, type MatchFacts } from "./matchKey.ts";

/**
 * Community pick / ban / win statistics from C2 replays (docs/BPM_Backend_Plan.md section 7). Pure functions: the caller
 * hands in only consented, visible replays; this file decides what is safe to show.
 *
 * Rules (section 7.2): one game counts once even if both players uploaded it; one user cannot fill the table; a cell with
 * too few games or too few different uploaders shows no numbers; AI games are not mixed with human games.
 */
/** `match` is from matchFacts(stored analysis); without it (an old analysis) the game is recognised by its draft and result. */
export interface StatsGame { id: number; userId: number; analysis: Analysis; match?: MatchFacts | null }
export interface StatsOptions { minGames: number; minUsers: number; perUserCap: number; matchup?: string }

export interface UnitStat {
  unit: string;
  race: RaceId | null;
  /** Player slots of this unit's race that were counted (the denominator of both rates). */
  slots: number;
  users: number;
  /** False when the cell is below the sample rules: no numbers are given then. */
  shown: boolean;
  picked: number;
  banned: number;
  decided: number;
  wins: number;
  pickRate: number | null;
  banRate: number | null;
  winRate: number | null;
  /** 95% Wilson interval of the win rate. */
  winLow: number | null;
  winHigh: number | null;
}

export interface StatsResult { games: number; users: number; units: UnitStat[] }

const LETTER: Record<RaceId, string> = { terran: "T", protoss: "P", zerg: "Z" };
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Fallback for analyses without match facts: same map, length, races, results and drafts. */
export function fingerprint(a: Analysis): string {
  return JSON.stringify([a.map, a.durationSec, a.players.map((p) => [p.race, p.result, p.picks.map((x) => norm(x.unit)).sort(), p.bans.map(norm).sort()])]);
}

/** "TvZ" and "ZvT" are the same pairing here (the picker's side is what the unit rows describe). */
export function pairing(a: Analysis): string | null {
  const r = a.players.map((p) => p.race);
  return r.length === 2 && r[0] && r[1] ? [LETTER[r[0]], LETTER[r[1]]].sort().join("v") : null;
}

export function wilson(wins: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96, p = wins / n, d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

export function aggregate(input: StatsGame[], unitRace: (id: string) => RaceId | null, o: StatsOptions): StatsResult {
  const want = o.matchup ? o.matchup.split("v").sort().join("v") : null;
  const seen = new GameClusters(), perUser = new Map<number, number>(), games: StatsGame[] = [];
  for (const g of [...input].sort((a, b) => b.id - a.id)) {          // newest first, so the cap keeps the recent games
    const a = g.analysis;
    if (a.players.length !== 2 || a.players.some((p) => p.isAi || !p.race)) continue;
    if (want && pairing(a) !== want) continue;
    const fp = fingerprint(a);
    if (seen.has(g.match ?? null, fp)) continue;
    if ((perUser.get(g.userId) ?? 0) >= o.perUserCap) continue;
    seen.add(g.match ?? null, fp); perUser.set(g.userId, (perUser.get(g.userId) ?? 0) + 1); games.push(g);
  }

  const slotsByRace = new Map<RaceId, { n: number; users: Set<number> }>();
  type Acc = { unit: string; race: RaceId | null; picked: number; banned: number; decided: number; wins: number; users: Set<number> };
  const acc = new Map<string, Acc>();
  const touch = (unit: string, slotRace: RaceId, uid: number): Acc => {
    const k = norm(unit);
    let a = acc.get(k);
    if (!a) { a = { unit, race: unitRace(unit) ?? slotRace, picked: 0, banned: 0, decided: 0, wins: 0, users: new Set() }; acc.set(k, a); }
    a.users.add(uid);
    return a;
  };
  for (const g of games) for (const p of g.analysis.players) {
    const r = p.race!;
    const s = slotsByRace.get(r) ?? { n: 0, users: new Set<number>() };
    s.n++; s.users.add(g.userId); slotsByRace.set(r, s);
    for (const pk of p.picks) {
      const a = touch(pk.unit, r, g.userId);
      a.picked++;
      if (p.result) { a.decided++; if (p.result === "win") a.wins++; }
    }
    for (const b of p.bans) touch(b, r, g.userId).banned++;
  }

  const units: UnitStat[] = [...acc.values()].map((a) => {
    const slots = a.race ? slotsByRace.get(a.race) : undefined;
    const n = slots?.n ?? 0, users = slots?.users.size ?? 0;
    const shown = n >= o.minGames && users >= o.minUsers;
    const [lo, hi] = a.decided ? wilson(a.wins, a.decided) : [null, null];
    return {
      unit: a.unit, race: a.race, slots: n, users, shown, picked: shown ? a.picked : 0, banned: shown ? a.banned : 0, decided: shown ? a.decided : 0, wins: shown ? a.wins : 0,
      pickRate: shown && n ? a.picked / n : null, banRate: shown && n ? a.banned / n : null,
      winRate: shown && a.decided ? a.wins / a.decided : null, winLow: shown ? lo : null, winHigh: shown ? hi : null,
    };
  }).sort((x, y) => Number(y.shown) - Number(x.shown) || (y.pickRate ?? 0) - (x.pickRate ?? 0) || x.unit.localeCompare(y.unit));

  return { games: games.length, users: new Set(games.map((g) => g.userId)).size, units };
}
