import "server-only";
import { getDb } from "./db";
import { MAX_DELETE_ATTEMPTS, deleteSource, type SourceRow } from "./sources";
import { feedbackRetentionDays, purgeClosedFeedback, type PurgeResult } from "./feedback";
import { auditRetentionDays, purgeAudit } from "./audit";
import { processStorageDeletes, type QueueSweep } from "./storageQueue";
import { flushLedgerOutbox, outboxPending } from "./ledger";
import { deleteObject, listObjects } from "./storage";
import { ledgerObjectTime } from "@/lib/ledger";
import { envDays } from "@/lib/envDays";
import { DUE_INACTIVE_SQL, MARK_INACTIVE_SQL } from "@/lib/inactiveSql";
import { deleteAccount } from "./account";

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
  /** Deletion-ledger files. Must be longer than the backups they have to cover. */
  ledgerDays: number;
  /** An account with no sign-in, session or upload for this long is marked for deletion. */
  inactiveDays: number;
  /** Days between the mark and the deletion; any activity in between lifts the mark. */
  inactiveGraceDays: number;
}

const days = (name: string, fallback: number) => envDays(process.env[name], fallback);

export function retentionConfig(over: Partial<RetentionConfig> = {}): RetentionConfig {
  return {
    readyDays: days("SOURCE_READY_MAX_DAYS", 7),
    failedDays: days("SOURCE_FAILED_MAX_DAYS", 30),
    unsupportedDays: days("SOURCE_UNSUPPORTED_MAX_DAYS", 30),
    stuckDays: days("SOURCE_STUCK_MAX_DAYS", 14),
    feedbackDays: feedbackRetentionDays(),
    linkDays: days("LINK_RETENTION_DAYS", 30),
    auditDays: auditRetentionDays(),
    ledgerDays: days("LEDGER_RETENTION_DAYS", 90),
    inactiveDays: days("INACTIVE_ACCOUNT_DAYS", 730),
    inactiveGraceDays: days("INACTIVE_GRACE_DAYS", 30),
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

export interface InactiveSweep { marked: number; due: number; deleted: number; failed: number }

async function sweepInactiveAccounts(cfg: RetentionConfig, dryRun: boolean): Promise<InactiveSweep> {
  const db = await getDb();
  const idle = String(cfg.inactiveDays), grace = String(cfg.inactiveGraceDays);
  let marked: number;
  if (dryRun) {
    const [r] = await db.query<{ n: number }>("select count(*)::int as n from app_user where deleted_at is null and inactive_notice_at is null and last_active_at < now() - ($1 || ' days')::interval", [idle]);
    marked = r?.n ?? 0;
  } else {
    marked = (await db.query(MARK_INACTIVE_SQL, [idle])).length;
  }
  const due = await db.query<{ id: number }>(DUE_INACTIVE_SQL, [idle, grace]);
  let deleted = 0, failed = 0;
  if (!dryRun) {
    for (const u of due) {
      try { await deleteAccount(u.id); deleted++; } catch { failed++; }              // retried next run
    }
  }
  return { marked, due: due.length, deleted, failed };
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
  /** Accounts idle for years: newly marked, past their grace period, deleted (lib/inactiveSql.ts). */
  inactiveAccounts: InactiveSweep;
  /** The deletion ledger (outside the database) and the acts still waiting to be copied to it. */
  ledger: { files: number; expired: number; deleted: number; outboxPending: number; outboxOldestMinutes: number | null };
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
  const inactiveAccounts = await sweepInactiveAccounts(cfg, dryRun);   // before the storage queue: their files are deleted in this run
  const storageQueue = await processStorageDeletes(500, dryRun);       // last, so files this run just queued are tried in the same run
  if (!dryRun) await flushLedgerOutbox().catch(() => undefined);
  const ob = await outboxPending();
  const ledgerKeys = await listObjects("ledger/").catch(() => [] as string[]);
  const old = ledgerKeys.filter((k) => {
    const t = ledgerObjectTime(k);
    return t !== null && t.getTime() < Date.now() - cfg.ledgerDays * 86400_000;
  });
  let ledgerDeleted = 0;
  if (!dryRun) for (const k of old) { try { await deleteObject(k); ledgerDeleted++; } catch { /* retried next run */ } }
  const ledger = { files: ledgerKeys.length, expired: old.length, deleted: ledgerDeleted, outboxPending: ob.pending, outboxOldestMinutes: ob.oldestMinutes };
  return { dryRun, config: cfg, sources, feedback, deviceLinkRequests, revokedLauncherTokens, auditRows, storageQueue, inactiveAccounts, ledger };
}
