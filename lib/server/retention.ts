import "server-only";
import { getDb } from "./db";
import { MAX_DELETE_ATTEMPTS, deleteSource, type SourceRow } from "./sources";
import { feedbackRetentionDays, purgeClosedFeedback, type PurgeResult } from "./feedback";
import { auditRetentionDays, purgeAudit } from "./audit";
import { processStorageDeletes, type QueueSweep } from "./storageQueue";
import { envDays } from "@/lib/envDays";

/**
 * Automatic deletion by age (docs/Privacy_Compliance_Additional_Plan.md, section 3.3; the values are in
 * docs/Privacy_Data_Inventory.md). One entry point, run daily by a scheduler through POST /api/admin/maintenance/retention.
 * It is safe to run again and again: each task only touches what is past its date, and a dry run (the default) changes nothing.
 */
export interface RetentionConfig {
  /** A READY replay whose evaluation never finished: its original is deleted this many days after the analysis. */
  readyDays: number;
  /** An analysis that failed for good. */
  failedDays: number;
  /** A game build the decoder cannot read yet is kept this long for re-analysis after a decoder update. */
  unsupportedDays: number;
  /** A job still waiting or running this long after the upload. */
  stuckDays: number;
  feedbackDays: number;
  /** Expired device-link requests and revoked launcher tokens are removed after this. */
  linkDays: number;
  /** Operator audit rows. */
  auditDays: number;
}

const days = (name: string, fallback: number) => envDays(process.env[name], fallback);

export function retentionConfig(over: Partial<RetentionConfig> = {}): RetentionConfig {
  return {
    readyDays: days("SOURCE_READY_MAX_DAYS", 7),
    failedDays: days("SOURCE_FAILED_MAX_DAYS", 7),
    unsupportedDays: days("SOURCE_UNSUPPORTED_MAX_DAYS", 30),
    stuckDays: days("SOURCE_STUCK_MAX_DAYS", 14),
    feedbackDays: feedbackRetentionDays(),
    linkDays: days("LINK_RETENTION_DAYS", 30),
    auditDays: auditRetentionDays(),
    ...over,
  };
}

/**
 * Which originals are due, by reason. An original is due when nothing needs it: a rejected one at once, a finished one at once,
 * and the rest at a fixed age. (Event replays kept for a league, A15, will be excluded here by their hold date.)
 */
const DUE_SQL = `
  source_deleted_at is null and source_delete_attempts < $1 and (source_delete_next is null or source_delete_next <= now()) and (
       (status = 'REJECTED' and reject_code <> 'UNSUPPORTED')
    or (status = 'READY' and eval_status in ('DONE','SKIPPED','FAILED'))
    or (status = 'READY' and (eval_status is null or eval_status in ('PENDING','LEASED')) and analyzed_at < now() - ($2 || ' days')::interval)
    or (status = 'FAILED' and coalesce(analyzed_at, uploaded_at) < now() - ($3 || ' days')::interval)
    or (status = 'REJECTED' and reject_code = 'UNSUPPORTED' and uploaded_at < now() - ($4 || ' days')::interval)
    or (status in ('QUEUED','ANALYZING') and uploaded_at < now() - ($5 || ' days')::interval)
  )`;

export interface SourceSweep { due: number; deleted: number; failed: number; gaveUp: number; oldestKeptDays: number | null }

async function sweepSources(cfg: RetentionConfig, dryRun: boolean): Promise<SourceSweep> {
  const db = await getDb();
  const params = [MAX_DELETE_ATTEMPTS, String(cfg.readyDays), String(cfg.failedDays), String(cfg.unsupportedDays), String(cfg.stuckDays)];
  const due = await db.query<SourceRow>(`select id, storage_key, status, eval_status from user_replay where ${DUE_SQL} order by uploaded_at limit 500`, params);
  let deleted = 0, failed = 0;
  if (!dryRun) {
    for (const row of due) {
      if (await deleteSource(row)) deleted++;
      else failed++;
    }
  }
  const [stats] = await db.query<{ gave_up: number; oldest: number | null }>(
    `select count(*) filter (where source_deleted_at is null and source_delete_attempts >= $1)::int as gave_up,
            (extract(epoch from now() - min(uploaded_at) filter (where source_deleted_at is null)) / 86400)::float as oldest
     from user_replay`, [MAX_DELETE_ATTEMPTS]);
  return { due: due.length, deleted, failed, gaveUp: stats?.gave_up ?? 0, oldestKeptDays: stats?.oldest == null ? null : Math.round(stats.oldest * 10) / 10 };
}

export interface RetentionReport {
  dryRun: boolean;
  config: RetentionConfig;
  sources: SourceSweep;
  feedback: PurgeResult;
  deviceLinkRequests: number;
  revokedLauncherTokens: number;
  auditRows: number;
  /** Files of deleted rows still waiting for the storage to confirm their deletion (lib/deleteSql.ts). */
  storageQueue: QueueSweep;
}

export async function runRetention(dryRun: boolean, over: Partial<RetentionConfig> = {}): Promise<RetentionReport> {
  const cfg = retentionConfig(over);
  const db = await getDb();
  const sources = await sweepSources(cfg, dryRun);
  const feedback = await purgeClosedFeedback(cfg.feedbackDays, dryRun);
  const link = String(cfg.linkDays);
  const countOf = async (sql: string) => (await db.query<{ n: number }>(sql, [link]))[0]?.n ?? 0;
  const reqSql = "from device_auth where expires_at < now() - ($1 || ' days')::interval";
  const tokSql = "from device_token where revoked_at is not null and revoked_at < now() - ($1 || ' days')::interval";
  const deviceLinkRequests = await countOf(`select count(*)::int as n ${reqSql}`);
  const revokedLauncherTokens = await countOf(`select count(*)::int as n ${tokSql}`);
  if (!dryRun) {
    await db.query(`delete ${reqSql}`, [link]);
    await db.query(`delete ${tokSql}`, [link]);
  }
  const auditRows = await purgeAudit(cfg.auditDays, dryRun);
  const storageQueue = await processStorageDeletes(500, dryRun);       // last, so files this run just queued are tried in the same run
  return { dryRun, config: cfg, sources, feedback, deviceLinkRequests, revokedLauncherTokens, auditRows, storageQueue };
}
