import { deleteSourceById } from "./sources";
import { enqueueDelete, processStorageDeletes } from "./storageQueue";
import { scrubAnalysis, scrubTimelineGzip } from "@/lib/replay/handles";
import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getDb } from "./db";
import { HttpError } from "./http";
import { putObject } from "./storage";
import { bumpStats } from "./statsVersion";

/**
 * Replay analysis queue. The analysis worker (worker/run_worker.py) pulls jobs over HTTP, so the server never
 * connects to the machine that parses replays (which may be a GPU box at home).
 *
 * QUEUED -> ANALYZING (claimed) -> READY | REJECTED | back to QUEUED (retry) -> FAILED (gave up)
 */
export const MAX_ATTEMPTS = 3;
export const LEASE_MINUTES = 10;
export const MAX_ANALYSIS_BYTES = 64 * 1024;
export const MAX_TIMELINE_BYTES = 2 * 1024 * 1024;

/** Reject codes a worker may report for a replay that will never be analyzable. */
const REJECT_CODES = new Set(["NOT_BPM", "CORRUPT", "UNSUPPORTED"]);

export function requireWorker(req: Request): void {
  const expected = process.env.WORKER_TOKEN;
  if (!expected || expected.length < 32) throw new HttpError(503, "WORKER_TOKEN is not configured");
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) throw new HttpError(401, "unauthorized");
}

export interface ClaimedJob {
  id: number;
  size: number;
  attempt: number;
}

/** Hand the oldest runnable job to a worker. A job whose lease expired (worker died) is handed out again, up to MAX_ATTEMPTS. */
export async function claimJob(): Promise<ClaimedJob | null> {
  const db = await getDb();
  await db.query(
    `update user_replay set status = 'FAILED', last_error = 'worker lease expired too many times'
     where status = 'ANALYZING' and claimed_at < now() - ($1 || ' minutes')::interval and attempts >= $2`,
    [String(LEASE_MINUTES), MAX_ATTEMPTS],
  );
  const [job] = await db.query<{ id: number; size: number; attempts: number }>(
    `update user_replay set status = 'ANALYZING', claimed_at = now(), attempts = attempts + 1
     where id = (
       select id from user_replay
       where (status = 'QUEUED' and available_at <= now())
          or (status = 'ANALYZING' and claimed_at < now() - ($1 || ' minutes')::interval)
       order by uploaded_at, id limit 1 for update skip locked)
     returning id, size, attempts`,
    [String(LEASE_MINUTES)],
  );
  return job ? { id: job.id, size: job.size, attempt: job.attempts } : null;
}

/** Storage key of a replay that is currently leased to a worker (workers cannot read anything else). */
export async function leasedReplayKey(id: number): Promise<string> {
  const db = await getDb();
  // The analysis worker leases a replay while it is ANALYZING; the evaluation worker while it is READY and eval-leased.
  const [r] = await db.query<{ storage_key: string }>(
    "select storage_key from user_replay where id = $1 and source_deleted_at is null and (status = 'ANALYZING' or (status = 'READY' and eval_status = 'LEASED'))", [id]);
  if (!r) throw new HttpError(404, "no such job in analysis", "NOT_LEASED");
  return r.storage_key;
}

/**
 * Store a gzip timeline only for the worker that currently owns the lease. A worker that says which attempt it holds
 * (`attempt`) is refused when a newer attempt has started: its timeline must not replace the newer attempt's.
 */
export async function storeTimeline(id: number, data: Uint8Array, attempt?: number): Promise<{ size: number; schema: number }> {
  if (data.byteLength < 10 || data.byteLength > MAX_TIMELINE_BYTES) throw new HttpError(413, "bad timeline size", "TIMELINE_SIZE");
  if (data[0] !== 0x1f || data[1] !== 0x8b) throw new HttpError(422, "timeline must be gzip", "TIMELINE_FORMAT");
  const db = await getDb();
  const [row] = await db.query<{ user_id: number; attempts: number }>(
    "select user_id, attempts from user_replay where id = $1 and status = 'ANALYZING'", [id],
  );
  if (!row || (attempt !== undefined && attempt !== row.attempts)) throw new HttpError(409, "job is not in analysis (lease expired or already finished)", "NOT_LEASED");
  try {
    data = scrubTimelineGzip(data);                    // a raw Battle.net handle is never stored, whatever the worker sent
  } catch {
    throw new HttpError(422, "timeline is not readable gzip JSON", "TIMELINE_FORMAT");
  }
  const key = `analysis/${row.user_id}/${id}.timeline.json.gz`;
  await putObject(key, data);
  const updated = await db.query(
    `update user_replay set timeline_key = $2, timeline_size = $3, timeline_schema = 1, timeline_attempt = $4
     where id = $1 and status = 'ANALYZING' and attempts = $4 returning id`,
    [id, key, data.byteLength, row.attempts],
  );
  if (!updated.length) {
    await enqueueDelete([key]);                        // skipped if a newer attempt's row already points to this name
    throw new HttpError(409, "lease expired while storing timeline", "NOT_LEASED");
  }
  return { size: data.byteLength, schema: 1 };
}

export type JobResult =
  | { status: "READY"; analyzerVersion: string; analysis: Record<string, unknown>; attempt?: number }
  | { status: "REJECTED"; rejectCode: string; analyzerVersion?: string; attempt?: number }
  | { status: "FAILED"; error: string; analyzerVersion?: string; attempt?: number };

