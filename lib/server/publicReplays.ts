import { deleteRowsAndFiles } from "./storageQueue";
import { REMOVE_REPLAY_SQL } from "@/lib/deleteSql";
import type { RateKey } from "@/lib/keys";
import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import { getDb } from "./db";
import { HttpError } from "./http";
import { getObject } from "./storage";
import { closeReplayFeedback, createFeedback } from "./feedback";
import { bumpStats } from "./statsVersion";
import { parseAnalysis, matchup, type Analysis } from "@/lib/replay/analysis";
import { parseEvaluation, type Evaluation } from "@/lib/replay/evaluation";
import { fingerprint, pairing } from "@/lib/replay/stats";
import { PUBLIC_WHERE } from "@/lib/publicWhere";
import { GameClusters, matchFacts } from "@/lib/replay/matchKey";

/**
 * C2 public viewing (docs/BPM_Backend_Plan.md section 2, Replay_Viewer_Plan.md section 11).
 *
 * A replay is public only while ALL of these hold, checked on every read (so withdrawing C2 or a takedown acts at once):
 *   status READY, C2 was on for this replay (c2_at_upload: set at upload, cleared for every replay when C2 is withdrawn, never re-granted in bulk) and the owner has not marked it private,
 *   not hidden by a report, and its timeline exists.
 * Public answers are built field by field from a whitelist. Nothing here ever returns the stored analysis JSON as is
 * (it carries Battle.net handles), the uploader, or the original file (there is no download route for player replays).
 */
export { PUBLIC_WHERE };

export interface PublicReplay {
  id: number;
  map: string;
  matchup: string | null;
  durationSec: number;
  uploadedDay: string;
  analysis: Analysis;
  /** The AI form curve, when an evaluation worker has produced it (only the detail page asks for it). */
  evaluation: Evaluation | null;
}

type Row = { id: number; uploaded_at: string; analysis: unknown; evaluation?: unknown };

function toPublic(r: Row): PublicReplay | null {
  const a = parseAnalysis(r.analysis);
  if (!a) return null;
  // Players keep only race, result, picks, bans and the AI flag (parseAnalysis drops handles); a day is coarse enough.
  return { id: r.id, map: a.map, matchup: matchup(a), durationSec: a.durationSec, uploadedDay: new Date(r.uploaded_at).toISOString().slice(0, 10), analysis: a, evaluation: parseEvaluation(r.evaluation) };
}

/** matchup is a pairing such as "TvZ"; "ZvT" is the same filter. */
export interface ListFilter { matchup?: string; map?: string }
export const PAGE_SIZE = 24;

export async function listPublic(filter: ListFilter, page: number): Promise<{ items: PublicReplay[]; more: boolean }> {
  const db = await getDb();
  // Filters run in JS on the parsed analysis: the stored JSON is written by the worker and may change shape.
  const want = filter.matchup ? filter.matchup.split("v").sort().join("v") : null;
  const rows = await db.query<Row>(`select id, uploaded_at, analysis from user_replay where ${PUBLIC_WHERE} order by uploaded_at desc, id desc limit 500`);
  // A game both players uploaded is listed once (the newest copy, which is first in this order). Only replays that are
  // public right now are compared, so one uploader withdrawing C2 leaves the other's copy in the list.
  const seen = new GameClusters();
  const all = rows.flatMap((r) => {
    const x = toPublic(r);
    if (!x) return [];
    const facts = matchFacts(r.analysis), fp = fingerprint(x.analysis);
    if (seen.has(facts, fp)) return [];
    seen.add(facts, fp);
    return [x];
  }).filter((x) => (!want || pairing(x.analysis) === want) && (!filter.map || x.map === filter.map));
  const start = Math.max(0, page) * PAGE_SIZE;
  return { items: all.slice(start, start + PAGE_SIZE), more: all.length > start + PAGE_SIZE };
}

export async function getPublic(id: number): Promise<PublicReplay | null> {
  const db = await getDb();
  const [row] = await db.query<Row>(`select id, uploaded_at, analysis, evaluation from user_replay where id = $1 and ${PUBLIC_WHERE}`, [id]);
  return row ? toPublic(row) : null;
}

/** The viewer's timeline with every player handle and handle key removed. Re-encoded, so a field added later cannot leak a handle either. */
export async function getPublicTimeline(id: number): Promise<Uint8Array | null> {
  const db = await getDb();
  const [row] = await db.query<{ timeline_key: string }>(`select timeline_key from user_replay where id = $1 and ${PUBLIC_WHERE}`, [id]);
  if (!row) return null;
  const obj = await getObject(row.timeline_key);
  if (!obj) return null;
  const raw = new Uint8Array(await new Response(obj.body).arrayBuffer());
  const tl = JSON.parse(gunzipSync(raw).toString("utf8")) as { players?: Record<string, unknown>[] };
  for (const p of tl.players ?? []) {            // neither the handle nor its pseudonym (which would link one player's games) goes out
    delete p.handle;
    p.handleKey = null;
  }
  return gzipSync(Buffer.from(JSON.stringify(tl)));
}

// ---------- reports and takedowns ----------

export const REPORT_REASONS = ["opponent", "privacy", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
const AUTO_HIDE: ReportReason[] = ["opponent", "privacy"];

/**
 * Anyone may report a public replay (the opponent in it never agreed to anything). Opponent and privacy reports take the
 * replay off the public pages straight away, pending an operator's decision: a wrongly hidden replay can be restored,
 * a wrongly shown one cannot be un-seen. The cost is that anyone can hide a replay for a while; the operator queue is the check.
 */
export async function reportReplay(id: number, reason: unknown, note: unknown, rate: RateKey): Promise<{ hidden: boolean }> {
  if (typeof reason !== "string" || !(REPORT_REASONS as readonly string[]).includes(reason)) throw new HttpError(400, `reason must be one of ${REPORT_REASONS.join(", ")}`);
  const db = await getDb();
  const [r] = await db.query<{ id: number }>(`select id from user_replay where id = $1 and ${PUBLIC_WHERE}`, [id]);
  if (!r) throw new HttpError(404, "no such public replay");
  const hidden = AUTO_HIDE.includes(reason as ReportReason);
  // For a reason that hides the replay, the report and the hiding are one statement (lib/reportSql.ts): never one without the other.
  await createFeedback({ kind: "replay", replayId: id, reason, body: note, page: `/replay-analysis/shared/${id}`, rate, hideReplay: hidden });
  if (hidden) bumpStats();
  return { hidden };
}

/** Operator decision on every open report of one replay: keep it hidden-and-deleted, or restore it to the public pages. */
export async function resolveReports(replayId: number, action: unknown): Promise<{ action: string }> {
  if (action !== "restore" && action !== "remove") throw new HttpError(400, "action must be restore or remove");
  const db = await getDb();
  const [row] = await db.query<{ storage_key: string; timeline_key: string | null }>("select storage_key, timeline_key from user_replay where id = $1", [replayId]);
  if (!row) throw new HttpError(404, "no such replay");
  if (action === "restore") {
    await db.query("update user_replay set hidden_at = null, hidden_reason = null where id = $1", [replayId]);
    await closeReplayFeedback(replayId, "DISMISSED", "restored to the public pages");
    bumpStats();
    return { action };
  }
  await closeReplayFeedback(replayId, "RESOLVED", "replay removed");
  // remove: the row and the names of its files in one statement, then the files (the reports stay in the inbox, with no replay
  // attached). The uploader's own copy is gone too, which is what a takedown means.
  await deleteRowsAndFiles(REMOVE_REPLAY_SQL, [replayId]);
  bumpStats();
  return { action };
}
