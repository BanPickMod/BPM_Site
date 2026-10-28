import "server-only";
import { getDb } from "./db";

/** Everything here only returns games whose publish_at has passed; unpublished games do not exist publicly. */
export interface EventRow {
  id: number;
  slug: string;
  kind: string;
  name_ko: string;
  name_en: string;
  starts_at: string | null;
  ends_at: string | null;
}

export interface PlayerRow {
  slot: number;
  name: string;
  race: string;
  persona: string | null;
  model_version: string | null;
  result: string;
}

export interface GameRow {
  id: number;
  matchup: string;
  round: number;
  series_key: string;
  game_no: number;
  map: string;
  ban_mode: string;
  ban_count: number;
  mod_version: string | null;
  balance_version: string | null;
  played_at: string | null;
  duration_sec: number | null;
  winner_slot: number | null;
  publish_at: string;
  summary: Record<string, unknown>;
  players: PlayerRow[];
}

export async function getEvent(slug: string): Promise<EventRow | null> {
  const db = await getDb();
  const [row] = await db.query<EventRow>("select * from event where slug = $1", [slug]);
  return row ?? null;
}

const GAME_SELECT = `
  select g.id, g.matchup, g.round, g.series_key, g.game_no, g.map, g.ban_mode, g.ban_count, g.mod_version,
         g.balance_version, g.played_at, g.duration_sec, g.winner_slot, g.publish_at, g.summary,
         coalesce((select json_agg(json_build_object('slot', p.slot, 'name', p.name, 'race', p.race,
                   'persona', p.persona, 'model_version', p.model_version, 'result', p.result) order by p.slot)
                   from game_player p where p.game_id = g.id), '[]'::json) as players
  from game g`;

export async function listGames(eventId: number, opts: { matchup?: string } = {}): Promise<GameRow[]> {
  const db = await getDb();
  const params: unknown[] = [eventId];
  let where = "where g.event_id = $1 and g.publish_at <= now()";
  if (opts.matchup) {
    params.push(opts.matchup);
    where += ` and g.matchup = $${params.length}`;
  }
  return db.query<GameRow>(`${GAME_SELECT} ${where} order by g.round, g.series_key, g.game_no`, params);
}

export interface DraftRow {
  seq: number;
  slot: number;
  action: string;
  unit_id: string;
  replaces_unit_id: string | null;
}

export async function getGame(id: number): Promise<(GameRow & { event_slug: string; draft: DraftRow[] }) | null> {
  const db = await getDb();
  const [row] = await db.query<GameRow & { event_slug: string }>(
    `select e.slug as event_slug, x.* from (${GAME_SELECT} where g.id = $1 and g.publish_at <= now()) x
     join game g2 on g2.id = x.id join event e on e.id = g2.event_id`,
    [id],
  );
  if (!row) return null;
  const draft = await db.query<DraftRow>(
    "select seq, slot, action, unit_id, replaces_unit_id from draft_event where game_id = $1 order by seq",
    [id],
  );
  return { ...row, draft };
}

export async function getReplayKey(gameId: number): Promise<{ key: string; size: number; game: GameRow & { event_slug: string } } | null> {
  const db = await getDb();
  const [r] = await db.query<{ storage_key: string; size: number }>(
    `select r.storage_key, r.size from replay r join game g on g.id = r.game_id
     where r.game_id = $1 and g.publish_at <= now() and g.source = 'AI_EVENT'`,
    [gameId],
  );
  if (!r) return null;
  const game = await getGame(gameId);
  return game ? { key: r.storage_key, size: r.size, game } : null;
}

export interface Standing {
  name: string;
  persona: string | null;
  seriesWon: number;
  seriesLost: number;
  gamesWon: number;
  gamesLost: number;
}

/**
 * League table per matchup from published games. A Bo3 series is decided once someone has two wins;
 * unfinished series count only toward game totals.
 */
export function computeStandings(games: GameRow[]): Record<string, Standing[]> {
  const table = new Map<string, Map<string, Standing>>();
  const seriesWins = new Map<string, Map<string, number>>();
  const seriesPlayers = new Map<string, string[]>();

  for (const g of games) {
    const league = table.get(g.matchup) ?? new Map<string, Standing>();
    table.set(g.matchup, league);
    const sw = seriesWins.get(`${g.matchup}|${g.series_key}`) ?? new Map<string, number>();
    seriesWins.set(`${g.matchup}|${g.series_key}`, sw);
    seriesPlayers.set(
      `${g.matchup}|${g.series_key}`,
      g.players.map((p) => p.name),
    );
    for (const p of g.players) {
      const s = league.get(p.name) ?? { name: p.name, persona: p.persona, seriesWon: 0, seriesLost: 0, gamesWon: 0, gamesLost: 0 };
      league.set(p.name, s);
      if (p.result === "win") {
        s.gamesWon += 1;
        sw.set(p.name, (sw.get(p.name) ?? 0) + 1);
      } else s.gamesLost += 1;
    }
  }

  for (const [k, wins] of seriesWins) {
    const [matchup] = k.split("|");
    const league = table.get(matchup)!;
    const names = seriesPlayers.get(k)!;
    const winner = [...wins.entries()].find(([, w]) => w >= 2)?.[0];
    if (!winner) continue;
    for (const n of names) {
      const s = league.get(n)!;
      if (n === winner) s.seriesWon += 1;
      else s.seriesLost += 1;
    }
  }

  const out: Record<string, Standing[]> = {};
  for (const [matchup, league] of table) {
    out[matchup] = [...league.values()].sort(
      (a, b) =>
        b.seriesWon - a.seriesWon ||
        b.gamesWon - b.gamesLost - (a.gamesWon - a.gamesLost) ||
        a.name.localeCompare(b.name),
    );
  }
  return out;
}
