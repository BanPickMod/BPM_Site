/**
 * Recognising one game uploaded by both players (docs/BPM_Backend_Plan.md section 4.3).
 *
 * Two players' replays of the same game are different files (different hashes), so the file hash cannot tell. What both
 * share: the map, the two players' pseudonymous handle keys (the worker hashes the Battle.net handles; see lib/replay/handles.ts), when it started and how long it ran. Each client records its own
 * start time and its own last frame, so those two are compared with a tolerance rather than for equality.
 *
 * This is computed when a list or statistic is built, from the stored analysis: nothing is stored or backfilled, two replays
 * finishing analysis at the same moment cannot race into two groups, and the answer is never shown to anyone (an
 * uploader is not told that the opponent uploaded too). Analyses written before the worker recorded the start time have no
 * facts; they fall back to comparing the draft and result (see `legacyFingerprint`), as the statistics always did.
 */
export interface MatchFacts {
  /** Map and the sorted handle keys of every player. */
  key: string;
  startedMs: number;
  loops: number;
}

/** Start times of two clients for one game differ by seconds; a rematch cannot begin within this of the previous start and be as long. */
export const START_TOLERANCE_MS = 120_000;
/** The same game ends within a few seconds on both clients (22.4 game loops per second): 30 s of slack. */
export const LOOPS_TOLERANCE = Math.round(22.4 * 30);

/** Facts from the stored analysis JSON, or null when it cannot identify a game (AI game, unknown handle, old analysis that still carries a raw handle). */
export function matchFacts(raw: unknown): MatchFacts | null {
  const a = raw as Record<string, unknown> | null;
  if (!a || typeof a !== "object" || a.schema !== 1 || typeof a.map !== "string" || !Array.isArray(a.players) || a.players.length < 2) return null;
  const handles: string[] = [];
  for (const p of a.players as Record<string, unknown>[]) {
    if (p.isAi === true || typeof p.handleKey !== "string" || !p.handleKey) return null;
    handles.push(p.handleKey);
  }
  if (new Set(handles).size !== handles.length) return null;
  const startedMs = typeof a.startedAt === "string" ? Date.parse(a.startedAt) : NaN;
  const loops = typeof a.gameLoops === "number" ? a.gameLoops : NaN;
  if (!Number.isFinite(startedMs) || !Number.isFinite(loops) || loops <= 0) return null;
  return { key: `${a.map}|${handles.sort().join(",")}`, startedMs, loops };
}

export function sameGame(a: MatchFacts, b: MatchFacts): boolean {
  return a.key === b.key && Math.abs(a.startedMs - b.startedMs) <= START_TOLERANCE_MS && Math.abs(a.loops - b.loops) <= LOOPS_TOLERANCE;
}

interface Member { facts: MatchFacts | null; legacy: string }
interface Cluster { members: Member[] }

/**
 * Remembers the games seen so far. Two games are the same when both have facts and the facts agree, or when at least one
 * lacks facts and the legacy fingerprints are equal. Facts win whenever both sides have them: a different start time means
 * a different game even if the draft and result happen to match.
 */
export class GameClusters {
  private byKey = new Map<string, Cluster[]>();
  private byLegacy = new Map<string, Cluster[]>();

  private find(facts: MatchFacts | null, legacy: string): Cluster | null {
    const candidates = new Set<Cluster>([...(facts ? this.byKey.get(facts.key) ?? [] : []), ...(this.byLegacy.get(legacy) ?? [])]);
    for (const c of candidates) {
      for (const m of c.members) if (facts && m.facts ? sameGame(facts, m.facts) : m.legacy === legacy) return c;
    }
    return null;
  }

  /** True when this game, or its other uploader's copy, was already added. */
  has(facts: MatchFacts | null, legacy: string): boolean {
    return this.find(facts, legacy) !== null;
  }

  /** Remember a game. A copy of one already known joins its group. */
  add(facts: MatchFacts | null, legacy: string): void {
    const cluster = this.find(facts, legacy) ?? { members: [] };
    cluster.members.push({ facts, legacy });
    const push = (m: Map<string, Cluster[]>, k: string) => {
      const list = m.get(k) ?? [];
      if (!list.includes(cluster)) list.push(cluster);
      m.set(k, list);
    };
    push(this.byLegacy, legacy);
    if (facts) push(this.byKey, facts.key);
  }

  /** `has` then `add`: true for the first copy of a game, false for every later one. */
  claim(facts: MatchFacts | null, legacy: string): boolean {
    if (this.has(facts, legacy)) return false;
    this.add(facts, legacy);
    return true;
  }
}
