import "server-only";
import { getDb } from "./db";
import { deleteObject } from "./storage";
import { flushLedgerOutbox } from "./ledger";
import { formatError } from "@/lib/logScrub";

/**
 * Files waiting to be deleted (lib/deleteSql.ts explains why the names are queued in the same statement that deletes the rows).
 * A file leaves the queue only after the storage confirmed its deletion. A failed attempt is retried with a growing delay, the error
 * is kept, and after MAX_ATTEMPTS the entry stays as "gave up" for the operator to see (the retention report counts it).
 */
export const MAX_ATTEMPTS = 10;

export interface QueueSweep { due: number; deleted: number; failed: number; gaveUp: number; oldestPendingMinutes: number | null }

export async function processStorageDeletes(limit = 200, dryRun = false): Promise<QueueSweep> {
  const db = await getDb();
  // A key can be reused: the same file uploaded again gets the same name. A queued name that a live row points to again must
  // not be deleted (it would delete the new upload's file), so it leaves the queue without touching the file.
  if (!dryRun) {
    await db.query(
      `delete from storage_delete_queue q where exists (
         select 1 from user_replay u where u.storage_key = q.storage_key or u.timeline_key = q.storage_key)`);
  }
  const due = await db.query<{ storage_key: string }>(
    "select storage_key from storage_delete_queue where attempts < $1 and next_try <= now() order by created_at limit $2", [MAX_ATTEMPTS, limit]);
  let deleted = 0, failed = 0;
  if (!dryRun) {
    for (const { storage_key } of due) {
      try {
        await deleteObject(storage_key);
        await db.query("delete from storage_delete_queue where storage_key = $1", [storage_key]);
        deleted++;
      } catch (e) {
        failed++;
        await db.query(
          `update storage_delete_queue set attempts = attempts + 1, error = $2, next_try = now() + (power(2, least(attempts + 1, 10)) || ' minutes')::interval where storage_key = $1`,
          [storage_key, formatError(e).split("\n")[0].slice(0, 300)]);
      }
    }
  }
  const [s] = await db.query<{ gave_up: number; oldest: number | null }>(
    `select count(*) filter (where attempts >= $1)::int as gave_up, (extract(epoch from now() - min(created_at)) / 60)::float as oldest from storage_delete_queue`, [MAX_ATTEMPTS]);
  return { due: due.length, deleted, failed, gaveUp: s?.gave_up ?? 0, oldestPendingMinutes: s?.oldest == null ? null : Math.round(s.oldest) };
}

/** Run the SQL of lib/deleteSql.ts, then try to delete the queued files right away. The retention run retries whatever fails. */
export async function deleteRowsAndFiles(sql: string, params: unknown[]): Promise<{ deleted: number; filesQueued: number }> {
  const db = await getDb();
  const [r] = await db.query<{ deleted: number; files_queued: number }>(sql, params);
  if (r?.files_queued) await processStorageDeletes().catch(() => undefined);
  if (r?.deleted) await flushLedgerOutbox().catch(() => undefined);     // copy the act to the ledger outside the database
  return { deleted: r?.deleted ?? 0, filesQueued: r?.files_queued ?? 0 };
}

/** Queue files that no row will point to any more, and try to delete them now. */
export async function enqueueDelete(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const db = await getDb();
  await db.query("insert into storage_delete_queue (storage_key) select unnest($1::text[]) on conflict do nothing", [keys]);
  await processStorageDeletes().catch(() => undefined);
}
