import "server-only";
import { getDb } from "./db";
import { PUBLIC_WHERE } from "./publicReplays";
import { parseAnalysis } from "@/lib/replay/analysis";
import { matchFacts } from "@/lib/replay/matchKey";
import { aggregate, type StatsOptions, type StatsResult } from "@/lib/replay/stats";
import { unitInfo } from "@/lib/replay/units";
import { statsVersion } from "./statsVersion";

/** Thresholds follow the plan (section 7.2); the environment can lower them on a test server, never raise them silently. */
export const statsRules = (): Omit<StatsOptions, "matchup"> => ({
  minGames: Number(process.env.STATS_MIN_GAMES) || 30,
  minUsers: Number(process.env.STATS_MIN_USERS) || 10,
  perUserCap: Number(process.env.STATS_USER_CAP) || 50,
});

export const WINDOW_DAYS = [30, 90, 365] as const;

/** Statistics over replays whose uploader has C2 on right now and that no report has hidden. */
export async function communityStats(days: number, matchup?: string): Promise<StatsResult> {
  const key = `${days}|${matchup ?? ""}|${JSON.stringify(statsRules())}`, v = statsVersion(), hit = cache.get(key);
  if (hit && hit.v === v && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await compute(days, matchup);
  cache.set(key, { v, at: Date.now(), value });
  return value;
}

const CACHE_MS = 60_000;
const g = globalThis as typeof globalThis & { __bpmStatsCache?: Map<string, { v: number; at: number; value: StatsResult }> };
const cache = (g.__bpmStatsCache ??= new Map());

async function compute(days: number, matchup?: string): Promise<StatsResult> {
  const db = await getDb();
  const rows = await db.query<{ id: number; user_id: number; analysis: unknown }>(
    `select id, user_id, analysis from user_replay where ${PUBLIC_WHERE} and uploaded_at > now() - ($1 || ' days')::interval`, [String(days)],
  );
  const games = rows.flatMap((r) => { const a = parseAnalysis(r.analysis); return a ? [{ id: r.id, userId: r.user_id, analysis: a, match: matchFacts(r.analysis) }] : []; });
  return aggregate(games, (u) => unitInfo(u, "en").race, { ...statsRules(), matchup });
}
