import "server-only";
import { getDb } from "./db";
import { deleteObject } from "./storage";
import { formatError } from "@/lib/logScrub";

/**
 * The original replay file (docs/Privacy_Compliance_Additional_Plan.md, section 3.1). It holds both players' nicknames, profile
 * handles and chat, so it is kept only as long as a worker still needs it: analysis reads it, then evaluation reads it, and
 * once evaluation has finished (or given up) the file is deleted. What the site keeps is the derived analysis and timeline.
 * A file that nothing finishes with is deleted at a fixed age (lib/server/retention.ts), so no state keeps one forever.
 *
 * Deleting is recorded: `source_deleted_at` is set only after the storage confirms the delete. A failed delete is retried with a
 * growing delay and the error is kept, so a delete is never lost to a restart or an outage.
 */
export const MAX_DELETE_ATTEMPTS = 10;

export interface SourceRow {
  id: number;
  storage_key: string;
  status: string;
  eval_status: string | null;
}

/** Delete one replay's original file now and record it. Returns true when the file is confirmed gone. */
export async function deleteSource(row: SourceRow): Promise<boolean> {
  const db = await getDb();
  try {
    await deleteObject(row.storage_key);
  } catch (e) {
    await db.query(
      `update user_replay set source_delete_attempts = source_delete_attempts + 1, source_delete_error = $2,
              source_delete_next = now() + (power(2, least(source_delete_attempts + 1, 10)) || ' minutes')::interval
       where id = $1 and source_deleted_at is null`,
      [row.id, formatError(e).split("\n")[0].slice(0, 300)],
    );
    return false;
  }
  // The file is gone, so nothing may wait for it any more: a job still queued for it cannot run, an evaluation cannot start.
  await db.query(
    `update user_replay set source_deleted_at = now(), source_delete_error = null, source_delete_next = null,
            status = case when status in ('QUEUED','ANALYZING') then 'FAILED' else status end,
            last_error = case when status in ('QUEUED','ANALYZING') then 'original file expired before it was analysed' else last_error end,
            eval_status = case when status = 'READY' and (eval_status is null or eval_status in ('PENDING','LEASED')) then 'SKIPPED' else eval_status end,
            eval_error = case when status = 'READY' and (eval_status is null or eval_status in ('PENDING','LEASED')) then 'original file expired before evaluation' else eval_error end
     where id = $1 and source_deleted_at is null`,
    [row.id],
  );
  return true;
}

/** Best effort right after a worker finishes with a replay; the retention run retries anything this misses. */
export async function deleteSourceById(id: number): Promise<void> {
  const db = await getDb();
  const [row] = await db.query<SourceRow>("select id, storage_key, status, eval_status from user_replay where id = $1 and source_deleted_at is null", [id]);
  if (row) await deleteSource(row).catch(() => false);
}
