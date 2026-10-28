import { deleteSourceById } from "./sources";
import "server-only";
import { getDb } from "./db";
import { HttpError } from "./http";
import { bumpStats } from "./statsVersion";
import { LEASE_MINUTES, MAX_ATTEMPTS, type ClaimedJob } from "./analysisJobs";
import { parseEvaluation } from "@/lib/replay/evaluation";

/**
 * AI evaluation queue, next to the analysis queue (lib/server/analysisJobs.ts) and built the same way: a worker pulls over HTTP,
 * so it can run anywhere (this PC today, a Railway service later) and the site never connects to it.
 *
 * A replay becomes PENDING when its analysis is READY. An evaluation worker leases it (LEASED, 10 minutes), downloads the replay
 * through the same lease-guarded route, and reports DONE (with the curve), SKIPPED (cannot be evaluated by design) or FAILED.
 * A lost lease is handed out again, a failing job is retried with a backoff and given up after MAX_ATTEMPTS.
 */
export const MAX_EVALUATION_BYTES = 32 * 1024;

export async function claimEvalJob(): Promise<ClaimedJob | null> {
  const db = await getDb();
  await db.query(
    `update user_replay set eval_status = 'FAILED', eval_error = 'worker lease expired too many times'
     where eval_status = 'LEASED' and eval_claimed_at < now() - ($1 || ' minutes')::interval and eval_attempts >= $2`,
    [String(LEASE_MINUTES), MAX_ATTEMPTS],
  );
  const [job] = await db.query<{ id: number; size: number; eval_attempts: number }>(
    `update user_replay set eval_status = 'LEASED', eval_claimed_at = now(), eval_attempts = eval_attempts + 1
     where id = (
       select id from user_replay
       where status = 'READY' and ((eval_status = 'PENDING' and eval_available_at <= now())
          or (eval_status = 'LEASED' and eval_claimed_at < now() - ($1 || ' minutes')::interval))
       order by uploaded_at, id limit 1 for update skip locked)
     returning id, size, eval_attempts`,
    [String(LEASE_MINUTES)],
  );
  return job ? { id: job.id, size: job.size, attempt: job.eval_attempts } : null;
}

export type EvalResult =
  | { status: "DONE"; evalVersion: string; evaluation: Record<string, unknown> }
  | { status: "SKIPPED"; reason: string }
  | { status: "FAILED"; error: string };

export function parseEvalResult(body: unknown): EvalResult {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.status === "DONE") {
    if (typeof b.evalVersion !== "string" || !b.evalVersion) throw new HttpError(400, "evalVersion required");
    if (typeof b.evaluation !== "object" || b.evaluation === null || Array.isArray(b.evaluation)) throw new HttpError(400, "evaluation object required");
    if (JSON.stringify(b.evaluation).length > MAX_EVALUATION_BYTES) throw new HttpError(413, "evaluation too large");
    // What is stored must be what the pages can read: the same validation as parseEvaluation, so a bad payload never reaches a page.
    if (!parseEvaluation(b.evaluation)) throw new HttpError(422, "evaluation is malformed", "BAD_EVALUATION");
    return { status: "DONE", evalVersion: b.evalVersion.slice(0, 40), evaluation: b.evaluation as Record<string, unknown> };
  }
  if (b.status === "SKIPPED") return { status: "SKIPPED", reason: typeof b.reason === "string" ? b.reason.slice(0, 200) : "skipped" };
  if (b.status === "FAILED") return { status: "FAILED", error: typeof b.error === "string" ? b.error.slice(0, 500) : "unknown" };
  throw new HttpError(400, "status must be DONE, SKIPPED or FAILED");
}

/** Record a worker's verdict. Only a replay that is still leased to evaluation accepts it. */
export async function submitEvalResult(id: number, r: EvalResult): Promise<{ status: string }> {
  const db = await getDb();
  const [row] = await db.query<{ eval_attempts: number }>("select eval_attempts from user_replay where id = $1 and status = 'READY' and eval_status = 'LEASED'", [id]);
  if (!row) throw new HttpError(409, "job is not in evaluation (lease expired or already finished)", "NOT_LEASED");

  if (r.status === "DONE") {
    await db.query(
      `update user_replay set eval_status = 'DONE', evaluation = $2::jsonb, eval_version = $3, eval_claimed_at = null, eval_error = null
       where id = $1 and eval_status = 'LEASED'`,
      [id, JSON.stringify(r.evaluation), r.evalVersion],
    );
    bumpStats();
    await deleteSourceById(id);                         // evaluation was the last reader of the original file
    return { status: "DONE" };
  }
  if (r.status === "SKIPPED") {
    await db.query("update user_replay set eval_status = 'SKIPPED', eval_error = $2, eval_claimed_at = null where id = $1 and eval_status = 'LEASED'", [id, r.reason]);
    await deleteSourceById(id);
    return { status: "SKIPPED" };
  }
  if (row.eval_attempts >= MAX_ATTEMPTS) {
    await db.query("update user_replay set eval_status = 'FAILED', eval_error = $2, eval_claimed_at = null where id = $1 and eval_status = 'LEASED'", [id, r.error]);
    await deleteSourceById(id);
    return { status: "FAILED" };
  }
  const backoffMin = 2 ** row.eval_attempts;
  await db.query(
    `update user_replay set eval_status = 'PENDING', eval_error = $2, eval_claimed_at = null, eval_available_at = now() + ($3 || ' minutes')::interval
     where id = $1 and eval_status = 'LEASED'`,
    [id, r.error, String(backoffMin)],
  );
  return { status: "PENDING" };
}