export function parseJobResult(body: unknown): JobResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const ver = typeof b.analyzerVersion === "string" ? b.analyzerVersion.slice(0, 40) : undefined;
  const attempt = Number.isInteger(b.attempt) ? (b.attempt as number) : undefined;
  if (b.status === "READY") {
    if (!ver) throw new HttpError(400, "analyzerVersion required");
    if (typeof b.analysis !== "object" || b.analysis === null || Array.isArray(b.analysis)) throw new HttpError(400, "analysis object required");
    if (JSON.stringify(b.analysis).length > MAX_ANALYSIS_BYTES) throw new HttpError(413, "analysis too large");
    return { status: "READY", analyzerVersion: ver, analysis: scrubAnalysis(b.analysis as Record<string, unknown>), attempt };
  }
  if (b.status === "REJECTED") {
    if (typeof b.rejectCode !== "string" || !REJECT_CODES.has(b.rejectCode)) throw new HttpError(400, `rejectCode must be one of ${[...REJECT_CODES].join(", ")}`);
    return { status: "REJECTED", rejectCode: b.rejectCode, analyzerVersion: ver, attempt };
  }
  if (b.status === "FAILED") {
    return { status: "FAILED", error: typeof b.error === "string" ? b.error.slice(0, 500) : "unknown", analyzerVersion: ver, attempt };
  }
  throw new HttpError(400, "status must be READY, REJECTED or FAILED");
}

/**
 * Record a worker's verdict. Only a job that is still leased (ANALYZING) accepts a result, so a worker that was too slow
 * and lost its lease cannot overwrite a newer attempt.
 */
export async function submitResult(id: number, r: JobResult): Promise<{ status: string }> {
  const db = await getDb();
  const [row] = await db.query<{ storage_key: string; timeline_key: string | null; timeline_attempt: number | null; attempts: number }>(
    "select storage_key, timeline_key, timeline_attempt, attempts from user_replay where id = $1 and status = 'ANALYZING'",
    [id],
  );
  if (!row || (r.attempt !== undefined && r.attempt !== row.attempts)) throw new HttpError(409, "job is not in analysis (lease expired or already finished)", "NOT_LEASED");
  const lost = () => new HttpError(409, "job changed while the result was being recorded (a newer attempt owns it)", "NOT_LEASED");
  // Every write below also checks status and attempt, so a slow worker whose lease went to another cannot overwrite the newer result
  // in the gap between the read above and the write.
  const guard = "id = $1 and status = 'ANALYZING' and attempts = $2";

  if (r.status === "READY") {
    if (!row.timeline_key || row.timeline_attempt !== row.attempts) {
      throw new HttpError(409, "timeline from this attempt is required before READY", "TIMELINE_REQUIRED");
    }
    const done = await db.query(
      `update user_replay set status = 'READY', analysis = $3::jsonb, analyzer_version = $4, analyzed_at = now(), claimed_at = null, last_error = null,
       eval_status = 'PENDING', eval_attempts = 0, eval_available_at = now(), eval_claimed_at = null, evaluation = null, eval_version = null, eval_error = null
       where ${guard} returning id`,
      [id, row.attempts, JSON.stringify(r.analysis), r.analyzerVersion],
    );
    if (!done.length) throw lost();
    bumpStats();
    return { status: "READY" };
  }

  // The name of the timeline file goes into the delete queue in the same statement that forgets it, so it cannot be lost.
  const dropTimeline = `with old as (select timeline_key from user_replay where ${guard}),
       q as (insert into storage_delete_queue (storage_key) select timeline_key from old where timeline_key is not null on conflict do nothing)`;

  if (r.status === "REJECTED") {
    // A replay that is not a BPM game, or is corrupt, is not kept: drop the file, keep the row so the hash stays known.
    // UNSUPPORTED (a game build the decoder cannot read yet) keeps its file so it can be re-analyzed after a decoder update.
    const done = await db.query(
      `${dropTimeline}
       update user_replay set status = 'REJECTED', reject_code = $3, analyzer_version = $4, analyzed_at = now(), claimed_at = null,
       timeline_key = null, timeline_size = null, timeline_schema = null, timeline_attempt = null where ${guard} returning id`,
      [id, row.attempts, r.rejectCode, r.analyzerVersion ?? null],
    );
    if (!done.length) throw lost();
    if (r.rejectCode !== "UNSUPPORTED") await deleteSourceById(id);      // not kept: the retention run retries a failed delete
    await processStorageDeletes().catch(() => undefined);
    return { status: "REJECTED" };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    const done = await db.query(
      `${dropTimeline}
       update user_replay set status = 'FAILED', last_error = $3, claimed_at = null,
       timeline_key = null, timeline_size = null, timeline_schema = null, timeline_attempt = null where ${guard} returning id`,
      [id, row.attempts, r.error],
    );
    if (!done.length) throw lost();
    await processStorageDeletes().catch(() => undefined);
    return { status: "FAILED" };
  }
  const backoffMin = 2 ** row.attempts; // 2, 4 minutes
  const done = await db.query(
    `update user_replay set status = 'QUEUED', last_error = $3, claimed_at = null, available_at = now() + ($4 || ' minutes')::interval where ${guard} returning id`,
    [id, row.attempts, r.error, String(backoffMin)],
  );
  if (!done.length) throw lost();
  return { status: "QUEUED" };
}
