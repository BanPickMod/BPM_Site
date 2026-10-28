import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "./db";
import { putObject, deleteObject } from "./storage";
import { matchupOf, type Manifest } from "./manifest";
import { HttpError } from "./http";

export const MAX_REPLAY_BYTES = 10 * 1024 * 1024;

export { HttpError };

/** SC2 replays are MPQ archives: the file starts with "MPQ" followed by 0x1A or 0x1B (user-data header). */
export function looksLikeReplay(data: Uint8Array): boolean {
  return data.length > 64 && data[0] === 0x4d && data[1] === 0x50 && data[2] === 0x51 && (data[3] === 0x1a || data[3] === 0x1b);
}

export type IngestResult = { id: number; created: boolean };

/**
 * Insert or update one event game. Idempotent on (event, seriesKey, gameNo): re-uploading corrects
 * the metadata and swaps the replay file. A replay hash that already belongs to another game is rejected.
 */
export async function ingestGame(manifest: Manifest, data: Uint8Array): Promise<IngestResult> {
  const db = await getDb();
  const [event] = await db.query<{ id: number }>("select id from event where slug = $1", [manifest.event]);
  if (!event) throw new HttpError(404, `unknown event: ${manifest.event}`);

  const sha = createHash("sha256").update(data).digest("hex");
  const key = `events/${manifest.event}/${sha}.SC2Replay`;

  const [dup] = await db.query<{ game_id: number; series_key: string; game_no: number }>(
    "select r.game_id, g.series_key, g.game_no from replay r join game g on g.id = r.game_id where r.sha256 = $1",
    [sha],
  );
  const [existing] = await db.query<{ id: number }>(
    "select id from game where event_id = $1 and series_key = $2 and game_no = $3",
    [event.id, manifest.seriesKey, manifest.gameNo],
  );
  if (dup && dup.game_id !== existing?.id) {
    throw new HttpError(409, `replay already uploaded as ${dup.series_key} game ${dup.game_no}`);
  }

  await putObject(key, data);

  const winner = manifest.players.find((p) => p.result === "win")!.slot;
  const [row] = await db.query<{ id: number; inserted: boolean }>(
    `insert into game (event_id, matchup, round, series_key, game_no, map, ban_mode, ban_count, mod_version,
       balance_version, played_at, duration_sec, winner_slot, publish_at, summary)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
     on conflict (event_id, series_key, game_no) do update set
       matchup=excluded.matchup, round=excluded.round, map=excluded.map, ban_mode=excluded.ban_mode,
       ban_count=excluded.ban_count, mod_version=excluded.mod_version, balance_version=excluded.balance_version,
       played_at=excluded.played_at, duration_sec=excluded.duration_sec, winner_slot=excluded.winner_slot,
       publish_at=excluded.publish_at, summary=excluded.summary
     returning id, (xmax = 0) as inserted`,
    [
      event.id,
      matchupOf(manifest),
      manifest.round,
      manifest.seriesKey,
      manifest.gameNo,
      manifest.map,
      manifest.banMode,
      manifest.banCount,
      manifest.modVersion ?? null,
      manifest.balanceVersion ?? null,
      manifest.playedAt ?? null,
      manifest.durationSec ?? null,
      winner,
      manifest.publishAt ?? new Date().toISOString(),
      JSON.stringify(manifest.summary ?? {}),
    ],
  );

  const old = await db.query<{ storage_key: string }>("select storage_key from replay where game_id = $1", [row.id]);
  await db.query("delete from replay where game_id = $1", [row.id]);
  await db.query("insert into replay (game_id, sha256, storage_key, size) values ($1,$2,$3,$4)", [row.id, sha, key, data.length]);
  for (const o of old) if (o.storage_key !== key) await deleteObject(o.storage_key).catch(() => {});

  await db.query("delete from game_player where game_id = $1", [row.id]);
  for (const p of manifest.players) {
    await db.query(
      "insert into game_player (game_id, slot, name, race, persona, model_version, result) values ($1,$2,$3,$4,$5,$6,$7)",
      [row.id, p.slot, p.name, p.race, p.persona ?? null, p.modelVersion ?? null, p.result],
    );
  }
  await db.query("delete from draft_event where game_id = $1", [row.id]);
  for (const d of manifest.draft) {
    await db.query(
      "insert into draft_event (game_id, seq, slot, action, unit_id, replaces_unit_id) values ($1,$2,$3,$4,$5,$6)",
      [row.id, d.seq, d.slot, d.action, d.unitId, d.replacesUnitId ?? null],
    );
  }
  return { id: row.id, created: row.inserted };
}

export async function deleteGame(id: number): Promise<boolean> {
  const db = await getDb();
  const keys = await db.query<{ storage_key: string }>("select storage_key from replay where game_id = $1", [id]);
  const gone = await db.query("delete from game where id = $1 returning id", [id]);
  for (const k of keys) await deleteObject(k.storage_key).catch(() => {});
  return gone.length > 0;
}
